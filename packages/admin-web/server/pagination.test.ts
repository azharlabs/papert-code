import { describe, expect, it } from 'vitest';
import { paginate, readPageParams } from './pagination.js';

describe('readPageParams', () => {
  it('reads and clamps limit/offset values', () => {
    const page = readPageParams({
      limit: '999',
      offset: '-3',
    });

    expect(page.limit).toBe(500);
    expect(page.offset).toBe(0);
  });

  it('falls back when params are missing or invalid', () => {
    const page = readPageParams(
      {
        limit: 'NaN',
      },
      { limit: 25, offset: 5 },
    );

    expect(page.limit).toBe(25);
    expect(page.offset).toBe(5);
  });
});

describe('paginate', () => {
  it('returns page metadata and sliced items', () => {
    const input = [1, 2, 3, 4, 5];
    const result = paginate(input, { limit: 2, offset: 2 });

    expect(result.items).toEqual([3, 4]);
    expect(result.page).toEqual({
      limit: 2,
      offset: 2,
      total: 5,
      hasMore: true,
    });
  });
});
