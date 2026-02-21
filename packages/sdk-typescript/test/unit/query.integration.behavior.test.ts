import { describe, expect, it, vi } from "vitest";
import { Query } from "../../src/query/Query.js";
import type { Transport } from "../../src/transport/Transport.js";
import type {
  CLIControlRequest,
  CLIControlResponse,
  ControlCancelRequest,
} from "../../src/types/protocol.js";
import { AbortError } from "../../src/types/errors.js";
import { Stream } from "../../src/utils/Stream.js";

class MockTransport implements Transport {
  private messageStream = new Stream<unknown>();
  public writtenMessages: string[] = [];
  public closed = false;

  write(data: string): void {
    this.writtenMessages.push(data);
  }

  async *readMessages(): AsyncGenerator<unknown, void, unknown> {
    for await (const message of this.messageStream) {
      yield message;
    }
  }

  simulateMessage(message: unknown): void {
    this.messageStream.enqueue(message);
  }

  getLastWrittenMessage(): unknown {
    if (this.writtenMessages.length === 0) {
      return null;
    }
    return JSON.parse(this.writtenMessages[this.writtenMessages.length - 1]);
  }

  getAllWrittenMessages(): unknown[] {
    return this.writtenMessages.map((item) => JSON.parse(item));
  }

  async close(): Promise<void> {
    this.closed = true;
    this.messageStream.done();
  }

  async waitForExit(): Promise<void> {
    return;
  }

  endInput(): void {
    return;
  }
}

function createControlResponse(
  requestId: string,
  success: boolean,
  data?: Record<string, unknown>,
): CLIControlResponse {
  return {
    type: "control_response",
    response: success
      ? {
          subtype: "success",
          request_id: requestId,
          response: data ?? null,
        }
      : {
          subtype: "error",
          request_id: requestId,
          error: "error",
        },
  };
}

function createControlCancel(requestId: string): ControlCancelRequest {
  return {
    type: "control_cancel_request",
    request_id: requestId,
  };
}

function findControlResponse(
  messages: unknown[],
  requestId: string,
): CLIControlResponse | undefined {
  return messages.find(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "type" in item &&
      item.type === "control_response" &&
      "response" in item &&
      typeof item.response === "object" &&
      item.response !== null &&
      "request_id" in item.response &&
      item.response.request_id === requestId,
  ) as CLIControlResponse | undefined;
}

describe("Query integration behavior", () => {
  it("sends initialize payload with agents and mcp servers", async () => {
    const transport = new MockTransport();
    const query = new Query(transport, {
      cwd: "/repo",
      agents: [
        {
          name: "reviewer",
          description: "Review code quality",
          systemPrompt: "Review and report risks.",
          level: "session",
        },
      ],
      mcpServers: {
        docs: { command: "node", args: ["server.js"] },
      },
    });

    const initialize = (await vi.waitFor(() => {
      const message = transport.getLastWrittenMessage() as CLIControlRequest | null;
      expect(message).toBeTruthy();
      return message as CLIControlRequest;
    })) as CLIControlRequest;

    expect(initialize.type).toBe("control_request");
    expect(initialize.request.subtype).toBe("initialize");
    expect(initialize.request.agents).toEqual([
      expect.objectContaining({
        name: "reviewer",
        level: "session",
      }),
    ]);
    expect(initialize.request.mcpServers).toEqual(
      expect.objectContaining({
        docs: expect.objectContaining({
          command: "node",
        }),
      }),
    );

    transport.simulateMessage(createControlResponse(initialize.request_id, true, {}));
    await query.initialized;
    await query.close();
  });

  it("passes permission suggestions to canUseTool callback", async () => {
    const transport = new MockTransport();
    const canUseTool = vi.fn().mockResolvedValue({ behavior: "allow" });
    const query = new Query(transport, {
      cwd: "/repo",
      canUseTool,
    });

    const initialize = (await vi.waitFor(() => {
      const message = transport.getLastWrittenMessage() as CLIControlRequest | null;
      expect(message).toBeTruthy();
      return message as CLIControlRequest;
    })) as CLIControlRequest;

    transport.simulateMessage(createControlResponse(initialize.request_id, true, {}));
    await query.initialized;

    const permissionRequest: CLIControlRequest = {
      type: "control_request",
      request_id: "perm-1",
      request: {
        subtype: "can_use_tool",
        tool_name: "run_shell_command",
        tool_use_id: "tool-1",
        input: { command: "git status" },
        permission_suggestions: [
          {
            type: "allow",
            label: "Allow once",
            description: "Safe read-only git command",
          },
        ],
        blocked_path: null,
      },
    };

    transport.simulateMessage(permissionRequest);

    await vi.waitFor(() => {
      expect(canUseTool).toHaveBeenCalledWith(
        "run_shell_command",
        { command: "git status" },
        expect.objectContaining({
          suggestions: [
            expect.objectContaining({
              type: "allow",
              label: "Allow once",
            }),
          ],
        }),
      );
    });

    const responses = transport.getAllWrittenMessages();
    const response = responses.find(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "type" in item &&
        item.type === "control_response" &&
        "response" in item &&
        typeof item.response === "object" &&
        item.response !== null &&
        "request_id" in item.response &&
        item.response.request_id === "perm-1",
    ) as CLIControlResponse | undefined;

    expect(response?.response.subtype).toBe("success");
    await query.close();
  });

  it("propagates abort signal to permission hooks and closes query", async () => {
    const transport = new MockTransport();
    const abortController = new AbortController();
    const canUseTool = vi.fn().mockImplementation(
      (
        _toolName: string,
        _input: unknown,
        options: { signal: AbortSignal },
      ) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => {
            reject(new Error("permission callback aborted"));
          });
        }),
    );
    const query = new Query(transport, {
      cwd: "/repo",
      abortController,
      canUseTool,
    });

    const initialize = (await vi.waitFor(() => {
      const message = transport.getLastWrittenMessage() as CLIControlRequest | null;
      expect(message).toBeTruthy();
      return message as CLIControlRequest;
    })) as CLIControlRequest;

    transport.simulateMessage(createControlResponse(initialize.request_id, true, {}));
    await query.initialized;

    const permissionRequest: CLIControlRequest = {
      type: "control_request",
      request_id: "perm-abort",
      request: {
        subtype: "can_use_tool",
        tool_name: "run_shell_command",
        tool_use_id: "tool-abort",
        input: { command: "npm run build" },
        permission_suggestions: null,
        blocked_path: null,
      },
    };

    transport.simulateMessage(permissionRequest);
    abortController.abort();

    await vi.waitFor(() => {
      expect(canUseTool).toHaveBeenCalled();
    });

    await vi.waitFor(() => {
      expect(query.isClosed()).toBe(true);
    });
    await expect(query.next()).rejects.toBeInstanceOf(AbortError);
    await query.close();
  });

  it("handles control_cancel_request for in-flight permission checks", async () => {
    const transport = new MockTransport();
    const canUseTool = vi.fn().mockImplementation(
      (
        _toolName: string,
        _input: unknown,
        options: { signal: AbortSignal },
      ) =>
        new Promise((resolve, reject) => {
          options.signal.addEventListener("abort", () => reject(new Error("aborted")));
          setTimeout(() => resolve({ behavior: "allow" }), 2000);
        }),
    );

    const query = new Query(transport, { cwd: "/repo", canUseTool });

    const initialize = (await vi.waitFor(() => {
      const message = transport.getLastWrittenMessage() as CLIControlRequest | null;
      expect(message).toBeTruthy();
      return message as CLIControlRequest;
    })) as CLIControlRequest;

    transport.simulateMessage(createControlResponse(initialize.request_id, true, {}));
    await query.initialized;

    const permissionRequest: CLIControlRequest = {
      type: "control_request",
      request_id: "perm-cancel",
      request: {
        subtype: "can_use_tool",
        tool_name: "run_shell_command",
        tool_use_id: "tool-cancel",
        input: { command: "npm test" },
        permission_suggestions: null,
        blocked_path: null,
      },
    };

    transport.simulateMessage(permissionRequest);
    transport.simulateMessage(createControlCancel("perm-cancel"));

    await vi.waitFor(() => {
      expect(canUseTool).toHaveBeenCalled();
    });

    await query.close();
  });

  it("initializes sdkMcpServers and resolves mcp_message requests", async () => {
    const transport = new MockTransport();
    const connect = vi.fn().mockImplementation(async (sdkTransport: unknown) => {
      const typedTransport = sdkTransport as {
        onmessage?: (message: { id?: string | number | null; method?: string }) => void;
        send: (message: Record<string, unknown>) => Promise<void>;
      };

      typedTransport.onmessage = (message) => {
        void typedTransport.send({
          jsonrpc: "2.0",
          id: message.id ?? null,
          result: {
            ok: true,
            method: message.method ?? null,
          },
        });
      };
    });

    const query = new Query(transport, {
      cwd: "/repo",
      sdkMcpServers: {
        local: { connect },
      },
    });

    const initialize = (await vi.waitFor(() => {
      const message = transport.getLastWrittenMessage() as CLIControlRequest | null;
      expect(message).toBeTruthy();
      return message as CLIControlRequest;
    })) as CLIControlRequest;

    expect(initialize.request.subtype).toBe("initialize");
    expect(initialize.request.sdkMcpServers).toEqual({
      local: {},
    });

    transport.simulateMessage(createControlResponse(initialize.request_id, true, {}));
    await query.initialized;

    const mcpRequest: CLIControlRequest = {
      type: "control_request",
      request_id: "mcp-1",
      request: {
        subtype: "mcp_message",
        server_name: "local",
        message: {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        },
      },
    };

    transport.simulateMessage(mcpRequest);

    await vi.waitFor(() => {
      const response = findControlResponse(transport.getAllWrittenMessages(), "mcp-1");
      expect(response?.response.subtype).toBe("success");
      if (!response || response.response.subtype !== "success") {
        return;
      }
      expect(response.response.response).toMatchObject({
        mcp_response: {
          jsonrpc: "2.0",
          id: 1,
          result: {
            ok: true,
            method: "tools/list",
          },
        },
      });
    });

    expect(connect).toHaveBeenCalledTimes(1);
    await query.close();
  });

  it("returns control errors for mcp_message requests to unknown sdk mcp servers", async () => {
    const transport = new MockTransport();
    const query = new Query(transport, {
      cwd: "/repo",
    });

    const initialize = (await vi.waitFor(() => {
      const message = transport.getLastWrittenMessage() as CLIControlRequest | null;
      expect(message).toBeTruthy();
      return message as CLIControlRequest;
    })) as CLIControlRequest;

    transport.simulateMessage(createControlResponse(initialize.request_id, true, {}));
    await query.initialized;

    const mcpRequest: CLIControlRequest = {
      type: "control_request",
      request_id: "mcp-missing",
      request: {
        subtype: "mcp_message",
        server_name: "missing",
        message: {
          jsonrpc: "2.0",
          id: 11,
          method: "tools/list",
        },
      },
    };

    transport.simulateMessage(mcpRequest);

    await vi.waitFor(() => {
      const response = findControlResponse(
        transport.getAllWrittenMessages(),
        "mcp-missing",
      );
      expect(response?.response.subtype).toBe("error");
      if (!response || response.response.subtype !== "error") {
        return;
      }
      expect(String(response.response.error)).toContain(
        "not found in SDK-embedded servers",
      );
    });

    await query.close();
  });
});
