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
    radius: 42
  };

  // Retain the last intentional direction across joystick release.
  let lastDirection = null;

  function setKnob() {
    const x = Math.max(-state.radius, Math.min(state.radius, state.dx));
    const y = Math.max(-state.radius, Math.min(state.radius, state.dy));
    // CSS centers the knob with translate(-50%, -50%); keep joystick offset
    // separate so changing device sizes never shifts its resting position.
    stickKnob.style.setProperty('--stick-x', `${x}px`);
    stickKnob.style.setProperty('--stick-y', `${y}px`);
  }

  stickBase.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (state.active && state.pointerId !== e.pointerId) return;
    state.active = true;
    state.pointerId = e.pointerId;
    const rect = stickBase.getBoundingClientRect();
    const knobRect = stickKnob.getBoundingClientRect();
    state.baseX = rect.left + rect.width / 2;
    state.baseY = rect.top + rect.height / 2;
    // Adapt the travel radius to the actual responsive joystick size. The
    // previous fixed 50px radius exceeded the compact landscape base and
    // made edge input unreliable on smaller phones.
    state.radius = Math.max(18, rect.width / 2 - knobRect.width / 2 - 5);
    state.dx = 0;
    state.dy = 0;
    setKnob();
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

    // Save the final intentional direction before clearing joystick state.
    // The DASH button is separate, so pointerup may happen before the game
    // loop reads getDirection() one last time.
    const dead = state.radius * 0.2;
    if (state.active && Math.hypot(state.dx, state.dy) >= dead) {
      lastDirection = {
        fwd: state.dy < -dead,
        back: state.dy > dead,
        left: state.dx < -dead,
        right: state.dx > dead
      };
    }

    state.active = false;
    state.pointerId = null;
    state.dx = 0;
    state.dy = 0;
    setKnob();
  };
  stickBase.addEventListener('pointerup', endHandler);
  stickBase.addEventListener('pointercancel', endHandler);
  stickBase.addEventListener('lostpointercapture', endHandler);

  // Buttons
  document.getElementById('touch-attack').addEventListener('click', (e) => {
    e.preventDefault();
    onAttack && onAttack();
  });
  document.getElementById('touch-dash').addEventListener('click', (e) => {
    e.preventDefault();
    onDash && onDash();
  });



  // Returns the active direction, or the last direction when released.
  // - fwd/back/left/right: boolean flags
  function getDirection() {
    if (state.active) {
      // Dead zone is a fraction of the joystick radius so it scales
      // correctly across devices with different touch precision.
      const dead = state.radius * 0.2;
      const mag = Math.hypot(state.dx, state.dy);
      if (mag >= dead) {
        lastDirection = {
          fwd: state.dy < -dead,
          back: state.dy > dead,
          left: state.dx < -dead,
          right: state.dx > dead
        };
        return { ...lastDirection };
      }
    }
    return lastDirection ? { ...lastDirection } : null;
  }

  // Movement uses one jump direction at a time. Choose the dominant axis
  // so diagonal drags remain predictable and feed the normal movement queue.
  function getMoveDirection() {
    if (!state.active) return null;
    const dead = state.radius * 0.2;
    if (Math.hypot(state.dx, state.dy) < dead) return null;
    if (Math.abs(state.dx) > Math.abs(state.dy)) {
      return state.dx < 0 ? 'left' : 'right';
    }
    return state.dy < 0 ? 'forward' : 'backward';
  }

  function dispose() {
    root.remove();
  }

  return { getDirection, getMoveDirection, dispose };
}
