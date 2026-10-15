// Mulberry32 — fast, deterministic PRNG. Returns a function that yields
// floats in [0, 1). Same seed → same sequence. Used for procedural placement
// (obstacles, houses) and any non-cryptographic randomness we want
// reproducible.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng, a, b) {
  return a + (b - a) * rng();
}

export function randInt(rng, a, b) {
  // inclusive of a, exclusive of b
  return Math.floor(a + (b - a) * rng());
}

export function chance(rng, p) {
  return rng() < p;
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Weighted pick: items is [{ weight, value }]. Higher weight = more likely.
export function pickWeighted(rng, items) {
  let total = 0;
  for (const it of items) total += it.weight;
  let r = rng() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it.value;
  }
  return items[items.length - 1].value;
}
