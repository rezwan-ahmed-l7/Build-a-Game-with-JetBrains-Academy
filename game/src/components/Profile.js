// Player profile: a single {name, flag} pair stored in localStorage so
// the onboarding only runs once. The flag is the full emoji string
// (e.g. "🇧🇩") so the leaderboard can render it without re-looking-up
// a code at read time.
//
// Validation rules are enforced in the menu UI (the Play button is
// disabled while either field is missing), not here. This module
// just persists whatever it is given.

import { load, save, remove } from '../utils/persistence.js';
import { FALLBACK_EMOJI, FALLBACK_NAME } from '../data/countries.js';

const KEY = 'profile';

function sanitize(value) {
  if (!value || typeof value !== 'object') return null;
  const name = (typeof value.name === 'string') ? value.name : '';
  const flag = (typeof value.flag === 'string') ? value.flag : '';
  if (!name || !flag) return null;
  return { name, flag };
}

export function loadProfile() {
  const raw = load(KEY, null);
  const clean = sanitize(raw);
  if (!clean) return null;
  return clean;
}

export function saveProfile(name, flag) {
  const clean = sanitize({ name, flag });
  if (!clean) {
    remove(KEY);
    return false;
  }
  return save(KEY, clean);
}

export function clearProfile() {
  remove(KEY);
}

// Safe defaults for leaderboard entries when no profile is set.
export function getEffectiveProfile() {
  return loadProfile() || { name: FALLBACK_NAME, flag: FALLBACK_EMOJI };
}
