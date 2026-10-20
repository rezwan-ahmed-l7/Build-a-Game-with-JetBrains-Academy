// Start / Pause / Game-Over menus. Single overlay container; the active
// menu is whichever is currently shown. Buttons dispatch callbacks.

import { el, clear, isTouchDevice } from '../utils/dom.js';
import { loadProfile, saveProfile } from './Profile.js';
import { getTop, isLeaderboardUnavailable } from './Leaderboard.js';
import { getAttempts } from './PlayCounter.js';
import { COUNTRIES } from '../data/countries.js';
import { POWERUP_TYPES } from './PowerUp.js';

const NAME_MIN = 1;
const NAME_MAX = 12;

export function createMenus({ onStart, onResume, onRestart, onTogglePause, onToggleMute, onCycleMode, isMuted }) {
  const leaderboardRenderVersions = new WeakMap();
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
  // Mini-stats panel — populated by `setPauseStats()` right before the
  // pause menu shows. Kept as a 2x2 grid so it reads at a glance.
  const statsGrid = el('div', { class: 'pause-stats' });
  const pause = el('div', { class: pauseClasses, id: 'menu-pause', style: { display: 'none' } }, [
    el('h1', {}, ['Paused']),
    statsGrid,
    el('div', { class: 'menu-buttons' }, [
      el('button', { class: 'menu-button', id: 'btn-resume' }, ['Resume']),
      el('button', { class: 'menu-button', id: 'btn-restart' }, ['Restart']),
    ]),
    el('p', { class: 'pause-hint', html: pauseHintHtml })
  ]);
  root.appendChild(pause);

  // Resume countdown overlay — separate from the pause menu so it can
  // sit on top of the menu (or anywhere) without altering the menu's
  // layout. Toggled by showResumeCountdown / clearResumeCountdown.
  const countdownEl = el('div', { class: 'resume-countdown', style: { display: 'none' } });
  document.body.appendChild(countdownEl);

  // ----- Mystery Box choice overlay: modal, three distinct tappable cards -----
  const mysteryOverlay = el('div', {
    class: 'mystery-overlay',
    id: 'mystery-overlay',
    style: { display: 'none' },
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Mystery Box power-up selection'
  });
  const mysteryPanel = el('section', { class: 'mystery-panel' });
  const mysteryKicker = el('div', { class: 'mystery-kicker' }, ['RARE DROP  •  LEVEL BONUS']);
  const mysteryTitle = el('h2', { class: 'mystery-title' }, ['MYSTERY BOX']);
  const mysterySubtitle = el('p', { class: 'mystery-subtitle' }, ['Choose one reward']);
  const mysteryTimerText = el('div', { class: 'mystery-timer-text', 'aria-live': 'polite' }, ['15s to choose']);
  const mysteryTimerTrack = el('div', { class: 'mystery-timer-track' }, [
    el('div', { class: 'mystery-timer-fill' })
  ]);
  const mysteryCards = el('div', { class: 'mystery-cards' });
  const mysteryFoot = el('p', { class: 'mystery-foot' }, ['Tap / left-click one card · No pick = no reward']);
  mysteryPanel.append(mysteryKicker, mysteryTitle, mysterySubtitle, mysteryTimerText, mysteryTimerTrack, mysteryCards, mysteryFoot);
  mysteryOverlay.appendChild(mysteryPanel);
  document.body.appendChild(mysteryOverlay);
  let mysteryChoiceHandler = null;
  let mysteryLocked = false;
  const mysteryIcons = {
    freeze: '❄', doubleAttack: '⚡⚡', shield: '🛡', magnet: '🧲',
    heal: '♥', attack: '⚔', score: '★', speed: '➤'
  };

  function showMysteryChoice(options, onSelect) {
    mysteryLocked = false;
    mysteryChoiceHandler = onSelect;
    clear(mysteryCards);
    options.forEach((option, index) => {
      const def = POWERUP_TYPES[option.type];
      const card = el('button', {
        class: 'mystery-card ' + (option.tier === 'better' ? 'is-rare' : 'is-common'),
        type: 'button',
        'aria-label': `${def?.label || option.type}: ${option.desc}`,
        tabindex: '-1'
      }, [
        el('span', { class: 'mystery-card-rank' }, [option.tier === 'better' ? (option.rarity || 'RARE') : 'COMMON']),
        el('span', { class: 'mystery-card-icon', 'aria-hidden': 'true' }, [mysteryIcons[option.type] || '✦']),
        el('span', { class: 'mystery-card-name' }, [def?.label || option.type.toUpperCase()]),
        el('span', { class: 'mystery-card-desc' }, [option.desc]),
        el('span', { class: 'mystery-card-choose' }, ['CHOOSE'])
      ]);
      card.style.setProperty('--reward-color', '#' + (def?.color ?? 0xffd166).toString(16).padStart(6, '0'));
      card.style.setProperty('--reward-accent', '#' + (def?.accent ?? 0xffe39a).toString(16).padStart(6, '0'));
      card.addEventListener('click', (event) => {
        // The feature intentionally supports pointer left-click/tap only;
        // ignore keyboard-generated synthetic clicks (detail === 0).
        if (event.detail === 0 || event.button === 2 || mysteryLocked) return;
        mysteryLocked = true;
        mysteryOverlay.classList.add('is-claimed');
        if (mysteryChoiceHandler) mysteryChoiceHandler(option.type);
      });
      mysteryCards.appendChild(card);
    });
    mysteryTimerText.textContent = '15s to choose';
    mysteryOverlay.classList.remove('is-claimed', 'is-expired');
    mysteryOverlay.style.display = 'flex';
    mysteryTimerTrack.classList.remove('is-running');
    void mysteryTimerTrack.offsetWidth;
    mysteryTimerTrack.classList.add('is-running');
  }
  function hideMysteryChoice(expired = false) {
    mysteryOverlay.classList.toggle('is-expired', expired);
    mysteryOverlay.style.display = 'none';
    mysteryTimerTrack.classList.remove('is-running');
    mysteryChoiceHandler = null;
    mysteryLocked = true;
  }

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
  renderLeaderboardInto(leaderboardEl, rankBadge);

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

  // Toggle the .is-tall class so the menu can pick between center (when
  // content fits) and top-aligned scroll (when it doesn't). Re-runs on
  // resize so orientation changes / window resizes don't strand the
  // user with clipped content.
  function refitMenu(menuEl) {
    if (!menuEl) return;
    // Reset scroll first so the height check uses the un-scrolled state.
    menuEl.scrollTop = 0;
    const tall = menuEl.scrollHeight > menuEl.clientHeight + 1;
    menuEl.classList.toggle('is-tall', !tall);
  }
  const refitAll = () => { refitMenu(start); refitMenu(pause); };
  window.addEventListener('resize', refitAll);

  function showStart() {
    start.style.display = '';
    pause.style.display = 'none';
    // Re-render the leaderboard in case a run finished while we were away.
    renderLeaderboardInto(leaderboardEl, rankBadge);
    refreshPlayState();
    // Defer to next frame so the leaderboard DOM has settled.
    requestAnimationFrame(() => refitMenu(start));
  }
  function hideStart() {
    start.style.display = 'none';
  }
  function showPause() {
    pause.style.display = '';
    requestAnimationFrame(() => refitMenu(pause));
  }
  function hidePause() {
    pause.style.display = 'none';
    clearResumeCountdown();
  }

  // Paint the 4-up mini-stats panel. Called by main.js with a snapshot
  // from GameManager.getRunStats() right before the pause menu shows,
  // so the numbers are always current.
  function setPauseStats(stats) {
    if (!stats) return;
    const fmt = (n) => String(Math.floor(n)).padStart(2, '0');
    const elapsed = stats.elapsedMs || 0;
    const mm = Math.floor(elapsed / 60000);
    const ss = Math.floor((elapsed % 60000) / 1000);
    clear(statsGrid);
    const rows = [
      { label: 'Score', value: String(Math.floor(stats.score || 0)).padStart(2, '0') },
      { label: 'Level', value: `Lv. ${stats.level || 1}` },
      { label: 'Kills', value: String(stats.kills || 0) },
      { label: 'Time', value: `${fmt(mm)}:${fmt(ss)}` },
    ];
    for (const r of rows) {
      statsGrid.appendChild(el('div', { class: 'pause-stat' }, [
        el('span', { class: 'pause-stat-label' }, [r.label]),
        el('span', { class: 'pause-stat-value' }, [r.value]),
      ]));
    }
  }

  // Resume countdown — a single big number that ticks 3 → 2 → 1 → Go!
  // before the game resumes. Driven by GameManager.beginResumeCountdown.
  function showResumeCountdown(n) {
    const phase = n > 0 ? 'tick' : 'go';
    countdownEl.textContent = n > 0 ? String(n) : 'Go!';
    countdownEl.dataset.phase = phase;
    countdownEl.style.display = '';
    // Re-trigger the entrance animation by removing/re-adding the class.
    countdownEl.classList.remove('resume-countdown-active');
    void countdownEl.offsetWidth;
    countdownEl.classList.add('resume-countdown-active');
  }
  function clearResumeCountdown() {
    countdownEl.style.display = 'none';
    countdownEl.classList.remove('resume-countdown-active');
  }
  function showHud(show) {
    hud.style.display = show ? '' : 'none';
    controlsStrip.style.display = show ? '' : 'none';
  }
  function setEnvironmentMode({ label, mode = 'auto', timeText = '' } = {}) {
    // Re-build the pill content so the time (e.g. "06:24") sits cleanly
    // next to the label, with a thin separator. Using a single text node
    // for the label keeps the ::before dot (driven by data-mode) anchored
    // to the pill's left edge.
    clear(modePill);
    modePill.appendChild(document.createTextNode(label));
    if (timeText) {
      modePill.appendChild(el('span', { class: 'mode-pill-sep' }, ['·']));
      modePill.appendChild(el('span', { class: 'mode-pill-clock' }, [timeText]));
    }
    modePill.dataset.mode = mode;
  }

  // Refresh the start-menu leaderboard without rebuilding the whole menu.
  // Called by main.js after a run ends so the new entry is visible.
  function refreshLeaderboard() {
    renderLeaderboardInto(leaderboardEl, rankBadge);
  }

  return {
    showStart, hideStart, showPause, hidePause, showHud, setEnvironmentMode,
    refreshLeaderboard, setPauseStats, showResumeCountdown, clearResumeCountdown,
    showMysteryChoice, hideMysteryChoice
  };

  // -----------------------------------------------------------------------
  // Build the start menu contents (title, profile, leaderboard).
  // The vertical stack is intentionally tight: every element earns its
  // space, no duplicate messaging, no decorative filler. Order reads
  // top-to-bottom: brand → actions → scoreboard.
  // -----------------------------------------------------------------------
  function buildStartMenu(container) {
    const avatar = el('div', { class: 'profile-avatar', title: 'Your avatar' }, ['🐸']);
    const profileRow = el('div', { class: 'profile-row' }, [
      avatar,
      el('input', {
        class: 'profile-name', id: 'profile-name', type: 'text',
        maxlength: String(NAME_MAX), placeholder: 'Enter name…',
        autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Player name'
      }),
      el('button', {
        class: 'profile-flag', id: 'profile-flag',
        type: 'button', title: 'Pick a flag', 'aria-label': 'Pick a flag'
      }, ['🏳️']),
    ]);
    const profileErr = el('p', {
      class: 'profile-error', id: 'profile-error', style: { display: 'none' }
    });
    const playBtnEl = el('button', {
      class: 'menu-button primary is-disabled', id: 'btn-start', disabled: 'disabled'
    }, ['Play']);

    const leaderboard = el('div', { class: 'leaderboard', id: 'menu-leaderboard' });
    // Rank is now rendered INSIDE the leaderboard title (e.g. "Top 5 — You #3")
    // so the title and badge are a single line, no separate row.
    const rankBadge = el('span', { class: 'lb-my-rank', id: 'menu-my-rank' });
    // Played times counter between "Top 5" and "You"
    const playedBadge = el('span', { class: 'lb-played', id: 'menu-played' });

    // "How to play" — single inline pill row. Glyph + label only, no
    // description text. The same info used to live in 3 stacked cards
    // (200px); the pill compresses it to ~40px while staying scannable.
    const stepMove = isTouch
      ? el('div', { class: 'how-pill' }, [
          el('span', { class: 'how-glyph' }, ['🕹']),
          el('span', { class: 'how-label' }, ['Move']),
        ])
      : el('div', { class: 'how-pill' }, [
          el('span', { class: 'how-glyph' }, ['🧭']),
          el('span', { class: 'how-label' }, ['Move']),
        ]);
    const stepAttack = el('div', { class: 'how-pill' }, [
      el('span', { class: 'how-glyph' }, ['⚔']),
      el('span', { class: 'how-label' }, ['Attack']),
    ]);
    const stepSurvive = el('div', { class: 'how-pill' }, [
      el('span', { class: 'how-glyph' }, ['🌙']),
      el('span', { class: 'how-label' }, ['Survive']),
    ]);
    const howToPlay = el('div', { class: 'how-to-play' }, [
      stepMove, stepAttack, stepSurvive
    ]);

    const items = [
      el('div', { class: 'menu-brand' }, [
        el('p', { class: 'menu-kicker' }, ['Moonlit Meadow · Survival']),
        el('h1', { class: 'menu-title' }, ['Tode the Frog']),
        el('p', { class: 'menu-subtitle' }, ['A little frog · A very long night']),
      ]),
      howToPlay,
      profileRow,
      profileErr,
      el('div', { class: 'menu-buttons' }, [playBtnEl]),
      el('div', { class: 'leaderboard-wrap' }, [
        el('div', { class: 'leaderboard-header' }, [
          el('h3', { class: 'leaderboard-title' }, ['Top 5']),
          playedBadge,
          rankBadge,
        ]),
        leaderboard,
      ]),
      ...(isTouch ? [
        el('p', {
          class: 'rotate-prompt',
          'aria-live': 'polite'
        }, ['Please rotate your device to play']),
      ] : []),
    ];
    for (const item of items) container.appendChild(item);
  }

  function buildFlagModal(onClose) {
    const backdrop = el('div', { class: 'flag-modal-backdrop', style: { display: 'none' } });

    // Header — minimal title only
    const header = el('div', { class: 'flag-modal-header' }, [
      el('h2', { class: 'flag-modal-title' }, ['Pick your country']),
    ]);

    // "Current pick" card — mirrors the .game-over-stats inner surface.
    // Starts as the placeholder, then is populated as the user hovers / clicks.
    const pickEmoji = el('div', { class: 'flag-pick-emoji' }, ['🏳️']);
    const pickName = el('div', { class: 'flag-pick-name' }, ['Pick a flag']);
    const pickHint = el('div', { class: 'flag-pick-hint' }, ['']);
    const pickCard = el('div', { class: 'flag-pick-card' }, [pickEmoji, pickName, pickHint]);

    const grid = el('div', { class: 'flag-grid' });

    // Primary CTA — same look as the start menu's "Play" button. Disabled
    // until the user has chosen a flag (or a prior pick is being kept).
    const confirmBtn = el('button', {
      class: 'flag-modal-confirm is-disabled', type: 'button', id: 'flag-confirm',
      disabled: 'disabled'
    }, ['Confirm']);

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
        pickHint.textContent = '';
      } else {
        pickEmoji.textContent = '🏳️';
        pickName.textContent = '—';
        pickHint.textContent = '';
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
      // Commit: update profile + chip + avatar + play state, then close.
      profile.flag = pending.emoji;
      flagChip.textContent = pending.emoji;
      if (profile.name) saveProfile(profile.name, profile.flag);
      refreshPlayState();
      cancel();
    }
    confirmBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      confirm();
    });
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

  async function renderLeaderboardInto(target, rankEl) {
    if (!target) return;
    const renderVersion = (leaderboardRenderVersions.get(target) || 0) + 1;
    leaderboardRenderVersions.set(target, renderVersion);
    clear(target);
    const top = await getTop();
    if (renderVersion !== leaderboardRenderVersions.get(target)) return;

    // Update played times badge
    const playedEl = target.closest('.leaderboard-wrap')
      ?.querySelector('.lb-played');
    if (playedEl) {
      try {
        const attempts = await getAttempts();
        if (attempts != null && attempts > 0) {
          playedEl.textContent = `Played ${attempts} times`;
          playedEl.style.display = '';
        } else {
          playedEl.style.display = 'none';
        }
      } catch {
        playedEl.style.display = 'none';
      }
    }

    if (isLeaderboardUnavailable()) {
      target.appendChild(el('p', { class: 'leaderboard-empty' }, ['Leaderboard temporarily unavailable. Please try again.']));
      if (rankEl) rankEl.textContent = '';
      return;
    }

    if (top.length === 0) {
      target.appendChild(el('p', { class: 'leaderboard-empty' }, ['No runs yet — be the first.']));
      if (rankEl) rankEl.textContent = '';
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
      const myRank = top.findIndex((entry) => {
        if (!myProfile) return false;
        return entry.name === myProfile.name && entry.flag === myProfile.flag;
      });
      rankEl.textContent = myRank >= 0 ? `You #${myRank + 1}` : '';
    }
  }
}
