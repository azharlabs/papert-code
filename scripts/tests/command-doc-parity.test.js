/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  getBuiltinSlashCommandNames,
  renderCommandIndexSection,
  upsertGeneratedSection,
} from '../command-doc-parity.mjs';

describe('command-doc-parity', () => {
  it('extracts command names from loader and command files', async () => {
    const loaderSource = `
import { fooCommand } from '../ui/commands/foo.js';
import { barCommand } from '../ui/commands/bar.js';
const allDefinitions: Array<SlashCommand | null> = [fooCommand, barCommand];
`;

    const files = new Map([
      [
        'packages/cli/src/ui/commands/foo.ts',
        "export const fooCommand: SlashCommand = { name: 'foo', kind: CommandKind.BUILT_IN };",
      ],
      [
        'packages/cli/src/ui/commands/bar.ts',
        "export const barCommand: SlashCommand = { name: 'bar', kind: CommandKind.BUILT_IN };",
      ],
    ]);

    const names = await getBuiltinSlashCommandNames({
      loaderSource,
      fileReader: async (relativePath) => files.get(relativePath) || '',
    });

    expect(names).toEqual(['bar', 'foo']);
  });

  it('renders deterministic generated section', () => {
    const section = renderCommandIndexSection(['about', 'help']);

    expect(section).toContain('BEGIN AUTO-GENERATED BUILTIN COMMAND INDEX');
    expect(section).toContain('- `/about`');
    expect(section).toContain('- `/help`');
    expect(section).toContain('END AUTO-GENERATED BUILTIN COMMAND INDEX');
  });

  it('replaces existing generated section in docs content', () => {
    const doc = `
# CLI Commands

<!-- BEGIN AUTO-GENERATED BUILTIN COMMAND INDEX -->
old
<!-- END AUTO-GENERATED BUILTIN COMMAND INDEX -->

Body
`;

    const generated = `
<!-- BEGIN AUTO-GENERATED BUILTIN COMMAND INDEX -->
new
<!-- END AUTO-GENERATED BUILTIN COMMAND INDEX -->
`;

    const updated = upsertGeneratedSection(doc, generated);
    expect(updated).toContain('new');
    expect(updated).not.toContain('\nold\n');
  });

  it('prepends generated section when marker is missing', () => {
    const doc = '# CLI Commands\n\nBody\n';
    const generated =
      '<!-- BEGIN AUTO-GENERATED BUILTIN COMMAND INDEX -->\nsection\n<!-- END AUTO-GENERATED BUILTIN COMMAND INDEX -->\n';

    const updated = upsertGeneratedSection(doc, generated);
    expect(updated.startsWith(generated)).toBe(true);
  });
});
