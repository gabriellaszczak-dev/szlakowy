import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { TrailPalette } from '@/components/trails/palette';
import { GlassCard, Icon } from '@/components/trails/ui';
import { computeTotals } from '@/lib/achievements';
import {
  DIFFICULTIES,
  DIFFICULTY_KEYS,
  formatDate,
  formatDuration,
  formatKm,
  formatNumber,
  formatSteps,
  type Difficulty,
  type Trail,
} from '@/lib/trails';

type Filter = Difficulty | 'all';

type Props = {
  trails: Trail[];
  palette: TrailPalette;
  onSelect: (t: Trail) => void;
  onClose: () => void;
  /** Usunięcie wybranych tras (z potwierdzeniem po stronie ekranu). */
  onDeleteMany: (ids: string[], done: () => void) => void;
  maxHeight: number;
};

export function TrailList({ trails, palette: c, onSelect, onClose, onDeleteMany, maxHeight }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const stopSelecting = () => {
    setSelecting(false);
    setSelected([]);
  };
  const visible = filter === 'all' ? trails : trails.filter((t) => t.difficulty === filter);
  const totals = computeTotals(trails);

  return (
    <GlassCard palette={c} style={[styles.panel, { maxHeight }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>{selecting ? `Zaznaczono: ${selected.length}` : 'Moje trasy'}</Text>
        {trails.length > 0 && (
          <Pressable
            onPress={() => (selecting ? stopSelecting() : setSelecting(true))}
            hitSlop={8}
            style={[styles.selectBtn, { backgroundColor: c.cardAlt }]}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 13 }}>{selecting ? 'Anuluj' : 'Wybierz'}</Text>
          </Pressable>
        )}
        <Pressable onPress={onClose} hitSlop={10} style={[styles.close, { backgroundColor: c.cardAlt }]} accessibilityLabel="Zamknij listę">
          <Icon name="close" size={18} color={c.text} />
        </Pressable>
      </View>

      <View style={styles.summary}>
        <Summary icon="walk" value={`${formatKm(totals.distanceM)} km`} label="łącznie" palette={c} />
        <Summary icon="footsteps" value={formatNumber(totals.steps)} label="kroków" palette={c} />
        <Summary icon="trending-up" value={`${formatNumber(totals.gainM)} m`} label="w górę" palette={c} />
      </View>

      <View style={styles.filters}>
        {(['all', ...DIFFICULTY_KEYS] as Filter[]).map((f) => {
          const active = filter === f;
          const color = f === 'all' ? c.accent : DIFFICULTIES[f].color;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.chip, { borderColor: color, backgroundColor: active ? color : 'transparent' }]}>
              <Text style={{ color: active ? c.onAccent : c.text, fontWeight: '800', fontSize: 12.5 }}>
                {f === 'all' ? `Wszystkie · ${trails.length}` : DIFFICULTIES[f].label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 40 }}>🏕️</Text>
          <Text style={[styles.emptyText, { color: c.subtext }]}>
            {trails.length === 0
              ? 'Tu pojawią się Twoje wyprawy.\nKliknij „Dodaj trasę” i ruszaj na szlak!'
              : 'Brak tras o tej trudności – czas to zmienić 😉'}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {visible.map((t) => {
            const info = DIFFICULTIES[t.difficulty];
            return (
              <Pressable
                key={t.id}
                onPress={() => (selecting ? toggle(t.id) : onSelect(t))}
                onLongPress={() => {
                  setSelecting(true);
                  toggle(t.id);
                }}
                style={({ pressed }) => [
                  styles.item,
                  {
                    backgroundColor: selected.includes(t.id) ? c.danger + '22' : c.cardAlt,
                    borderColor: selected.includes(t.id) ? c.danger : 'transparent',
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}>
                <LinearGradient colors={info.gradient} style={styles.itemBadge}>
                  <Text style={{ fontSize: 20 }}>{info.emoji}</Text>
                </LinearGradient>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.itemTitle, { color: c.text }]} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <View style={styles.itemStats}>
                    <Text style={[styles.itemKm, { color: info.color }]}>{formatKm(t.distanceM)} km</Text>
                    <Text style={[styles.itemSub, { color: c.subtext }]}>
                      👣 {formatSteps(t.steps, t.stepsEstimated)} · ⏱ {formatDuration(t.durationS)} · ↑{' '}
                      {Math.round(t.elevationGainM)} m
                    </Text>
                  </View>
                  <Text style={[styles.itemDate, { color: c.subtext }]}>{formatDate(t.createdAt)}</Text>
                </View>
                {selecting ? (
                  <Icon
                    name={selected.includes(t.id) ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={selected.includes(t.id) ? c.danger : c.subtext}
                  />
                ) : (
                  <Icon name="chevron-forward" size={18} color={c.subtext} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {selecting ? (
        <View style={styles.selectBar}>
          <Pressable
            onPress={() => setSelected(selected.length === visible.length ? [] : visible.map((t) => t.id))}
            style={[styles.barBtn, { backgroundColor: c.cardAlt }]}>
            <Text style={{ color: c.text, fontWeight: '800' }}>
              {selected.length === visible.length && visible.length > 0 ? 'Odznacz' : 'Zaznacz wszystkie'}
            </Text>
          </Pressable>
          <Pressable
            disabled={selected.length === 0}
            onPress={() => onDeleteMany(selected, stopSelecting)}
            style={[styles.barBtn, { backgroundColor: c.danger, opacity: selected.length === 0 ? 0.4 : 1 }]}>
            <Icon name="trash-outline" size={16} color="white" />
            <Text style={{ color: 'white', fontWeight: '900' }}>Usuń ({selected.length})</Text>
          </Pressable>
        </View>
      ) : trails.length > 0 ? (
        <Text style={[styles.tip, { color: c.subtext }]}>Przytrzymaj trasę, aby zaznaczyć ją do usunięcia</Text>
      ) : null}
    </GlassCard>
  );
}

function Summary({
  icon,
  value,
  label,
  palette: c,
}: {
  icon: 'walk' | 'footsteps' | 'trending-up';
  value: string;
  label: string;
  palette: TrailPalette;
}) {
  return (
    <View style={[styles.summaryItem, { backgroundColor: c.cardAlt }]}>
      <Icon name={icon} size={16} color={c.accent} />
      <Text style={{ color: c.text, fontWeight: '900', fontSize: 15 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={{ color: c.subtext, fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 14, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: '900', flex: 1 },
  selectBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8 },
  selectBar: { flexDirection: 'row', gap: 8 },
  barBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 14 },
  tip: { fontSize: 11.5, textAlign: 'center' },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', gap: 8 },
  summaryItem: { flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center', gap: 2 },
  filters: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  empty: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyText: { textAlign: 'center', lineHeight: 20 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1.5 },
  itemBadge: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 15.5, fontWeight: '800' },
  itemStats: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  itemKm: { fontSize: 15, fontWeight: '900' },
  itemSub: { fontSize: 12.5 },
  itemDate: { fontSize: 11 },
});
