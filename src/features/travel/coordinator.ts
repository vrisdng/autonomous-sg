// Only in-flight work is shared. Provider responses are not persisted or cached.
export function createCoordinator<I, O>(keyOf: (input: I) => string, run: (inputs: I[], signal: AbortSignal) => Promise<O[]>, batchSize = 4) {
  type Consumer = { resolve: (value: O) => void; reject: (error: unknown) => void; cleanup: () => void };
  type Entry = { key: string; input: I; consumers: Set<Consumer>; cancel?: () => void };
  const pending = new Map<string, Entry>();
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancelled = () => new Error('Journey check cancelled.');
  const schedule = () => { if (!timer) timer = setTimeout(() => { timer = undefined; void drain(); }, 0); };
  const drain = async () => {
    if (running) return;
    const entries = [...pending.values()].filter((entry) => !entry.cancel && entry.consumers.size).slice(0, batchSize);
    if (!entries.length) return;
    running = true;
    const controller = new AbortController();
    for (const entry of entries) entry.cancel = () => { if (entries.every((item) => !item.consumers.size)) controller.abort(); };
    try {
      const output = await run(entries.map((entry) => entry.input), controller.signal);
      entries.forEach((entry, index) => { for (const consumer of entry.consumers) { consumer.cleanup(); consumer.resolve(output[index]!); } });
    } catch (error) {
      for (const entry of entries) for (const consumer of entry.consumers) { consumer.cleanup(); consumer.reject(error); }
    } finally {
      for (const entry of entries) { if (pending.get(entry.key) === entry) pending.delete(entry.key); }
      running = false; schedule();
    }
  };
  return (input: I, signal?: AbortSignal): Promise<O> => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(cancelled()); return; }
    const key = keyOf(input);
    let entry = pending.get(key);
    if (!entry) { entry = { key, input, consumers: new Set() }; pending.set(key, entry); }
    const selected = entry;
    const abort = () => {
      selected.consumers.delete(consumer); consumer.cleanup(); reject(cancelled());
      if (!selected.consumers.size) { if (pending.get(key) === selected) pending.delete(key); selected.cancel?.(); }
    };
    const consumer: Consumer = { resolve, reject, cleanup: () => signal?.removeEventListener('abort', abort) };
    selected.consumers.add(consumer);
    signal?.addEventListener('abort', abort, { once: true });
    schedule();
  });
}
