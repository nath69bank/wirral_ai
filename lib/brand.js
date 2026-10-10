// CMD + SHIFT + CASH. Each tier is named after one key in the shortcut.
export const BRAND = 'CMD + SHIFT + CASH';

export const TIERS = {
  cmd: {
    key: '⌘',
    name: 'CMD',
    label: 'Small',
    target: 'around 4/1',
    // decimal odds window: 3/1 to 6/1
    min: 4,
    max: 7,
    stake: 1,
    blurb: 'The controlled one. A short acca, bet builder or single priced around 4/1.',
  },
  shift: {
    key: '⇧',
    name: 'SHIFT',
    label: 'Medium',
    target: '20/1 or bigger',
    min: 21,
    max: 100,
    stake: 0.5,
    blurb: 'Shifts the bank. Accas and bet builders at 20/1+ where the numbers stack up.',
  },
  cash: {
    key: '$',
    name: 'CASH',
    label: 'Gamble',
    target: '100/1 or bigger',
    min: 101,
    max: Infinity,
    stake: 0.25,
    blurb: 'The big swing. 100/1+ for small stakes, only when every leg has a reason.',
  },
};

export const TIER_ORDER = ['cmd', 'shift', 'cash'];

export const SPORTS = {
  football: 'Football',
  horse_racing: 'Horse racing',
  mma: 'UFC / MMA',
  boxing: 'Boxing',
  mixed: 'Multi-sport',
};

export const BET_TYPES = {
  acca: 'Acca',
  bet_builder: 'Bet builder',
  single: 'Single',
  each_way: 'Each way',
  multiple: 'Multiple',
};
