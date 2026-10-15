export function createInput() {
  const queue = [];
  const maxQueueSize = 1;

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

  function handleKeyDown(e) {
    if (e.key in keyMap) {
      e.preventDefault();
      const direction = keyMap[e.key];

      if (queue.length < maxQueueSize) {
        queue.push(direction);
      }
    }
  }

  window.addEventListener('keydown', handleKeyDown);

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

  return {
    dequeue,
    peek,
    isEmpty,
    clear
  };
}
