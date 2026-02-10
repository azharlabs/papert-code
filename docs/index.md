# Papert Code Documentation

Papert Code is an AI coding agent for terminal-first development workflows. This site is organized so you can move quickly from setup to production usage, then to internals and extension development.

## Get started

- [User Guide](./cli): interactive and headless usage, auth, settings, commands.
- [Outside the Terminal](./ide-integration): desktop app, VS Code companion, IDE protocol.
- [Features](./features): approvals, sandboxing, checkpointing, subagents, automation.
- [Support](./support): troubleshooting, uninstall, policy/legal pages.

## Install

```bash
npm install -g @papert-code/papert-code@latest
papert --version
```

Homebrew (macOS/Linux):

```bash
brew install papert-code
```

## Quickstart

```bash
cd your-project
papert
```

Example prompts:

- `Explain the architecture of this repository`
- `Refactor auth middleware and add regression tests`
- `Generate release notes from commits since last tag`

## Desktop app

Use Papert Code as a native desktop app with local-first project and session storage.

- Desktop docs: [Desktop App](./ide-integration/desktop-app.md)
- Download installers: [GitHub Releases](https://github.com/azharlabs/papert-code/releases)

## Developer docs

- [Core](./core)
- [Tools](./tools)
- [Extensions](./extensions)
- [Development](./development)
- [Examples](./examples)

## Popular Tasks

### 📚 Understand New Codebases

```text
> What are the core business logic components?
> What security mechanisms are in place?
> How does the data flow through the system?
> What are the main design patterns used?
> Generate a dependency graph for this module
```

### 🔨 Code Refactoring & Optimization

```text
> What parts of this module can be optimized?
> Help me refactor this class to follow SOLID principles
> Add proper error handling and logging
> Convert callbacks to async/await pattern
> Implement caching for expensive operations
```

### 📝 Documentation & Testing

```text
> Generate comprehensive JSDoc comments for all public APIs
> Write unit tests with edge cases for this component
> Create API documentation in OpenAPI format
> Add inline comments explaining complex algorithms
> Generate a README for this module
```

### 🚀 Development Acceleration

```text
> Set up a new Express server with authentication
> Create a React component with TypeScript and tests
> Implement a rate limiter middleware
> Add database migrations for new schema
> Configure CI/CD pipeline for this project
```

## Commands & Shortcuts

### Session Commands

- `/help` - Display available commands
- `/clear` (aliases: `/reset`, `/new`) - Clear conversation history and start a fresh session
- `/compress` - Compress history to save tokens
- `/stats` - Show current session information
- `/exit` or `/quit` - Exit Papert Code

### Keyboard Shortcuts

- `Ctrl+C` - Cancel current operation
- `Ctrl+D` - Exit (on empty line)
- `Up/Down` - Navigate command history
