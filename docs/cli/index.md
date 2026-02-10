# Papert Code CLI

Within Papert Code, `packages/cli` is the frontend for users to send and receive prompts with Papert and other AI models and their associated tools. For a general overview of Papert Code

## Navigating this section

- **[Authentication](./authentication.md):** A guide to setting up authentication with Papert OAuth and OpenAI-compatible providers.
- **[Commands](./commands.md):** A reference for Papert Code CLI commands (e.g., `/help`, `/tools`, `/theme`).
- **[Remote Driving](./remote-driving.md):** Run the CLI against a remote daemon with `papert server` and `papert connect`.
- **[Configuration](./configuration.md):** A guide to tailoring Papert Code CLI behavior using configuration files.
- **[Scheduler](./scheduler.md):** Schedule recurring or one-shot Papert prompts.
- **[Hooks](./hooks.md):** Run external scripts at lifecycle events to intercept or customize behavior.
- **[Settings](./settings.md):** How to view and edit settings via the `/settings` command or JSON files.
- **[Themes](./themes.md)**: A guide to customizing the CLI's appearance with different themes.
- **[Tutorials](tutorials.md)**: A tutorial showing how to use Papert Code to automate a development task.
- **[Desktop App](../ide-integration/desktop-app.md)**: Run Papert Code as a native desktop application.

## Non-interactive mode

Papert Code can be run in a non-interactive mode, which is useful for scripting and automation. In this mode, you pipe input to the CLI, it executes the command, and then it exits.

The following example pipes a command to Papert Code from your terminal:

```bash
echo "What is fine tuning?" | papert
```

You can also use the `--prompt` or `-p` flag:

```bash
papert -p "What is fine tuning?"
```

For comprehensive documentation on headless usage, scripting, automation, and advanced examples, see the **[Headless Mode](../features/headless.md)** guide.
