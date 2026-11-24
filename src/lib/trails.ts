// Logika tras: typy, obliczenia, formatowanie, eksport GPX.

export type Difficulty = 'easy' | 'medium' | 'hard';

export type TrackPoint = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: number;
};

export type Trail = {
  id: string;
  name: string;
  notes: string;
  difficulty: Difficulty;
  /** Odcinki nagrania – pauza zaczyna nowy odcinek. */
  segments: TrackPoint[][];
  distanceM: number;
  durationS: number;
  elevationGainM: number;
  elevationLossM: number;
  maxAltitudeM: number | null;
  minAltitudeM: number | null;
  /** Liczba kroków na trasie. */
  steps: number;
  /** true = policzone z dystansu (brak krokomierza), false = z czujnika telefonu. */
  stepsEstimated: boolean;
  createdAt: number;
};

export const DIFFICULTIES: Record<
  Difficulty,
  {
    label: string;
    color: string;
    gradient: readonly [string, string];
    description: string;
    hint: string;
    emoji: string;
  }
> = {
  easy: {
    label: 'Łatwa',
    color: '#2FBF71',
    gradient: ['#3EE08A', '#13874A'],
    description: 'Szlak zielony',
    hint: 'Spacer z widokami, dla każdego',
    emoji: '🌲',
  },
  medium: {
    label: 'Średnia',
    color: '#3D8BFF',
    gradient: ['#5AA2FF', '#1C55C9'],
    description: 'Szlak niebieski',
    hint: 'Trochę podejść, trzeba mieć kondycję',
    emoji: '⛰️',
  },
  hard: {
    label: 'Trudna',
    color: '#FF4D63',
    gradient: ['#FF6A7C', '#C3163F'],
    description: 'Szlak czerwony',
    hint: 'Strome podejścia, skały, ekspozycja',
    emoji: '🏔️',
  },
};

export const DIFFICULTY_KEYS = Object.keys(DIFFICULTIES) as Difficulty[];

/** Odczyty GPS gorsze niż tyle metrów są odrzucane. */
export const MAX_ACCURACY_M = 30;
/** Skoki szybsze niż ~43 km/h to błąd GPS, nie piechur. */
export const MAX_SPEED_MS = 12;
/** Próg wygładzania przewyższeń (szum wysokości z GPS). */
const ELEVATION_THRESHOLD_M = 3;

type LatLng = { latitude: number; longitude: number };

export function haversine(a: LatLng, b: LatLng) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Kierunek z punktu a do b w stopniach (0 = północ, 90 = wschód). */
export function bearing(a: LatLng, b: LatLng) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Strzałki kierunku marszu rozłożone równo wzdłuż trasy.
 * Kierunek liczony na odcinku ~30 m, żeby drobne zygzaki GPS nie kręciły strzałką.
 */
export function directionArrows(points: TrackPoint[], count = 6) {
  if (points.length < 2) return [];
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + haversine(points[i - 1], points[i]));
  const total = cum[cum.length - 1];
  if (total < 20) return [];

  const arrows: { coordinate: LatLng; bearing: number; key: string }[] = [];
  let j = 0;
  for (let k = 1; k <= count; k++) {
    const target = (total * k) / (count + 1);
    while (j < cum.length - 1 && cum[j + 1] < target) j++;
    let end = j + 1;
    while (end < points.length - 1 && cum[end] - cum[j] < 30) end++;
    const from = points[j];
    const to = points[Math.min(end, points.length - 1)];
    arrows.push({
      key: `arrow-${k}`,
      coordinate: { latitude: from.latitude, longitude: from.longitude },
      bearing: bearing(from, to),
    });
  }
  return arrows;
}

/** Przerzedza punkty (do animacji), zachowując pierwszy i ostatni. */
export function downsample<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

export function cumulativeDistances(points: LatLng[]) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + haversine(points[i - 1], points[i]));
  return cum;
}

/**
 * Fragment trasy przebyty po `fraction` (0–1) całego dystansu,
 * z płynnie interpolowanym „łebkiem” węża.
 */
export function pathAtProgress(points: TrackPoint[], cum: number[], fraction: number) {
  const total = cum[cum.length - 1] ?? 0;
  const target = Math.max(0, Math.min(1, fraction)) * total;
  let i = 0;
  while (i < cum.length - 2 && cum[i + 1] < target) i++;
  const a = points[i];
  const b = points[Math.min(i + 1, points.length - 1)];
  const segLen = cum[i + 1] - cum[i] || 1;
  const t = Math.max(0, Math.min(1, (target - cum[i]) / segLen));
  const head: TrackPoint = {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
    altitude:
      a.altitude != null && b.altitude != null ? a.altitude + (b.altitude - a.altitude) * t : (a.altitude ?? b.altitude),
    timestamp: a.timestamp,
  };
  return { coords: [...points.slice(0, i + 1), head], head, distanceM: target };
}

export function compassDirection(deg: number) {
  const names = ['północ', 'północny wschód', 'wschód', 'południowy wschód', 'południe', 'południowy zachód', 'zachód', 'północny zachód'];
  return names[Math.round(deg / 45) % 8];
}

export function countPoints(segments: TrackPoint[][]) {
  return segments.reduce((n, s) => n + s.length, 0);
}

export function allPoints(segments: TrackPoint[][]) {
  return segments.flat();
}

export function computeStats(segments: TrackPoint[][]) {
  let distanceM = 0;
  let gain = 0;
  let loss = 0;
  let max: number | null = null;
  let min: number | null = null;

  for (const seg of segments) {
    let ref: number | null = null;
    for (let i = 0; i < seg.length; i++) {
      const p = seg[i];
      if (i > 0) distanceM += haversine(seg[i - 1], p);
      const alt = p.altitude;
      if (alt == null) continue;
      max = max == null ? alt : Math.max(max, alt);
      min = min == null ? alt : Math.min(min, alt);
      if (ref == null) {
        ref = alt;
      } else if (alt - ref >= ELEVATION_THRESHOLD_M) {
        gain += alt - ref;
        ref = alt;
      } else if (ref - alt >= ELEVATION_THRESHOLD_M) {
        loss += ref - alt;
        ref = alt;
      }
    }
  }
  return {
    distanceM,
    elevationGainM: gain,
    elevationLossM: loss,
    maxAltitudeM: max,
    minAltitudeM: min,
  };
}

/** Profil wysokości: `buckets` średnich wysokości rozłożonych równo po dystansie. */
export function elevationProfile(segments: TrackPoint[][], buckets = 40): number[] | null {
  const samples: { d: number; alt: number }[] = [];
  let d = 0;
  for (const seg of segments) {
    for (let i = 0; i < seg.length; i++) {
      if (i > 0) d += haversine(seg[i - 1], seg[i]);
      const alt = seg[i].altitude;
      if (alt != null) samples.push({ d, alt });
    }
  }
  if (samples.length < 2 || d <= 0) return null;

  const sums = new Array<number>(buckets).fill(0);
  const counts = new Array<number>(buckets).fill(0);
  for (const s of samples) {
    const idx = Math.min(buckets - 1, Math.floor((s.d / d) * buckets));
    sums[idx] += s.alt;
    counts[idx] += 1;
  }
  // Puste kubełki uzupełniamy poprzednią wartością.
  const out: number[] = [];
  let last = samples[0].alt;
  for (let i = 0; i < buckets; i++) {
    if (counts[i] > 0) last = sums[i] / counts[i];
    out.push(last);
  }
  return out;
}

/** Zawsze w kilometrach, z polskim przecinkiem: „2,45 km”. */
export function formatDistance(m: number) {
  return `${formatKm(m)} km`;
}

export function formatKm(m: number) {
  const km = m / 1000;
  return (km < 10 ? km.toFixed(2) : km.toFixed(1)).replace('.', ',');
}

/** Średnia długość kroku w górach (krótsza niż na płaskim). */
const STRIDE_M = 0.68;

export function estimateSteps(distanceM: number) {
  return Math.round(distanceM / STRIDE_M);
}

/** 12345 -> „12 345” */
export function formatNumber(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatSteps(steps: number, estimated: boolean) {
  return `${estimated ? '~' : ''}${formatNumber(steps)}`;
}

export function formatDuration(s: number) {
  const total = Math.max(0, Math.floor(s));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function formatAltitude(m: number | null) {
  return m == null ? '—' : `${Math.round(m)} m`;
}

export function averageSpeedKmh(distanceM: number, durationS: number) {
  return durationS > 0 ? (distanceM / durationS) * 3.6 : 0;
}

export function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.toLocaleDateString('pl-PL')} ${d.toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Eksport do GPX – otworzysz go w Mapy.com, Strava, Garmin itp. */
export function toGpx(trail: Trail) {
  const segs = trail.segments
    .filter((s) => s.length > 0)
    .map(
      (seg) =>
        '    <trkseg>\n' +
        seg
          .map(
            (p) =>
              `      <trkpt lat="${p.latitude.toFixed(7)}" lon="${p.longitude.toFixed(7)}">` +
              (p.altitude != null ? `<ele>${p.altitude.toFixed(1)}</ele>` : '') +
              `<time>${new Date(p.timestamp).toISOString()}</time></trkpt>`,
          )
          .join('\n') +
        '\n    </trkseg>',
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="moja-apka" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(trail.name)}</name>
    <desc>${escapeXml(`${DIFFICULTIES[trail.difficulty].label}. ${trail.notes}`.trim())}</desc>
${segs}
  </trk>
</gpx>
`;
}

/** Migracja tras zapisanych przez pierwszą wersję aplikacji. */
export function migrateLegacyTrail(raw: any): Trail {
  if (Array.isArray(raw.segments)) return raw as Trail;
  const points: TrackPoint[] = (raw.points ?? []).map((p: LatLng) => ({
    latitude: p.latitude,
    longitude: p.longitude,
    altitude: null,
    timestamp: raw.createdAt ?? Date.now(),
  }));
  const segments = [points];
  return {
    id: String(raw.id),
    name: String(raw.name ?? 'Trasa'),
    notes: '',
    difficulty: raw.difficulty ?? 'easy',
    segments,
    durationS: raw.durationS ?? 0,
    createdAt: raw.createdAt ?? Date.now(),
    ...computeStats(segments),
    steps: 0,
    stepsEstimated: true,
  };
}

/** Uzupełnia pola dodane w nowszych wersjach (np. kroki). */
export function normalizeTrail(raw: any): Trail {
  const t = migrateLegacyTrail(raw);
  if (typeof t.steps !== 'number' || (t.steps === 0 && t.distanceM > 0)) {
    return { ...t, steps: estimateSteps(t.distanceM), stepsEstimated: true };
  }
  return t;
}
