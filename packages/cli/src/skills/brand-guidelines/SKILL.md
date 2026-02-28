---
name: brand-guidelines
description: Applies papert-code web UI brand colors and typography to artifacts that should match papert-code look-and-feel. Use it for brand colors, visual formatting, and company design standards.
license: Complete terms in LICENSE.txt
---

# papert-code Brand Styling

## Overview

Use this skill to align output with papert-code's current web UI visual system.

**Keywords**: branding, corporate identity, visual identity, post-processing, styling, brand colors, typography, papert-code brand, visual formatting, visual design

## Brand Guidelines

### Light Theme Colors

- Background: `#f6f6fb`
- Foreground: `#0f172a`
- Card/Surface: `#ffffff`
- Border/Input: `#e4e7ec`
- Muted Surface: `#eef2f8`
- Muted Text: `#64748b`

### Primary and Status Colors

- Primary: `#1a9e4c`
- Primary Foreground: `#ffffff`
- Focus Ring: `#33d17a`
- Success: `#0dbd5c`
- Warning: `#f59e0b`
- Destructive: `#ef4444`

### Dark Theme Colors

- Background: `#0b1220`
- Foreground: `#e2e8f0`
- Card/Surface: `#111827`
- Border/Input: `#334155`
- Muted Surface: `#1f2937`
- Muted Text: `#94a3b8`
- Primary: `#33d17a`
- Primary Foreground: `#052e16`

### Typography

- Heading and body: `Space Grotesk`
- Monospace and code: `JetBrains Mono`
- Fallback sans: `"Segoe UI", ui-sans-serif, system-ui, sans-serif`
- Fallback mono: `ui-monospace, monospace`

## Usage Rules

- Use papert-code primary green (`#1a9e4c` or `#33d17a`) for primary actions and highlights.
- Use neutral surfaces and borders for structure; avoid legacy beige/orange theme foundations.
- Keep text contrast high against backgrounds in both light and dark modes.
- Use success/warning/destructive colors only for semantic states.
- Keep typography consistent with `Space Grotesk` for interface content and `JetBrains Mono` for code/data.

## Technical Details

### Color Application

- Apply values exactly as hex tokens for consistency with the web UI.
- For RGB-based APIs (e.g., python-pptx), convert hex values directly and preserve fidelity.

### Font Management

- Prefer installed `Space Grotesk` and `JetBrains Mono`.
- Use fallback stacks when custom fonts are unavailable.
- Keep heading/body hierarchy clear with weight and size before introducing additional colors.
