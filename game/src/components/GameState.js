// Centralized game state enum. Replaces the previous GameState inside
// Score.js so every system speaks the same vocabulary.

export const GameState = Object.freeze({
  MENU: 'menu',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAMEOVER: 'gameover',
});
