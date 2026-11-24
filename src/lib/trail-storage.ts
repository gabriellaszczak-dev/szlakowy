import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeTrail, type Difficulty, type TrackPoint, type Trail } from '@/lib/trails';

const TRAILS_KEY = 'trasy-gorskie:v2';
const LEGACY_KEY = 'trasy-gorskie:v1';
const DRAFT_KEY = 'trasy-gorskie:draft';

/** Niedokończone nagranie – chroni trasę, gdy telefon zamknie aplikację. */
export type Draft = {
  difficulty: Difficulty;
  segments: TrackPoint[][];
  elapsedMs: number;
  /** Kroki z czujnika zebrane do tej pory (null = brak krokomierza). */
  sensorSteps: number | null;
  savedAt: number;
};

export async function loadTrails(): Promise<Trail[]> {
  try {
    const raw = await AsyncStorage.getItem(TRAILS_KEY);
    if (raw) return (JSON.parse(raw) as any[]).map(normalizeTrail);

    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = (JSON.parse(legacy) as any[]).map(normalizeTrail);
      await AsyncStorage.setItem(TRAILS_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (e) {
    console.warn('Nie udało się wczytać tras', e);
  }
  return [];
}

export async function persistTrails(trails: Trail[]) {
  try {
    await AsyncStorage.setItem(TRAILS_KEY, JSON.stringify(trails));
  } catch (e) {
    console.warn('Nie udało się zapisać tras', e);
  }
}

export async function loadDraft(): Promise<Draft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export async function saveDraft(draft: Draft) {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // brak miejsca itp. – nagrywanie i tak trwa w pamięci
  }
}

export async function clearDraft() {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignorujemy
  }
}
