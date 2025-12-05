/**
 * Query class - Main orchestrator for SDK
 *
 * Manages SDK workflow, routes messages, and handles lifecycle.
 * Implements AsyncIterator protocol for message consumption.
 */

const PERMISSION_CALLBACK_TIMEOUT = 30000;
const MCP_REQUEST_TIMEOUT = 30000;
const CONTROL_REQUEST_TIMEOUT = 30000;
const STREAM_CLOSE_TIMEOUT = 10000;

import { randomUUID } from 'node:crypto';
import { SdkLogger } from '../utils/logger.js';
import type {
  SDKMessage,
  SDKUserMessage,
  CLIControlRequest,
  CLIControlResponse,
  ControlCancelRequest,
  PermissionSuggestion,
} from '../types/protocol.js';
import {
  isSDKUserMessage,
  isSDKAssistantMessage,
  isSDKSystemMessage,
  isSDKResultMessage,
  isSDKPartialAssistantMessage,
  isControlRequest,
  isControlResponse,
  isControlCancel,
} from '../types/protocol.js';
import type { Transport } from '../transport/Transport.js';
import type { QueryOptions } from '../types/types.js';
import { Stream } from '../utils/Stream.js';
import { serializeJsonLine } from '../utils/jsonLines.js';
import { AbortError } from '../types/errors.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { SdkControlServerTransport } from '../mcp/SdkControlServerTransport.js';
import { ControlRequestType } from '../types/protocol.js';

interface PendingControlRequest {
  resolve: (response: Record<string, unknown> | null) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  abortController: AbortController;
}

interface TransportWithEndInput extends Transport {
  endInput(): void;
}

const logger = SdkLogger.createLogger('Query');

export class Query implements AsyncIterable<SDKMessage> {
  private transport: Transport;
  private options: QueryOptions;
  private sessionId: string;
  private inputStream: Stream<SDKMessage>;
  private sdkMessages: AsyncGenerator<SDKMessage>;
  private abortController: AbortController;
  private pendingControlRequests: Map<string, PendingControlRequest> =
    new Map();
  private sdkMcpTransports: Map<string, SdkControlServerTransport> = new Map();
  readonly initialized: Promise<void>;
  private closed = false;
  private messageRouterStarted = false;

  private firstResultReceivedPromise?: Promise<void>;
  private firstResultReceivedResolve?: () => void;

  private readonly isSingleTurn: boolean;

  constructor(
    transport: Transport,
    options: QueryOptions,
    singleTurn: boolean = false,
  ) {
    this.transport = transport;
    this.options = options;
    this.sessionId = randomUUID();
    this.inputStream = new Stream<SDKMessage>();
    this.abortController = options.abortController ?? new AbortController();
    this.isSingleTurn = singleTurn;

    /**
     * Create async generator proxy to ensure stream.next() is called at least once.
     * The generator will start iterating when the user begins iteration.
     * This ensures readResolve/readReject are set up as soon as iteration starts.
     * If errors occur before iteration starts, they'll be stored in hasError and
     * properly rejected when the user starts iterating.
     */
    this.sdkMessages = this.readSdkMessages();

    this.firstResultReceivedPromise = new Promise((resolve) => {
      this.firstResultReceivedResolve = resolve;
    });

    /**
     * Handle abort signal if controller is provided and already aborted or will be aborted.
     * If already aborted, set error immediately. Otherwise, listen for abort events
     * and set abort error on the stream before closing.
     */
    if (this.abortController.signal.aborted) {
      this.inputStream.error(new AbortError('Query aborted by user'));
      this.close().catch((err) => {
        logger.error('Error during abort cleanup:', err);
      });
    } else {
      this.abortController.signal.addEventListener('abort', () => {
        this.inputStream.error(new AbortError('Query aborted by user'));
        this.close().catch((err) => {
          logger.error('Error during abort cleanup:', err);
        });
      });
    }

    this.initialized = this.initialize();
    this.initialized.catch(() => {});

    this.startMessageRouter();
  }

  private async initialize(): Promise<void> {
    try {
      logger.debug('Initializing Query');

      const sdkMcpServerNames = Array.from(this.sdkMcpTransports.keys());

      await this.sendControlRequest(ControlRequestType.INITIALIZE, {
        hooks: null,
        sdkMcpServers:
          sdkMcpServerNames.length > 0 ? sdkMcpServerNames : undefined,
        mcpServers: this.options.mcpServers,
        agents: this.options.agents,
      });
      logger.info('Query initialized successfully');
    } catch (error) {
      logger.error('Initialization error:', error);
      throw error;
    }
  }

  private startMessageRouter(): void {
    if (this.messageRouterStarted) {
      return;
    }

    this.messageRouterStarted = true;

    (async () => {
      try {
        for await (const message of this.transport.readMessages()) {
          await this.routeMessage(message);

          if (this.closed) {
            break;
          }
        }

        if (this.abortController.signal.aborted) {
          this.inputStream.error(new AbortError('Query aborted'));
        } else {
          this.inputStream.done();
        }
      } catch (error) {
        this.inputStream.error(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    })();
  }

  private async routeMessage(message: unknown): Promise<void> {
    if (isControlRequest(message)) {
      await this.handleControlRequest(message);
      return;
    }

    if (isControlResponse(message)) {
      this.handleControlResponse(message);
      return;
    }

    if (isControlCancel(message)) {
      this.handleControlCancelRequest(message);
      return;
    }

    if (isSDKSystemMessage(message)) {
      /**
       * SystemMessage contains session info (cwd, tools, model, etc.)
       * that should be passed to user.
       */
      this.inputStream.enqueue(message);
      return;
    }

    if (isSDKResultMessage(message)) {
      if (this.firstResultReceivedResolve) {
        this.firstResultReceivedResolve();
      }
      /**
       * In single-turn mode, automatically close input after receiving result
       * to signal completion to the CLI.
       */
      if (this.isSingleTurn && 'endInput' in this.transport) {
        (this.transport as TransportWithEndInput).endInput();
      }
      this.inputStream.enqueue(message);
      return;
    }

    if (
      isSDKAssistantMessage(message) ||
      isSDKUserMessage(message) ||
      isSDKPartialAssistantMessage(message)
    ) {
      this.inputStream.enqueue(message);
      return;
    }

    logger.warn('Unknown message type:', message);
    this.inputStream.enqueue(message as SDKMessage);
  }

  private async handleControlRequest(
    request: CLIControlRequest,
  ): Promise<void> {
    const { request_id, request: payload } = request;

    logger.debug(`Handling control request: ${payload.subtype}`);
    const requestAbortController = new AbortController();

    try {
      let response: Record<string, unknown> | null = null;

      switch (payload.subtype) {
        case 'can_use_tool':
          response = await this.handlePermissionRequest(
            payload.tool_name,
            payload.input as Record<string, unknown>,
            payload.permission_suggestions,
            requestAbortController.signal,
          );
          break;

        case 'mcp_message':
          response = await this.handleMcpMessage(
            payload.server_name,
            payload.message as unknown as JSONRPCMessage,
          );
          break;

        default:
          throw new Error(
            `Unknown control request subtype: ${payload.subtype}`,
          );
      }

      await this.sendControlResponse(request_id, true, response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Control request error (${payload.subtype}):`, errorMessage);
      await this.sendControlResponse(request_id, false, errorMessage);
    }
  }

  private async handlePermissionRequest(
    toolName: string,
    toolInput: Record<string, unknown>,
    permissionSuggestions: PermissionSuggestion[] | null,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    /* Default deny all wildcard tool requests */
    if (!this.options.canUseTool) {
      return { behavior: 'deny', message: 'Denied' };
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Permission callback timeout')),
          PERMISSION_CALLBACK_TIMEOUT,
        );
      });

      const result = await Promise.race([
        Promise.resolve(
          this.options.canUseTool(toolName, toolInput, {
            signal,
            suggestions: permissionSuggestions,
          }),
        ),
        timeoutPromise,
      ]);

      if (result.behavior === 'allow') {
        return {
          behavior: 'allow',
          updatedInput: result.updatedInput ?? toolInput,
        };
      } else {
        return {
          behavior: 'deny',
          message: result.message ?? 'Denied',
          ...(result.interrupt !== undefined
            ? { interrupt: result.interrupt }
            : {}),
        };
      }
    } catch (error) {
      /**
       * Timeout or error → deny (fail-safe).
       * This ensures that any issues with the permission callback
       * result in a safe default of denying access.
       */
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.warn(
        'Permission callback error (denying by default):',
        errorMessage,
      );
      return {
        behavior: 'deny',
        message: `Permission check failed: ${errorMessage}`,
      };
    }
  }

  private async handleMcpMessage(
    serverName: string,
    message: JSONRPCMessage,
  ): Promise<Record<string, unknown>> {
    const transport = this.sdkMcpTransports.get(serverName);
    if (!transport) {
      throw new Error(
        `MCP server '${serverName}' not found in SDK-embedded servers`,
      );
    }

    /**
     * Check if this is a request (has method and id) or notification.
     * Requests need to wait for a response, while notifications are just routed.
     */
    const isRequest =
      'method' in message && 'id' in message && message.id !== null;

    if (isRequest) {
      const response = await this.handleMcpRequest(
        serverName,
        message,
        transport,
      );
      return { mcp_response: response };
    } else {
      transport.handleMessage(message);
      return { mcp_response: { jsonrpc: '2.0', result: {}, id: 0 } };
    }
  }

  private handleMcpRequest(
    _serverName: string,
    message: JSONRPCMessage,
    transport: SdkControlServerTransport,
  ): Promise<JSONRPCMessage> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MCP request timeout'));
      }, MCP_REQUEST_TIMEOUT);

      const messageId = 'id' in message ? message.id : null;

      /**
       * Hook into transport to capture response.
       * Temporarily replace sendToQuery to intercept the response message
       * matching this request's ID, then restore the original handler.
       */
      const originalSend = transport.sendToQuery;
      transport.sendToQuery = async (responseMessage: JSONRPCMessage) => {
        if ('id' in responseMessage && responseMessage.id === messageId) {
          clearTimeout(timeout);
          transport.sendToQuery = originalSend;
          resolve(responseMessage);
        }
        return originalSend(responseMessage);
      };

      transport.handleMessage(message);
    });
  }

  private handleControlResponse(response: CLIControlResponse): void {
    const { response: payload } = response;
    const request_id = payload.request_id;

    const pending = this.pendingControlRequests.get(request_id);
    if (!pending) {
      logger.warn(
        'Received response for unknown request:',
        request_id,
        JSON.stringify(payload),
      );
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingControlRequests.delete(request_id);

    if (payload.subtype === 'success') {
      logger.debug(
        `Control response success for request: ${request_id}: ${JSON.stringify(payload.response)}`,
      );
      pending.resolve(payload.response as Record<string, unknown> | null);
    } else {
      /**
       * Extract error message from error field.
       * Error can be either a string or an object with a message property.
       */
      const errorMessage =
        typeof payload.error === 'string'
          ? payload.error
          : (payload.error?.message ?? 'Unknown error');
      logger.error(
        `Control response error for request ${request_id}:`,
        errorMessage,
      );
      pending.reject(new Error(errorMessage));
    }
  }

  private handleControlCancelRequest(request: ControlCancelRequest): void {
    const { request_id } = request;

    if (!request_id) {
      logger.warn('Received cancel request without request_id');
      return;
    }

    const pending = this.pendingControlRequests.get(request_id);
    if (pending) {
      logger.debug(`Cancelling control request: ${request_id}`);
      pending.abortController.abort();
      clearTimeout(pending.timeout);
      this.pendingControlRequests.delete(request_id);
      pending.reject(new AbortError('Request cancelled'));
    }
  }

  private async sendControlRequest(
    subtype: string,
    data: Record<string, unknown> = {},
  ): Promise<Record<string, unknown> | null> {
    const requestId = randomUUID();

    const request: CLIControlRequest = {
      type: 'control_request',
      request_id: requestId,
      request: {
        subtype: subtype as never,
        ...data,
      } as CLIControlRequest['request'],
    };

    const responsePromise = new Promise<Record<string, unknown> | null>(
      (resolve, reject) => {
        const abortController = new AbortController();
        const timeout = setTimeout(() => {
          this.pendingControlRequests.delete(requestId);
          reject(new Error(`Control request timeout: ${subtype}`));
        }, CONTROL_REQUEST_TIMEOUT);

        this.pendingControlRequests.set(requestId, {
          resolve,
          reject,
          timeout,
          abortController,
        });
      },
    );

    this.transport.write(serializeJsonLine(request));
    return responsePromise;
  }

  private async sendControlResponse(
    requestId: string,
    success: boolean,
    responseOrError: Record<string, unknown> | null | string,
  ): Promise<void> {
    const response: CLIControlResponse = {
      type: 'control_response',
      response: success
        ? {
            subtype: 'success',
            request_id: requestId,
            response: responseOrError as Record<string, unknown> | null,
          }
        : {
            subtype: 'error',
            request_id: requestId,
            error: responseOrError as string,
          },
    };

    this.transport.write(serializeJsonLine(response));
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;

    for (const pending of this.pendingControlRequests.values()) {
      pending.abortController.abort();
      clearTimeout(pending.timeout);
    }
    this.pendingControlRequests.clear();

    await this.transport.close();

    /**
     * Complete input stream - check if aborted first.
     * Only set error/done if stream doesn't already have an error state.
     */
    if (this.inputStream.hasError === undefined) {
      if (this.abortController.signal.aborted) {
        this.inputStream.error(new AbortError('Query aborted'));
      } else {
        this.inputStream.done();
      }
    }

    for (const transport of this.sdkMcpTransports.values()) {
      try {
        await transport.close();
      } catch (error) {
        logger.error('Error closing MCP transport:', error);
      }
    }
    this.sdkMcpTransports.clear();
    logger.info('Query closed');
  }

  private async *readSdkMessages(): AsyncGenerator<SDKMessage> {
    for await (const message of this.inputStream) {
      yield message;
    }
  }

  async next(...args: [] | [unknown]): Promise<IteratorResult<SDKMessage>> {
    return this.sdkMessages.next(...args);
  }

  async return(value?: unknown): Promise<IteratorResult<SDKMessage>> {
    return this.sdkMessages.return(value);
  }

  async throw(e?: unknown): Promise<IteratorResult<SDKMessage>> {
    return this.sdkMessages.throw(e);
  }

  [Symbol.asyncIterator](): AsyncIterator<SDKMessage> {
    return this.sdkMessages;
  }

  async streamInput(messages: AsyncIterable<SDKUserMessage>): Promise<void> {
    if (this.closed) {
      throw new Error('Query is closed');
    }

    try {
      /**
       * Wait for initialization to complete before sending messages.
       * This prevents "write after end" errors when streamInput is called
       * with an empty iterable before initialization finishes.
       */
      await this.initialized;

      for await (const message of messages) {
        if (this.abortController.signal.aborted) {
          break;
        }
        this.transport.write(serializeJsonLine(message));
      }

      /**
       * In multi-turn mode with MCP servers, wait for first result
       * to ensure MCP servers have time to process before next input.
       * This prevents race conditions where the next input arrives before
       * MCP servers have finished processing the current request.
       */
      if (
        !this.isSingleTurn &&
        this.sdkMcpTransports.size > 0 &&
        this.firstResultReceivedPromise
      ) {
        await Promise.race([
          this.firstResultReceivedPromise,
          new Promise<void>((resolve) => {
            setTimeout(() => {
              resolve();
            }, STREAM_CLOSE_TIMEOUT);
          }),
        ]);
      }

      this.endInput();
    } catch (error) {
      if (this.abortController.signal.aborted) {
        logger.info('Aborted during input streaming');
        this.inputStream.error(
          new AbortError('Query aborted during input streaming'),
        );
        return;
      }
      throw error;
    }
  }

  endInput(): void {
    if (this.closed) {
      throw new Error('Query is closed');
    }

    if (
      'endInput' in this.transport &&
      typeof this.transport.endInput === 'function'
    ) {
      (this.transport as TransportWithEndInput).endInput();
    }
  }

  async interrupt(): Promise<void> {
    if (this.closed) {
      throw new Error('Query is closed');
    }

    await this.sendControlRequest(ControlRequestType.INTERRUPT);
  }

  async setPermissionMode(mode: string): Promise<void> {
    if (this.closed) {
      throw new Error('Query is closed');
    }

    await this.sendControlRequest(ControlRequestType.SET_PERMISSION_MODE, {
      mode,
    });
  }

  async setModel(model: string): Promise<void> {
    if (this.closed) {
      throw new Error('Query is closed');
    }

    await this.sendControlRequest(ControlRequestType.SET_MODEL, { model });
  }

  /**
   * Get list of control commands supported by the CLI
   *
   * @returns Promise resolving to list of supported command names
   * @throws Error if query is closed
   */
  async supportedCommands(): Promise<Record<string, unknown> | null> {
    if (this.closed) {
      throw new Error('Query is closed');
    }

    return this.sendControlRequest(ControlRequestType.SUPPORTED_COMMANDS);
  }

  /**
   * Get the status of MCP servers
   *
   * @returns Promise resolving to MCP server status information
   * @throws Error if query is closed
   */
  async mcpServerStatus(): Promise<Record<string, unknown> | null> {
    if (this.closed) {
      throw new Error('Query is closed');
    }

    return this.sendControlRequest(ControlRequestType.MCP_SERVER_STATUS);
  }

  getSessionId(): string {
    return this.sessionId;
  }

  isClosed(): boolean {
    return this.closed;
  }
}
