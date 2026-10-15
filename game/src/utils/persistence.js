// Tiny localStorage wrapper that survives quota / privacy errors and missing
// support (private mode, sandboxed iframes, etc).

const KEY_PREFIX = 'tode:';

export function load(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    window.localStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    window.localStorage.removeItem(KEY_PREFIX + key);
  } catch {
    /* ignore */
  }
}
