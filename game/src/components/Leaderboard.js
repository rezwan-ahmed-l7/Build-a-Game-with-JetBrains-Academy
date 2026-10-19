// Shared Top-5 leaderboard backed by the server-side JSONBin proxy.
// With a cloud API URL configured, the API is authoritative. Local-only scores
// must never be merged into or shown as if they were part of the global board.

import { load, save } from '../utils/persistence.js';

const LEADERBOARD_API_URL = (import.meta.env.VITE_LEADERBOARD_API_URL || '').replace(/\\/+$/, '');
const KEY = 'leaderboard';
const CAP = 5;
let cloudUnavailable = false;

export function isLeaderboardUnavailable() {
  return Boolean(LEADERBOARD_API_URL) && cloudUnavailable;
}

async function readFromCloud() {
  if (!LEADERBOARD_API_URL) return null;
  try {
    const response = await fetch(`${LEADERBOARD_API_URL}/leaderboard`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.error('[Leaderboard] API read failed:', response.status);
      return null;
    }
    const data = await response.json();
    if (!Array.isArray(data?.leaderboard)) return null;
    cloudUnavailable = false;
    return data.leaderboard.filter(isValidEntry);
  } catch (err) {
    console.error('[Leaderboard] API read error:', err.message);
    return null;
  }
}

async function writeToCloud(board) {
  if (!LEADERBOARD_API_URL) return null;
  try {
    const response = await fetch(`${LEADERBOARD_API_URL}/leaderboard`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(board),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.error('[Leaderboard] API write failed:', response.status);
      return null;
    }
    const data = await response.json();
    if (!Array.isArray(data?.leaderboard)) return null;
    cloudUnavailable = false;
    return data.leaderboard.filter(isValidEntry);
  } catch (err) {
    console.error('[Leaderboard] API write error:', err.message);
    return null;
  }
}

function isValidEntry(entry) {
  return Boolean(entry && typeof entry === 'object'
    && typeof entry.name === 'string' && typeof entry.flag === 'string'
    && Number.isFinite(entry.score));
}

function readLocal() {
  const raw = load(KEY, []);
  return Array.isArray(raw) ? raw.filter(isValidEntry) : [];
}

function deduplicate(board) {
  const seen = new Map();
  for (const entry of board) {
    const key = entry.name + '|' + entry.flag;
    if (!seen.has(key) || entry.score > seen.get(key).score) seen.set(key, entry);
  }
  return [...seen.values()];
}

function sortDesc(board) {
  return board.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.ts || 0) - (b.ts || 0);
  });
}

function sameIdentity(a, b) {
  return a.name === b.name && a.flag === b.flag;
}

// Returns an array for a successful read; null indicates cloud failure.
async function read() {
  if (LEADERBOARD_API_URL) {
    const cloud = await readFromCloud();
    cloudUnavailable = cloud === null;
    return cloud === null ? null : sortDesc(deduplicate(cloud)).slice(0, CAP);
  }
  cloudUnavailable = false;
  return sortDesc(deduplicate(readLocal())).slice(0, CAP);
}

async function write(board) {
  const deduped = sortDesc(deduplicate(board)).slice(0, CAP);
  if (LEADERBOARD_API_URL) {
    const saved = await writeToCloud(deduped);
    cloudUnavailable = saved === null;
    if (saved === null) return null;
    save(KEY, saved); // cache only after the authoritative cloud write succeeds
    return sortDesc(deduplicate(saved)).slice(0, CAP);
  }
  save(KEY, deduped);
  return deduped;
}

export async function getTop() {
  const board = await read();
  return board === null ? [] : sortDesc(board).slice(0, CAP);
}

export async function loadBoard() {
  return getTop();
}

// Returns rank 1-5 if the saved authoritative board contains this score.
export async function submitScore(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const { name, flag, score, ts } = entry;
  if (typeof name !== 'string' || !name.trim() || name.length > 24
      || typeof flag !== 'string' || !flag || !Number.isFinite(score) || score < 0) {
    return null;
  }

  const board = await read();
  if (board === null) return null;

  const incoming = { name: name.trim(), flag, score: Math.floor(score), ts: ts || Date.now() };
  const existingIdx = board.findIndex((e) => sameIdentity(e, incoming));
  if (existingIdx !== -1) {
    if (incoming.score <= board[existingIdx].score) return rankOf(board, board[existingIdx]);
    board[existingIdx] = incoming;
  } else {
    board.push(incoming);
  }

  const saved = await write(board);
  return saved === null ? null : rankOf(saved, incoming);
}

function rankOf(board, entry) {
  const idx = board.findIndex((e) => sameIdentity(e, entry) && e.score === entry.score);
  return idx === -1 ? null : idx + 1;
}

export async function clearBoard() {
  await write([]);
}
