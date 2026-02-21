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

Or set it in Web UI:

- Open `CLI` view
- Use the **Release channel** selector (`stable`, `preview`, `nightly`)
- Click **Save**

Allowed values:

- `stable`: checks the `latest` dist-tag
- `preview`: checks `preview`, then falls back to `latest`
- `nightly`: checks `nightly`, then `preview`, then `latest`

## Promotion gates

Release-channel promotion toward stability is gated:

- `nightly -> preview` only
- `preview -> stable` only
- direct `nightly -> stable` promotion is rejected

Each promotion step also requires a soak window:

- nightly soak (before preview): default `24h`
- preview soak (before stable): default `72h`

Soak windows can be overridden in server environments:

- `PAPERT_RELEASE_CHANNEL_SOAK_NIGHTLY_MS`
- `PAPERT_RELEASE_CHANNEL_SOAK_PREVIEW_MS`

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

## Web client support

The web client now:

- reads current channel from `GET /api/v1/webui/catalog`
- writes updates via `PUT /api/v1/webui/release-channel`
- shows active channel in connection/status text
