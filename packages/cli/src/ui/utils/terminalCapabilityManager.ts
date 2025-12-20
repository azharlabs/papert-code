/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import {
  debugLogger,
  enableKittyKeyboardProtocol,
  disableKittyKeyboardProtocol,
} from '@papert-code/papert-code-core';

export type TerminalBackgroundColor = string | undefined;

export class TerminalCapabilityManager {
  private static instance: TerminalCapabilityManager | undefined;

  private static readonly KITTY_QUERY = '\x1b[?u';
  private static readonly OSC_11_QUERY = '\x1b]11;?\x1b\\';
  private static readonly TERMINAL_NAME_QUERY = '\x1b[>q';
  private static readonly DEVICE_ATTRIBUTES_QUERY = '\x1b[c';

  // Kitty keyboard flags: CSI ? flags u
  // eslint-disable-next-line no-control-regex
  private static readonly KITTY_REGEX = /\x1b\[\?(\d+)u/;
  // Terminal Name/Version response: DCS > | text ST (or BEL)
  // eslint-disable-next-line no-control-regex
  private static readonly TERMINAL_NAME_REGEX = /\x1bP>\|(.+?)(\x1b\\|\x07)/;
  // Primary Device Attributes: CSI ? ID ; ... c
  // eslint-disable-next-line no-control-regex
  private static readonly DEVICE_ATTRIBUTES_REGEX = /\x1b\[\?(\d+)(;\d+)*c/;
  // OSC 11 response: OSC 11 ; rgb:rrrr/gggg/bbbb ST (or BEL)
  private static readonly OSC_11_REGEX =
    // eslint-disable-next-line no-control-regex
    /\x1b\]11;rgb:([0-9a-fA-F]{1,4})\/([0-9a-fA-F]{1,4})\/([0-9a-fA-F]{1,4})(\x1b\\|\x07)?/;

  private terminalBackgroundColor: TerminalBackgroundColor;
  private kittySupported = false;
  private kittyEnabled = false;
  private detectionComplete = false;
  private terminalName: string | undefined;

  private constructor() {}

  static getInstance(): TerminalCapabilityManager {
    if (!this.instance) {
      this.instance = new TerminalCapabilityManager();
    }
    return this.instance;
  }

  static resetInstanceForTesting(): void {
    this.instance = undefined;
  }

  /**
   * Detects terminal capabilities (Kitty protocol support, terminal name,
   * background color).
   * This should be called once at app startup.
   */
  async detectCapabilities(): Promise<void> {
    if (this.detectionComplete) return;

    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      this.detectionComplete = true;
      return;
    }

    return new Promise((resolve) => {
      const originalRawMode = process.stdin.isRaw;
      if (!originalRawMode) {
        process.stdin.setRawMode(true);
      }

      let buffer = '';
      let kittyKeyboardReceived = false;
      let terminalNameReceived = false;
      let deviceAttributesReceived = false;
      let bgReceived = false;
      // eslint-disable-next-line prefer-const
      let timeoutId: NodeJS.Timeout;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        process.stdin.removeListener('data', onData);
        if (!originalRawMode) {
          process.stdin.setRawMode(false);
        }
        this.detectionComplete = true;

        // Auto-enable kitty if supported
        if (this.kittySupported) {
          this.enableKittyProtocol();
          process.on('exit', () => this.disableKittyProtocol());
          process.on('SIGTERM', () => this.disableKittyProtocol());
        }

        resolve();
      };

      const onTimeout = () => {
        cleanup();
      };

      // A somewhat long timeout is acceptable as all terminals should respond
      // to the device attributes query used as a sentinel.
      timeoutId = setTimeout(onTimeout, 1000);

      const onData = (data: Buffer) => {
        buffer += data.toString();

        // Check OSC 11
        if (!bgReceived) {
          const match = buffer.match(TerminalCapabilityManager.OSC_11_REGEX);
          if (match) {
            bgReceived = true;
            this.terminalBackgroundColor = this.parseColor(
              match[1],
              match[2],
              match[3],
            );
          }
        }

        // Check Kitty keyboard
        if (!kittyKeyboardReceived) {
          const match = buffer.match(TerminalCapabilityManager.KITTY_REGEX);
          if (match) {
            kittyKeyboardReceived = true;
            this.kittySupported = true;
            if (deviceAttributesReceived && terminalNameReceived && bgReceived) {
              cleanup();
            }
          }
        }

        // Check terminal name/version
        if (!terminalNameReceived) {
          const match = buffer.match(
            TerminalCapabilityManager.TERMINAL_NAME_REGEX,
          );
          if (match && match[1]) {
            terminalNameReceived = true;
            this.terminalName = match[1].trim();
            if (deviceAttributesReceived && kittyKeyboardReceived && bgReceived) {
              cleanup();
            }
          }
        }

        // Check device attributes (sentinel)
        if (!deviceAttributesReceived) {
          const match = buffer.match(
            TerminalCapabilityManager.DEVICE_ATTRIBUTES_REGEX,
          );
          if (match) {
            deviceAttributesReceived = true;
            if (
              kittyKeyboardReceived &&
              terminalNameReceived &&
              (bgReceived || !this.shouldQueryBackgroundColor())
            ) {
              cleanup();
            }
          }
        }
      };

      process.stdin.on('data', onData);

      // Query background color (OSC 11)
      if (this.shouldQueryBackgroundColor()) {
        process.stdout.write(TerminalCapabilityManager.OSC_11_QUERY);
      } else {
        bgReceived = true; // skip
      }
      // Query Kitty keyboard support
      process.stdout.write(TerminalCapabilityManager.KITTY_QUERY);
      // Query terminal name/version
      process.stdout.write(TerminalCapabilityManager.TERMINAL_NAME_QUERY);
      // Query device attributes (sentinel)
      process.stdout.write(TerminalCapabilityManager.DEVICE_ATTRIBUTES_QUERY);
    });
  }

  getTerminalBackgroundColor(): TerminalBackgroundColor {
    return this.terminalBackgroundColor;
  }

  isKittyProtocolSupported(): boolean {
    return this.kittySupported;
  }

  isKittyProtocolEnabled(): boolean {
    return this.kittyEnabled;
  }

  getTerminalName(): string | undefined {
    return this.terminalName;
  }

  enableKittyProtocol(): void {
    if (this.kittySupported && !this.kittyEnabled) {
      enableKittyKeyboardProtocol();
      this.kittyEnabled = true;
    }
  }

  disableKittyProtocol(): void {
    if (this.kittyEnabled) {
      disableKittyKeyboardProtocol();
      this.kittyEnabled = false;
    }
  }

  /**
   * Determines whether to query background color based on terminal support.
   */
  private shouldQueryBackgroundColor(): boolean {
    // Skip OSC 11 on Windows terminals that don't support it.
    if (process.platform === 'win32') {
      // Common Windows terminals that don't support OSC 11
      const unsupportedTerminals = ['Windows Terminal', 'Alacritty', 'WezTerm'];
      const termProgram = process.env['TERM_PROGRAM'];
      if (termProgram && unsupportedTerminals.includes(termProgram)) {
        debugLogger.debug('Skipping OSC 11 query on unsupported terminal');
        return false;
      }
    }
    return true;
  }

  /**
   * Parses RGB values from OSC 11 response and converts to hex color.
   */
  private parseColor(
    r: string,
    g: string,
    b: string,
  ): TerminalBackgroundColor {
    try {
      const rVal = parseInt(r, 16);
      const gVal = parseInt(g, 16);
      const bVal = parseInt(b, 16);
      return `#${rVal.toString(16).padStart(2, '0')}${gVal
        .toString(16)
        .padStart(2, '0')}${bVal.toString(16).padStart(2, '0')}`;
    } catch (error) {
      debugLogger.warn('Failed to parse OSC 11 color:', error);
      return undefined;
    }
  }
}

export const terminalCapabilityManager = TerminalCapabilityManager.getInstance();
