// Health system. Tracks HP, i-frames, listeners. Pure logic — the hearts
// UI is rendered in Score.js and the hurt flash is applied to Player.

export function createHealth(max = 3, invulnDurationMs = 700) {
  let hp = max;
  let invulnUntilMs = 0; // absolute time (performance.now()) until which damage is blocked
  let listeners = [];

  function now() { return performance.now(); }

  function onChange(fn) { listeners.push(fn); return () => {
    listeners = listeners.filter((l) => l !== fn);
  }; }

  function notify(event, payload) {
    for (const l of listeners) l(event, payload);
  }

  function damage(amount = 1) {
    if (now() < invulnUntilMs) return false;
    if (hp <= 0) return false;
    hp = Math.max(0, hp - amount);
    invulnUntilMs = now() + invulnDurationMs;
    notify('damage', { hp, max: max });
    if (hp === 0) notify('death', { hp, max: max });
    return true;
  }

  function heal(amount = 1) {
    if (hp <= 0) return false; // no overheal on dead
    const before = hp;
    hp = Math.min(max, hp + amount);
    if (hp > before) {
      notify('heal', { hp, max: max });
      return true;
    }
    return false;
  }

  function update(_delta) {
    // No-op: i-frames are wall-clock based, not frame-delta based.
    // We keep update() for API compatibility.
  }

  function reset() {
    hp = max;
    invulnUntilMs = 0;
    notify('reset', { hp, max: max });
  }

  function setMax(value) {
    max = Math.max(1, Math.floor(value));
    if (hp > max) hp = max;
  }

  function isInvulnerable() { return now() < invulnUntilMs; }
  function getHp() { return hp; }
  function getMax() { return max; }
  function isDead() { return hp <= 0; }

  return {
    damage, heal, update, reset, onChange, setMax,
    isInvulnerable, getHp, getMax, isDead
  };
}
