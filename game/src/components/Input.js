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

  // Click-to-move: a click on the canvas converts to a direction in
  // camera-relative space. Movement's getCameraBasis already handles this
  // — Input only knows about keyboard.
  function handleCanvasClick(e, getCameraBasis) {
    if (!enabled) return;
    // No-op: the click-to-move logic lives in Movement itself via
    // (targetPos) => canPlayerMoveTo. We expose a "click" queue for the
    // click-to-move path here.
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const basis = getCameraBasis();
    if (!basis.valid) return;

    // Convert to world X/Y by projecting the click direction onto the
    // camera basis. Store the raw (un-normalized) offset so Movement can
    // scale it — clicking farther from center moves the player farther.
    const tx = nx * basis.fwdX + ny * basis.rightX;
    const ty = nx * basis.fwdY + ny * basis.rightY;
    queue.push({ click: { x: tx, y: ty } });
    if (queue.length > maxQueueSize) queue.shift();
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

  // Register a click-to-move handler on a canvas. Returns a cleanup function.
  // On touch devices, skip — the virtual joystick handles movement instead.
  function attachClickToMove(canvas, getCameraBasis) {
    if (typeof navigator !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
      return () => {}; // no-op on touch devices
    }
    function onClick(e) {
      handleCanvasClick(e, getCameraBasis);
    }
    canvas.addEventListener('pointerdown', onClick);
    return () => canvas.removeEventListener('pointerdown', onClick);
  }

  return {
    dequeue, peek, isEmpty, clear, setEnabled,
    getHeldDirection, attachClickToMove
  };
}
