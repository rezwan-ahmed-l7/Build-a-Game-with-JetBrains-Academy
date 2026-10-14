export const GameState = {
  PLAYING: 'playing',
  GAMEOVER: 'gameover'
};

const SCORE_PER_SECOND = 1;
const SCORE_PER_KILL = 15;

export function createScore() {
  let score = 0;
  let highScore = 0;
  let lastScoreDisplayed = -1;

  const el = document.createElement('div');
  el.className = 'score';
  el.textContent = 'Score: 0';
  document.body.appendChild(el);

  const gameOverEl = document.createElement('div');
  gameOverEl.className = 'game-over';
  gameOverEl.innerHTML = `
    <div class="game-over-panel">
      <h1>Game Over</h1>
      <p class="final-score">Score: <span class="final-score-value">0</span></p>
      <p class="hint">Press <kbd>Space</kbd> to Restart</p>
    </div>
  `;
  gameOverEl.style.display = 'none';
  document.body.appendChild(gameOverEl);

  function tick(delta) {
    score += SCORE_PER_SECOND * delta;
  }

  function addKillBonus() {
    score += SCORE_PER_KILL;
  }

  function render() {
    const display = Math.floor(score);
    if (display !== lastScoreDisplayed) {
      el.textContent = `Score: ${display}`;
      lastScoreDisplayed = display;
    }
  }

  function showGameOver() {
    const display = Math.floor(score);
    if (score > highScore) highScore = score;
    gameOverEl.querySelector('.final-score-value').textContent = display;
    gameOverEl.style.display = 'flex';
  }

  function hideGameOver() {
    gameOverEl.style.display = 'none';
  }

  function reset() {
    score = 0;
    lastScoreDisplayed = -1;
    el.textContent = 'Score: 0';
  }

  function getScore() {
    return score;
  }

  function getHighScore() {
    return highScore;
  }

  return {
    tick,
    addKillBonus,
    render,
    showGameOver,
    hideGameOver,
    reset,
    getScore,
    getHighScore
  };
}
