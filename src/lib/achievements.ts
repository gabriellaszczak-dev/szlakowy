// Odznaki i podsumowanie sezonu – żeby chciało się wracać w góry.

import type { Trail } from '@/lib/trails';

export const EVEREST_M = 8849;

export type Totals = {
  trails: number;
  distanceM: number;
  steps: number;
  gainM: number;
  durationS: number;
  highestM: number | null;
};

export function computeTotals(trails: Trail[]): Totals {
  let highest: number | null = null;
  for (const t of trails) {
    if (t.maxAltitudeM != null) highest = highest == null ? t.maxAltitudeM : Math.max(highest, t.maxAltitudeM);
  }
  return {
    trails: trails.length,
    distanceM: trails.reduce((s, t) => s + t.distanceM, 0),
    steps: trails.reduce((s, t) => s + t.steps, 0),
    gainM: trails.reduce((s, t) => s + t.elevationGainM, 0),
    durationS: trails.reduce((s, t) => s + t.durationS, 0),
    highestM: highest,
  };
}

export type Badge = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  unlocked: (trails: Trail[], totals: Totals) => boolean;
};

export const BADGES: Badge[] = [
  {
    id: 'first',
    emoji: '🥾',
    title: 'Pierwszy szlak',
    description: 'Zapisz pierwszą trasę',
    unlocked: (_t, tot) => tot.trails >= 1,
  },
  {
    id: 'km10',
    emoji: '🗺️',
    title: 'Wędrowiec',
    description: 'Przejdź łącznie 10 km',
    unlocked: (_t, tot) => tot.distanceM >= 10_000,
  },
  {
    id: 'steps10k',
    emoji: '👣',
    title: '10 000 kroków',
    description: 'Zrób 10 000 kroków na jednej trasie',
    unlocked: (t) => t.some((x) => x.steps >= 10_000),
  },
  {
    id: 'gain500',
    emoji: '📈',
    title: 'Pod górkę',
    description: '500 m podejść na jednej trasie',
    unlocked: (t) => t.some((x) => x.elevationGainM >= 500),
  },
  {
    id: 'red',
    emoji: '🔴',
    title: 'Czerwony szlak',
    description: 'Ukończ trudną trasę',
    unlocked: (t) => t.some((x) => x.difficulty === 'hard'),
  },
  {
    id: 'km50',
    emoji: '🏅',
    title: 'Twarde nogi',
    description: 'Przejdź łącznie 50 km',
    unlocked: (_t, tot) => tot.distanceM >= 50_000,
  },
  {
    id: 'alt1500',
    emoji: '🦅',
    title: 'Ponad chmurami',
    description: 'Bądź wyżej niż 1500 m n.p.m.',
    unlocked: (_t, tot) => (tot.highestM ?? 0) >= 1500,
  },
  {
    id: 'everest',
    emoji: '🏔️',
    title: 'Mój Everest',
    description: 'Zbierz 8849 m podejść łącznie',
    unlocked: (_t, tot) => tot.gainM >= EVEREST_M,
  },
];

export function badgeStatus(trails: Trail[]) {
  const totals = computeTotals(trails);
  return BADGES.map((b) => ({ ...b, done: b.unlocked(trails, totals) }));
}

// Krótkie, własne hasła na każdy dzień.
const MOTTOS = [
  'Każdy szczyt zaczyna się od pierwszego kroku.',
  'Najlepsze widoki czekają za najtrudniejszym podejściem.',
  'Mniej ekranu, więcej szlaku.',
  'Dziś jest dobry dzień, żeby być trochę wyżej.',
  'Woda, kurtka, dobry humor – reszta sama przyjdzie.',
  'Góry nie uciekną. Wschód słońca – tak.',
  'Zmęczone nogi, wypoczęta głowa.',
  'Szlak nie pyta o tempo. Liczy się, że idziesz.',
];

export function mottoOfTheDay(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0).getTime();
  const day = Math.floor((date.getTime() - start) / 86_400_000);
  return MOTTOS[day % MOTTOS.length];
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h >= 4 && h < 11) return 'Dzień dobry';
  if (h >= 11 && h < 18) return 'Cześć';
  if (h >= 18 && h < 22) return 'Dobry wieczór';
  return 'Nocna wyprawa?';
}
