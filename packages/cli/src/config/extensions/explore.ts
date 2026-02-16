/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  parseInstallSource,
  type ClaudeMarketplaceConfig,
} from './marketplace.js';

export interface MarketplaceExploreResult {
  source: string;
  marketplaceName: string;
  plugins: string[];
}

export async function exploreMarketplacePlugins(
  sourceInput?: string,
  keywordInput?: string,
): Promise<MarketplaceExploreResult> {
  const source = sourceInput?.trim() || 'wshobson/agents';
  const keyword = keywordInput?.trim().toLowerCase();

  const installMetadata = await parseInstallSource(source);
  if (installMetadata.type !== 'marketplace') {
    throw new Error(
      `Source "${source}" does not expose a marketplace config. Try another source.`,
    );
  }

  const marketplace = installMetadata.marketplaceConfig as
    | ClaudeMarketplaceConfig
    | undefined;
  if (!marketplace) {
    throw new Error('Marketplace config missing.');
  }

  const plugins = marketplace.plugins
    .map((plugin) => plugin.name)
    .filter((name) =>
      keyword && keyword.length > 0 ? name.toLowerCase().includes(keyword) : true,
    );

  return {
    source,
    marketplaceName: marketplace.name,
    plugins,
  };
}
