// Lightweight toast notification system. Stacks up to MAX_VISIBLE toasts
// in the top-right, below the icon-button HUD column. Toasts auto-dismiss
// after `duration` ms, with a fade-out + slide-up exit. The host element
// is appended to <body> on creation and removed with dispose().
//
// Decoupled from the rest of the game: callers just pass a label, a
// short description (e.g. "+1 HP"), and an accent color hex.

import { el, prefersReducedMotion } from '../utils/dom.js';

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 2400;
// Must match the .toast-exit keyframe duration in style.css.
const EXIT_DURATION_MS = 320;

export function createNotifications() {
  // Non-interactive container — pointer-events: none so toasts never
  // block clicks on the canvas or the icon-button column above them.
  const host = el('div', {
    className: 'toast-host',
    'aria-live': 'polite',
    'aria-atomic': 'true'
  });
  document.body.appendChild(host);

  const active = [];

  function show({ label, desc, color = 0xffe27a, duration = DEFAULT_DURATION }) {
    if (prefersReducedMotion()) duration = Math.min(duration, 1200);

    const { r, g, b } = hexToRgb(color);
    const accent = `rgb(${r}, ${g}, ${b})`;
    const accentSoft = `rgba(${r}, ${g}, ${b}, 0.35)`;

    const dot = el('span', { className: 'toast-dot', 'aria-hidden': 'true' });
    const labelNode = el('div', { className: 'toast-label' }, [String(label)]);
    const bodyChildren = [labelNode];
    if (desc) bodyChildren.push(el('div', { className: 'toast-desc' }, [String(desc)]));
    const body = el('div', { className: 'toast-body' }, bodyChildren);

    const toast = el('div', {
      className: 'toast-notification',
      style: { '--accent': accent, '--accent-soft': accentSoft }
    }, [dot, body]);

    host.appendChild(toast);
    if (active.length >= MAX_VISIBLE) dismiss(active[0], true);
    active.push(toast);

    toast._dismissTimer = setTimeout(() => dismiss(toast), duration);
    return toast;
  }

  function dismiss(node, immediate = false) {
    if (!node || !node.isConnected) return;
    if (node._dismissTimer) clearTimeout(node._dismissTimer);
    if (immediate) { remove(node); return; }
    node.classList.add('toast-exit');
    node._exitTimer = setTimeout(() => remove(node), EXIT_DURATION_MS);
  }

  function remove(node) {
    if (node._exitTimer) clearTimeout(node._exitTimer);
    const idx = active.indexOf(node);
    if (idx >= 0) active.splice(idx, 1);
    if (node.parentNode) node.parentNode.removeChild(node);
  }

  function clear() {
    for (const n of active.slice()) dismiss(n, true);
  }

  function dispose() {
    clear();
    if (host.parentNode) host.parentNode.removeChild(host);
  }

  return { show, clear, dispose };
}

function hexToRgb(hex) {
  return {
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff
  };
}
