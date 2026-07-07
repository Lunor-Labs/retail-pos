/**
 * Supabase / PostgREST returns at most 1000 rows for a single request by
 * default. Any query that reads a whole collection (all products, variants,
 * batches, customers, sales, ...) will silently truncate once the table grows
 * past that cap, which shows up as "missing" rows — e.g. products whose stock
 * appears as 0 because their batches fell beyond row 1000.
 *
 * fetchAllRows works around this by paging through the result set with
 * `.range()` until a short page comes back.
 *
 * Pass a factory that builds the query fresh on every call, with all filters
 * and ordering applied but WITHOUT `.range()` / `.limit()`. Always include a
 * stable, unique ordering (e.g. `.order('id')`, or a non-unique sort key plus
 * `.order('id')` as a tiebreaker) so page boundaries don't skip or duplicate
 * rows.
 *
 * Example:
 *   const batches = await fetchAllRows<ProductBatch>(() =>
 *     client.from('product_batches').select('*').in('variant_id', ids).order('id')
 *   );
 */
export async function fetchAllRows<T = any>(
    makeQuery: () => any,
    pageSize = 1000,
): Promise<T[]> {
    const all: T[] = [];
    let from = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { data, error } = await makeQuery().range(from, from + pageSize - 1);
        if (error) throw new Error(error.message);

        const rows = (data as T[]) || [];
        all.push(...rows);

        if (rows.length < pageSize) break;
        from += pageSize;
    }

    return all;
}
