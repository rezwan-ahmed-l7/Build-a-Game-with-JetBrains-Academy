import { GameState } from './GameState.js';
import { recordAttempt } from './PlayCounter.js';

// Boost durations and multipliers
const ATTACK_BOOST_DURATION = 10;
const ATTACK_BOOST_MULT = 1.85;
const SPEED_BOOST_DURATION = 8;
const SPEED_BOOST_MULT = 1.7;
const PLAYER_PUSHBACK = 18;

let attackRef = null;
let menusRef = null;

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
    return attackRef.getRadius() * ATTACK_BOOST_MULT;
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
    if (type === 'heal') {
      health.heal(1);
      damageNumbers.spawn('+1 HP', pos.x, pos.y, pos.z + 6, '#ff7799');
    } else if (type === 'score') {
      score.addKillBonus(8);
      damageNumbers.spawn('x2 BONUS', pos.x, pos.y, pos.z + 6, '#ffd166');
      particles.spawnBurst(pos.x, pos.y, pos.z, { count: 24, color: 0xffd166, speed: 90, life: 0.7, size: 7 });
    } else if (type === 'speed') {
      speedBoostRemaining = SPEED_BOOST_DURATION;
      movement.setSpeedMultiplier(SPEED_BOOST_MULT);
      score.addKillBonus(2);
      damageNumbers.spawn('SPEED!', pos.x, pos.y, pos.z + 6, '#4cc9f0');
      particles.spawnBurst(pos.x, pos.y, pos.z, { count: 22, color: 0x4cc9f0, speed: 80, life: 0.7, size: 6 });
    } else if (type === 'attack') {
      attackBoostRemaining = ATTACK_BOOST_DURATION;
      attackRef.setRadius(getBoostedAttackRadius());
      score.addKillBonus(4);
      damageNumbers.spawn('LONG ATTACK!', pos.x, pos.y, pos.z + 6, '#9ee7ff');
      particles.spawnBurst(pos.x, pos.y, pos.z, { count: 28, color: 0x9ee7ff, speed: 100, life: 0.8, size: 7 });
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

  function resetGame() {
    // Bump the community play counter. This is the single funnel point
    // for "player is starting a fresh run" (startGame + onRestart from
    // game-over both route through here), so pause/resume won't double
    // count and every Play press contributes exactly once.
    recordAttempt();
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
    score.setHearts(3, 3);
    attackBoostRemaining = 0;
    speedBoostRemaining = 0;
    movement.setSpeedMultiplier(1);
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
    if (health.isInvulnerable() || dash.isInvulnerable()) return false;
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
        player.group.position.x += nx * PLAYER_PUSHBACK;
        player.group.position.y += ny * PLAYER_PUSHBACK;
        return true;
      }
    }
    return false;
  }

  // Attack hooks — uses attackRef so it works even when attack is set later
  const attackHooks = {
    onHit(enemy, pos) {
      damageNumbers.spawn('1', pos.x, pos.y, pos.z + 8, '#ffdd66');
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
    ATTACK_BOOST_DURATION,
    SPEED_BOOST_DURATION,
    ATTACK_BOOST_MULT,
    SPEED_BOOST_MULT
  };
}
