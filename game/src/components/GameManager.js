import { GameState } from './GameState.js';
import { recordAttempt } from './PlayCounter.js';
import { getLevel } from './Score.js';

// Boost durations and multipliers
const ATTACK_BOOST_DURATION = 10;
const ATTACK_BOOST_MULT = 1.85;
const SPEED_BOOST_DURATION = 8;
const SPEED_BOOST_MULT = 1.7;
const PLAYER_PUSHBACK = 18;

let attackRef = null;
let menusRef = null;

// Level-based frog stat scaling config
// { maxHp, attackDamage, attackCooldown, moveSpeedMult, dashCooldownMs }
const LEVEL_STATS = {
  1: { maxHp: 3, attackDamage: 1, attackCooldown: 0.85, moveSpeedMult: 1.0, dashCooldownMs: 3000 },
  2: { maxHp: 3, attackDamage: 1, attackCooldown: 0.85, moveSpeedMult: 1.0, dashCooldownMs: 3000 },
  3: { maxHp: 4, attackDamage: 1, attackCooldown: 0.75, moveSpeedMult: 1.1, dashCooldownMs: 2500 },
  4: { maxHp: 4, attackDamage: 1, attackCooldown: 0.75, moveSpeedMult: 1.1, dashCooldownMs: 2500 },
  5: { maxHp: 5, attackDamage: 1, attackCooldown: 0.65, moveSpeedMult: 1.2, dashCooldownMs: 2000 },
  6: { maxHp: 5, attackDamage: 1, attackCooldown: 0.65, moveSpeedMult: 1.2, dashCooldownMs: 2000 },
  7: { maxHp: 5, attackDamage: 2, attackCooldown: 0.65, moveSpeedMult: 1.2, dashCooldownMs: 2000 },
  8: { maxHp: 5, attackDamage: 2, attackCooldown: 0.65, moveSpeedMult: 1.2, dashCooldownMs: 2000 },
  9: { maxHp: 6, attackDamage: 2, attackCooldown: 0.55, moveSpeedMult: 1.3, dashCooldownMs: 1500 },
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
  let shieldRemaining = 0;       // invincibility from shield power-up
  let doubleAttackRemaining = 0; // 2x damage from double attack power-up
  let magnetRemaining = 0;       // auto-pickup radius from magnet power-up
  let freezeRemaining = 0;       // enemies frozen

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
    const lvl = currentLevel;
    const eff = getPowerUpEffect('attack', lvl);
    return attackRef.getRadius() * eff.mult;
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

  function onPowerUpPickup(type, pos) {
    audio.playPickup();
    const lvl = currentLevel;
    if (type === 'heal') {
      const eff = getPowerUpEffect('heal', lvl);
      health.heal(eff.amount);
      damageNumbers.spawn(eff.label, pos.x, pos.y, pos.z + 6, '#ff7799');
    } else if (type === 'score') {
      const eff = getPowerUpEffect('score', lvl);
      score.addKillBonus(eff.bonus);
      damageNumbers.spawn(eff.label, pos.x, pos.y, pos.z + 6, '#ffd166');
      particles.spawnBurst(pos.x, pos.y, pos.z, { count: 24, color: 0xffd166, speed: 90, life: 0.7, size: 7 });
    } else if (type === 'speed') {
      const eff = getPowerUpEffect('speed', lvl);
      speedBoostRemaining = eff.duration;
      movement.setSpeedMultiplier(eff.mult);
      score.addKillBonus(2);
      damageNumbers.spawn(eff.label, pos.x, pos.y, pos.z + 6, '#4cc9f0');
      particles.spawnBurst(pos.x, pos.y, pos.z, { count: 22, color: 0x4cc9f0, speed: 80, life: 0.7, size: 6 });
    } else if (type === 'attack') {
      const eff = getPowerUpEffect('attack', lvl);
      attackBoostRemaining = eff.duration;
      attackRef.setRadius(attackRef.getRadius() * eff.mult);
      score.addKillBonus(4);
      damageNumbers.spawn(eff.label, pos.x, pos.y, pos.z + 6, '#9ee7ff');
      particles.spawnBurst(pos.x, pos.y, pos.z, { count: 28, color: 0x9ee7ff, speed: 100, life: 0.8, size: 7 });
    } else if (type === 'shield') {
      const eff = getPowerUpEffect('shield', lvl);
      shieldRemaining = eff.duration;
      damageNumbers.spawn(eff.label, pos.x, pos.y, pos.z + 6, '#ffffff');
      particles.spawnBurst(pos.x, pos.y, pos.z, { count: 20, color: 0xffffff, speed: 80, life: 0.7, size: 6 });
    } else if (type === 'doubleAttack') {
      const eff = getPowerUpEffect('doubleAttack', lvl);
      doubleAttackRemaining = eff.duration;
      damageNumbers.spawn(eff.label, pos.x, pos.y, pos.z + 6, '#ffdd44');
      particles.spawnBurst(pos.x, pos.y, pos.z, { count: 20, color: 0xffdd44, speed: 80, life: 0.7, size: 6 });
    } else if (type === 'magnet') {
      const eff = getPowerUpEffect('magnet', lvl);
      magnetRemaining = eff.duration;
      damageNumbers.spawn(eff.label, pos.x, pos.y, pos.z + 6, '#aa88ff');
      particles.spawnBurst(pos.x, pos.y, pos.z, { count: 20, color: 0xaa88ff, speed: 80, life: 0.7, size: 6 });
    } else if (type === 'freeze') {
      const eff = getPowerUpEffect('freeze', lvl);
      freezeRemaining = eff.duration;
      damageNumbers.spawn(eff.label, pos.x, pos.y, pos.z + 6, '#88ddff');
      particles.spawnBurst(pos.x, pos.y, pos.z, { count: 24, color: 0x88ddff, speed: 100, life: 0.8, size: 7 });
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
    
    // Health: set max HP and reset to full
    health.setMax(stats.maxHp);
    health.reset();
    
    // Attack: set cooldown and damage
    attackRef.setCooldown(stats.attackCooldown);
    attackRef.setDamage(stats.attackDamage);
    
    // Movement: set base speed multiplier
    movement.setSpeedMultiplier(stats.moveSpeedMult);
    
    // Dash: set cooldown
    dash.setCooldown(stats.dashCooldownMs);
    
    // Update hearts UI
    score.setHearts(stats.maxHp, stats.maxHp);
    
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
  }

  function resetGame() {
    // Bump the community play counter. This is the single funnel point
    // for "player is starting a fresh run" (startGame + onRestart from
    // game-over both route through here), so pause/resume won't double
    // count and every Play press contributes exactly once.
    recordAttempt().catch(() => {}); // fire-and-forget, don't block game start
    input.setEnabled(true);
    player.group.position.set(0, 0, 0);
    movement.reset();
    player.group.visible = true;
    health.reset();
    combo.reset();
    enemyManager.removeAll();
    powerUps.removeAll();
    dash.reset();
    score.reset();
    
    // Apply level-based stats
    currentLevel = 1;
    lastDisplayedLevel = 0;
    applyLevelStats(1);
    
    attackBoostRemaining = 0;
    speedBoostRemaining = 0;
    shieldRemaining = 0;
    doubleAttackRemaining = 0;
    magnetRemaining = 0;
    freezeRemaining = 0;
    
    currentState = GameState.PLAYING;
    score.hideGameOver();
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
    if (currentState === GameState.PLAYING) {
      currentState = GameState.PAUSED;
      input.setEnabled(false);
      dash.cancel();
      menusRef.showPause();
    } else if (currentState === GameState.PAUSED) {
      currentState = GameState.PLAYING;
      input.setEnabled(true);
      menusRef.hidePause();
    }
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
        health.damage(1);
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
      const dmg = doubleAttackRemaining > 0 ? attackRef.getDamage() * 2 : attackRef.getDamage();
      damageNumbers.spawn(String(dmg), pos.x, pos.y, pos.z + 8, '#ffdd66');
    },
    onKill(enemy, pos) {
      combo.register();
      const mul = combo.getMultiplier();
      score.addKillBonus(mul);
      score.setCombo(combo.getCount(), combo.getTimeLeft());
      audio.playHit();
      if (combo.getCount() >= 3) audio.playPowerUp();
      screenShake.kick(1.5 + mul * 0.6);
      particles.spawnBurst(pos.x, pos.y, pos.z + 6, {
        count: 18, color: 0xff5577, speed: 90, life: 0.6, size: 7
      });
    },
    onShake(amount) {
      screenShake.kick(amount);
      audio.playAttack();
    },
    onParticles(kind, x, y, z, color) {
      if (kind === 'sparks') {
        particles.spawnBurst(x, y, z, { count: 12, color, speed: 60, life: 0.4, size: 5 });
      } else if (kind === 'death') {
        particles.spawnBurst(x, y, z, { count: 22, color, speed: 100, life: 0.7, size: 8 });
      }
    }
  };

  // Menu callbacks — uses menusRef so it works even when menus is set later
  const menuCallbacks = {
    onStart: startGame,
    onResume: () => {
      if (currentState === GameState.PAUSED) togglePause();
    },
    onTogglePause: () => {
      if (currentState === GameState.PLAYING || currentState === GameState.PAUSED) {
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

  return {
    currentState: () => currentState,
    startGame,
    resetGame,
    togglePause,
    triggerGameOver,
    onPowerUpPickup,
    tickComboHud,
    isPlaying,
    isPaused,
    isGameOver,
    isMenu,
    setAttack,
    setMenus,
    checkPlayerEnemyContact,
    attackHooks,
    menuCallbacks,
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
    BASE_ATTACK_RADIUS: 38
  };
}
