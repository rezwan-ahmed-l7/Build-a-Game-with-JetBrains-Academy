// Top-5 leaderboard, local-only for v1.
//
// Storage shape (under "tode:leaderboard"):
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
// `submitScore(entry)` returns the new rank (1-5) if the run is on the
// board, or null if it didn't make it. The game-over UI uses this to
// decide whether to flash a "you placed #N" badge.

import { load, save } from '../utils/persistence.js';

const KEY = 'leaderboard';
const CAP = 5;

function read() {
  const raw = load(KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((e) => e && typeof e === 'object'
    && typeof e.name === 'string'
    && typeof e.flag === 'string'
    && Number.isFinite(e.score));
}

function write(board) {
  save(KEY, board);
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

export function getTop() {
  return sortDesc(read()).slice(0, CAP);
}

export function loadBoard() {
  return getTop();
}

// Returns 1-5 if the entry is in the final top 5, else null.
export function submitScore(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const { name, flag, score, ts } = entry;
  if (typeof name !== 'string' || !name) return null;
  if (typeof flag !== 'string' || !flag) return null;
  if (!Number.isFinite(score)) return null;

  const board = read();
  const incoming = { name, flag, score, ts: ts || Date.now() };

  // Replace existing entry for this player if the new score is better.
  const existingIdx = board.findIndex((e) => sameIdentity(e, incoming));
  if (existingIdx !== -1) {
    if (incoming.score > board[existingIdx].score) {
      board[existingIdx] = incoming;
    } else {
      // Worse score — keep the existing entry. Board unchanged.
      return rankOf(incoming);
    }
  } else {
    board.push(incoming);
  }

  const sorted = sortDesc(board).slice(0, CAP);
  write(sorted);
  return rankOf(incoming);
}

function rankOf(entry) {
  const top = getTop();
  const idx = top.findIndex((e) => sameIdentity(e, entry) && e.score === entry.score);
  return idx === -1 ? null : idx + 1;
}

export function clearBoard() {
  save(KEY, []);
}
