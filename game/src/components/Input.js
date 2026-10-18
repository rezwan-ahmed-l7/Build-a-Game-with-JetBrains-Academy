export function createInput() {
  const queue = [];
  const maxQueueSize = 1;
  let enabled = true;

  const keyMap = {
    ArrowUp: 'forward',
    ArrowDown: 'backward',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    w: 'forward',
    s: 'backward',
    a: 'left',
    d: 'right',
    W: 'forward',
    S: 'backward',
    A: 'left',
    D: 'right'
  };

  // Currently-held keys (for dash direction)
  const held = {
    forward: false, backward: false, left: false, right: false
  };

  function handleKeyDown(e) {
    if (!enabled) return;
    if (e.key in keyMap) {
      e.preventDefault();
      const direction = keyMap[e.key];
      held[direction] = true;
      if (queue.length < maxQueueSize) {
        queue.push(direction);
      }
    }
  }

  function handleKeyUp(e) {
    if (e.key in keyMap) {
      const direction = keyMap[e.key];
      held[direction] = false;
    }
  }


  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  function dequeue() {
    return queue.shift();
  }

  function peek() {
    return queue[0];
  }

  function isEmpty() {
    return queue.length === 0;
  }

  function clear() {
    queue.length = 0;
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    clear();
    for (const direction of Object.keys(held)) held[direction] = false;
  }

  // Snapshot of currently-held keys for systems that need to know
  // (e.g. dash direction).
  function getHeldDirection() {
    if (!held.forward && !held.backward && !held.left && !held.right) return null;
    return { ...held };
  }

  // Register a click-to-attack handler on the canvas. Returns a cleanup function.
  // On touch devices, skip — the virtual joystick handles attack instead.
  function attachClickToAttack(canvas, onAttack) {
    if (typeof navigator !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
      return () => {}; // no-op on touch devices
    }
    function onClick(e) {
      if (!enabled) return;
      onAttack();
    }
    canvas.addEventListener('pointerdown', onClick);
    return () => canvas.removeEventListener('pointerdown', onClick);
  }

  return {
    dequeue, peek, isEmpty, clear, setEnabled,
    getHeldDirection, attachClickToAttack
  };
}
