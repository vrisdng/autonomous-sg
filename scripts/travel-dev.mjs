// Development-only loopback gateway. Shares the production request handler;
// credentials stay in this Node process, never in the Expo bundle.
import http from 'node:http';
process.env.BOJIO_LOCAL_DEV = '1';
let handler;
globalThis.Deno = {
  env: { get: (key) => process.env[key] },
  serve: (callback) => { handler = callback; },
};
await import('../supabase/functions/onemap/index.ts');
let requests = 0;
const timer = setInterval(() => { requests = 0; }, 60000).unref();
http.createServer(async (incoming, outgoing) => {
  try {
    const origin = incoming.headers.origin;
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) { outgoing.writeHead(403); outgoing.end(); return; }
    if (++requests > 120) { outgoing.writeHead(429); outgoing.end('Local request limit reached'); return; }
    const chunks = []; let length = 0;
    for await (const chunk of incoming) { length += chunk.length; if (length > 12000) { outgoing.writeHead(413); outgoing.end(); return; } chunks.push(chunk); }
    const request = new Request('http://127.0.0.1:8788/', { method: incoming.method, headers: incoming.headers, ...(incoming.method !== 'GET' && incoming.method !== 'HEAD' ? { body: Buffer.concat(chunks) } : {}) });
    const response = await handler(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch { outgoing.writeHead(503); outgoing.end(JSON.stringify({ error: 'Local travel gateway unavailable.' })); }
}).listen(8788, '127.0.0.1', () => console.log('OneMap development gateway listening on http://127.0.0.1:8788'));
