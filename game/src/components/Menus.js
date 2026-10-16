// Start / Pause / Game-Over menus. Single overlay container; the active
// menu is whichever is currently shown. Buttons dispatch callbacks.

import { el, clear, isTouchDevice } from '../utils/dom.js';
import { loadProfile, saveProfile } from './Profile.js';
import { getTop } from './Leaderboard.js';
import { getAttempts } from './PlayCounter.js';
import { COUNTRIES } from '../data/countries.js';

const NAME_MIN = 1;
const NAME_MAX = 12;

export function createMenus({ onStart, onResume, onRestart, onTogglePause, onToggleMute, onCycleMode, isMuted }) {
  // Resolve once so all child builders (start menu, pause menu, game-over
  // hint) agree on whether to render keyboard or touch instructions.
  const isTouch = isTouchDevice();

  const root = el('div', { class: 'menu-root' });
  document.body.appendChild(root);

  // ----- Start menu -----
  // The profile row (name + flag) lives inside the start menu. The
  // Play button is disabled until both fields are valid.
  const start = el('div', { class: 'menu menu-start', id: 'menu-start' });
  root.appendChild(start);
  buildStartMenu(start);

  // ----- Pause menu -----
  // On touch devices, the "Press Esc to resume" hint doesn't apply —
  // touch users tap the Resume button instead. Swap the keyboard hint
  // for a touch-aware one (and add .is-touch so the parent menu can
  // adjust layout if needed). Resume / Restart buttons are always
  // visible so both input modes work.
  const pauseHintHtml = isTouch
    ? 'Tap <strong>Resume</strong> to continue'
    : 'Press <kbd>Esc</kbd> to resume';
  const pauseClasses = 'menu menu-pause' + (isTouch ? ' is-touch' : '');
  const pause = el('div', { class: pauseClasses, id: 'menu-pause', style: { display: 'none' } }, [
    el('h1', {}, ['Paused']),
    el('div', { class: 'menu-buttons' }, [
      el('button', { class: 'menu-button', id: 'btn-resume' }, ['Resume']),
      el('button', { class: 'menu-button', id: 'btn-restart' }, ['Restart']),
    ]),
    el('p', { class: 'pause-hint', html: pauseHintHtml })
  ]);
  root.appendChild(pause);

  // ----- HUD: icon buttons (top-right) -----
  const hud = el('div', { class: 'menu-hud' }, [
    el('div', { class: 'menu-hud-row' }, [
      el('button', { class: 'icon-button', id: 'btn-pause', title: 'Pause' }, ['\u2759\u2759']),
      el('button', { class: 'icon-button', id: 'btn-mute', title: 'Mute' }, [isMuted() ? '\u266B\u20E0' : '\u266B']),
      el('button', { class: 'icon-button', id: 'btn-cycle', title: 'Cycle environment' }, ['\u263E']),
    ]),
    el('button', { class: 'mode-pill', id: 'mode-pill', title: 'Click to cycle day / night / auto' }, ['Auto Cycle'])
  ]);
  document.body.appendChild(hud);

  // ----- Bottom-center controls strip (created here, hidden by default) -----
  const controlsStrip = el('div', { class: 'controls-strip', id: 'controls-strip', style: { display: 'none' }, html:
    '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move <span class="sep">·</span> ' +
    '<kbd>Space</kbd> Attack <span class="sep">·</span> ' +
    '<kbd>Shift</kbd> Dash <span class="sep">·</span> ' +
    '<kbd>Esc</kbd> Pause'
  });
  document.body.appendChild(controlsStrip);

  // ----- Flag picker modal (created once, hidden by default) -----
  const flagModal = buildFlagModal(() => {
    // onClose callback — fired on confirm, cancel, or backdrop click.
    // The picker already updated the profile + chip + play state on
    // confirm; this just hides the backdrop.
  });
  document.body.appendChild(flagModal);

  // ----- Start menu: profile + leaderboard wiring -----
  // Current in-memory profile. Source of truth while the menu is open;
  // persisted to localStorage whenever it changes (debounced).
  const profile = loadProfile() || { name: '', flag: '' };

  const nameInput = start.querySelector('#profile-name');
  const flagChip = start.querySelector('#profile-flag');
  const profileError = start.querySelector('#profile-error');
  const playBtn = start.querySelector('#btn-start');
  const leaderboardEl = start.querySelector('#menu-leaderboard');
  const rankBadge = start.querySelector('#menu-my-rank');
  const playCounterEl = start.querySelector('#menu-play-counter');

  nameInput.value = profile.name;
  flagChip.textContent = profile.flag || '🏳️';  // placeholder

  function refreshPlayState() {
    const name = nameInput.value.trim();
    const flag = profile.flag;
    const valid = name.length >= NAME_MIN && name.length <= NAME_MAX && !!flag;
    playBtn.disabled = !valid;
    playBtn.classList.toggle('is-disabled', !valid);
    if (name.length > NAME_MAX) {
      profileError.textContent = `Name is too long (max ${NAME_MAX} characters).`;
      profileError.style.display = '';
    } else if (name.length === 0) {
      profileError.textContent = 'Enter a name to play.';
      profileError.style.display = '';
    } else if (!flag) {
      profileError.textContent = 'Pick a flag to play.';
      profileError.style.display = '';
    } else {
      profileError.textContent = '';
      profileError.style.display = 'none';
    }
  }
  refreshPlayState();
  renderLeaderboardInto(leaderboardEl, rankBadge, playCounterEl);

  nameInput.addEventListener('input', () => {
    profile.name = nameInput.value;
    refreshPlayState();
    // Persist on first valid input so a refresh restores the half-filled state.
    if (profile.name && profile.flag) saveProfile(profile.name, profile.flag);
  });
  // Click the flag chip → open modal. Pre-fill with the current profile
  // so a returning player sees their previous pick + the CTA enabled.
  flagChip.addEventListener('click', () => {
    flagModal.prefill(profile.flag);
    flagModal.style.display = '';
  });

  // Hint: tap-to-start is required for audio unlock.
  playBtn.addEventListener('click', () => {
    if (playBtn.disabled) return;
    saveProfile(profile.name, profile.flag);
    onStart();
  });
  pause.querySelector('#btn-resume').addEventListener('click', () => onResume());
  pause.querySelector('#btn-restart').addEventListener('click', () => onRestart());

  const muteBtn = hud.querySelector('#btn-mute');
  hud.querySelector('#btn-pause').addEventListener('click', () => onTogglePause && onTogglePause());
  muteBtn.addEventListener('click', () => {
    onToggleMute();
    muteBtn.textContent = isMuted() ? '\u266B\u20E0' : '\u266B';
    muteBtn.classList.toggle('muted', isMuted());
  });
  hud.querySelector('#btn-cycle').addEventListener('click', () => onCycleMode());
  const modePill = hud.querySelector('#mode-pill');
  modePill.addEventListener('click', () => onCycleMode());

  // Keyboard shortcuts. Enter only triggers start if the Play button
  // is enabled (profile valid).
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Enter') {
      if (start.style.display !== 'none' && !playBtn.disabled) {
        e.preventDefault();
        saveProfile(profile.name, profile.flag);
        onStart();
      }
    }
  });

  function showStart() {
    start.style.display = '';
    pause.style.display = 'none';
    // Re-render the leaderboard in case a run finished while we were away.
    renderLeaderboardInto(leaderboardEl, rankBadge, playCounterEl);
    refreshPlayState();
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
    controlsStrip.style.display = show ? '' : 'none';
  }
  function setEnvironmentMode(label, modeKey = 'auto') {
    modePill.firstChild.nodeValue = label;
    modePill.dataset.mode = modeKey;
  }

  // Refresh the start-menu leaderboard without rebuilding the whole menu.
  // Called by main.js after a run ends so the new entry is visible.
  function refreshLeaderboard() {
    renderLeaderboardInto(leaderboardEl, rankBadge, playCounterEl);
  }

  return {
    showStart, hideStart, showPause, hidePause, showHud, setEnvironmentMode,
    refreshLeaderboard
  };

  // -----------------------------------------------------------------------
  // Build the start menu contents (title, profile, leaderboard, hints).
  // The profile row and the leaderboard are siblings of the existing
  // title block so the visual hierarchy stays the same.
  // -----------------------------------------------------------------------
  function buildStartMenu(container) {
    const profileRow = el('div', { class: 'profile-row' }, [
      el('label', { class: 'profile-label', for: 'profile-name' }, ['Player name']),
      el('input', {
        class: 'profile-name', id: 'profile-name', type: 'text',
        maxlength: String(NAME_MAX), placeholder: 'Enter name…',
        autocomplete: 'off', spellcheck: 'false'
      }),
      el('button', {
        class: 'profile-flag', id: 'profile-flag',
        type: 'button', title: 'Pick a flag'
      }, ['🏳️']),
    ]);
    const profileErr = el('p', {
      class: 'profile-error', id: 'profile-error', style: { display: 'none' }
    });
    const playBtnEl = el('button', {
      class: 'menu-button primary is-disabled', id: 'btn-start', disabled: 'disabled'
    }, ['Play']);

    const leaderboard = el('div', { class: 'leaderboard', id: 'menu-leaderboard' });
    const rankBadgeEl = el('div', {
      class: 'my-rank-badge', id: 'menu-my-rank', style: { display: 'none' }
    });
    // Community play counter — sits under the leaderboard list. Hidden
    // until the count is > 0; updated by `renderLeaderboardInto` on
    // every leaderboard re-render so a fresh Play press always shows
    // up immediately.
    const playCounterEl = el('p', {
      class: 'play-counter', id: 'menu-play-counter', style: { display: 'none' }
    });

    // On touch devices show "tap Play" instead of "press Enter", and
    // replace the WASD/Space/Esc hint grid with what the player will
    // actually use: joystick + action buttons.
    const enterHintHtml = isTouch
      ? 'Tap <strong>Play</strong> to begin'
      : 'Press <kbd>Enter</kbd> or click Play';
    const hintsGrid = isTouch
      ? el('div', { class: 'menu-hints menu-hints-touch' }, [
          el('p', { html: '<span class="touch-hint-icon">🕹</span> Joystick Move' }),
          el('p', { html: '<span class="touch-hint-chip">ATK</span> Attack' }),
          el('p', { html: '<span class="touch-hint-chip">DASH</span> Dash' }),
          el('p', { html: '<span class="touch-hint-icon">⏸</span> Pause (top-right)' }),
          el('p', { html: '<span class="touch-hint-icon">🚩</span> Tap your flag to change' }),
        ])
      : el('div', { class: 'menu-hints' }, [
          el('p', { html: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move' }),
          el('p', { html: '<kbd>Space</kbd> Attack' }),
          el('p', { html: '<kbd>Shift</kbd> Dash' }),
          el('p', { html: '<kbd>Q</kbd><kbd>E</kbd> Rotate · <kbd>R</kbd><kbd>F</kbd> Pitch' }),
          el('p', { html: 'Wheel Zoom' }),
          el('p', { html: '<kbd>Esc</kbd> / <kbd>P</kbd> Pause' }),
        ]);

    const items = [
      el('p', { class: 'menu-kicker' }, ['MOONLIT MEADOW  /  SURVIVAL MODE']),
      el('h1', { class: 'menu-title' }, ['Tode the Frog']),
      el('p', { class: 'menu-subtitle' }, ['A little frog · A very long night']),
      el('p', { class: 'menu-objective' }, ['Defeat the shades · Chain your attacks · Survive the night']),
      profileRow,
      profileErr,
      el('div', { class: 'menu-buttons' }, [playBtnEl]),
      el('p', { class: 'menu-enter-hint', html: enterHintHtml }),
      el('div', { class: 'leaderboard-wrap' }, [
        el('h3', { class: 'leaderboard-title' }, ['Top 5']),
        rankBadgeEl,
        leaderboard,
        playCounterEl,
      ]),
      hintsGrid,
    ];
    for (const item of items) container.appendChild(item);
  }

  function buildFlagModal(onClose) {
    const backdrop = el('div', { class: 'flag-modal-backdrop', style: { display: 'none' } });

    // Header — same hierarchy as the start menu: eyebrow + title + subtitle + divider.
    const header = el('div', { class: 'flag-modal-header' }, [
      el('p', { class: 'flag-modal-eyebrow' }, ['PICK YOUR COUNTRY']),
      el('h2', { class: 'flag-modal-title' }, ['Choose your flag']),
      el('p', { class: 'flag-modal-subtitle' }, ['This will show on the leaderboard']),
      el('hr', { class: 'flag-modal-divider' }),
    ]);

    // "Current pick" card — mirrors the .game-over-stats inner surface.
    // Starts as the placeholder, then is populated as the user hovers / clicks.
    const pickEmoji = el('div', { class: 'flag-pick-emoji' }, ['🏳️']);
    const pickName = el('div', { class: 'flag-pick-name' }, ['Pick a flag']);
    const pickHint = el('div', { class: 'flag-pick-hint' }, ['Tap a flag below to choose']);
    const pickCard = el('div', { class: 'flag-pick-card' }, [pickEmoji, pickName, pickHint]);

    const grid = el('div', { class: 'flag-grid' });

    // Primary CTA — same look as the start menu's "Play" button. Disabled
    // until the user has chosen a flag (or a prior pick is being kept).
    const confirmBtn = el('button', {
      class: 'flag-modal-confirm is-disabled', type: 'button', id: 'flag-confirm',
      disabled: 'disabled'
    }, ['Use this flag']);

    const panel = el('div', { class: 'flag-modal' }, [
      header,
      pickCard,
      grid,
      confirmBtn,
    ]);
    backdrop.appendChild(panel);

    // Pending pick: null = nothing chosen in this session, otherwise the
    // country the user is hovering / has clicked. The "Use this flag" CTA
    // commits the pending pick to the profile + chip.
    let pending = null;
    // Track the cell that visually holds the pending pick (so we can clear
    // its `.is-selected` when the user changes their mind).
    let pendingBtn = null;

    function renderPick(c) {
      if (c) {
        pickEmoji.textContent = c.emoji;
        pickName.textContent = c.name;
        pickHint.textContent = 'Looks good? Hit Use this flag below.';
      } else {
        pickEmoji.textContent = '🏳️';
        pickName.textContent = 'Pick a flag';
        pickHint.textContent = 'Tap a flag below to choose';
      }
    }
    function refreshConfirm() {
      const ok = !!pending;
      confirmBtn.disabled = !ok;
      confirmBtn.classList.toggle('is-disabled', !ok);
    }

    for (const c of COUNTRIES) {
      // Cell shows ONLY the emoji; the cell's title / aria-label carries
      // the full country name for screen readers + hover tooltips.
      const btn = el('button', {
        class: 'flag-cell', type: 'button',
        'data-flag': c.emoji, 'data-code': c.code,
        title: c.name, 'aria-label': c.name
      }, [
        el('span', { class: 'flag-emoji' }, [c.emoji]),
      ]);
      // Hover / focus previews the pick in the card but does NOT commit.
      btn.addEventListener('mouseenter', () => renderPick(c));
      btn.addEventListener('focus', () => renderPick(c));
      btn.addEventListener('click', () => {
        // Lock the pending pick to this cell.
        if (pendingBtn) pendingBtn.classList.remove('is-selected');
        btn.classList.add('is-selected');
        pendingBtn = btn;
        pending = c;
        renderPick(c);
        refreshConfirm();
      });
      grid.appendChild(btn);
    }

    // ESC + Enter on the backdrop: Enter triggers confirm (when enabled);
    // ESC cancels. Backdrop click also cancels.
    function cancel() {
      backdrop.style.display = 'none';
      if (onClose) onClose();
    }
    function confirm() {
      if (!pending) return;
      // Commit: update profile + chip + play state, then close.
      profile.flag = pending.emoji;
      flagChip.textContent = pending.emoji;
      if (profile.name) saveProfile(profile.name, profile.flag);
      refreshPlayState();
      cancel();
    }
    confirmBtn.addEventListener('click', confirm);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cancel();
    });
    backdrop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      } else if (e.key === 'Enter' && !confirmBtn.disabled &&
                 document.activeElement !== confirmBtn) {
        // Enter inside the grid commits the currently pending pick.
        e.preventDefault();
        confirm();
      }
    });

    // Pre-fill the modal with the current profile's flag (if any). Called
    // by the caller every time the modal opens so a returning player
    // sees their previous pick highlighted + the CTA enabled.
    function prefill(currentFlagEmoji) {
      // Clear previous pending state.
      if (pendingBtn) pendingBtn.classList.remove('is-selected');
      pendingBtn = null;
      pending = null;
      // Find the matching country.
      const match = COUNTRIES.find((c) => c.emoji === currentFlagEmoji) || null;
      if (match) {
        pending = match;
        const btn = backdrop.querySelector(`[data-flag="${CSS.escape(match.emoji)}"]`);
        if (btn) {
          btn.classList.add('is-selected');
          pendingBtn = btn;
        }
        renderPick(match);
      } else {
        renderPick(null);
      }
      refreshConfirm();
    }

    return Object.assign(backdrop, { prefill });
  }

  function renderLeaderboardInto(target, rankEl, playCounterEl) {
    if (!target) return;
    clear(target);
    const top = getTop();
    // Update the community play counter on every re-render. Hidden
    // until the count is > 0 — never shows "0 players have tried".
    if (playCounterEl) {
      const attempts = getAttempts();
      if (attempts > 0) {
        const formatted = attempts.toLocaleString('en-US');
        const noun = attempts === 1 ? 'player has' : 'players have';
        playCounterEl.textContent = `${formatted} ${noun} tried Tode the Frog`;
        playCounterEl.style.display = '';
      } else {
        playCounterEl.textContent = '';
        playCounterEl.style.display = 'none';
      }
    }
    if (top.length === 0) {
      target.appendChild(el('p', { class: 'leaderboard-empty' }, ['No runs yet — be the first.']));
      if (rankEl) rankEl.style.display = 'none';
      return;
    }
    const list = el('ol', { class: 'leaderboard-list' });
    const myProfile = loadProfile();
    top.forEach((entry, i) => {
      const isMine = myProfile
        && entry.name === myProfile.name
        && entry.flag === myProfile.flag;
      const row = el('li', {
        class: 'leaderboard-row' + (isMine ? ' is-mine' : '')
      }, [
        el('span', { class: 'lb-rank' }, [String(i + 1)]),
        el('span', { class: 'lb-flag' }, [entry.flag || '🏳️']),
        el('span', { class: 'lb-name' }, [entry.name]),
        el('span', { class: 'lb-score' }, [String(Math.floor(entry.score))]),
      ]);
      if (isMine) row.appendChild(el('span', { class: 'lb-mine-tag' }, ['You']));
      list.appendChild(row);
    });
    target.appendChild(list);
    if (rankEl) {
      const myRank = top.findIndex((entry, i) => {
        if (!myProfile) return false;
        return entry.name === myProfile.name && entry.flag === myProfile.flag;
      });
      if (myRank >= 0) {
        rankEl.textContent = `You are #${myRank + 1} of ${top.length}`;
        rankEl.style.display = '';
      } else {
        rankEl.style.display = 'none';
      }
    }
  }
}
