import http from 'node:http';

const PORT = Number(process.env.PORT || 10000);
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_MASTER_KEY = process.env.JSONBIN_MASTER_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
const JSONBIN_BASE_URL = 'https://api.jsonbin.io/v3';
const CAP = 5;
const MAX_BODY_BYTES = 8 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;
const requests = new Map();

function send(res, status, payload, origin) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(origin && origin === ALLOWED_ORIGIN ? {
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
    } : {}),
  });
  res.end(JSON.stringify(payload));
}

function cleanBoard(value) {
  if (!Array.isArray(value)) return [];
  const valid = value.filter((entry) =>
    entry && typeof entry === 'object' &&
    typeof entry.name === 'string' && entry.name.trim().length > 0 &&
    entry.name.trim().length <= 24 &&
    typeof entry.flag === 'string' && entry.flag.length <= 16 &&
    Number.isFinite(entry.score) && entry.score >= 0 && entry.score <= 1_000_000_000
  ).map((entry) => ({
    name: entry.name.trim(),
    flag: entry.flag,
    score: Math.floor(entry.score),
    ts: Number.isFinite(entry.ts) && entry.ts > 0 ? Math.floor(entry.ts) : Date.now(),
  }));

  const bestByIdentity = new Map();
  for (const entry of valid) {
    const key = entry.name.toLocaleLowerCase() + '|' + entry.flag;
    const previous = bestByIdentity.get(key);
    if (!previous || entry.score > previous.score) bestByIdentity.set(key, entry);
  }

  return [...bestByIdentity.values()]
    .sort((a, b) => b.score - a.score || a.ts - b.ts)
    .slice(0, CAP);
}

async function readRecord() {
  const response = await fetch(`${JSONBIN_BASE_URL}/b/${encodeURIComponent(JSONBIN_BIN_ID)}/latest`, {
    headers: { 'X-Master-Key': JSONBIN_MASTER_KEY },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`JSONBin read failed (${response.status})`);
  const data = await response.json();
  const record = data?.record;
  const leaderboard = Array.isArray(record?.leaderboard) ? record.leaderboard : Array.isArray(record) ? record : [];
  return { record: record && typeof record === 'object' && !Array.isArray(record) ? record : {}, leaderboard: cleanBoard(leaderboard) };
}

// JSONBin does not provide compare-and-swap. Mutations are serialized by the
// in-process queue below to prevent simultaneous requests handled by this API
// instance from overwriting one another. This is not a cross-instance lock.
async function incrementAttempts() {
  const { record, leaderboard } = await readRecord();
  const current = Number.isSafeInteger(record.attempts) && record.attempts >= 0 ? record.attempts : 0;
  const next = current + 1;
  const response = await fetch(`${JSONBIN_BASE_URL}/b/${encodeURIComponent(JSONBIN_BIN_ID)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_MASTER_KEY,
    },
    body: JSON.stringify({ ...record, leaderboard, attempts: next }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`JSONBin write failed (${response.status})`);
  return next;
}

let mutationQueue = Promise.resolve();
function serializeMutation(operation) {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function writeRecord(leaderboard, attempts) {
  const current = await readRecord();
  const nextAttempts = Number.isFinite(attempts)
    ? Math.max(0, Math.floor(attempts))
    : (Number.isFinite(current.record.attempts) ? current.record.attempts : 0);
  const response = await fetch(`${JSONBIN_BASE_URL}/b/${encodeURIComponent(JSONBIN_BIN_ID)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_MASTER_KEY,
    },
    body: JSON.stringify({
      ...current.record,
      leaderboard: cleanBoard(leaderboard),
      attempts: nextAttempts,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`JSONBin write failed (${response.status})`);
  return { leaderboard: cleanBoard(leaderboard), attempts: nextAttempts };
}

function isRateLimited(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0] : '') || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (requests.get(ip) || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    requests.set(ip, recent);
    return true;
  }
  recent.push(now);
  requests.set(ip, recent);
  if (requests.size > 2000) {
    for (const [key, times] of requests) {
      if (!times.some((time) => now - time < RATE_WINDOW_MS)) requests.delete(key);
    }
  }
  return false;
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
  }
  return JSON.parse(body || 'null');
}

export async function handler(req, res) {
  const origin = req.headers.origin;
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/';

  if (req.method === 'OPTIONS') {
    if (ALLOWED_ORIGIN && origin !== ALLOWED_ORIGIN) return send(res, 403, { error: 'Origin not allowed' }, null);
    res.writeHead(204, {
      ...(origin && origin === ALLOWED_ORIGIN ? {
        'Access-Control-Allow-Origin': origin,
        'Vary': 'Origin',
      } : {}),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
    });
    return res.end();
  }

  if (!JSONBIN_BIN_ID || !JSONBIN_MASTER_KEY || !ALLOWED_ORIGIN) {
    return send(res, 503, { error: 'Leaderboard API is not configured' }, origin);
  }
  if (origin && origin !== ALLOWED_ORIGIN) return send(res, 403, { error: 'Origin not allowed' }, null);
  if (pathname === '/health' && req.method === 'GET') return send(res, 200, { ok: true }, origin);

  // /attempts: GET reads the counter, POST increments it.
  // Mutations are serialized within this API process; JSONBin does not provide
  // cross-instance atomicity. The client never sees the JSONBin master key.
  if (pathname === '/attempts') {
    if (!['GET', 'POST'].includes(req.method || '')) return send(res, 405, { error: 'Method not allowed' }, origin);
    if (isRateLimited(req)) return send(res, 429, { error: 'Too many requests; try again shortly' }, origin);
    try {
      if (req.method === 'GET') {
        const { record } = await readRecord();
        const attempts = Number.isFinite(record.attempts) ? Math.floor(record.attempts) : 0;
        return send(res, 200, { attempts }, origin);
      }
      const result = await serializeMutation(incrementAttempts);
      return send(res, 200, { attempts: result }, origin);
    } catch (error) {
      return send(res, 502, { error: 'Attempts service is temporarily unavailable' }, origin);
    }
  }

  if (pathname !== '/leaderboard') return send(res, 404, { error: 'Not found' }, origin);
  if (!['GET', 'PUT'].includes(req.method || '')) return send(res, 405, { error: 'Method not allowed' }, origin);
  if (isRateLimited(req)) return send(res, 429, { error: 'Too many requests; try again shortly' }, origin);

  try {
    if (req.method === 'GET') {
      const { leaderboard } = await readRecord();
      return send(res, 200, { leaderboard }, origin);
    }

    const incoming = await readBody(req);
    if (!Array.isArray(incoming)) return send(res, 400, { error: 'Expected a leaderboard array' }, origin);
    if (incoming.length > 50) return send(res, 400, { error: 'Too many entries' }, origin);
    // Merge rather than replacing the shared board, so a stale browser cannot
    // accidentally erase entries submitted by other players.
    const result = await serializeMutation(async () => {
      const current = await readRecord();
      return writeRecord(cleanBoard([...current.leaderboard, ...incoming]), current.record.attempts);
    });
    return send(res, 200, { leaderboard: result.leaderboard }, origin);
  } catch (error) {
    const status = error?.message === 'BODY_TOO_LARGE' ? 413 : error instanceof SyntaxError ? 400 : 502;
    return send(res, status, { error: status === 502 ? 'Leaderboard storage is temporarily unavailable' : 'Invalid request body' }, origin);
  }
}

if (!process.env.VERCEL) {
  const server = http.createServer(handler);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Leaderboard API listening on port ${PORT}`);
  });
}
