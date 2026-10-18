// Score, hearts, combo HUD, and game-over panel. Now re-uses the central
// GameState enum and integrates with the Health system for the heart row.

import { GameState } from './GameState.js';
import { load, save } from '../utils/persistence.js';
import { isTouchDevice, prefersReducedMotion } from '../utils/dom.js';
import { easeOutCubic } from '../utils/easings.js';
import { TODE_NEW_BEST } from '../events.js';

const SCORE_PER_SECOND = 2;
// Kill scores by enemy type (spec: small=25, medium=50, strong=100)
const KILL_SCORES = { chaser: 25, sprinter: 50, brute: 100 };
const COMBO_WINDOW = 1.5; // kept here as reference; Combo owns the actual window

// Level thresholds — 500-point intervals.
// Level 1: 0–500, Level 2: 501–1000, Level 3: 1001–1500, etc.
export const LEVEL_THRESHOLDS = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000, 9500, 10000];

export function getLevel(score) {
  // Find the highest threshold the score has reached.
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (score >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return level;
}

export function getNextLevelScore(score = 0) {
  // Return the threshold for the next level, or null at the maximum level.
  const currentLevel = getLevel(Math.max(0, Number(score) || 0));
  const nextIdx = currentLevel; // LEVEL_THRESHOLDS is 0-indexed; level 1 → index 1
  if (nextIdx >= LEVEL_THRESHOLDS.length) return null;
  return LEVEL_THRESHOLDS[nextIdx];
}

// Whether this device is a touchscreen. The game-over panel adapts:
// keyboard users see "Press Enter to restart", touch users see a visible
// Restart button. Hint + button are
// mutually exclusive per-device — both render in the DOM, the wrong one
// is hidden via the .is-touch class on the panel.
const IS_TOUCH = isTouchDevice();

// Animates a DOM element's textContent from 0 -> target over `duration` ms
// using requestAnimationFrame. Skips animation in test/jsdom environments
// (the rAF callback wouldn't fire synchronously, so the test assertion
// would see the starting "0" rather than the final value) and when the
// user prefers reduced motion.
function animateCountUp(el, to, duration) {
  if (prefersReducedMotion() || typeof process !== 'undefined') {
    el.textContent = to;
    return;
  }
  const start = performance.now();
  let raf = 0;
  function frame(now) {
    // Bail if the element was removed (game restart, panel teardown)
    // so we don't keep writing to a detached node.
    if (!el.isConnected) return;
    const t = Math.min(1, (now - start) / duration);
    el.textContent = Math.round(to * easeOutCubic(t));
    if (t < 1) raf = requestAnimationFrame(frame);
    else el.textContent = to;
  }
  raf = requestAnimationFrame(frame);
}

export function createScore({ submitter = null } = {}) {
  let score = 0;
  let highScore = load('highScore', 0);
  let lastScoreDisplayed = -1;
  // Rank (1-5) the player's last run achieved on the leaderboard, or null.
  // Read by the game-over panel / start menu to highlight the player's row.
  let lastRank = null;
  // Restart callback — wired by main.js after the GameManager exists
  // (Score is constructed first). Click handler on the visible Restart
  // button invokes this so a tap restarts the run.
  let onRestartRef = null;

  // Combo state — owned by Score for HUD; the Combo system mirrors the
  // values for multiplier computation.
  let combo = 0;
  let comboTimer = 0;
  let lastComboDisplayed = -1;
  let lastComboFading = false;
  let lastHeartsHp = 3;
  let lastHeartsMax = 3;

  function setCombo(value, timer) {
    const wasFading = lastComboFading;
    combo = value;
    comboTimer = timer;
    if (combo > 1) lastComboFading = false;
  }

  // Top-center score chip
  const el = document.createElement('div');
  el.className = 'score';
  el.textContent = 'Score: 0';
  document.body.appendChild(el);

  // Level badge, positioned to the right of the score chip
  const levelEl = document.createElement('div');
  levelEl.className = 'level-badge';
  levelEl.textContent = 'Lv. 1';
  document.body.appendChild(levelEl);

  // Combo chip, hidden by default; positioned just below score
  const comboEl = document.createElement('div');
  comboEl.className = 'combo-chip';
  comboEl.style.display = 'none';
  document.body.appendChild(comboEl);

  // Hearts row, top-left — dynamically created based on max HP
  const heartsEl = document.createElement('div');
  heartsEl.className = 'hearts';
  document.body.appendChild(heartsEl);
  const heartNodes = [];
  // Inline "current/max" label. Shown only when max != default (3) or
  // HP < max — keeps the row visually quiet at full health.
  const hpLabelEl = document.createElement('span');
  hpLabelEl.className = 'hearts-hp';
  hpLabelEl.textContent = '';
  heartsEl.appendChild(hpLabelEl);

  // Inline SVG heart — base shape + a "crack" path layered on top that
  // fades in when the heart is lost. Using SVG (not emoji) gives us
  // per-element control over color, filter, and animation.
  const HEART_SVG = `
    <svg class="heart-svg heart-svg-base" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-9.6-9.4C.8 7.4 3.4 3 7.4 3c2 0 3.6 1 4.6 2.5C13 4 14.6 3 16.6 3 20.6 3 23.2 7.4 21.6 11.6 19.5 16.4 12 21 12 21z"
            fill="currentColor" />
    </svg>
    <svg class="heart-svg heart-svg-crack" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4 L8.5 10 L11 12 L7 15 L10.5 17.5 L8 21 M12 4 L15.5 10 L13 12 L17 15 L13.5 17.5 L16 21"
            fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;

  function syncHeartNodes(max) {
    // Remove excess hearts
    while (heartNodes.length > max) {
      const node = heartNodes.pop();
      heartsEl.removeChild(node);
    }
    // Add missing hearts
    while (heartNodes.length < max) {
      const h = document.createElement('span');
      h.className = 'heart';
      h.innerHTML = HEART_SVG;
      heartsEl.appendChild(h);
      heartNodes.push(h);
    }
  }

  // Game-over overlay. The panel carries an `is-touch` class on
  // touchscreens so CSS can swap the keyboard hint for a visible
  // Restart button — touch users tap the button to restart.
  const gameOverEl = document.createElement('div');
  gameOverEl.className = 'game-over';
  if (IS_TOUCH) gameOverEl.classList.add('is-touch');
  gameOverEl.style.display = 'none';
  gameOverEl.innerHTML = `
    <div class="game-over-panel">
      <p class="game-over-eyebrow">Run ended</p>
      <h1 class="game-over-title">Game Over</h1>
      <hr class="game-over-divider" />
      <div class="game-over-stats">
        <span class="label">Score</span><span class="value final-score-value">0</span>
        <span class="label">Level</span><span class="value final-level-value">1</span>
        <span class="label">Best</span><span class="value dim high-score-value">0</span>
      </div>
      <p class="new-best" style="display:none">\u2728 New best!</p>
      <p class="game-over-hint">Press <kbd>Space</kbd> or <kbd>Enter</kbd> to restart</p>
      <button class="menu-button primary game-over-restart" id="btn-game-over-restart" type="button">Restart</button>
    </div>
  `;
  document.body.appendChild(gameOverEl);
  const finalScoreEl = gameOverEl.querySelector('.final-score-value');
  const finalLevelEl = gameOverEl.querySelector('.final-level-value');
  const highScoreEl = gameOverEl.querySelector('.high-score-value');
  const newBestEl = gameOverEl.querySelector('.new-best');
  const rankEl = document.createElement('p');
  rankEl.className = 'game-over-rank';
  rankEl.style.display = 'none';
  // Insert the rank line right under the "New best" element so the
  // game-over stack reads: eyebrow / title / stats / new-best? / rank? / hint/button.
  newBestEl.parentNode.insertBefore(rankEl, newBestEl.nextSibling);
  // Click on the visible Restart button calls the injected callback.
  // Wired lazily because GameManager doesn't exist when Score is built.
  const restartBtn = gameOverEl.querySelector('#btn-game-over-restart');
  restartBtn.addEventListener('click', () => {
    if (typeof onRestartRef === 'function') onRestartRef();
  });

  // Keyboard shortcut: Enter restarts when game-over is visible.
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (gameOverEl.style.display !== 'none' && e.code === 'Enter') {
      e.preventDefault();
      if (typeof onRestartRef === 'function') onRestartRef();
    }
  });

  function setHearts(hp, max) {
    // Dynamically adjust heart nodes to match max HP
    syncHeartNodes(max);
    for (let i = 0; i < heartNodes.length; i++) {
      const node = heartNodes[i];
      if (i < max) {
        node.style.display = '';
        const wasFull = i < lastHeartsHp;
        const isFull = i < hp;
        node.classList.remove('lost');
        if (!isFull && wasFull) {
          // The just-lost heart plays the red flash, then settles to empty.
          node.classList.add('lost');
          // Strip the class after the animation so a future heal re-plays it.
          setTimeout(() => node.classList.remove('lost'), 380);
        } else if (isFull) {
          node.classList.remove('empty');
        } else {
          node.classList.add('empty');
        }
      } else {
        node.style.display = 'none';
      }
    }
    // HP label is shown only when max != default (3) or HP < max.
    // Hidden at full 3/3 to keep the row visually quiet.
    if (max !== lastHeartsMax || hp < max) {
      hpLabelEl.textContent = `${hp}/${max}`;
    } else {
      hpLabelEl.textContent = '';
    }
    lastHeartsHp = hp;
    lastHeartsMax = max;
  }

  function tick(delta) {
    score += SCORE_PER_SECOND * delta;
  }

  function addKillBonus(comboMultiplier = 1, enemyType = 'chaser') {
    const baseScore = KILL_SCORES[enemyType] ?? KILL_SCORES.chaser;
    score += baseScore * comboMultiplier;
    // Trigger the strong kill bump on the score chip.
    el.classList.remove('bump-kill');
    void el.offsetWidth;
    el.classList.add('bump-kill');
  }

  function addFlatBonus(amount) {
    score += amount;
    // Trigger a subtle bump for power-up bonus.
    el.classList.remove('bump-kill');
    void el.offsetWidth;
    el.classList.add('bump-kill');
  }

  let lastLevelDisplayed = 0;

  function render() {
    const display = Math.floor(score);
    if (display !== lastScoreDisplayed) {
      el.textContent = `Score: ${display}`;
      lastScoreDisplayed = display;
    }
    // Update level badge when level changes
    const currentLevel = getLevel(display);
    if (currentLevel !== lastLevelDisplayed) {
      levelEl.textContent = `Lv. ${currentLevel}`;
      levelEl.classList.remove('bump-level');
      void levelEl.offsetWidth;
      levelEl.classList.add('bump-level');
      lastLevelDisplayed = currentLevel;
    }
    if (combo !== lastComboDisplayed || (combo > 1) !== (lastComboDisplayed > 1)) {
      if (combo > 1) {
        comboEl.textContent = `x${combo} COMBO`;
        comboEl.style.display = '';
        comboEl.classList.remove('fade-out');
        comboEl.classList.remove('flash');
        void comboEl.offsetWidth;
        comboEl.classList.add('flash');
        lastComboFading = false;
      } else if (!lastComboFading) {
        // Play a small fade-out, then hide.
        comboEl.classList.remove('flash');
        comboEl.classList.add('fade-out');
        lastComboFading = true;
        setTimeout(() => {
          if (lastComboFading) comboEl.style.display = 'none';
        }, 240);
      }
      lastComboDisplayed = combo;
    }
    // Drive the conic-gradient progress arc from comboTimer / COMBO_WINDOW.
    if (combo > 1) {
      const progress = Math.max(0, Math.min(1, comboTimer / COMBO_WINDOW));
      comboEl.style.setProperty('--combo-progress', progress.toFixed(3));
    }
  }

  function showGameOver() {
    const display = Math.floor(score);
    const finalLevel = getLevel(display);
    const prevBest = Math.floor(highScore);
    const isNewBest = score > highScore;
    if (isNewBest) {
      highScore = score;
      save('highScore', Math.floor(highScore));
    }
    // Submit to the leaderboard through the abstraction the caller
    // injected. The submitter is now async (JSONBin.io cloud storage).
    // We fire-and-forget here so the game-over UI appears immediately;
    // the rank will be shown once the promise resolves.
    if (typeof submitter === 'function') {
      submitter({ score, ts: Date.now() }).then((result) => {
        lastRank = (result && Number.isInteger(result)) ? result : null;
        if (lastRank) {
          rankEl.textContent = `You placed #${lastRank} on the leaderboard!`;
          rankEl.style.display = '';
        } else {
          rankEl.textContent = '';
          rankEl.style.display = 'none';
        }
      }).catch((err) => {
        console.error('[Score] Submitter error:', err);
        lastRank = null;
        rankEl.textContent = '';
        rankEl.style.display = 'none';
      });
    } else {
      lastRank = null;
    }
    finalScoreEl.textContent = '0';
    finalLevelEl.textContent = finalLevel;
    highScoreEl.textContent = Math.floor(highScore);
    animateCountUp(finalScoreEl, display, 900);
    if (isNewBest) {
      newBestEl.style.display = '';
      newBestEl.textContent = prevBest === 0 ? '\u2728 First best!' : '\u2728 New best!';
      // Notify the main loop so it can spawn a confetti burst in world
      // space. DOM event bus keeps Score.js decoupled from THREE/Particles.
      window.dispatchEvent(new CustomEvent(TODE_NEW_BEST, {
        detail: { score: display, prevBest }
      }));
    } else {
      newBestEl.style.display = 'none';
    }
    if (lastRank) {
      rankEl.textContent = `You placed #${lastRank} on the leaderboard!`;
      rankEl.style.display = '';
    } else {
      rankEl.textContent = '';
      rankEl.style.display = 'none';
    }
    gameOverEl.style.display = 'flex';
  }

  function hideGameOver() {
    gameOverEl.style.display = 'none';
    newBestEl.style.display = 'none';
  }

  function reset() {
    score = 0;
    combo = 0;
    comboTimer = 0;
    lastScoreDisplayed = -1;
    lastComboDisplayed = -1;
    lastComboFading = false;
    lastLevelDisplayed = 0;
    lastHeartsHp = 3;
    lastHeartsMax = 3;
    lastRank = null;
    el.textContent = 'Score: 0';
    el.classList.remove('bump-kill');
    levelEl.textContent = 'Lv. 1';
    comboEl.style.display = 'none';
    comboEl.classList.remove('flash', 'fade-out');
    rankEl.style.display = 'none';
    for (const node of heartNodes) {
      node.classList.remove('lost', 'empty');
    }
    // Hearts will be set by GameManager.applyLevelStats() based on level
  }

  function getScore() { return score; }
  function getHighScore() { return highScore; }
  function getCombo() { return combo; }
  function getLastRank() { return lastRank; }

  // Milestone pulse — fires when a combo crosses a 5-kill boundary. Owned
  // by Score because the .combo-chip element is created here.
  function pulseCombo() {
    comboEl.classList.remove('milestone');
    void comboEl.offsetWidth;
    comboEl.classList.add('milestone');
  }

  return {
    tick, addKillBonus, addFlatBonus, render,
    showGameOver, hideGameOver, reset,
    getScore, getHighScore, getCombo, getLastRank,
    setHearts, setCombo, pulseCombo,
    // Wired by main.js after GameManager is built (Score is constructed first).
    setOnRestart: (fn) => { onRestartRef = fn; }
  };
}