// At most two provider calls per batch, preserving input order and partial failures.
export async function mapPairs<T, R>(items: T[], work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += 2) {
    results.push(...await Promise.all(items.slice(i, i + 2).map(work)));
  }
  return results;
}
