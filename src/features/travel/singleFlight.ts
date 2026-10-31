// Share only work currently in progress. No persistent route/location cache or stale results.
export function singleFlight<T>() {
  const pending = new Map<string, Promise<T>>();
  return (key: string, work: () => Promise<T>) => {
    const existing = pending.get(key);
    if (existing) return existing;
    const task = Promise.resolve().then(work).finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  };
}
