// Shared community play counter. When the cloud API is configured, it is the
// sole source of truth: never display a device-local number as the global total.
// Local storage is used only for development/offline builds without an API URL.

import { load, save } from '../utils/persistence.js';

const LEADERBOARD_API_URL = (import.meta.env.VITE_LEADERBOARD_API_URL || '').replace(/\\/+$/, '');
const KEY = 'attempts';

async function requestAttempts(method) {
  if (!LEADERBOARD_API_URL) return null;
  try {
    const response = await fetch(`${LEADERBOARD_API_URL}/attempts`, {
      method,
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error(`[PlayCounter] API ${method} failed:`, response.status);
      return null;
    }
    const data = await response.json();
    const attempts = Number.isSafeInteger(data?.attempts) ? data.attempts : null;
    return attempts !== null && attempts >= 0 ? attempts : null;
  } catch (err) {
    console.warn(`[PlayCounter] API ${method} error:`, err.message);
    return null;
  }
}

function readLocal() {
  const raw = load(KEY, 0);
  return Number.isSafeInteger(raw) && raw >= 0 ? raw : 0;
}

export async function getAttempts() {
  if (LEADERBOARD_API_URL) {
    const cloud = await requestAttempts('GET');
    if (cloud !== null) save(KEY, cloud);
    return cloud; // null means unavailable; never pretend local data is global.
  }
  return readLocal();
}

export async function recordAttempt() {
  if (LEADERBOARD_API_URL) {
    const cloud = await requestAttempts('POST');
    if (cloud !== null) save(KEY, cloud);
    return cloud; // Do not increment a separate local counter on cloud failure.
  }
  const local = readLocal() + 1;
  save(KEY, local);
  return local;
}

// Kept for local development/tests. This never resets the shared server counter.
export function clearAttempts() {
  save(KEY, 0);
}
