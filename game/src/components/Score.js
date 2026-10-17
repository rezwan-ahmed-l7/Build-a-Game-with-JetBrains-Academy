// Score, hearts, combo HUD, and game-over panel. Now re-uses the central
// GameState enum and integrates with the Health system for the heart row.

import { GameState } from './GameState.js';
import { load, save } from '../utils/persistence.js';
import { isTouchDevice } from '../utils/dom.js';

const SCORE_PER_SECOND = 3;
const SCORE_PER_KILL = 15;
const COMBO_WINDOW = 1.5; // kept here as reference; Combo owns the actual window

// Whether this device is a touchscreen. The game-over panel adapts:
// keyboard users see "Press Space to restart", touch users see a visible
// Restart button (since they can't press Space). Hint + button are
// mutually exclusive per-device — both render in the DOM, the wrong one
// is hidden via the .is-touch class on the panel.
const IS_TOUCH = isTouchDevice();

export function createScore({ submitter = null } = {}) {
  let score = 0;
  let highScore = load('highScore', 0);
  let lastScoreDisplayed = -1;
  // Rank (1-5) the player's last run achieved on the leaderboard, or null.
  // Read by the game-over panel / start menu to highlight the player's row.
  let lastRank = null;
  // Restart callback — wired by main.js after the GameManager exists
  // (Score is constructed first). Click handler on the visible Restart
  // button invokes this so a tap restarts the run without needing Space.
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

  // Combo chip, hidden by default; positioned just below score
  const comboEl = document.createElement('div');
  comboEl.className = 'combo-chip';
  comboEl.style.display = 'none';
  document.body.appendChild(comboEl);

  // Hearts row, top-left
  const heartsEl = document.createElement('div');
  heartsEl.className = 'hearts';
  document.body.appendChild(heartsEl);
  const heartNodes = [];
  for (let i = 0; i < 3; i++) {
    const h = document.createElement('span');
    h.className = 'heart';
    h.textContent = '\u2665';
    heartsEl.appendChild(h);
    heartNodes.push(h);
  }

  // Game-over overlay. The panel carries an `is-touch` class on
  // touchscreens so CSS can swap the keyboard hint for a visible
  // Restart button — touch users can't press Space, so the button is
  // the only way to restart a run.
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
        <span class="label">Best</span><span class="value dim high-score-value">0</span>
      </div>
      <p class="new-best" style="display:none">\u2728 New best!</p>
      <p class="game-over-hint">Press <kbd>Space</kbd> to restart</p>
      <button class="menu-button primary game-over-restart" id="btn-game-over-restart" type="button">Restart</button>
    </div>
  `;
  document.body.appendChild(gameOverEl);
  const finalScoreEl = gameOverEl.querySelector('.final-score-value');
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

  function setHearts(hp, max) {
    // Dynamically adjust heart nodes to match the current max HP.
    while (heartNodes.length < max) {
      const h = document.createElement('span');
      h.className = 'heart';
      h.textContent = '\u2665';
      heartsEl.appendChild(h);
      heartNodes.push(h);
    }
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
    lastHeartsHp = hp;
    lastHeartsMax = max;
  }

  function tick(delta) {
    score += SCORE_PER_SECOND * delta;
  }

  function addKillBonus(comboMultiplier = 1) {
    score += SCORE_PER_KILL * comboMultiplier;
    // Trigger the strong kill bump on the score chip.
    el.classList.remove('bump-kill');
    void el.offsetWidth;
    el.classList.add('bump-kill');
  }

  function render() {
    const display = Math.floor(score);
    if (display !== lastScoreDisplayed) {
      el.textContent = `Score: ${display}`;
      lastScoreDisplayed = display;
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
    const prevBest = Math.floor(highScore);
    const isNewBest = score > highScore;
    if (isNewBest) {
      highScore = score;
      save('highScore', Math.floor(highScore));
    }
    // Submit to the leaderboard through the abstraction the caller
    // injected. If the submitter isn't provided (legacy wiring), we
    // still get the existing local highScore path.
    if (typeof submitter === 'function') {
      try {
        const result = submitter({ score, ts: Date.now() });
        lastRank = (result && Number.isInteger(result)) ? result : null;
      } catch {
        lastRank = null;
      }
    } else {
      lastRank = null;
    }
    finalScoreEl.textContent = display;
    highScoreEl.textContent = Math.floor(highScore);
    if (isNewBest) {
      newBestEl.style.display = '';
      newBestEl.textContent = prevBest === 0 ? '\u2728 First best!' : '\u2728 New best!';
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
    lastHeartsHp = 3;
    lastHeartsMax = 3;
    lastRank = null;
    el.textContent = 'Score: 0';
    el.classList.remove('bump-kill');
    comboEl.style.display = 'none';
    comboEl.classList.remove('flash', 'fade-out');
    rankEl.style.display = 'none';
    for (const node of heartNodes) {
      node.classList.remove('lost', 'empty');
    }
    setHearts(3, 3);
  }

  function getScore() { return score; }
  function getHighScore() { return highScore; }
  function getCombo() { return combo; }
  function getLastRank() { return lastRank; }

  return {
    tick, addKillBonus, render,
    showGameOver, hideGameOver, reset,
    getScore, getHighScore, getCombo, getLastRank,
    setHearts, setCombo,
    // Wired by main.js after GameManager is built (Score is constructed first).
    setOnRestart: (fn) => { onRestartRef = fn; }
  };
}