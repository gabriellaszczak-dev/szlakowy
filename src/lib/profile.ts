import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ThemeId } from '@/components/trails/palette';
import type { Trail } from '@/lib/trails';

const PROFILE_KEY = 'szlakowy:profile';

export type Profile = {
  name: string;
  weeklyGoalKm: number;
  /** Zdjęcie profilowe jako data URI (base64) – nie znika z pamięci podręcznej telefonu. */
  avatar?: string | null;
  theme?: ThemeId;
  /** Kiedy użytkownik zaczął korzystać z aplikacji. */
  joinedAt?: number;
};

export const GOAL_PRESETS = [10, 20, 30, 50, 75];
export const DEFAULT_GOAL_KM = 20;

export async function loadProfile(): Promise<Profile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export async function saveProfile(p: Profile) {
  try {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    // ignorujemy – profil zostaje w pamięci do końca sesji
  }
}

/** Poniedziałek 00:00 bieżącego tygodnia (czas lokalny). */
export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // pon = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export function weekDistanceM(trails: Trail[], now = new Date()) {
  const from = startOfWeek(now);
  return trails.filter((t) => t.createdAt >= from).reduce((s, t) => s + t.distanceM, 0);
}

/** Ile dni zostało do końca tygodnia (włącznie z dzisiaj). */
export function daysLeftInWeek(now = new Date()) {
  return 7 - ((now.getDay() + 6) % 7);
}

const DAY_LABELS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

/** Kilometry w każdym dniu bieżącego tygodnia (pon–nd). */
export function weekByDay(trails: Trail[], now = new Date()) {
  const from = startOfWeek(now);
  const days = DAY_LABELS.map((label) => ({ label, distanceM: 0 }));
  for (const t of trails) {
    if (t.createdAt < from) continue;
    const idx = Math.floor((t.createdAt - from) / 86_400_000);
    if (idx >= 0 && idx < 7) days[idx].distanceM += t.distanceM;
  }
  const todayIdx = (now.getDay() + 6) % 7;
  return { days, todayIdx };
}

/** Ile kolejnych tygodni (licząc wstecz od poprzedniego, plus bieżący jeśli zaliczony) cel był osiągnięty. */
export function goalStreakWeeks(trails: Trail[], goalKm: number, now = new Date()) {
  const goalM = goalKm * 1000;
  const week = 7 * 86_400_000;
  let start = startOfWeek(now);
  let streak = weekDistanceM(trails, now) >= goalM ? 1 : 0;
  for (let i = 0; i < 104; i++) {
    const prevStart = start - week;
    const sum = trails.filter((t) => t.createdAt >= prevStart && t.createdAt < start).reduce((s, t) => s + t.distanceM, 0);
    if (sum < goalM) break;
    streak++;
    start = prevStart;
  }
  return streak;
}
