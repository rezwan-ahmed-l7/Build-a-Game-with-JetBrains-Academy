import { createScore } from '../game/src/components/Score.js';

describe('score component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  test('starts at zero and creates score UI', () => {
    const score = createScore();

    expect(score.getScore()).toBe(0);
    expect(document.querySelector('.score').textContent).toBe('Score: 0');
    expect(document.querySelector('.game-over').style.display).toBe('none');
  });

  test('adds time-based score and renders the integer score', () => {
    const score = createScore();

    score.tick(2.5);
    score.render();

    expect(score.getScore()).toBeCloseTo(7.5);
    expect(document.querySelector('.score').textContent).toBe('Score: 7');
  });

  test('adds kill bonus', () => {
    const score = createScore();

    score.addKillBonus();
    expect(score.getScore()).toBe(15);
  });

  test('resets current score and hides game-over overlay', () => {
    const score = createScore();

    score.addKillBonus();
    score.showGameOver();
    score.reset();
    score.hideGameOver();

    expect(score.getScore()).toBe(0);
    expect(document.querySelector('.score').textContent).toBe('Score: 0');
    expect(document.querySelector('.game-over').style.display).toBe('none');
  });

  test('shows the final score and retains the best score', () => {
    const score = createScore();

    score.tick(5);
    score.showGameOver();

    expect(document.querySelector('.final-score-value').textContent).toBe('15');
    expect(document.querySelector('.game-over').style.display).toBe('flex');
    expect(score.getHighScore()).toBe(15);

    score.reset();
    score.tick(2);
    score.showGameOver();

    expect(score.getHighScore()).toBe(15);
  });
});
