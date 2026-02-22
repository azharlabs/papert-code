export interface PageParams {
  limit: number;
  offset: number;
}

export interface PageMetadata extends PageParams {
  total: number;
  hasMore: boolean;
}

export interface PageResult<T> {
  items: T[];
  page: PageMetadata;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function readQueryNumber(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

export function readPageParams(
  query: Record<string, unknown>,
  fallback: Partial<PageParams> = {},
): PageParams {
  const fallbackLimit = fallback.limit ?? DEFAULT_LIMIT;
  const fallbackOffset = fallback.offset ?? 0;

  const rawLimit = readQueryNumber(query.limit);
  const rawOffset = readQueryNumber(query.offset);

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Math.trunc(rawLimit ?? fallbackLimit)),
  );
  const offset = Math.max(0, Math.trunc(rawOffset ?? fallbackOffset));

  return { limit, offset };
}

export function paginate<T>(items: T[], page: PageParams): PageResult<T> {
  const start = page.offset;
  const end = page.offset + page.limit;
  const sliced = items.slice(start, end);
  const total = items.length;

  return {
    items: sliced,
    page: {
      limit: page.limit,
      offset: page.offset,
      total,
      hasMore: end < total,
    },
  };
}
