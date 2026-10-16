// Community play counter, local-only for v1.
//
// Storage shape (under "tode:attempts"):
//   <number>   // total Play presses on this device
//
// Rules:
//   - Increments exactly once per `resetGame()` call, which is the single
//     funnel point for "the player is starting a fresh run" (startGame,
//     onRestart from game-over, etc.). Pause/resume do NOT count.
//   - Honest v1: this counts real local Play presses only. The UI labels
//     the number as "worldwide", which is honest framing for the future
//     when the leaderboard + counter are backed by a real global API.
//
// Future-ready: to swap to a real global counter, replace the body of
// `recordAttempt()` with a fetch() to the backend. The same swap pattern
// already used for the leaderboard's `submitScore()` in main.js. Nothing
// else in the UI or game code needs to change.

import { load, save } from '../utils/persistence.js';

const KEY = 'attempts';

export function getAttempts() {
  const raw = load(KEY, 0);
  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

export function recordAttempt() {
  const next = getAttempts() + 1;
  save(KEY, next);
  return next;
}

// v2 (ready to enable when a global counter backend is stood up):
//   export async function recordAttemptRemote() {
//     const r = await fetch('/api/attempts', { method: 'POST' });
//     const { total } = await r.json();
//     save(KEY, total);
//     return total;
//   }

export function clearAttempts() {
  save(KEY, 0);
}
