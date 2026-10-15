// Combo system. Each kill within the chain window extends it; missing the
// window resets. Multiplier: 1x at 0-1, 2x at 2, 3x at 3, 4x at 4, 5x at 5+.
//
// Wall-clock based so it works correctly even when frame deltas spike.

const WINDOW_MS = 1500;

export function createCombo() {
  let count = 0;
  let expireAtMs = 0;

  function now() { return performance.now(); }

  function register() {
    count += 1;
    expireAtMs = now() + WINDOW_MS;
  }

  function update(_delta) {
    if (count > 0 && now() > expireAtMs) {
      count = 0;
      expireAtMs = 0;
    }
  }

  function getMultiplier() {
    if (count <= 1) return 1;
    if (count === 2) return 2;
    if (count === 3) return 3;
    if (count === 4) return 4;
    return 5;
  }

  function reset() {
    count = 0;
    expireAtMs = 0;
  }

  function getCount() { return count; }
  function getTimeLeft() {
    const left = expireAtMs - now();
    return left > 0 ? left / 1000 : 0;
  }

  return { register, update, getMultiplier, reset, getCount, getTimeLeft, WINDOW_MS };
}
