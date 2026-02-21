# Papert Code Core

Papert Code's core package (`packages/core`) is the backend portion of Papert Code, handling communication with model APIs, managing tools, and processing requests sent from `packages/cli`. For a general overview of Papert Code, see the [main documentation page](../).

## Navigating this section

- **[Core tools API](./tools-api.md):** Information on how tools are defined, registered, and used by the core.
- **[Memory Import Processor](./memport.md):** Documentation for the modular papert.md import feature using @file.md syntax.

## Role of the core

While the `packages/cli` portion of Papert Code provides the user interface, `packages/core` is responsible for:

- **Model API interaction:** Securely communicating with the configured model provider, sending user prompts, and receiving model responses.
- **Prompt engineering:** Constructing effective prompts for the model, potentially incorporating conversation history, tool definitions, and instructional context from context files (e.g., `papert.md`).
- **Tool management & orchestration:**
  - Registering available tools (e.g., file system tools, shell command execution).
  - Interpreting tool use requests from the model.
  - Executing the requested tools with the provided arguments.
  - Returning tool execution results to the model for further processing.
- **Session and state management:** Keeping track of the conversation state, including history and any relevant context required for coherent interactions.
- **Configuration:** Managing core-specific configurations, such as API key access, model selection, and tool settings.

## Security considerations

The core plays a vital role in security:

- **API key management:** It handles provider credentials and ensures they're used securely when communicating with APIs.
- **Tool execution:** When tools interact with the local system (e.g., `run_shell_command`), the core (and its underlying tool implementations) must do so with appropriate caution, often involving sandboxing mechanisms to prevent unintended modifications.

## Chat history compression

To ensure that long conversations don't exceed the token limits of the selected model, the core includes a chat history compression feature.

When a conversation approaches the token limit for the configured model, the core automatically compresses the conversation history before sending it to the model. This compression is designed to be lossless in terms of the information conveyed, but it reduces the overall number of tokens used.

You can find token limits for each provider's models in their documentation.

## Model fallback

Papert Code includes a provider-agnostic model availability state machine to keep sessions resilient when model calls fail.

The runtime now classifies failures into:

- `terminal` failures: hard failures that should not be retried immediately
- `transient` failures: temporary failures that may recover automatically
- `sticky_retry` failures: failures where one retry is allowed per turn before skipping the model

Availability transitions are applied consistently through fallback handling, and transient states are reset on turn boundaries while terminal states remain until the model is explicitly marked healthy (for example, after a successful call or model switch).

## File discovery service

The file discovery service is responsible for finding files in the project that are relevant to the current context. It is used by the `@` command and other tools that need to access files.

## Memory discovery service

The memory discovery service is responsible for finding and loading the context files (default: `papert.md`) that provide context to the model. It searches for these files in a hierarchical manner, starting from the current working directory and moving up to the project root and the user's home directory. It also searches in subdirectories.

This allows you to have global, project-level, and component-level context files, which are all combined to provide the model with the most relevant information.

You can use the [`/memory` command](../cli/commands.md) to `show`, `list`, `add`, and `refresh` the content and source paths of loaded context files.
