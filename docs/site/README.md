# Papert Docs Site

This is a Next.js + Nextra documentation website that renders content from the parent `docs/` folder.

## Run locally

From repository root:

```bash
npm install
npm --prefix docs/site install
npm run docs:dev
```

Then open `http://localhost:3000`.

## Build

```bash
npm run docs:build
```

## How content is loaded

The site syncs all files from `docs/` into `docs/site/content` before dev/build.

Sync command:

```bash
npm --prefix docs/site run sync-content
```
