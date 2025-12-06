# Papert Code: Terms of Service and Privacy Notice

Papert Code is an open-source AI coding assistant maintained by the Papert community. The CLI runs locally and connects directly to the model provider you configure. This document summarizes how to think about Terms of Service and privacy when using Papert Code.

## Authentication and applicable terms

Papert Code relies on OpenAI-compatible APIs. Your provider choice determines which Terms of Service and Privacy Notice apply.

| Authentication Method   | Provider                | Terms of Service / Privacy Notice                                  |
| :---------------------- | :---------------------- | :----------------------------------------------------------------- |
| OpenAI-Compatible API   | Your chosen provider    | Refer to your provider's documentation (OpenAI, Alibaba, etc.)     |

Papert Code does not operate its own login system or cloud service. When you authenticate, you are agreeing to your provider's terms, not a Papert-hosted service.

## Data handling

Papert Code itself does not collect or transmit your prompts, code, or model responses. Any data retention, logging, or training policies are defined by the API provider you select. Review your provider's privacy policy for details.

If you enable optional telemetry in configuration, only anonymized CLI diagnostics are recorded locally; nothing is sent to a Papert-run backend.

## Frequently Asked Questions (FAQ)

### 1. Is my code, including prompts and answers, used to train AI models?

That depends entirely on your chosen API provider. Papert Code does not train models or run a hosted inference service. Check your provider's terms to understand their training and retention policies.

### 2. How do I switch providers or credentials?

- During startup: select or paste a new key when prompted.
- Within the CLI: use the `/auth` command to reconfigure.
- Environment variables: set values in your shell or `.env` files for automatic use.

See the [Authentication Setup](./cli/authentication.md) guide for details.
