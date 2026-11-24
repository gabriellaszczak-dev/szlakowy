import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import type { TrailPalette } from '@/components/trails/palette';

type Props = {
  profile: number[] | null;
  color: string;
  palette: TrailPalette;
  height?: number;
  distanceLabel?: string;
};

/** Profil wysokości jak w przewodniku górskim – bez dodatkowych bibliotek do wykresów. */
export function ElevationChart({ profile, color, palette: c, height = 90, distanceLabel }: Props) {
  if (!profile) {
    return (
      <View style={[styles.empty, { height, backgroundColor: c.cardAlt }]}>
        <Text style={{ color: c.subtext, fontSize: 13 }}>⛰️ Brak danych o wysokości dla tej trasy</Text>
      </View>
    );
  }

  const max = Math.max(...profile);
  const min = Math.min(...profile);
  const range = Math.max(max - min, 10);
  const peakIdx = profile.indexOf(max);

  return (
    <View style={{ gap: 6 }}>
      <View style={[styles.chart, { height, backgroundColor: c.cardAlt }]}>
        {/* linie pomocnicze */}
        <View style={[styles.grid, { top: '33%', borderColor: c.border }]} />
        <View style={[styles.grid, { top: '66%', borderColor: c.border }]} />

        <View style={styles.bars}>
          {profile.map((alt, i) => (
            <LinearGradient
              key={i}
              colors={[color, color + '22']}
              style={[
                styles.bar,
                { height: `${10 + ((alt - min) / range) * 86}%` as `${number}%` },
                i === peakIdx && styles.peakBar,
              ]}
            />
          ))}
        </View>

        <View style={[styles.peakLabel, { backgroundColor: c.cardSolid }]}>
          <Text style={{ color: c.text, fontSize: 11, fontWeight: '800' }}>▲ {Math.round(max)} m</Text>
        </View>
      </View>
      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: c.subtext }]}>start · {Math.round(profile[0])} m</Text>
        {distanceLabel ? <Text style={[styles.legendText, { color: c.subtext }]}>{distanceLabel}</Text> : null}
        <Text style={[styles.legendText, { color: c.subtext }]}>
          meta · {Math.round(profile[profile.length - 1])} m
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chart: { borderRadius: 16, overflow: 'hidden' },
  grid: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  bars: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    paddingHorizontal: 8,
  },
  bar: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  peakBar: { borderTopWidth: 2, borderColor: 'white' },
  peakLabel: { position: 'absolute', top: 6, right: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  legend: { flexDirection: 'row', justifyContent: 'space-between' },
  legendText: { fontSize: 11, fontWeight: '600' },
});
