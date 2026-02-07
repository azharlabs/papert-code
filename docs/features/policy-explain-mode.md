# Policy Explain Mode

Papert Code now includes explanation text when a tool call is denied by policy.

## Why this matters

Before this change, a deny decision only indicated that the request was blocked.  
Now deny responses can include a concrete `reason`, helping operators and agents resolve policy issues quickly.

## Behavior

- `PolicyEngine` now exposes decision details and deny reasons.
- Deny reasons can come from:
  - Explicit `reason` on a matching policy rule
  - Auto-generated summary from matched rule fields (`toolName`, `argsPattern`, `priority`)
  - Non-interactive fallback explanation when `ASK_USER` is converted to `DENY`
- `MessageBus` includes the reason on:
  - `TOOL_POLICY_REJECTION`
  - `TOOL_CONFIRMATION_RESPONSE` (when denied)

## API details

### Policy engine methods

- `getDecisionDetails(toolCall, serverName)` returns:
  - `decision`
  - optional `reason`
- `getDecisionReason(toolCall, serverName)` returns optional reason string.

### Confirmation bus payloads

- `ToolPolicyRejection.reason?: string`
- `ToolConfirmationResponse.reason?: string`

## Example reason outputs

- `Shell execution is restricted in this workspace`
- `Denied by matching policy rule (tool=run_shell_command, argsPattern=rm -rf, priority=9)`
- `Interactive confirmation is disabled in non-interactive mode`

## Testing guidance

- Add rule-level tests for custom and generated reasons.
- Add message-bus tests to assert reason propagation.
- Verify existing deny flows still work when reason is absent.
