# Papert Code Desktop

Papert Code Desktop is a local-first native app built with Tauri v2.

## What it does

- Starts in a blank state and lets users create projects from local folders.
- Stores projects, chats, and desktop session data locally on-device.
- Runs Papert Code against the selected local folder.
- No required cloud login for desktop-local usage.

## Download (GitHub Releases)

Desktop installers are published in GitHub Releases:

- Open [GitHub Releases](https://github.com/azharlabs/papert-code/releases)
- Download the asset for your OS:
  - macOS: `.dmg`
  - Windows: `.exe` (NSIS installer)
  - Linux: `.deb` and `.rpm`

## Local development

From repo root:

```bash
npm install
npm run dev:desktop
```

This starts the desktop shell with the local web app.

If you only want the web layer:

```bash
npm run --workspace packages/desktop dev
```

## Build installers locally

From repo root:

```bash
npm run build:desktop:app
```

Output bundles are written under:

`packages/desktop/src-tauri/target/release/bundle/`

## GitHub release automation

This repo includes a desktop release workflow:

- File: `.github/workflows/desktop-release.yml`
- Trigger:
  - Push a tag like `desktop-v0.1.0`
  - Or run manually via **Actions > Desktop Release**
- Result:
  - Builds desktop bundles for macOS, Windows, Linux
  - Uploads artifacts to the workflow run
  - If triggered by tag, also uploads assets to the corresponding GitHub Release

## Prerequisites

Desktop builds require Tauri prerequisites:

- Rust toolchain
- Platform-specific native build dependencies

Reference: [Tauri prerequisites](https://tauri.app/start/prerequisites/)
