import { GameState } from './GameState.js';
import { recordAttempt } from './PlayCounter.js';
import { POWERUP_TYPES } from './PowerUp.js';
import { TODE_TOAST, TODE_LEVEL_UP, TODE_COMBO_MILESTONE } from '../events.js';

// Boost durations and multipliers
const ATTACK_BOOST_DURATION = 10;
const ATTACK_BOOST_MULT = 1.85;
const SPEED_BOOST_DURATION = 8;
const SPEED_BOOST_MULT = 1.7;
const PLAYER_PUSHBACK = 18;

let attackRef = null;
let menusRef = null;
let countdownTimer = 0; // handle for the in-flight 3-2-1 start countdown

// Level-based frog stat scaling config
// { maxHp, attackDamage, attackCooldown, moveSpeedMult, dashCooldownMs }
const LEVEL_STATS = {
  1: { maxHp: 3, attackRadius: 42, attackDamage: 2, attackCooldown: 0.50, moveSpeedMult: 1.0, dashCooldownMs: 3000 },
  2: { maxHp: 3, attackRadius: 42, attackDamage: 2.5, attackCooldown: 0.50, moveSpeedMult: 1.0, dashCooldownMs: 3000 },
  3: { maxHp: 4, attackRadius: 45, attackDamage: 3, attackCooldown: 0.40, moveSpeedMult: 1.1, dashCooldownMs: 2500 },
  4: { maxHp: 4, attackRadius: 45, attackDamage: 3.5, attackCooldown: 0.40, moveSpeedMult: 1.1, dashCooldownMs: 2500 },
  5: { maxHp: 5, attackRadius: 48, attackDamage: 4, attackCooldown: 0.30, moveSpeedMult: 1.2, dashCooldownMs: 2000 },
  6: { maxHp: 5, attackRadius: 51, attackDamage: 4.5, attackCooldown: 0.30, moveSpeedMult: 1.2, dashCooldownMs: 2000 },
  7: { maxHp: 5, attackRadius: 51, attackDamage: 5, attackCooldown: 0.20, moveSpeedMult: 1.2, dashCooldownMs: 2000 },
  8: { maxHp: 5, attackRadius: 55, attackDamage: 5.5, attackCooldown: 0.20, moveSpeedMult: 1.2, dashCooldownMs: 2000 },
  9: { maxHp: 6, attackRadius: 60, attackDamage: 6, attackCooldown: 0.10, moveSpeedMult: 1.3, dashCooldownMs: 1500 },
};

function getLevelStats(level) {
  // Return stats for the given level, clamping to known ranges
  if (level <= 1) return LEVEL_STATS[1];
  if (level >= 9) return LEVEL_STATS[9];
  return LEVEL_STATS[level] || LEVEL_STATS[Math.min(level, 9)];
}

// Power-up effect scaling by level
function getPowerUpEffect(type, level) {
  if (type === 'heal') {
    if (level >= 5) return { amount: 2, label: '+2 HP' };
    return { amount: 1, label: '+1 HP' };
  }
  if (type === 'score') {
    if (level >= 7) return { bonus: 40, label: '+40 Bonus' };
    if (level >= 5) return { bonus: 25, label: '+25 Bonus' };
    if (level >= 3) return { bonus: 15, label: '+15 Bonus' };
    return { bonus: 8, label: '+8 Bonus' };
  }
  if (type === 'speed') {
    if (level >= 7) return { mult: 2.0, duration: 12, label: 'Speed x2.0 for 12s' };
    if (level >= 5) return { mult: 2.0, duration: 10, label: 'Speed x2.0 for 10s' };
    if (level >= 3) return { mult: 1.8, duration: 10, label: 'Speed x1.8 for 10s' };
    return { mult: 1.7, duration: 8, label: 'Speed x1.7 for 8s' };
  }
  if (type === 'attack') {
    if (level >= 7) return { mult: 2.2, duration: 15, label: 'Attack x2.2 for 15s' };
    if (level >= 5) return { mult: 2.2, duration: 12, label: 'Attack x2.2 for 12s' };
    if (level >= 3) return { mult: 2.0, duration: 12, label: 'Attack x2.0 for 12s' };
    return { mult: 1.85, duration: 10, label: 'Attack x1.85 for 10s' };
  }
  // New power-up types
  if (type === 'shield') {
    return { duration: 5, label: 'Shield 5s' };
  }
  if (type === 'doubleAttack') {
    return { duration: 8, label: '2x Damage 8s' };
  }
  if (type === 'magnet') {
    return { duration: 10, radius: 50, label: 'Magnet 10s' };
  }
  if (type === 'freeze') {
    return { duration: 3, label: 'Freeze 3s' };
  }
  return { amount: 1, label: '???' };
}

export function createGameManager({
  player,
  input,
  movement,
  health,
  combo,
  score,
  enemyManager,
  powerUps,
  dash,
  attack,
  audio,
  menus,
  particles,
  damageNumbers,
  screenShake,
  damageFlash
}) {
  // Store references so they can be set later (attack and menus may be null at creation time)
  if (attack) attackRef = attack;
  if (menus) menusRef = menus;

  let currentState = GameState.MENU;
  let attackBoostRemaining = 0;
  let speedBoostRemaining = 0;
  let flashTimer = 0;
  let currentLevel = 1;
  let lastDisplayedLevel = 0;
  // Pause-menu stats — tracked per-run.
  let killCount = 0;
  let runStartTime = 0; // performance.now() when startGame fired
  let shieldRemaining = 0;       // invincibility from shield power-up
  let doubleAttackRemaining = 0; // 2x damage from double attack power-up
  let magnetRemaining = 0;       // auto-pickup radius from magnet power-up
  let freezeRemaining = 0;       // enemies frozen
  let resumeCountdownTimer = 0;  // handle for the in-flight 3-2-1 chain
  let mysteryChoiceTimer = 0;
  let mysteryChoiceActive = false;
  let attackBoostMultiplier = 1;
  const RESUME_TICK_MS = 800;

  function getAttack() {
    return attackRef;
  }

  function getMenus() {
    return menusRef;
  }

  function setAttack(a) {
    attackRef = a;
  }

  function setMenus(m) {
    menusRef = m;
  }

  function getBoostedAttackRadius() {
    const stats = getLevelStats(currentLevel);
    return stats.attackRadius * attackBoostMultiplier;
  }

  function flashDamage() {
    damageFlash.classList.add('active');
    flashTimer = 0.2;
    setTimeout(() => damageFlash.classList.remove('active'), 200);
  }

  // Health / damage flow
  health.onChange((event, payload) => {
    if (event === 'damage') {
      player.flash();
      audio.playHurt();
      flashDamage();
      screenShake.kick(2.5);
    } else if (event === 'heal') {
      audio.playPickup();
      particles.spawnBurst(player.group.position.x, player.group.position.y, player.group.position.z + 8, {
        count: 16, color: 0xff7799, speed: 70, life: 0.6, size: 6
      });
    } else if (event === 'death') {
      triggerGameOver();
    } else if (event === 'reset') {
      damageFlash.classList.remove('active');
    }
    score.setHearts(payload.hp, payload.max);
  });

  function tickComboHud() {
    score.setCombo(combo.getCount(), combo.getTimeLeft());
  }

  function onPowerUpPickup(type, pos, effectOverride = null) {
    audio.playPowerUp ? audio.playPowerUp() : audio.playPickup();
    const lvl = currentLevel;
    if (type === 'heal') {
      const eff = effectOverride || getPowerUpEffect('heal', lvl);
      health.heal(eff.amount);
      damageNumbers.spawn(eff.label, pos.x, pos.y, pos.z + 6, '#7ee08a', { kind: 'heal' });
    } else if (type === 'score') {
      const eff = effectOverride || getPowerUpEffect('score', lvl);
      score.addFlatBonus(eff.bonus);
      damageNumbers.spawn(eff.label, pos.x, pos.y, pos.z + 6, '#ffd166', { kind: 'power' });
      particles.spawnBurst(pos.x, pos.y, pos.z, { count: 24, color: 0xffd166, speed: 90, life: 0.7, size: 7 });
    } else if (type === 'speed') {
      const eff = effectOverride || getPowerUpEffect('speed', lvl);
      speedBoostRemaining = eff.duration;
      movement.setSpeedMultiplier(eff.mult);
      score.addKillBonus(2);
      damageNumbers.spawn(eff.label, pos.x, pos.y, pos.z + 6, '#4cc9f0', { kind: 'power' });
      particles.spawnBurst(pos.x, pos.y, pos.z, { count: 22, color: 0x4cc9f0, speed: 80, life: 0.7, size: 6 });
    } else if (type === 'attack') {
      const eff = getPowerUpEffect('attack', lvl);
      attackBoostRemaining = eff.duration;
      attackBoostMultiplier = eff.mult;
      attackRef.setRadius(getBoostedAttackRadius());
      score.addKillBonus(4);
      damageNumbers.spawn(eff.label, pos.x, pos.y, pos.z + 6, '#9ee7ff', { kind: 'power' });
      particles.spawnBurst(pos.x, pos.y, pos.z, { count: 28, color: 0x9ee7ff, speed: 100, life: 0.8, size: 7 });
    } else if (type === 'shield') {
      const eff = effectOverride || getPowerUpEffect('shield', lvl);
      shieldRemaining = eff.duration;
      damageNumbers.spawn(eff.label, pos.x, pos.y, pos.z + 6, '#ffffff', { kind: 'power' });
      particles.spawnBurst(pos.x, pos.y, pos.z, { count: 20, color: 0xffffff, speed: 80, life: 0.7, size: 6 });
    } else if (type === 'doubleAttack') {
      const eff = effectOverride || getPowerUpEffect('doubleAttack', lvl);
      doubleAttackRemaining = eff.duration;
      damageNumbers.spawn(eff.label, pos.x, pos.y, pos.z + 6, '#ffdd44', { kind: 'crit' });
      particles.spawnBurst(pos.x, pos.y, pos.z, { count: 20, color: 0xffdd44, speed: 80, life: 0.7, size: 6 });
    } else if (type === 'magnet') {
      const eff = effectOverride || getPowerUpEffect('magnet', lvl);
      magnetRemaining = eff.duration;
      damageNumbers.spawn(eff.label, pos.x, pos.y, pos.z + 6, '#aa88ff', { kind: 'power' });
      particles.spawnBurst(pos.x, pos.y, pos.z, { count: 20, color: 0xaa88ff, speed: 80, life: 0.7, size: 6 });
    } else if (type === 'freeze') {
      const eff = effectOverride || getPowerUpEffect('freeze', lvl);
      freezeRemaining = eff.duration;
      damageNumbers.spawn(eff.label, pos.x, pos.y, pos.z + 6, '#88ddff', { kind: 'power' });
      particles.spawnBurst(pos.x, pos.y, pos.z, { count: 24, color: 0x88ddff, speed: 100, life: 0.8, size: 7 });
    }
    // Toast the pickup so the HUD shows what was grabbed. POWERUP_TYPES
    // is the single source of truth for label/desc/color — keeps the
    // toast in sync with the 3D shape definitions in PowerUp.js.
    const def = POWERUP_TYPES[type];
    if (def) {
      window.dispatchEvent(new CustomEvent(TODE_TOAST, {
        detail: { label: def.label, desc: def.desc, color: def.color }
      }));
    }
  }

  function triggerGameOver() {
    if (currentState === GameState.GAMEOVER) return;
    currentState = GameState.GAMEOVER;
    input.setEnabled(false);
    dash.cancel();
    player.group.visible = false;
    audio.stopAmbient();
    audio.playGameOver();
    score.showGameOver();
  }

  // Apply level-based stats to all subsystems
  function applyLevelStats(level) {
    const stats = getLevelStats(level);
    currentLevel = level;

    // Health: set max HP without resetting current HP
    // (on initial game start, reset() is called before this, so HP is already full)
    // (on level up, only adjust max and clamp current HP if needed)
    const oldMax = health.getMax();
    health.setMax(stats.maxHp);
    if (stats.maxHp < oldMax) {
      // Max decreased — clamp current HP
      const currentHp = health.getHp();
      if (currentHp > stats.maxHp) {
        health.damage(currentHp - stats.maxHp);
      }
    }

    // Attack: set cooldown and damage
    attackRef.setRadius(stats.attackRadius);
    attackRef.setCooldown(stats.attackCooldown);
    attackRef.setDamage(stats.attackDamage);

    // Movement: set base speed multiplier
    movement.setSpeedMultiplier(stats.moveSpeedMult);

    // Dash: set cooldown and level-based duration/i-frames
    dash.setCooldown(stats.dashCooldownMs);
    if (typeof dash.setLevel === 'function') {
      dash.setLevel(level);
    }

    // Update hearts UI with actual current HP, not max
    score.setHearts(health.getHp(), stats.maxHp);

    // Update power-up manager level
    if (typeof powerUps.setLevel === 'function') {
      powerUps.setLevel(level);
    }
  }

  // Trigger level-up visual/audio feedback
  function triggerLevelUp(level) {
    currentLevel = level;
    lastDisplayedLevel = level;
    const pos = player.group.position;
    damageNumbers.spawn(`⬆ Lv. ${level}!`, pos.x, pos.y, pos.z + 12, '#ffd700');
    particles.spawnBurst(pos.x, pos.y, pos.z + 8, {
      count: 30, color: 0xffd700, speed: 120, life: 1.0, size: 8
    });
    audio.playLevelUp();
    // Notify the main loop so it can fire the full-screen vignette +
    // "LEVEL UP" banner. Keeps GameManager decoupled from DOM.
    window.dispatchEvent(new CustomEvent(TODE_LEVEL_UP, { detail: { level } }));
  }

  // 3-2-1 countdown before gameplay begins. During countdown the player
  // cannot move, enemies don't spawn, and no damage or score accumulates.
  const COUNTDOWN_TICK_MS = 800;
  function beginCountdown() {
    if (countdownTimer) clearTimeout(countdownTimer);
    let n = 3;
    const tick = () => {
      countdownTimer = 0;
      if (currentState !== GameState.COUNTDOWN) {
        // Player died or something else interrupted — bail.
        return;
      }
      if (n <= 0) {
        // Countdown finished — start the actual game
        currentState = GameState.PLAYING;
        input.setEnabled(true);
        menusRef.clearResumeCountdown && menusRef.clearResumeCountdown();
        runStartTime = performance.now();
        return;
      }
      menusRef.showResumeCountdown && menusRef.showResumeCountdown(n);
      n -= 1;
      countdownTimer = setTimeout(tick, COUNTDOWN_TICK_MS);
    };
    tick();
  }

  function resetGame() {
    if (mysteryChoiceTimer) clearTimeout(mysteryChoiceTimer);
    mysteryChoiceTimer = 0;
    mysteryChoiceActive = false;
    menusRef.hideMysteryChoice && menusRef.hideMysteryChoice();
    if (resumeCountdownTimer) clearTimeout(resumeCountdownTimer);
    resumeCountdownTimer = 0;
    menusRef.clearResumeCountdown && menusRef.clearResumeCountdown();
    // Bump the community play counter. This is the single funnel point
    // for "player is starting a fresh run" (startGame + onRestart from
    // game-over both route through here), so pause/resume won't double
    // count and every Play press contributes exactly once.
    recordAttempt().catch(() => {}); // fire-and-forget, don't block game start
    input.setEnabled(false); // disabled during countdown
    player.group.position.set(0, 0, 0);
    movement.reset();
    player.group.visible = true;
    health.reset();
    combo.reset();
    enemyManager.removeAll();
    powerUps.removeAll();
    dash.reset();
    score.reset();
    killCount = 0;
    // runStartTime is set when countdown finishes, not here

    // Apply level-based stats
    currentLevel = 1;
    lastDisplayedLevel = 0;
    applyLevelStats(1);

    attackBoostRemaining = 0;
    attackBoostMultiplier = 1;
    speedBoostRemaining = 0;
    shieldRemaining = 0;
    doubleAttackRemaining = 0;
    magnetRemaining = 0;
    freezeRemaining = 0;

    currentState = GameState.COUNTDOWN;
    score.hideGameOver();
    beginCountdown();
  }

  function startGame() {
    audio.resume().then(() => {
      audio.startAmbient();
    }).catch(() => {
      audio.startAmbient();
    });
    resetGame();
    menusRef.hideStart();
    menusRef.showHud(true);
  }

  function togglePause() {
    if (mysteryChoiceActive) return;
    if (currentState === GameState.PLAYING) {
      currentState = GameState.PAUSED;
      input.setEnabled(false);
      dash.cancel();
      menusRef.showPause();
    } else if (currentState === GameState.PAUSED) {
      // If a resume countdown is mid-flight, cancel it so a fresh pause
      // doesn't overlap a stale tick firing after we hide the menu.
      if (resumeCountdownTimer) {
        clearTimeout(resumeCountdownTimer);
        resumeCountdownTimer = 0;
      }
      currentState = GameState.PLAYING;
      input.setEnabled(true);
      menusRef.hidePause();
    }
  }

  const MYSTERY_COMMON = ['heal', 'attack', 'score', 'speed'];
  const MYSTERY_BETTER = ['freeze', 'doubleAttack', 'shield', 'magnet'];

  function weightedMysteryType(pool) {
    // Rare-tier odds are deliberately low early on, then rise with level.
    const weights = currentLevel >= 9
      ? { freeze: 7, doubleAttack: 10, shield: 12, magnet: 14 }
      : currentLevel >= 7
        ? { freeze: 5, doubleAttack: 8, shield: 10, magnet: 12 }
        : currentLevel >= 5
          ? { freeze: 3, doubleAttack: 5, shield: 8, magnet: 10 }
          : { freeze: 1, doubleAttack: 2, shield: 4, magnet: 6 };
    const total = pool.reduce((sum, type) => sum + (weights[type] || 1), 0);
    let roll = Math.random() * total;
    for (const type of pool) {
      roll -= weights[type] || 1;
      if (roll < 0) return type;
    }
    return pool[pool.length - 1];
  }

  function sampleDistinct(pool, count, tier) {
    const remaining = [...pool];
    const picked = [];
    while (picked.length < count && remaining.length) {
      const type = tier === 'better'
        ? weightedMysteryType(remaining)
        : remaining[Math.floor(Math.random() * remaining.length)];
      picked.push(type);
      remaining.splice(remaining.indexOf(type), 1);
    }
    return picked;
  }

  function mysteryEffect(type) {
    const lvl = currentLevel;
    if (type === 'freeze') {
      const duration = lvl >= 9 ? 3 : lvl >= 7 ? 2.5 : lvl >= 5 ? 2 : 1.5;
      return { duration, label: `Freeze ${duration}s` };
    }
    if (type === 'doubleAttack') {
      const duration = lvl >= 9 ? 8 : lvl >= 7 ? 7 : lvl >= 5 ? 6 : 5;
      return { duration, label: `2x Damage ${duration}s` };
    }
    if (type === 'shield') {
      const duration = lvl >= 9 ? 5 : lvl >= 7 ? 4 : lvl >= 5 ? 3 : 2;
      return { duration, label: `Shield ${duration}s` };
    }
    if (type === 'magnet') {
      const duration = lvl >= 9 ? 10 : lvl >= 7 ? 8 : lvl >= 5 ? 6 : 4;
      return { duration, radius: 50, label: `Magnet ${duration}s` };
    }
    return getPowerUpEffect(type, lvl);
  }

  function createMysteryOptions() {
    const twoBetter = Math.random() < 0.35;
    const commonCount = twoBetter ? 1 : 2;
    const betterCount = 3 - commonCount;
    const common = sampleDistinct(MYSTERY_COMMON, commonCount, 'common');
    const better = sampleDistinct(MYSTERY_BETTER, betterCount, 'better');
    const options = [
      ...common.map((type) => ({ type, tier: 'common' })),
      ...better.map((type) => ({ type, tier: 'better' }))
    ];
    // Shuffle card order so rarity isn't always on the right.
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return options.map((option) => {
      const def = POWERUP_TYPES[option.type];
      const effect = mysteryEffect(option.type);
      const rarity = option.type === 'freeze' ? 'MYTHIC'
        : option.type === 'doubleAttack' ? 'LEGENDARY'
          : option.type === 'shield' ? 'EPIC'
            : option.type === 'magnet' ? 'RARE' : 'COMMON';
      return { ...option, desc: effect.label, rarity, color: def?.color };
    });
  }

  function startMysteryResumeCountdown() {
    if (resumeCountdownTimer) clearTimeout(resumeCountdownTimer);
    let n = 3;
    const tick = () => {
      resumeCountdownTimer = 0;
      if (currentState !== GameState.PAUSED || currentState === GameState.GAMEOVER) return;
      if (n <= 0) {
        currentState = GameState.PLAYING;
        input.setEnabled(true);
        menusRef.clearResumeCountdown && menusRef.clearResumeCountdown();
        return;
      }
      menusRef.showResumeCountdown && menusRef.showResumeCountdown(n);
      n -= 1;
      resumeCountdownTimer = setTimeout(tick, RESUME_TICK_MS);
    };
    tick();
  }

  function finishMysteryChoice(type = null, expired = false) {
    if (!mysteryChoiceActive || currentState !== GameState.PAUSED) return;
    mysteryChoiceActive = false;
    if (mysteryChoiceTimer) clearTimeout(mysteryChoiceTimer);
    mysteryChoiceTimer = 0;
    menusRef.hideMysteryChoice && menusRef.hideMysteryChoice(expired);
    if (type) {
      const pos = player.group.position;
      audio.playRewardBurst ? audio.playRewardBurst() : audio.playPowerUp();
      particles.spawnBurst(pos.x, pos.y, pos.z + 9, {
        count: 54, color: 0xffd166, speed: 145, life: 1.0, size: 8, upBias: 30
      });
      particles.spawnBurst(pos.x, pos.y, pos.z + 10, {
        count: 30, color: 0xb77aff, speed: 105, life: 0.85, size: 6, upBias: 20
      });
      onPowerUpPickup(type, { x: pos.x, y: pos.y, z: pos.z + 4 }, mysteryEffect(type));
    }
    startMysteryResumeCountdown();
  }

  function onMysteryBoxPickup(pos) {
    if (currentState !== GameState.PLAYING || currentLevel < 3 || mysteryChoiceActive) return;
    currentState = GameState.PAUSED;
    input.setEnabled(false);
    dash.cancel();
    audio.playMysteryBox ? audio.playMysteryBox() : audio.playLevelUp();
    particles.spawnBurst(pos.x, pos.y, pos.z + 8, {
      count: 46, color: 0xffc247, speed: 135, life: 0.9, size: 8, upBias: 28
    });
    particles.spawnBurst(pos.x, pos.y, pos.z + 10, {
      count: 30, color: 0xb77aff, speed: 100, life: 0.8, size: 6, upBias: 20
    });
    mysteryChoiceActive = true;
    const options = createMysteryOptions();
    menusRef.showMysteryChoice(options, (type) => finishMysteryChoice(type, false));
    mysteryChoiceTimer = setTimeout(() => finishMysteryChoice(null, true), 15000);
  }

  // 3-2-1 countdown before resuming. Gives the player a beat to
  // re-orient after unpausing and prevents an instant re-engagement that
  // can feel jarring. The countdown is just a visual + state transition;
  // no game logic ticks while it's running because currentState stays
  // PAUSED.
  function beginResumeCountdown() {
    if (currentState !== GameState.PAUSED || mysteryChoiceActive) return;
    if (resumeCountdownTimer) clearTimeout(resumeCountdownTimer);
    let n = 3;
    const tick = () => {
      resumeCountdownTimer = 0;
      if (currentState !== GameState.PAUSED) {
        // Player paused again (Esc) or died during countdown — bail.
        return;
      }
      if (n <= 0) {
        currentState = GameState.PLAYING;
        input.setEnabled(true);
        menusRef.hidePause();
        menusRef.clearResumeCountdown && menusRef.clearResumeCountdown();
        return;
      }
      menusRef.showResumeCountdown && menusRef.showResumeCountdown(n);
      n -= 1;
      resumeCountdownTimer = setTimeout(tick, RESUME_TICK_MS);
    };
    tick();
  }

  // Snapshot of run stats — used by the pause menu so it can show
  // current score, level, kills, and elapsed time without each subsystem
  // having to expose its own getter to the menu layer.
  function getRunStats() {
    return {
      score: score.getScore(),
      level: currentLevel,
      kills: killCount,
      combo: combo.getCount(),
      elapsedMs: runStartTime ? performance.now() - runStartTime : 0
    };
  }

  function isPlaying() {
    return currentState === GameState.PLAYING;
  }

  function isPaused() {
    return currentState === GameState.PAUSED;
  }

  function isGameOver() {
    return currentState === GameState.GAMEOVER;
  }

  function isMenu() {
    return currentState === GameState.MENU;
  }

  function isCountdown() {
    return currentState === GameState.COUNTDOWN;
  }

  // Player-enemy contact check
  function checkPlayerEnemyContact(playerVsEnemyDist) {
    if (health.isInvulnerable() || dash.isInvulnerable() || shieldRemaining > 0) return false;
    const enemies = enemyManager.getEnemies();
    for (const enemy of enemies) {
      if (enemy.isSpawning || enemy.isDying) continue;
      const dx = player.group.position.x - enemy.group.position.x;
      const dy = player.group.position.y - enemy.group.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < playerVsEnemyDist) {
        // Use the enemy type's attackContact damage (chaser=1, sprinter=1, brute=2)
        const dmg = enemy.def && enemy.def.attackContact ? enemy.def.attackContact : 1;

        // Contact attack impact: a hot, directional burst plus a cooler
        // secondary spark ring makes enemy hits readable without adding
        // meshes, lights, textures, or post-processing to the frame loop.
        const hitX = player.group.position.x;
        const hitY = player.group.position.y;
        const hitZ = player.group.position.z + 5;
        const enemyColor = enemy.type === 'brute' ? 0xff5a36
          : enemy.type === 'sprinter' ? 0xffbd4a : 0xff784f;
        particles.spawnBurst(hitX, hitY, hitZ, {
          count: enemy.type === 'brute' ? 24 : 16,
          color: enemyColor,
          speed: enemy.type === 'brute' ? 115 : 90,
          life: 0.42,
          size: enemy.type === 'brute' ? 8 : 6,
          upBias: 24
        });
        particles.spawnBurst(hitX - dx / (dist || 1) * 3, hitY - dy / (dist || 1) * 3, hitZ + 1, {
          count: 9,
          color: 0xb9f4ff,
          speed: 65,
          life: 0.28,
          size: 4,
          upBias: 12
        });
        damageNumbers.spawn(dmg > 1 ? `-${dmg} HP!` : '-1 HP', hitX, hitY, hitZ + 7, '#ff6b5f', { kind: 'crit' });

        health.damage(dmg);
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);
        movement.translate(nx * PLAYER_PUSHBACK, ny * PLAYER_PUSHBACK);
        return true;
      }
    }
    return false;
  }

  // Attack hooks — uses attackRef so it works even when attack is set later
  const attackHooks = {
    onHit(enemy, pos) {
      const isCrit = doubleAttackRemaining > 0;
      const dmg = isCrit ? attackRef.getDamage() * 2 : attackRef.getDamage();
      damageNumbers.spawn(String(dmg), pos.x, pos.y, pos.z + 8, isCrit ? '#ffdd66' : '#ffdd66', {
        kind: isCrit ? 'crit' : 'default'
      });
    },
    onKill(enemy, pos) {
      combo.register();
      const mul = combo.getMultiplier();
      const count = combo.getCount();
      killCount += 1;
      score.addKillBonus(mul, enemy.type);
      score.setCombo(count, combo.getTimeLeft());
      audio.playHit();
      if (count >= 3) audio.playPowerUp();
      screenShake.kick(1.5 + mul * 0.6);
      particles.spawnBurst(pos.x, pos.y, pos.z + 6, {
        count: 18, color: 0xff5577, speed: 90, life: 0.6, size: 7
      });
      // Milestone every 5 kills — gold ring + bigger burst + SFX.
      // Fires a custom event so the HUD can pulse the combo chip without
      // GameManager knowing about Score's internals.
      if (count > 0 && count % 5 === 0) {
        particles.spawnBurst(pos.x, pos.y, pos.z + 10, {
          count: 30, color: 0xffd166, speed: 130, life: 0.9, size: 8
        });
        window.dispatchEvent(new CustomEvent(TODE_COMBO_MILESTONE, {
          detail: { count }
        }));
      }
    },
    onShake(amount) {
      screenShake.kick(amount);
      audio.playAttack();
    },
    onParticles(kind, x, y, z, color) {
      if (kind === 'sparks') {
        // Multi-hue spark fan matches the prismatic attack rings without
        // changing damage, range, cooldown, or enemy behavior.
        particles.spawnBurst(x, y, z, { count: 12, color: 0xffd166, speed: 72, life: 0.42, size: 5 });
        particles.spawnBurst(x, y, z + 1, { count: 9, color: 0x54f6ff, speed: 58, life: 0.36, size: 4 });
        particles.spawnBurst(x, y, z + 2, { count: 8, color: 0xff4fc8, speed: 66, life: 0.38, size: 4 });
        particles.spawnBurst(x, y, z + 3, { count: 6, color: 0xa7ff58, speed: 48, life: 0.32, size: 3.5 });
      } else if (kind === 'death') {
        particles.spawnBurst(x, y, z, { count: 22, color, speed: 100, life: 0.7, size: 8 });
      }
    }
  };

  // Menu callbacks — uses menusRef so it works even when menus is set later
  const menuCallbacks = {
    onStart: startGame,
    onResume: () => {
      if (currentState === GameState.PAUSED) beginResumeCountdown();
    },
    onTogglePause: () => {
      if (currentState === GameState.PLAYING) {
        // Populate the pause menu's mini-stats from a fresh snapshot so
        // the numbers are current as of the moment the player paused.
        if (menusRef.setPauseStats) menusRef.setPauseStats(getRunStats());
        togglePause();
      } else if (currentState === GameState.PAUSED) {
        togglePause();
      }
    },
    onRestart: () => {
      menusRef.hidePause();
      resetGame();
    },
    onToggleMute: () => {
      audio.setMuted(!audio.isMuted());
    },
    isMuted: () => audio.isMuted()
  };

  function showMenu() {
    currentState = GameState.MENU;
    score.hideGameOver();
    menusRef.showStart && menusRef.showStart();
  }

  return {
    currentState: () => currentState,
    startGame,
    resetGame,
    togglePause,
    beginResumeCountdown,
    triggerGameOver,
    onPowerUpPickup,
    onMysteryBoxPickup,
    tickComboHud,
    isPlaying,
    isPaused,
    isGameOver,
    isMenu,
    isCountdown,
    showMenu,
    setAttack,
    setMenus,
    checkPlayerEnemyContact,
    attackHooks,
    menuCallbacks,
    getRunStats,
    getAttackBoostRemaining: () => attackBoostRemaining,
    setAttackBoostTimer: (v) => { attackBoostRemaining = v; },
    getSpeedBoostRemaining: () => speedBoostRemaining,
    setSpeedBoostTimer: (v) => { speedBoostRemaining = v; },
    getFlashTimer: () => flashTimer,
    setFlashTimer: (v) => { flashTimer = v; },
    getBoostedAttackRadius,
    getShieldRemaining: () => shieldRemaining,
    setShieldTimer: (v) => { shieldRemaining = v; },
    getDoubleAttackRemaining: () => doubleAttackRemaining,
    setDoubleAttackTimer: (v) => { doubleAttackRemaining = v; },
    getMagnetRemaining: () => magnetRemaining,
    setMagnetTimer: (v) => { magnetRemaining = v; },
    getFreezeRemaining: () => freezeRemaining,
    setFreezeTimer: (v) => { freezeRemaining = v; },
    getCurrentLevel: () => currentLevel,
    getLastDisplayedLevel: () => lastDisplayedLevel,
    setLastDisplayedLevel: (v) => { lastDisplayedLevel = v; },
    triggerLevelUp,
    ATTACK_BOOST_DURATION,
    SPEED_BOOST_DURATION,
    ATTACK_BOOST_MULT,
    SPEED_BOOST_MULT,
    LEVEL_STATS,
    BASE_ATTACK_RADIUS: 42
  };
}
