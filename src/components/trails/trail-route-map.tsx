import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Linking, Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';

import type { TrailPalette } from '@/components/trails/palette';
import { Icon, PrimaryButton } from '@/components/trails/ui';
import {
  DIFFICULTIES,
  allPoints,
  bearing,
  compassDirection,
  cumulativeDistances,
  directionArrows,
  downsample,
  pathAtProgress,
  formatDistance,
  haversine,
  type Trail,
} from '@/lib/trails';

export type LatLng = { latitude: number; longitude: number };

/**
 * Mapa jednej trasy: start, meta, strzałki kierunku marszu,
 * Twoja pozycja i przerywana linia „jak dojść do startu”.
 */
export function RouteMap({
  trail,
  me,
  interactive,
  padding,
  progress = null,
}: {
  trail: Trail;
  me: LatLng | null;
  interactive: boolean;
  padding?: { top: number; bottom: number };
  /** 0–1: odtwarzanie przebiegu trasy („wąż”); null = cała trasa. */
  progress?: number | null;
}) {
  const scheme = useColorScheme();
  const ref = useRef<MapView>(null);
  const points = allPoints(trail.segments);
  const start = points[0];
  const end = points[points.length - 1];
  const color = DIFFICULTIES[trail.difficulty].color;
  const arrows = directionArrows(points, interactive ? 8 : 5);
  const replay = useReplayGeometry(trail);
  const snake = progress != null && replay ? pathAtProgress(replay.points, replay.cum, progress) : null;
  const headRadius = replay ? Math.min(120, Math.max(8, replay.total / 90)) : 10;

  // Twoja pozycja w kadrze tylko, jeśli jesteś w miarę blisko (do 15 km).
  const showMeInFrame = me != null && haversine(me, start) < 15_000;

  const fit = () => {
    const coords = showMeInFrame && me ? [...points, me] : points;
    ref.current?.fitToCoordinates(coords, {
      edgePadding: { top: padding?.top ?? 40, right: 40, bottom: padding?.bottom ?? 40, left: 40 },
      animated: false,
    });
  };

  useEffect(() => {
    const t = setTimeout(fit, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trail.id, showMeInFrame]);

  if (!start) return null;

  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      initialRegion={{ latitude: start.latitude, longitude: start.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
      onMapReady={fit}
      mapType={Platform.OS === 'android' ? 'terrain' : 'standard'}
      userInterfaceStyle={scheme === 'dark' ? 'dark' : 'light'}
      showsUserLocation
      showsMyLocationButton={false}
      showsCompass={interactive}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={false}
      pitchEnabled={interactive}
      toolbarEnabled={false}
      pointerEvents={interactive ? 'auto' : 'none'}>
      {me && haversine(me, start) > 30 && (
        <Polyline coordinates={[me, start]} strokeColor="#16191ACC" strokeWidth={3} lineDashPattern={[8, 8]} />
      )}

      {snake ? (
        <>
          {/* cała trasa przygaszona, wąż rysuje przebieg */}
          {trail.segments.map((seg, i) =>
            seg.length > 1 ? <Polyline key={`g${i}`} coordinates={seg} strokeColor={color + '45'} strokeWidth={5} /> : null,
          )}
          {snake.coords.length > 1 && (
            <>
              <Polyline coordinates={snake.coords} strokeColor="#FFFFFF" strokeWidth={10} zIndex={3} />
              <Polyline coordinates={snake.coords} strokeColor={color} strokeWidth={6} zIndex={4} />
            </>
          )}
          <Circle
            center={snake.head}
            radius={headRadius}
            fillColor={color}
            strokeColor="#FFFFFF"
            strokeWidth={3}
            zIndex={5}
          />
        </>
      ) : (
        <>
          {/* biała „obwódka” pod linią trasy – lepiej widać na mapie terenowej */}
          {trail.segments.map((seg, i) =>
            seg.length > 1 ? <Polyline key={`o${i}`} coordinates={seg} strokeColor="#FFFFFF" strokeWidth={9} /> : null,
          )}
          {trail.segments.map((seg, i) =>
            seg.length > 1 ? <Polyline key={`l${i}`} coordinates={seg} strokeColor={color} strokeWidth={5} /> : null,
          )}
          {arrows.map((a) => (
            <Marker key={a.key} coordinate={a.coordinate} anchor={{ x: 0.5, y: 0.5 }} tappable={false}>
              <View style={[styles.arrow, { backgroundColor: color, transform: [{ rotate: `${a.bearing}deg` }] }]}>
                <Text style={styles.arrowText}>▲</Text>
              </View>
            </Marker>
          ))}
        </>
      )}

      <Marker coordinate={end} anchor={{ x: 0.5, y: 0.5 }} title="Meta">
        <View style={[styles.pin, { backgroundColor: '#16191A' }]}>
          <Text style={{ fontSize: 13 }}>🏁</Text>
        </View>
      </Marker>
      <Marker coordinate={start} anchor={{ x: 0.5, y: 0.5 }} title="Start" zIndex={10}>
        <View style={[styles.startPin, { backgroundColor: DIFFICULTIES.easy.color }]}>
          <Text style={styles.startText}>START</Text>
        </View>
      </Marker>
    </MapView>
  );
}

/** Przerzedzone punkty + dystanse narastające – liczone raz na trasę. */
function useReplayGeometry(trail: Trail) {
  return useMemo(() => {
    const pts = downsample(allPoints(trail.segments), 400);
    if (pts.length < 2) return null;
    const cum = cumulativeDistances(pts);
    return { points: pts, cum, total: cum[cum.length - 1] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trail.id]);
}

/** Wąż przebiegu trasy: aktualny dystans i wysokość „łebka”. */
export function snakeInfo(trail: Trail, progress: number) {
  const pts = downsample(allPoints(trail.segments), 400);
  if (pts.length < 2) return null;
  const s = pathAtProgress(pts, cumulativeDistances(pts), progress);
  return { distanceM: s.distanceM, altitude: s.head.altitude };
}

/**
 * Płynna animacja 0 → 1 (ease-in-out). Czas zależy od długości trasy: 4–10 s.
 * Aktualizacje ~30 razy na sekundę, żeby mapa nie zadyszała się na słabszych telefonach.
 */
export function useReplay(distanceM: number) {
  const [progress, setProgress] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const frame = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
    const duration = Math.min(10_000, Math.max(4_000, 3_000 + distanceM * 0.8));
    const startedAt = Date.now();
    let lastPush = 0;
    setPlaying(true);
    setProgress(0);
    const tick = () => {
      const t = Math.min(1, (Date.now() - startedAt) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const nowMs = Date.now();
      if (nowMs - lastPush > 33 || t >= 1) {
        lastPush = nowMs;
        setProgress(eased);
      }
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        frame.current = null;
        setPlaying(false);
      }
    };
    frame.current = requestAnimationFrame(tick);
  }, [distanceM]);

  useEffect(() => stop, [stop]);

  /** Po zakończeniu pokazujemy znów pełną trasę ze strzałkami. */
  const reset = useCallback(() => {
    stop();
    setProgress(null);
  }, [stop]);

  return { progress, playing, play, reset };
}

/** Karta „Jak dojść”: kierunek ze startu, odległość do startu, nawigacja. */
export function DirectionsCard({ trail, me, palette: c }: { trail: Trail; me: LatLng | null; palette: TrailPalette }) {
  const points = allPoints(trail.segments);
  if (points.length < 2) return null;
  const start = points[0];
  const arrows = directionArrows(points, 5);
  const firstHeading = arrows[0]?.bearing ?? bearing(points[0], points[points.length - 1]);
  const toStartM = me ? haversine(me, start) : null;
  const info = DIFFICULTIES[trail.difficulty];

  return (
    <View style={[styles.dirCard, { backgroundColor: c.cardAlt }]}>
      <Row icon="flag" color={DIFFICULTIES.easy.color} palette={c}>
        Ze startu ruszaj na <Text style={styles.bold}>{compassDirection(firstHeading)}</Text>, dalej prowadzą
        strzałki <Text style={{ color: info.color, fontWeight: '900' }}>▲</Text> na mapie.
      </Row>
      {toStartM != null && (
        <Row icon="navigate" color={c.accent} palette={c}>
          {toStartM > 30 ? (
            <>
              Do startu masz <Text style={styles.bold}>{formatDistance(toStartM)}</Text> w kierunku:{' '}
              {compassDirection(bearing(me!, start))}.
            </>
          ) : (
            <>Jesteś na starcie – możesz ruszać! 🎒</>
          )}
        </Row>
      )}
      <PrimaryButton
        title="Prowadź mnie do startu"
        icon="navigate-circle"
        gradient={info.gradient}
        onPress={() => openWalkingDirections(start)}
      />
    </View>
  );
}

function Row({
  icon,
  color,
  palette: c,
  children,
}: {
  icon: 'flag' | 'navigate';
  color: string;
  palette: TrailPalette;
  children: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: color + '26' }]}>
        <Icon name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.rowText, { color: c.text }]}>{children}</Text>
    </View>
  );
}

export function useMyPosition() {
  const [me, setMe] = useState<LatLng | null>(null);
  useEffect(() => {
    let alive = true;
    Location.getLastKnownPositionAsync()
      .then((p) => p ?? Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }))
      .then((p) => {
        if (alive && p) setMe({ latitude: p.coords.latitude, longitude: p.coords.longitude });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return me;
}

/** Otwiera Mapy Google / Apple z trasą pieszą do punktu. */
export function openWalkingDirections(to: LatLng) {
  const dest = `${to.latitude},${to.longitude}`;
  const url =
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${dest}&dirflg=w`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
  Linking.openURL(url);
}

const styles = StyleSheet.create({
  arrow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  arrowText: { color: 'white', fontSize: 10, fontWeight: '900', marginTop: -1 },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  startPin: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9, borderWidth: 2, borderColor: 'white' },
  startText: { color: 'white', fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },

  dirCard: { borderRadius: 18, padding: 14, gap: 12 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: '900' },
});
