import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cardShadow, type TrailPalette } from '@/components/trails/palette';
import { Icon, SectionTitle } from '@/components/trails/ui';
import { EVEREST_M, badgeStatus, computeTotals } from '@/lib/achievements';
import { daysLeftInWeek, goalStreakWeeks, weekByDay, weekDistanceM, type Profile } from '@/lib/profile';
import { formatAltitude, formatKm, formatNumber, type Trail } from '@/lib/trails';

type Props = {
  visible: boolean;
  trails: Trail[];
  profile: Profile;
  palette: TrailPalette;
  onClose: () => void;
  onEditGoal: () => void;
};

/** Procent celu tygodnia (do małej plakietki na przycisku). */
export function weekGoalPercent(trails: Trail[], goalKm: number) {
  return goalKm > 0 ? Math.round((weekDistanceM(trails) / (goalKm * 1000)) * 100) : 0;
}

/** Panel „Cel i postępy” – otwierany ikonką na mapie. */
export function GoalSheet({ visible, trails, profile, palette: c, onClose, onEditGoal }: Props) {
  const insets = useSafeAreaInsets();
  const goalM = profile.weeklyGoalKm * 1000;
  const doneM = weekDistanceM(trails);
  const pct = goalM > 0 ? doneM / goalM : 0;
  const reached = doneM >= goalM;
  const leftM = Math.max(0, goalM - doneM);
  const days = daysLeftInWeek();
  const { days: byDay, todayIdx } = weekByDay(trails);
  const maxDay = Math.max(1, ...byDay.map((d) => d.distanceM));
  const activeDays = byDay.filter((d) => d.distanceM > 0).length;
  const streak = goalStreakWeeks(trails, profile.weeklyGoalKm);
  const totals = computeTotals(trails);
  const badges = badgeStatus(trails);
  const longest = trails.reduce<Trail | null>((a, t) => (!a || t.distanceM > a.distanceM ? t : a), null);
  const mostSteps = trails.reduce<Trail | null>((a, t) => (!a || t.steps > a.steps ? t : a), null);
  const everestPct = Math.min(1, totals.gainM / EVEREST_M);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: c.overlay }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Zamknij" />
        <View style={[styles.sheet, { backgroundColor: c.cardSolid, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: c.text }]}>Cel tygodnia</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={onEditGoal} style={[styles.headerBtn, { backgroundColor: c.cardAlt }]} accessibilityLabel="Zmień cel">
                <Icon name="pencil" size={16} color={c.text} />
              </Pressable>
              <Pressable onPress={onClose} style={[styles.headerBtn, { backgroundColor: c.cardAlt }]} accessibilityLabel="Zamknij">
                <Icon name="close" size={18} color={c.text} />
              </Pressable>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 20 }}>
            {/* Procent celu */}
            <LinearGradient
              colors={[c.accent + '30', c.accent + '08']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.hero, { borderColor: c.accent + '55' }]}>
              <Text style={[styles.pct, { color: c.text }]}>
                {Math.round(pct * 100)}
                <Text style={[styles.pctSign, { color: c.accent }]}>%</Text>
              </Text>
              <Text style={[styles.heroSub, { color: c.subtext }]}>
                {formatKm(doneM)} z {profile.weeklyGoalKm} km
              </Text>
              <View style={[styles.track, { backgroundColor: c.cardAlt }]}>
                <LinearGradient
                  colors={c.sunrise}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.fill, { width: `${Math.max(2, Math.min(1, pct) * 100)}%` as `${number}%` }]}
                />
              </View>
              <Text style={[styles.heroMsg, { color: c.text }]}>
                {reached
                  ? `🎉 Cel osiągnięty, ${profile.name}! Wszystko ponad to – bonus.`
                  : `Jeszcze ${formatKm(leftM)} km · ${days} ${days === 1 ? 'dzień' : 'dni'} – ok. ${formatKm(leftM / days)} km dziennie.`}
              </Text>
            </LinearGradient>

            {/* Dni tygodnia */}
            <View style={{ gap: 10 }}>
              <SectionTitle title="Ten tydzień" palette={c} right={<Text style={{ color: c.subtext, fontSize: 12 }}>{activeDays} dni aktywne</Text>} />
              <View style={styles.daysRow}>
                {byDay.map((d, i) => (
                  <View key={d.label} style={styles.dayCol}>
                    <View style={[styles.dayBarBg, { backgroundColor: c.cardAlt }]}>
                      {d.distanceM > 0 && (
                        <LinearGradient
                          colors={c.sunrise}
                          style={[styles.dayBar, { height: `${Math.max(8, (d.distanceM / maxDay) * 100)}%` as `${number}%` }]}
                        />
                      )}
                    </View>
                    <Text style={[styles.dayLabel, { color: i === todayIdx ? c.accent : c.subtext }]}>{d.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Szybkie liczby */}
            <View style={styles.cardsRow}>
              <MiniCard emoji="🔥" value={`${streak}`} label={streak === 1 ? 'tydzień z celem' : 'tyg. z celem z rzędu'} palette={c} />
              <MiniCard emoji="📏" value={longest ? `${formatKm(longest.distanceM)} km` : '—'} label="najdłuższa trasa" palette={c} />
            </View>
            <View style={styles.cardsRow}>
              <MiniCard emoji="👣" value={mostSteps ? formatNumber(mostSteps.steps) : '—'} label="rekord kroków" palette={c} />
              <MiniCard emoji="🦅" value={formatAltitude(totals.highestM)} label="najwyżej" palette={c} />
            </View>

            {/* Mój Everest */}
            <View style={{ gap: 8 }}>
              <SectionTitle
                title="🏔️ Mój Everest"
                palette={c}
                right={<Text style={{ color: c.subtext, fontSize: 12 }}>{formatNumber(totals.gainM)} / {formatNumber(EVEREST_M)} m</Text>}
              />
              <View style={[styles.track, { backgroundColor: c.cardAlt }]}>
                <LinearGradient
                  colors={c.sunrise}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.fill, { width: `${Math.max(2, everestPct * 100)}%` as `${number}%` }]}
                />
              </View>
            </View>

            {/* Odznaki */}
            <View style={{ gap: 10 }}>
              <SectionTitle title="Odznaki" palette={c} right={<Text style={{ color: c.subtext, fontSize: 12 }}>{badges.filter((b) => b.done).length}/{badges.length}</Text>} />
              <View style={styles.badges}>
                {badges.map((b) => (
                  <View key={b.id} style={[styles.badge, { backgroundColor: c.cardAlt, borderColor: b.done ? c.accent : c.border }]}>
                    <Text style={{ fontSize: 22, opacity: b.done ? 1 : 0.25 }}>{b.emoji}</Text>
                    <Text style={[styles.badgeTitle, { color: b.done ? c.text : c.subtext }]} numberOfLines={1}>
                      {b.title}
                    </Text>
                    <Text style={[styles.badgeDesc, { color: c.subtext }]} numberOfLines={2}>
                      {b.description}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MiniCard({ emoji, value, label, palette: c }: { emoji: string; value: string; label: string; palette: TrailPalette }) {
  return (
    <View style={[styles.mini, { backgroundColor: c.cardAlt }]}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.miniValue, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text style={[styles.miniLabel, { color: c.subtext }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 10,
    maxHeight: '90%',
    gap: 14,
    ...cardShadow,
  },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '900' },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  hero: { borderRadius: 24, borderWidth: 1, padding: 18, alignItems: 'center', gap: 6 },
  pct: { fontSize: 64, fontWeight: '900', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  pctSign: { fontSize: 30 },
  heroSub: { fontSize: 14, fontWeight: '700', marginTop: -6 },
  heroMsg: { fontSize: 13.5, textAlign: 'center', lineHeight: 19, marginTop: 4 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden', alignSelf: 'stretch' },
  fill: { height: '100%', borderRadius: 5 },

  daysRow: { flexDirection: 'row', gap: 8, height: 110 },
  dayCol: { flex: 1, alignItems: 'center', gap: 6 },
  dayBarBg: { flex: 1, width: '100%', borderRadius: 10, overflow: 'hidden', justifyContent: 'flex-end' },
  dayBar: { width: '100%', borderRadius: 10 },
  dayLabel: { fontSize: 12, fontWeight: '800' },

  cardsRow: { flexDirection: 'row', gap: 8 },
  mini: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 12 },
  miniValue: { fontSize: 16, fontWeight: '900' },
  miniLabel: { fontSize: 11 },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { width: '23%', flexGrow: 1, borderRadius: 14, borderWidth: 1, padding: 8, alignItems: 'center', gap: 2 },
  badgeTitle: { fontSize: 10.5, fontWeight: '800', textAlign: 'center' },
  badgeDesc: { fontSize: 9, textAlign: 'center' },
});
