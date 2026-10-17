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

// ---- JSONBin.io Configuration ----
// Sign up at https://jsonbin.io (free), create a bin with the leaderboard
// data, then fill in your API key and bin ID below.
//
// To set up:
// 1. Create a free account at jsonbin.io
// 2. Go to API Keys page and copy your Master Key
// 3. Create a new bin with: {"leaderboard": []}
// 4. Copy the bin ID from the URL (e.g., /b/6360e54a65b57a31e6a94a42)
// 5. Paste the values below
//
// Never ship a JSONBin Master Key in browser code: every visitor can read it.
// Cloud sync is deliberately disabled until a server-side proxy is configured.
// The localStorage leaderboard remains fully functional in the meantime.
const JSONBIN_API_KEY = '';
const JSONBIN_BIN_ID = '6ad32ef4ffd5d16053730958';
const JSONBIN_BASE_URL = 'https://api.jsonbin.io/v3';

// LocalStorage fallback key
const KEY = 'leaderboard';
const CAP = 5;

// ---- JSONBin.io Cloud Functions ----

async function readFromCloud() {
  if (!JSONBIN_API_KEY || !JSONBIN_BIN_ID) return null;
  try {
    console.log('[Leaderboard] Reading from JSONBin.io...');
    const response = await fetch(`${JSONBIN_BASE_URL}/b/${JSONBIN_BIN_ID}/latest`, {
      method: 'GET',
      headers: {
        'X-Master-Key': JSONBIN_API_KEY
      }
    });

    console.log('[Leaderboard] Read response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Leaderboard] JSONBin read failed:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log('[Leaderboard] Read data:', data);
    const raw = data.record?.leaderboard || data.record || [];
    if (!Array.isArray(raw)) return [];
    const filtered = raw.filter((e) => e && typeof e === 'object'
      && typeof e.name === 'string'
      && typeof e.flag === 'string'
      && Number.isFinite(e.score));
    console.log('[Leaderboard] Filtered entries:', filtered.length);
    return filtered;
  } catch (err) {
    console.error('[Leaderboard] JSONBin network error:', err.message, err);
    return null;
  }
}

async function writeToCloud(board) {
  if (!JSONBIN_API_KEY || !JSONBIN_BIN_ID) return false;
  try {
    console.log('[Leaderboard] Writing to JSONBin.io...', board.length, 'entries');
    
    // First, read the current bin data to preserve attempts counter
    const readResponse = await fetch(`${JSONBIN_BASE_URL}/b/${JSONBIN_BIN_ID}/latest`, {
      method: 'GET',
      headers: {
        'X-Master-Key': JSONBIN_API_KEY
      }
    });
    
    const record = { leaderboard: board };
    
    if (readResponse.ok) {
      const data = await readResponse.json();
      const currentRecord = data.record || {};
      // Preserve the attempts counter if it exists, otherwise initialize to 0
      if (Number.isFinite(currentRecord.attempts)) {
        record.attempts = currentRecord.attempts;
      } else {
        record.attempts = 0;
      }
    } else {
      // If we can't read current data, initialize attempts to 0
      record.attempts = 0;
    }
    
    const response = await fetch(`${JSONBIN_BASE_URL}/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_API_KEY
      },
      body: JSON.stringify(record)
    });

    console.log('[Leaderboard] Write response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Leaderboard] JSONBin write failed:', response.status, errorText);
      return false;
    }
    console.log('[Leaderboard] Write successful!');
    return true;
  } catch (err) {
    console.error('[Leaderboard] JSONBin network error:', err.message, err);
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
