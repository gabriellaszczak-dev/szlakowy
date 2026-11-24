import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import type { TrailPalette } from '@/components/trails/palette';
import { GlassCard, PrimaryButton, StatTile } from '@/components/trails/ui';
import { DIFFICULTIES, formatDuration, formatKm, formatSteps, type Difficulty } from '@/lib/trails';

type Props = {
  palette: TrailPalette;
  paused: boolean;
  difficulty: Difficulty;
  distanceM: number;
  elapsedS: number;
  steps: number;
  stepsEstimated: boolean;
  gainM: number;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
};

/** Dolny panel podczas nagrywania – duże cyfry, czytelne w słońcu i w biegu. */
export function RecordingHud(p: Props) {
  const c = p.palette;
  const info = DIFFICULTIES[p.difficulty];

  return (
    <GlassCard palette={c} style={styles.card}>
      <View style={styles.header}>
        <PulsingDot color={p.paused ? c.subtext : '#FF4D63'} active={!p.paused} />
        <Text style={[styles.status, { color: c.text }]}>{p.paused ? 'PAUZA' : 'NAGRYWAM'}</Text>
        <View style={[styles.diffPill, { backgroundColor: info.color }]}>
          <Text style={styles.diffPillText}>
            {info.emoji} {info.label}
          </Text>
        </View>
      </View>

      <View style={styles.kmRow}>
        <Text style={[styles.km, { color: c.text }]}>{formatKm(p.distanceM)}</Text>
        <Text style={[styles.kmUnit, { color: info.color }]}>km</Text>
      </View>

      <View style={styles.grid}>
        <StatTile palette={c} icon="time-outline" iconColor={info.color} value={formatDuration(p.elapsedS)} label="czas" />
        <StatTile palette={c} icon="footsteps" iconColor={info.color} value={formatSteps(p.steps, p.stepsEstimated)} label="kroków" />
        <StatTile palette={c} icon="trending-up" iconColor={info.color} value={`${Math.round(p.gainM)} m`} label="w górę" />
      </View>

      <View style={styles.grid}>
        {p.paused ? (
          <PrimaryButton title="Wznów" icon="play" gradient={info.gradient} onPress={p.onResume} flex large />
        ) : (
          <PrimaryButton title="Pauza" icon="pause" color={c.cardAlt} onPress={p.onPause} flex large />
        )}
        <PrimaryButton title="Zakończ" icon="stop" gradient={['#FF6A7C', '#C3163F']} onPress={p.onFinish} flex large />
      </View>
    </GlassCard>
  );
}

function PulsingDot({ color, active }: { color: string; active: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.8, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, scale]);

  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.dotHalo, { backgroundColor: color, transform: [{ scale }], opacity: active ? 0.35 : 0 }]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  status: { flex: 1, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  diffPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  diffPillText: { color: 'white', fontSize: 12, fontWeight: '800' },
  kmRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 6 },
  km: { fontSize: 52, fontWeight: '900', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  kmUnit: { fontSize: 22, fontWeight: '900', marginBottom: 12 },
  grid: { flexDirection: 'row', gap: 8 },
  dotWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  dotHalo: { position: 'absolute', width: 14, height: 14, borderRadius: 7 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
