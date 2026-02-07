# Web Policy Deny Visibility

Web UI now surfaces policy-denied tool calls directly in the chat experience.

## What changed

- SSE event handling inspects tool updates for denial reasons.
- When a denial is detected:
  - Activity feed logs `Policy Deny` with reason text.
  - System chat message is added: `Policy denied tool execution: <reason>`.

## Reason extraction strategy

The Web UI checks multiple fields in tool event payloads:

- `result.reason`
- `result.error.message`
- `result.status.message.parts[].text` (when it contains `denied` or `policy`)

## Why this matters

- Operators can see denial reasons immediately without inspecting backend logs.
- Makes policy tuning and remediation faster in remote/web sessions.

## Validation

- Web UI integration test confirms deny-message logic is embedded in delivered HTML script.
