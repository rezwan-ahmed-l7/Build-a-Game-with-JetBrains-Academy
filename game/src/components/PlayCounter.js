// Community play counter — shared across all devices via the leaderboard
// server-side proxy. The proxy is the only place that holds the JSONBin
// master key; this file never embeds credentials in the client bundle.
//
// `getAttempts()` returns the current total count (async).
// `recordAttempt()` atomically increments and returns the new count
// (async). The atomic CAS happens server-side, so concurrent players
// don't lose increments.

import { load, save } from '../utils/persistence.js';

// Server-side proxy URL (the same one used by Leaderboard.js). Configured
// at build time via Vite's env injection. Falls back to localStorage when
// the API is not configured or unreachable.
const LEADERBOARD_API_URL = (import.meta.env.VITE_LEADERBOARD_API_URL || '').replace(/\/+$/, '');

const KEY = 'attempts';

async function readFromCloud() {
  if (!LEADERBOARD_API_URL) return null;
  try {
    const response = await fetch(`${LEADERBOARD_API_URL}/attempts`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const attempts = Number.isFinite(data?.attempts) ? Math.floor(data.attempts) : 0;
    return attempts >= 0 ? attempts : 0;
  } catch (err) {
    console.warn('[PlayCounter] API read failed:', err.message);
    return null;
  }
}

async function incrementOnCloud() {
  if (!LEADERBOARD_API_URL) return null;
  try {
    const response = await fetch(`${LEADERBOARD_API_URL}/attempts`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const attempts = Number.isFinite(data?.attempts) ? Math.floor(data.attempts) : 0;
    return attempts >= 0 ? attempts : null;
  } catch (err) {
    console.warn('[PlayCounter] API increment failed:', err.message);
    return null;
  }
}

// LocalStorage fallback functions — used when the API is unavailable
// (offline, blocked, or not yet configured).
function readLocal() {
  const raw = load(KEY, 0);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0;
}

function writeLocal(value) {
  save(KEY, value);
}

export async function getAttempts() {
  const cloud = await readFromCloud();
  if (cloud !== null) {
    writeLocal(cloud);
    return cloud;
  }
  return readLocal();
}

export async function recordAttempt() {
  // Try the atomic server-side increment first. This is the only path
  // that can guarantee a durable count across devices.
  const next = await incrementOnCloud();
  if (next !== null) {
    writeLocal(next);
    return next;
  }
  // Fallback: best-effort local increment. This will not be shared with
  // other devices, but it preserves the UI counter when offline.
  const local = readLocal() + 1;
  writeLocal(local);
  return local;
}

export function clearAttempts() {
  save(KEY, 0);
}
