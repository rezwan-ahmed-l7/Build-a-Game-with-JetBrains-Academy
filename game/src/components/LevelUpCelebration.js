// Level-up celebration: full-screen vignette flash + a centered "LEVEL
// UP" banner. Both auto-remove from the DOM after their CSS animations
// complete so re-triggering the effect doesn't leave stale elements
// around (e.g. two level-ups in quick succession).

import { el, prefersReducedMotion } from '../utils/dom.js';

const VIGNETTE_LIFETIME_MS = 1200;
const BANNER_LIFETIME_MS = 1500;

export function createLevelUpCelebration() {
  let activeVignette = null;
  let activeVignetteTimer = 0;
  let activeBanner = null;
  let activeBannerTimer = 0;

  function celebrate(level) {
    // Vignette flash always plays (it's a passive visual; cheap even with
    // reduced motion). Banner is skipped for reduced-motion users — the
    // level-badge bump in Score.js already conveys the change.
    if (activeVignette && activeVignette.parentNode) activeVignette.remove();
    if (activeVignetteTimer) clearTimeout(activeVignetteTimer);
    const vignette = el('div', { class: 'level-up-vignette' });
    document.body.appendChild(vignette);
    activeVignette = vignette;
    activeVignetteTimer = setTimeout(() => {
      if (vignette.parentNode) vignette.remove();
      if (activeVignette === vignette) {
        activeVignette = null;
        activeVignetteTimer = 0;
      }
    }, VIGNETTE_LIFETIME_MS);

    if (prefersReducedMotion()) return;
    if (activeBanner && activeBanner.parentNode) activeBanner.remove();
    if (activeBannerTimer) clearTimeout(activeBannerTimer);
    const banner = el('div', { class: 'level-up-banner' }, [
      `Level ${level}`,
      el('span', { class: 'level-up-sub' }, ['STRONGER']),
    ]);
    document.body.appendChild(banner);
    activeBanner = banner;
    activeBannerTimer = setTimeout(() => {
      if (banner.parentNode) banner.remove();
      if (activeBanner === banner) {
        activeBanner = null;
        activeBannerTimer = 0;
      }
    }, BANNER_LIFETIME_MS);
  }

  function dispose() {
    if (activeVignetteTimer) clearTimeout(activeVignetteTimer);
    if (activeBannerTimer) clearTimeout(activeBannerTimer);
    if (activeVignette && activeVignette.parentNode) activeVignette.remove();
    if (activeBanner && activeBanner.parentNode) activeBanner.remove();
    activeVignette = null;
    activeBanner = null;
    activeVignetteTimer = 0;
    activeBannerTimer = 0;
  }

  return { celebrate, dispose };
}