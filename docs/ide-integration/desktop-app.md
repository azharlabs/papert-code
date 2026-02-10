# Desktop App

Papert Code Desktop is a local-first native app built with Tauri.

## Download installers

Download the latest installers from GitHub Releases:

- [Papert Code Releases](https://github.com/azharlabs/papert-code/releases)

Typical assets by platform:

- macOS: `.dmg`
- Windows: `.exe` (NSIS installer)
- Linux: `.deb` and `.rpm`

## What desktop provides

- Local-first project and session management.
- Native shell with the Papert runtime.
- No required Papert account for local desktop usage.

## Local development

From repository root:

```bash
npm install
npm run dev:desktop
```

If you only want to run the desktop web layer:

```bash
npm run --workspace packages/desktop dev
```

## Build desktop bundles

From repository root:

```bash
npm run build:desktop:app
```

Build output:

`packages/desktop/src-tauri/target/release/bundle/`

## Release workflow

Desktop release automation is defined in:

`/Users/azhar/code/coding-agent/papert-code/.github/workflows/desktop-release.yml`

See also package-level desktop notes:

- [packages/desktop/README.md](../../packages/desktop/README.md)
