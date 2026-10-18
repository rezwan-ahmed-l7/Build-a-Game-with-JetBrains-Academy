// Single source of truth for cross-component custom-event names. Both
// the dispatcher and the listener import from here so a typo can't
// silently break the channel.

export const TODE_TOAST = 'tode:toast';
export const TODE_LEVEL_UP = 'tode:level-up';
export const TODE_COMBO_MILESTONE = 'tode:combo-milestone';
export const TODE_NEW_BEST = 'tode:new-best';
