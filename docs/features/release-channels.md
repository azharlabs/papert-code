# Release Channels

Papert Code supports three update channels:

- `stable` (default)
- `preview`
- `nightly`

## Configuration

Set the channel in `settings.json`:

```json
{
  "general": {
    "releaseChannel": "stable"
  }
}
```

Allowed values:

- `stable`: checks the `latest` dist-tag
- `preview`: checks `preview`, then falls back to `latest`
- `nightly`: checks `nightly`, then `preview`, then `latest`

## Selection behavior

- The updater compares all candidates available for your selected channel.
- Higher semantic version wins.
- If multiple channels have the same base version, channel precedence is:
  - `nightly` over `preview` over `stable`

## Auto-update behavior

When auto-update is enabled:

- `stable` installs an exact version (`@<resolved-version>`)
- `preview` installs from `@preview`
- `nightly` installs from `@nightly`

This preserves your selected channel on future updates.
