// Motywy kolorystyczne aplikacji. Kolory szlaków (zielony/niebieski/czerwony) zostają stałe,
// bo mają znaczenie – zmienia się akcent, gradient przycisków i tło kart.

export type TrailPalette = {
  dark: boolean;
  card: string;
  cardSolid: string;
  cardAlt: string;
  text: string;
  subtext: string;
  border: string;
  accent: string;
  /** Kolor tekstu na tle akcentu. */
  onAccent: string;
  danger: string;
  overlay: string;
  sunrise: readonly [string, string];
  night: readonly [string, string];
};

export type ThemeId = 'forest' | 'sunset' | 'glacier' | 'lavender' | 'volcano';

export const THEMES: Record<
  ThemeId,
  { name: string; emoji: string; accent: string; gradient: readonly [string, string]; base: string; tint: string }
> = {
  forest: { name: 'Las', emoji: '🌲', accent: '#3DDC97', gradient: ['#FFB547', '#FF4F6D'], base: '#0D1513', tint: '#1B3A31' },
  sunset: { name: 'Zachód', emoji: '🌅', accent: '#FFB547', gradient: ['#FF9A3D', '#E8366B'], base: '#17110F', tint: '#3A2418' },
  glacier: { name: 'Lodowiec', emoji: '🧊', accent: '#5CD6FF', gradient: ['#5CD6FF', '#3D6BFF'], base: '#0C1219', tint: '#16314A' },
  lavender: { name: 'Lawenda', emoji: '💜', accent: '#C29BFF', gradient: ['#C29BFF', '#7B4DFF'], base: '#120F1A', tint: '#2E2346' },
  volcano: { name: 'Wulkan', emoji: '🌋', accent: '#FF7A59', gradient: ['#FF7A59', '#D7263D'], base: '#160E0D', tint: '#3D1C17' },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export function makePalette(themeId: ThemeId = 'forest'): TrailPalette {
  const t = THEMES[themeId] ?? THEMES.forest;
  const [r, g, b] = hexToRgb(t.base);
  return {
    dark: true,
    card: `rgba(${r}, ${g}, ${b}, 0.93)`,
    cardSolid: t.base,
    cardAlt: 'rgba(255, 255, 255, 0.07)',
    text: '#F4F7F5',
    subtext: '#9AA7A2',
    border: 'rgba(255, 255, 255, 0.09)',
    accent: t.accent,
    onAccent: t.base,
    danger: '#FF5A6E',
    overlay: 'rgba(0, 0, 0, 0.6)',
    sunrise: t.gradient,
    night: [t.tint, t.base],
  };
}

/** Domyślny motyw (np. przed wczytaniem profilu). */
export function useTrailPalette(): TrailPalette {
  return makePalette('forest');
}

export const cardShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 10,
};
