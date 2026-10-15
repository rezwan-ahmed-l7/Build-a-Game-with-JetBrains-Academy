// Score, hearts, combo HUD, and game-over panel. Now re-uses the central
// GameState enum and integrates with the Health system for the heart row.

export { GameState } from './GameState.js';
import { GameState } from './GameState.js';
import { load, save } from '../utils/persistence.js';

const SCORE_PER_SECOND = 1;
const SCORE_PER_KILL = 15;

export function createScore() {
  let score = 0;
  let highScore = load('highScore', 0);
  let lastScoreDisplayed = -1;

  // Combo state — owned by Score for HUD; the Combo system mirrors the
  // values for multiplier computation.
  let combo = 0;
  let comboTimer = 0;
  const COMBO_WINDOW = 1.5;
  let lastComboDisplayed = -1;

  function setCombo(value, timer) {
    combo = value;
    comboTimer = timer;
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

  // Game-over overlay
  const gameOverEl = document.createElement('div');
  gameOverEl.className = 'game-over';
  gameOverEl.innerHTML = `
    <div class="game-over-panel">
      <h1>Game Over</h1>
      <p class="final-score">Score: <span class="final-score-value">0</span></p>
      <p class="high-score">Best: <span class="high-score-value">0</span></p>
      <p class="hint">Press <kbd>Space</kbd> to Restart</p>
    </div>
  `;
  gameOverEl.style.display = 'none';
  document.body.appendChild(gameOverEl);

  function setHearts(hp, max) {
    for (let i = 0; i < heartNodes.length; i++) {
      const node = heartNodes[i];
      if (i < max) {
        node.style.display = '';
        if (i < hp) node.classList.remove('empty');
        else node.classList.add('empty');
      } else {
        node.style.display = 'none';
      }
    }
  }

  function tick(delta) {
    score += SCORE_PER_SECOND * delta;
  }

  function addKillBonus(comboMultiplier = 1) {
    score += SCORE_PER_KILL * comboMultiplier;
  }

  function render() {
    const display = Math.floor(score);
    if (display !== lastScoreDisplayed) {
      el.textContent = `Score: ${display}`;
      lastScoreDisplayed = display;
    }
    if (combo !== lastComboDisplayed) {
      if (combo > 1) {
        comboEl.textContent = `x${combo} COMBO`;
        comboEl.style.display = '';
        comboEl.classList.remove('flash');
        void comboEl.offsetWidth;
        comboEl.classList.add('flash');
      } else {
        comboEl.style.display = 'none';
      }
      lastComboDisplayed = combo;
    }
  }

  function showGameOver() {
    const display = Math.floor(score);
    if (score > highScore) {
      highScore = score;
      save('highScore', Math.floor(highScore));
    }
    gameOverEl.querySelector('.final-score-value').textContent = display;
    gameOverEl.querySelector('.high-score-value').textContent = Math.floor(highScore);
    gameOverEl.style.display = 'flex';
  }

  function hideGameOver() {
    gameOverEl.style.display = 'none';
  }

  function reset() {
    score = 0;
    combo = 0;
    comboTimer = 0;
    lastScoreDisplayed = -1;
    lastComboDisplayed = -1;
    el.textContent = 'Score: 0';
    comboEl.style.display = 'none';
    setHearts(3, 3);
  }

  function getScore() { return score; }
  function getHighScore() { return highScore; }
  function getCombo() { return combo; }

  return {
    tick, addKillBonus, render,
    showGameOver, hideGameOver, reset,
    getScore, getHighScore, getCombo,
    setHearts, setCombo
  };
}

// Re-export to keep callers that imported GameState from Score working.
export { GameState as legacyGameState };
