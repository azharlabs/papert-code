/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { exploreMarketplacePlugins } from '../../config/extensions/explore.js';
import { getErrorMessage } from '../../utils/errors.js';

interface ExploreArgs {
  source?: string;
  keyword?: string;
}

export async function handleExplore(args: ExploreArgs) {
  try {
    const result = await exploreMarketplacePlugins(args.source, args.keyword);
    const { source, marketplaceName, plugins } = result;
    if (plugins.length === 0) {
      console.log(`No plugins found for keyword "${args.keyword}".`);
      return;
    }

    console.log(`Marketplace "${marketplaceName}" plugins:`);
    for (const plugin of plugins) {
      console.log(`  - ${plugin}`);
    }
    console.log(`\nInstall with: papert extensions install ${source}:<plugin-name>`);
  } catch (error) {
    console.error(getErrorMessage(error));
    process.exit(1);
  }
}

export const exploreCommand: CommandModule = {
  command: 'explore [source] [keyword]',
  describe:
    'Explore plugins from a marketplace source (default: wshobson/agents).',
  builder: (yargs) =>
    yargs
      .positional('source', {
        describe: 'Marketplace source (repo/url/path).',
        type: 'string',
      })
      .positional('keyword', {
        describe: 'Optional keyword to filter plugin names.',
        type: 'string',
      }),
  handler: async (argv) => {
    await handleExplore({
      source: argv['source'] as string | undefined,
      keyword: argv['keyword'] as string | undefined,
    });
  },
};
