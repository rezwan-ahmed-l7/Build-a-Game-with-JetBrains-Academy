// Start / Pause / Game-Over menus. Single overlay container; the active
// menu is whichever is currently shown. Buttons dispatch callbacks.

import { el, isTouchDevice } from '../utils/dom.js';

export function createMenus({ onStart, onResume, onRestart, onTogglePause, onToggleMute, onCycleMode, isMuted }) {
  const root = el('div', { class: 'menu-root' });
  document.body.appendChild(root);

  // ----- Start menu -----
  const start = el('div', { class: 'menu menu-start', id: 'menu-start' }, [
    el('p', { class: 'menu-kicker' }, ['MOONLIT MEADOW  /  SURVIVAL MODE']),
    el('h1', { class: 'menu-title' }, ['Tode the Frog']),
    el('p', { class: 'menu-subtitle' }, ['A little frog. A very long night.']),
    el('p', { class: 'menu-objective' }, ['Defeat the shades · Chain your attacks · Survive the night']),
    el('div', { class: 'menu-buttons' }, [
      el('button', { class: 'menu-button primary', id: 'btn-start' }, ['Play'])
    ]),
    el('div', { class: 'menu-hints' }, [
      el('p', {}, ['WASD / Arrows to move']),
      el('p', {}, ['Space to attack']),
      el('p', {}, ['Shift to dash']),
      el('p', {}, ['Q/E or drag to rotate camera · R/F pitch · Wheel zoom']),
      el('p', {}, ['Esc / P to pause'])
    ])
  ]);
  root.appendChild(start);

  // ----- Pause menu -----
  const pause = el('div', { class: 'menu menu-pause', id: 'menu-pause', style: { display: 'none' } }, [
    el('h1', {}, ['Paused']),
    el('div', { class: 'menu-buttons' }, [
      el('button', { class: 'menu-button', id: 'btn-resume' }, ['Resume']),
      el('button', { class: 'menu-button', id: 'btn-restart' }, ['Restart'])
    ])
  ]);
  root.appendChild(pause);

  // ----- HUD: small floating pause button (top-right) -----
  const hud = el('div', { class: 'menu-hud' }, [
    el('button', { class: 'icon-button', id: 'btn-pause', title: 'Pause' }, ['\u2759\u2759']),
    el('button', { class: 'icon-button', id: 'btn-mute', title: 'Mute' }, [isMuted() ? '\u266B\u20E0' : '\u266B']),
    el('button', { class: 'icon-button', id: 'btn-cycle', title: 'Cycle environment' }, ['\u263E'])
  ]);
  document.body.appendChild(hud);

  // ----- Hint: tap-to-start is required for audio unlock -----
  start.querySelector('#btn-start').addEventListener('click', () => {
    onStart();
  });
  pause.querySelector('#btn-resume').addEventListener('click', () => onResume());
  pause.querySelector('#btn-restart').addEventListener('click', () => onRestart());
  // Pause button: always toggle, regardless of current state.
  hud.querySelector('#btn-pause').addEventListener('click', () => onTogglePause && onTogglePause());
  hud.querySelector('#btn-mute').addEventListener('click', () => {
    onToggleMute();
    const btn = hud.querySelector('#btn-mute');
    btn.textContent = isMuted() ? '\u266B\u20E0' : '\u266B';
  });
  hud.querySelector('#btn-cycle').addEventListener('click', () => onCycleMode());

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Enter') {
      if (start.style.display !== 'none') {
        e.preventDefault();
        onStart();
      }
    }
  });

  function showStart() {
    start.style.display = '';
    pause.style.display = 'none';
  }
  function hideStart() {
    start.style.display = 'none';
  }
  function showPause() {
    pause.style.display = '';
  }
  function hidePause() {
    pause.style.display = 'none';
  }
  function showHud(show) {
    hud.style.display = show ? '' : 'none';
  }

  return { showStart, hideStart, showPause, hidePause, showHud };
}
