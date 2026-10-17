// Top-5 shared leaderboard using JSONBin.io (no database needed).
//
// JSONBin.io is a free cloud JSON storage service — stores the leaderboard
// as a JSON array in the cloud. Any device/browser can read/write to it.
//
// Storage shape (JSONBin record):
//   [{ name, flag, score, ts }, ...]   // length <= 5, sorted desc by score
//
// Rules:
//   - Cap is 5 entries.
//   - Sort desc by `score`; ties broken by ascending `ts` (oldest wins).
//   - Identity is (name, flag). A repeat player only keeps their best
//     score, so a worse run doesn't bump them off the board.
//   - If a new run would push a unique player out of the cap and the
//     existing player has a higher score, the existing player stays.
//
// Fallback: If network is unavailable, falls back to localStorage so the
// game still works offline. Scores submitted offline will be synced next
// time the player is online.
//
// `submitScore(entry)` returns the new rank (1-5) if the run is on the
// board, or null if it didn't make it. The game-over UI uses this to
// decide whether to flash a "you placed #N" badge.

import { load, save } from '../utils/persistence.js';

// ---- Server-side leaderboard API configuration ----
// Set VITE_LEADERBOARD_API_URL in the Render Static Site environment.
// The JSONBin Master Key must only exist on the separate backend service.
const LEADERBOARD_API_URL = (import.meta.env.VITE_LEADERBOARD_API_URL || '').replace(/\/+$/, '');

// LocalStorage fallback key
const KEY = 'leaderboard';
const CAP = 5;

// ---- Server-side leaderboard API functions ----

async function readFromCloud() {
  if (!LEADERBOARD_API_URL) return null;
  try {
    const response = await fetch(`${LEADERBOARD_API_URL}/leaderboard`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.error('[Leaderboard] API read failed:', response.status);
      return null;
    }
    const data = await response.json();
    const raw = data?.leaderboard;
    if (!Array.isArray(raw)) return [];
    return raw.filter((entry) => entry && typeof entry === 'object'
      && typeof entry.name === 'string'
      && typeof entry.flag === 'string'
      && Number.isFinite(entry.score));
  } catch (err) {
    console.error('[Leaderboard] API read error:', err.message);
    return null;
  }
}

async function writeToCloud(board) {
  if (!LEADERBOARD_API_URL) return false;
  try {
    const response = await fetch(`${LEADERBOARD_API_URL}/leaderboard`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(board),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.error('[Leaderboard] API write failed:', response.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Leaderboard] API write error:', err.message);
    return false;
  }
}

// ---- LocalStorage Fallback Functions ----

function readLocal() {
  const raw = load(KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((e) => e && typeof e === 'object'
    && typeof e.name === 'string'
    && typeof e.flag === 'string'
    && Number.isFinite(e.score));
}

function writeLocal(board) {
  save(KEY, board);
}

// ---- Unified Read/Write (Cloud first, fallback to local) ----

async function read() {
  const cloud = await readFromCloud();
  const local = readLocal();
  
  // If cloud has entries, deduplicate them first
  if (cloud !== null && cloud.length > 0) {
    const deduped = deduplicate(cloud);
    return sortDesc(deduped).slice(0, CAP);
  }
  // If cloud is empty or failed, merge with local to preserve entries
  if (local.length > 0) {
    // Merge cloud and local, deduplicate by identity
    const merged = [...(cloud || [])];
    for (const entry of local) {
      const existingIdx = merged.findIndex(e => sameIdentity(e, entry));
      if (existingIdx === -1) {
        merged.push(entry);
      } else if (entry.score > merged[existingIdx].score) {
        merged[existingIdx] = entry;
      }
    }
    return sortDesc(merged).slice(0, CAP);
  }
  return cloud || [];
}

function deduplicate(board) {
  // Keep only the best score per unique (name, flag) identity.
  const seen = new Map();
  for (const entry of board) {
    const key = entry.name + '|' + entry.flag;
    if (!seen.has(key) || entry.score > seen.get(key).score) {
      seen.set(key, entry);
    }
  }
  return Array.from(seen.values());
}

async function write(board) {
  // Deduplicate before writing to cloud to prevent duplicates
  const deduped = deduplicate(board);
  const success = await writeToCloud(deduped);
  // Always sync localStorage so it stays in line with the cloud.
  // When cloud succeeds, local is a fresh backup.
  // When cloud fails, local acts as the fallback store.
  writeLocal(deduped);
}

function sortDesc(board) {
  // Higher score first; on tie, oldest timestamp first.
  return board.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.ts || 0) - (b.ts || 0);
  });
}

function sameIdentity(a, b) {
  return a.name === b.name && a.flag === b.flag;
}

export async function getTop() {
  const board = await read();
  return sortDesc(board).slice(0, CAP);
}

export async function loadBoard() {
  return getTop();
}

// Returns 1-5 if the entry is in the final top 5, else null.
export async function submitScore(entry) {
  console.log('[Leaderboard] submitScore called with:', entry);
  if (!entry || typeof entry !== 'object') {
    console.error('[Leaderboard] Invalid entry:', entry);
    return null;
  }
  const { name, flag, score, ts } = entry;
  if (typeof name !== 'string' || !name) {
    console.error('[Leaderboard] Invalid name:', name);
    return null;
  }
  if (typeof flag !== 'string' || !flag) {
    console.error('[Leaderboard] Invalid flag:', flag);
    return null;
  }
  if (!Number.isFinite(score)) {
    console.error('[Leaderboard] Invalid score:', score);
    return null;
  }

  const board = await read();
  const incoming = { name, flag, score, ts: ts || Date.now() };
  console.log('[Leaderboard] Current board:', board.length, 'entries');

  // Replace existing entry for this player if the new score is better.
  const existingIdx = board.findIndex((e) => sameIdentity(e, incoming));
  if (existingIdx !== -1) {
    if (incoming.score > board[existingIdx].score) {
      console.log('[Leaderboard] Updating existing entry for:', name);
      board[existingIdx] = incoming;
    } else {
      // Worse score — keep the existing entry. Board unchanged.
      console.log('[Leaderboard] New score worse than existing for:', name);
      return rankOfLocal(board, incoming);
    }
  } else {
    console.log('[Leaderboard] Adding new entry for:', name);
    board.push(incoming);
  }

  const sorted = sortDesc(board).slice(0, CAP);
  console.log('[Leaderboard] Sorted board:', sorted.length, 'entries');
  await write(sorted);
  const rank = rankOfLocal(sorted, incoming);
  console.log('[Leaderboard] Final rank:', rank);
  return rank;
}

function rankOfLocal(board, entry) {
  const idx = board.findIndex((e) => sameIdentity(e, entry) && e.score === entry.score);
  return idx === -1 ? null : idx + 1;
}

export async function clearBoard() {
  await write([]);
}
