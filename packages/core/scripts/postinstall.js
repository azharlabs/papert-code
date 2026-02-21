#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 Papert
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageRoot = path.join(__dirname, '..');
const defaultVendorDir = path.join(packageRoot, 'vendor', 'ripgrep');
const MIN_NODE_MAJOR = 20;

function getLogLabel(level) {
  return `[postinstall] ${level.toUpperCase()}:`;
}

function safeMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

function parseNodeMajor(version) {
  const [major] = version.split('.');
  return Number.parseInt(major ?? '0', 10);
}

function normalizeArch(arch) {
  if (arch === 'x64' || arch === 'arm64') {
    return arch;
  }
  return null;
}

function normalizePlatform(platform) {
  if (platform === 'darwin' || platform === 'linux' || platform === 'win32') {
    return platform;
  }
  return null;
}

export function resolveBundledRipgrepBinary({
  platform,
  arch,
  vendorDir,
  fsModule = fs,
}) {
  const normalizedPlatform = normalizePlatform(platform);
  const normalizedArch = normalizeArch(arch);

  if (!normalizedPlatform) {
    return {
      binaryPath: null,
      reason: `unsupported platform ${platform}`,
    };
  }

  if (!normalizedArch) {
    return {
      binaryPath: null,
      reason: `unsupported architecture ${arch}`,
    };
  }

  if (!fsModule.existsSync(vendorDir)) {
    return {
      binaryPath: null,
      reason: `vendor directory not found at ${vendorDir}`,
    };
  }

  const binaryDir = path.join(vendorDir, `${normalizedArch}-${normalizedPlatform}`);
  const binaryName = normalizedPlatform === 'win32' ? 'rg.exe' : 'rg';
  const binaryPath = path.join(binaryDir, binaryName);

  if (!fsModule.existsSync(binaryDir)) {
    return {
      binaryPath: null,
      reason: `binary directory not found for ${normalizedArch}-${normalizedPlatform}`,
    };
  }

  if (!fsModule.existsSync(binaryPath)) {
    return {
      binaryPath: null,
      reason: `bundled ripgrep binary missing at ${binaryPath}`,
    };
  }

  return {
    binaryPath,
    reason: null,
  };
}

export function getPlatformGuidance(platform, binaryPath) {
  if (platform === 'darwin') {
    return [
      'macOS guidance:',
      `- If execution is blocked, run: xattr -dr com.apple.quarantine "${binaryPath ?? '<path-to-rg>'}"`,
      `- Ensure executable permissions: chmod +x "${binaryPath ?? '<path-to-rg>'}"`,
    ];
  }

  if (platform === 'linux') {
    return [
      'Linux guidance:',
      `- Ensure executable permissions: chmod +x "${binaryPath ?? '<path-to-rg>'}"`,
      '- If bundled binary is unavailable, install ripgrep from your distro packages and ensure "rg" is on PATH.',
    ];
  }

  if (platform === 'win32') {
    return [
      'Windows guidance:',
      '- If ripgrep is blocked, allow it in SmartScreen/antivirus and retry.',
      '- If needed, install ripgrep and ensure "rg.exe" is available on PATH.',
    ];
  }

  return [
    'General guidance:',
    '- Ensure ripgrep is installed and executable in your environment.',
  ];
}

export function setupBundledRipgrep({
  platform = process.platform,
  arch = process.arch,
  vendorDir = defaultVendorDir,
  fsModule = fs,
  execCommand = execSync,
  logger = console,
} = {}) {
  const warnings = [];
  const checks = [];

  const resolved = resolveBundledRipgrepBinary({
    platform,
    arch,
    vendorDir,
    fsModule,
  });

  if (!resolved.binaryPath) {
    const reason = resolved.reason ?? 'bundled ripgrep unavailable';
    checks.push(reason);
    logger.log(`${getLogLabel('info')} ${reason}; falling back to system ripgrep checks.`);
    return {
      binaryPath: null,
      warnings,
      checks,
    };
  }

  const binaryPath = resolved.binaryPath;

  if (platform !== 'win32') {
    try {
      fsModule.chmodSync(binaryPath, 0o755);
      checks.push(`set executable permissions on ${binaryPath}`);
      logger.log(`${getLogLabel('info')} set executable permissions on ${binaryPath}`);
    } catch (error) {
      const warning = `could not set executable permissions on ${binaryPath}: ${safeMessage(error)}`;
      warnings.push(warning);
      logger.warn(`${getLogLabel('warn')} ${warning}`);
    }
  }

  if (platform === 'darwin') {
    try {
      execCommand(`xattr -d com.apple.quarantine "${binaryPath}"`, {
        stdio: 'pipe',
      });
      checks.push(`cleared quarantine attribute on ${binaryPath}`);
      logger.log(`${getLogLabel('info')} cleared quarantine attribute on ${binaryPath}`);
    } catch {
      checks.push('quarantine attribute not present or could not be removed');
      logger.log(
        `${getLogLabel('info')} quarantine attribute not present or could not be removed`,
      );
    }
  }

  return {
    binaryPath,
    warnings,
    checks,
  };
}

export function runPostInstallHealthChecks({
  platform = process.platform,
  nodeVersion = process.versions.node,
  binaryPath,
  fsModule = fs,
  execCommand = execSync,
  logger = console,
} = {}) {
  const warnings = [];
  const checks = [];
  const nodeMajor = parseNodeMajor(nodeVersion);

  if (Number.isFinite(nodeMajor) && nodeMajor < MIN_NODE_MAJOR) {
    const warning = `Node.js ${nodeVersion} detected; Papert Code is tested on Node.js ${MIN_NODE_MAJOR}+.`;
    warnings.push(warning);
    logger.warn(`${getLogLabel('warn')} ${warning}`);
  } else {
    checks.push(`Node.js version ${nodeVersion} is supported`);
    logger.log(`${getLogLabel('info')} Node.js version ${nodeVersion} is supported`);
  }

  if (binaryPath) {
    const accessMode =
      platform === 'win32' ? fsModule.constants.F_OK : fsModule.constants.X_OK;

    try {
      fsModule.accessSync(binaryPath, accessMode);
      checks.push(`bundled ripgrep is accessible at ${binaryPath}`);
      logger.log(`${getLogLabel('info')} bundled ripgrep is accessible at ${binaryPath}`);
    } catch (error) {
      const warning = `bundled ripgrep is not accessible at ${binaryPath}: ${safeMessage(error)}`;
      warnings.push(warning);
      logger.warn(`${getLogLabel('warn')} ${warning}`);
    }

    try {
      execCommand(`"${binaryPath}" --version`, { stdio: 'pipe' });
      checks.push('bundled ripgrep version check passed');
      logger.log(`${getLogLabel('info')} bundled ripgrep version check passed`);
    } catch (error) {
      const warning = `bundled ripgrep failed version check: ${safeMessage(error)}`;
      warnings.push(warning);
      logger.warn(`${getLogLabel('warn')} ${warning}`);
    }

    return { warnings, checks };
  }

  try {
    execCommand('rg --version', { stdio: 'pipe' });
    checks.push('system ripgrep is available on PATH');
    logger.log(`${getLogLabel('info')} system ripgrep is available on PATH`);
  } catch (error) {
    const warning =
      'ripgrep is not available on PATH and no bundled binary was detected.';
    warnings.push(`${warning} (${safeMessage(error)})`);
    logger.warn(`${getLogLabel('warn')} ${warning}`);
  }

  return { warnings, checks };
}

export function runPostinstall({
  platform = process.platform,
  arch = process.arch,
  nodeVersion = process.versions.node,
  vendorDir = defaultVendorDir,
  fsModule = fs,
  execCommand = execSync,
  logger = console,
} = {}) {
  try {
    const setup = setupBundledRipgrep({
      platform,
      arch,
      vendorDir,
      fsModule,
      execCommand,
      logger,
    });

    const health = runPostInstallHealthChecks({
      platform,
      nodeVersion,
      binaryPath: setup.binaryPath,
      fsModule,
      execCommand,
      logger,
    });

    const warnings = [...setup.warnings, ...health.warnings];
    if (warnings.length === 0) {
      logger.log(`${getLogLabel('info')} post-install checks completed successfully`);
      return { warnings, checks: [...setup.checks, ...health.checks] };
    }

    logger.warn(
      `${getLogLabel('warn')} post-install completed with ${warnings.length} warning(s).`,
    );

    const guidance = getPlatformGuidance(platform, setup.binaryPath);
    for (const line of guidance) {
      logger.log(`${getLogLabel('info')} ${line}`);
    }

    return {
      warnings,
      checks: [...setup.checks, ...health.checks],
    };
  } catch (error) {
    logger.warn(
      `${getLogLabel('warn')} unexpected post-install error: ${safeMessage(error)}`,
    );
    logger.log(`${getLogLabel('info')} continuing without blocking installation`);
    return {
      warnings: [safeMessage(error)],
      checks: [],
    };
  }
}

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  runPostinstall();
}
