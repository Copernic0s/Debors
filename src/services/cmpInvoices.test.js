import { describe, expect, it } from 'vitest';
import { fetchCmpInvoices } from './cmpInvoices';

const createSupabaseMock = ({ rows, maxPageSize = Infinity, failAt } = {}) => {
  const requestedRanges = [];
  const currentFilters = [];
  return {
    requestedRanges,
    currentFilters,
    from: () => ({
      select: (_columns, options) => {
        if (options?.head) {
          return {
            eq: (column, value) => {
              currentFilters.push(['count', column, value]);
              return Promise.resolve({ count: rows.length, error: null });
            }
          };
        }

        let rangeStart = 0;
        let rangeEnd = rows.length - 1;
        const query = {
          eq: (column, value) => {
            currentFilters.push(['rows', column, value]);
            return query;
          },
          order: () => query,
          range: (start, end) => {
            rangeStart = start;
            rangeEnd = end;
            requestedRanges.push([start, end]);
            return query;
          },
          then: (resolve, reject) => {
            if (rangeStart === failAt) {
              return Promise.resolve({ data: null, error: new Error('page failed') }).then(resolve, reject);
            }
            const boundedEnd = Math.min(rangeEnd + 1, rangeStart + maxPageSize, rows.length);
            return Promise.resolve({ data: rows.slice(rangeStart, boundedEnd), error: null }).then(resolve, reject);
          }
        };
        return query;
      }
    })
  };
};

describe('fetchCmpInvoices', () => {
  it('reads every row across pages when the server caps page size below the request', async () => {
    const rows = Array.from({ length: 2520 }, (_, index) => ({ id: `cmp-${index}` }));
    const supabase = createSupabaseMock({ rows, maxPageSize: 500 });

    const result = await fetchCmpInvoices(supabase);

    expect(result.expected).toBe(2520);
    expect(result.rows).toHaveLength(2520);
    expect(new Set(result.rows.map((row) => row.id)).size).toBe(2520);
    expect(supabase.requestedRanges).toHaveLength(6);
    expect(supabase.requestedRanges.at(-1)[0]).toBe(2500);
    expect(supabase.currentFilters.every(([, column, value]) => column === 'is_current' && value === true)).toBe(true);
  });

  it('returns an empty list when the exact count is zero', async () => {
    const result = await fetchCmpInvoices(createSupabaseMock({ rows: [] }));
    expect(result).toEqual({ rows: [], expected: 0 });
  });

  it('throws instead of returning a partial read when a page fails', async () => {
    const rows = Array.from({ length: 1200 }, (_, index) => ({ id: `cmp-${index}` }));
    const supabase = createSupabaseMock({ rows, maxPageSize: 500, failAt: 500 });

    await expect(fetchCmpInvoices(supabase)).rejects.toMatchObject({
      message: 'page failed',
      expectedCount: 1200,
      receivedCount: 500
    });
  });
});
