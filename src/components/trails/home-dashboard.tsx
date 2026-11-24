import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TrailPalette } from '@/components/trails/palette';
import { GlassCard, Icon, PrimaryButton } from '@/components/trails/ui';
import { daysLeftInWeek, weekDistanceM, type Profile } from '@/lib/profile';
import { formatKm, type Trail } from '@/lib/trails';

type Props = {
  trails: Trail[];
  profile: Profile;
  palette: TrailPalette;
  onStart: () => void;
  onEditGoal: () => void;
};

/** Minimalistyczny dół ekranu: cel tygodnia + przycisk startu. */
export function HomeDashboard({ trails, profile, palette: c, onStart, onEditGoal }: Props) {
  const doneM = weekDistanceM(trails);
  const goalM = profile.weeklyGoalKm * 1000;
  const pct = goalM > 0 ? Math.min(1, doneM / goalM) : 0;
  const reached = doneM >= goalM;
  const leftKm = Math.max(0, goalM - doneM);
  const days = daysLeftInWeek();

  return (
    <View style={{ gap: 10 }}>
      <Pressable onPress={onEditGoal} accessibilityRole="button" accessibilityLabel="Zmień cel tygodniowy">
        <GlassCard palette={c} style={styles.card}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: c.subtext }]}>CEL TYGODNIA</Text>
            <Icon name="pencil" size={13} color={c.subtext} />
          </View>
          <View style={styles.row}>
            <Text style={[styles.value, { color: c.text }]}>
              {formatKm(doneM)}
              <Text style={[styles.of, { color: c.subtext }]}> / {profile.weeklyGoalKm} km</Text>
            </Text>
            <Text style={[styles.side, { color: reached ? c.accent : c.subtext }]}>
              {reached ? '🎉 Cel osiągnięty!' : `jeszcze ${formatKm(leftKm)} km · ${days} ${days === 1 ? 'dzień' : 'dni'}`}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: c.cardAlt }]}>
            <LinearGradient
              colors={reached ? ['#3DDC97', '#1E9E66'] : c.sunrise}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.fill, { width: `${Math.max(2, pct * 100)}%` as `${number}%` }]}
            />
          </View>
        </GlassCard>
      </Pressable>

      <PrimaryButton title="Dodaj trasę" icon="add" gradient={c.sunrise} large onPress={onStart} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  value: { fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  of: { fontSize: 15, fontWeight: '700' },
  side: { fontSize: 12.5, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
