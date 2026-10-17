// Community play counter — shared across all devices via JSONBin.io.
//
// JSONBin.io is a free cloud JSON storage service — stores the play count
// as a single number in the cloud. Any device/browser can read/write to it.
//
// Storage shape (JSONBin record):
//   { "leaderboard": [...], "attempts": 123 }
//
// Rules:
//   - Increments exactly once per `resetGame()` call, which is the single
//     funnel point for "the player is starting a fresh run" (startGame,
//     onRestart from game-over, etc.). Pause/resume do NOT count.
//   - Falls back to localStorage if network is unavailable.
//
// `getAttempts()` returns the current total count (async).
// `recordAttempt()` increments and returns the new count (async).

import { load, save } from '../utils/persistence.js';

// ---- JSONBin.io Configuration (same bin as Leaderboard.js) ----
const JSONBIN_API_KEY = '$2a$10$JEmUTran3DtFAKce1qSmWu8DKyiD5FADULRM7RnEg0H3N6VcP7NDK';
const JSONBIN_BIN_ID = '6ad32ef4ffd5d16053730958';
const JSONBIN_BASE_URL = 'https://api.jsonbin.io/v3';

// LocalStorage fallback key
const KEY = 'attempts';

// ---- JSONBin.io Cloud Functions ----

async function readFromCloud() {
  try {
    console.log('[PlayCounter] Reading from JSONBin.io...');
    const response = await fetch(`${JSONBIN_BASE_URL}/b/${JSONBIN_BIN_ID}/latest`, {
      method: 'GET',
      headers: {
        'X-Master-Key': JSONBIN_API_KEY
      }
    });

    if (!response.ok) {
      console.warn('[PlayCounter] JSONBin read failed:', response.status);
      return null;
    }

    const data = await response.json();
    const record = data.record || {};
    const attempts = record.attempts;
    console.log('[PlayCounter] Read attempts from cloud:', attempts);
    if (Number.isFinite(attempts) && attempts >= 0) {
      return attempts;
    }
    return 0;
  } catch (err) {
    console.warn('[PlayCounter] JSONBin read failed:', err.message);
    return null;
  }
}

async function writeToCloud(attempts) {
  try {
    console.log('[PlayCounter] Writing attempts to JSONBin.io:', attempts);
    // First, read the current bin data to preserve leaderboard
    const readResponse = await fetch(`${JSONBIN_BASE_URL}/b/${JSONBIN_BIN_ID}/latest`, {
      method: 'GET',
      headers: {
        'X-Master-Key': JSONBIN_API_KEY
      }
    });

    if (!readResponse.ok) {
      console.warn('[PlayCounter] JSONBin read before write failed:', readResponse.status);
      return false;
    }

    const data = await readResponse.json();
    const record = data.record || {};
    // Preserve leaderboard, update attempts
    record.attempts = attempts;

    const writeResponse = await fetch(`${JSONBIN_BASE_URL}/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_API_KEY
      },
      body: JSON.stringify(record)
    });

    if (!writeResponse.ok) {
      console.warn('[PlayCounter] JSONBin write failed:', writeResponse.status);
      return false;
    }
    console.log('[PlayCounter] Write successful!');
    return true;
  } catch (err) {
    console.warn('[PlayCounter] JSONBin write failed:', err.message);
    return false;
  }
}

// ---- LocalStorage Fallback Functions ----

function readLocal() {
  const raw = load(KEY, 0);
  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

function writeLocal(value) {
  save(KEY, value);
}

// ---- Unified Read/Write (Cloud first, fallback to local) ----

export async function getAttempts() {
  const cloud = await readFromCloud();
  if (cloud !== null) {
    // Sync local cache
    writeLocal(cloud);
    console.log('[PlayCounter] getAttempts returned:', cloud);
    return cloud;
  }
  // Fallback to localStorage
  const local = readLocal();
  console.log('[PlayCounter] getAttempts fallback to local:', local);
  return local;
}

export async function recordAttempt() {
  const current = await getAttempts();
  const next = current + 1;
  console.log('[PlayCounter] recordAttempt: current=', current, 'next=', next);

  // Try cloud first
  const success = await writeToCloud(next);
  if (success) {
    console.log('[PlayCounter] recordAttempt success, returned:', next);
    return next;
  }

  // Fallback to localStorage
  console.warn('[PlayCounter] recordAttempt fallback to localStorage');
  writeLocal(next);
  return next;
}

export function clearAttempts() {
  save(KEY, 0);
}
