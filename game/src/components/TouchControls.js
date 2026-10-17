// Touch / mobile controls. Auto-detected via isTouchDevice() in dom.js.
// Provides:
//  - Virtual joystick (bottom-left): converts to a direction string fed
//    into the same movement pipeline as keyboard.
//  - Action buttons (bottom-right): Attack, Dash, Pause.
//  - Tap-anywhere-on-canvas as a move target (same as desktop click-to-move).

import { el, isTouchDevice } from '../utils/dom.js';

export function createTouchControls({ onPause, onAttack, onDash }) {
  if (!isTouchDevice()) return null;

  const root = el('div', { class: 'touch-root' });
  document.body.appendChild(root);

  // Joystick
  const stickBase = el('div', { class: 'joystick-base' });
  const stickKnob = el('div', { class: 'joystick-knob' });
  stickBase.appendChild(stickKnob);
  root.appendChild(stickBase);

  // Buttons
  const btnRow = el('div', { class: 'touch-buttons' }, [
    el('button', { class: 'touch-button dash', id: 'touch-dash' }, ['DASH']),
    el('button', { class: 'touch-button attack', id: 'touch-attack' }, ['ATK'])
  ]);
  root.appendChild(btnRow);

  // Pause button (top-right) is shared with the desktop HUD; we don't add
  // a second one.

  // Joystick state
  const state = {
    active: false,
    pointerId: null,
    baseX: 0, baseY: 0,
    dx: 0, dy: 0,
    radius: 50
  };

  function setKnob() {
    const x = Math.max(-state.radius, Math.min(state.radius, state.dx));
    const y = Math.max(-state.radius, Math.min(state.radius, state.dy));
    stickKnob.style.transform = `translate(${x}px, ${y}px)`;
  }

  stickBase.addEventListener('pointerdown', (e) => {
    state.active = true;
    state.pointerId = e.pointerId;
    const rect = stickBase.getBoundingClientRect();
    state.baseX = rect.left + rect.width / 2;
    state.baseY = rect.top + rect.height / 2;
    stickBase.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  stickBase.addEventListener('pointermove', (e) => {
    if (!state.active || e.pointerId !== state.pointerId) return;
    state.dx = e.clientX - state.baseX;
    state.dy = e.clientY - state.baseY;
    setKnob();
  });

  const endHandler = (e) => {
    if (e.pointerId !== state.pointerId && state.pointerId != null) return;
    state.active = false;
    state.pointerId = null;
    state.dx = 0;
    state.dy = 0;
    setKnob();
  };
  stickBase.addEventListener('pointerup', endHandler);
  stickBase.addEventListener('pointercancel', endHandler);

  // Buttons
  document.getElementById('touch-attack').addEventListener('click', (e) => {
    e.preventDefault();
    onAttack && onAttack();
  });
  document.getElementById('touch-dash').addEventListener('click', (e) => {
    e.preventDefault();
    onDash && onDash();
  });

  // Returns the most recent direction object or null.
  // - fwd/back/left/right: boolean flags
  function getDirection() {
    if (!state.active) return null;
    const mag = Math.sqrt(state.dx * state.dx + state.dy * state.dy);
    if (mag < 12) return null; // dead zone
    return {
      fwd: state.dy < -12,
      back: state.dy > 12,
      left: state.dx < -12,
      right: state.dx > 12
    };
  }

  function dispose() {
    root.remove();
  }

  return { getDirection, dispose };
}
