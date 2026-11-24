import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ElevationChart } from '@/components/trails/elevation-chart';
import type { TrailPalette } from '@/components/trails/palette';
import { DirectionsCard, RouteMap, snakeInfo, useMyPosition, useReplay } from '@/components/trails/trail-route-map';
import {
  DifficultyBadge,
  Icon,
  PrimaryButton,
  RoundButton,
  SectionTitle,
  StatTile,
} from '@/components/trails/ui';
import {
  DIFFICULTIES,
  averageSpeedKmh,
  elevationProfile,
  formatAltitude,
  formatDate,
  formatDistance,
  formatDuration,
  formatKm,
  formatSteps,
  type Trail,
} from '@/lib/trails';

type Props = {
  trail: Trail | null;
  palette: TrailPalette;
  onClose: () => void;
  onShowOnMap: () => void;
  onShare: () => void;
  onDelete: () => void;
};

/**
 * Pełnoekranowy podgląd trasy.
 * Wyjście: strzałka ← u góry, przycisk „Zamknij podgląd” na dole albo systemowy „wstecz”.
 */
export function TrailPreview({ trail, palette: c, onClose, onShowOnMap, onShare, onDelete }: Props) {
  return (
    <Modal visible={trail != null} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {trail && (
        <PreviewContent
          trail={trail}
          palette={c}
          onClose={onClose}
          onShowOnMap={onShowOnMap}
          onShare={onShare}
          onDelete={onDelete}
        />
      )}
    </Modal>
  );
}

function PreviewContent({ trail, palette: c, onClose, onShowOnMap, onShare, onDelete }: Props & { trail: Trail }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const me = useMyPosition();
  const [mapOnly, setMapOnly] = useState(false);
  const info = DIFFICULTIES[trail.difficulty];
  const mapHeight = mapOnly ? height : height * 0.45;
  const replay = useReplay(trail.distanceM);
  const head = replay.progress != null ? snakeInfo(trail, replay.progress) : null;

  // Po otwarciu podglądu trasa „rysuje się” sama.
  useEffect(() => {
    const t = setTimeout(replay.play, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trail.id]);

  return (
    <View style={{ flex: 1, backgroundColor: c.cardSolid }}>
      {/* ---- Mapa trasy ---- */}
      <View style={{ height: mapHeight }}>
        <RouteMap
          trail={trail}
          me={me}
          interactive
          progress={replay.progress}
          padding={{ top: insets.top + 70, bottom: mapOnly ? 150 : 80 }}
        />
        {!mapOnly && (
          <LinearGradient
            colors={['transparent', c.cardSolid]}
            style={styles.mapFade}
            pointerEvents="none"
          />
        )}
        <View style={[styles.mapTop, { top: insets.top + 10 }]}>
          <RoundButton icon="arrow-back" label="Wróć do mapy" palette={c} onPress={onClose} />
          <RoundButton
            icon={mapOnly ? 'contract' : 'expand'}
            label={mapOnly ? 'Pokaż szczegóły' : 'Powiększ mapę'}
            palette={c}
            onPress={() => setMapOnly((v) => !v)}
          />
        </View>
        <View style={[styles.replayRow, { bottom: mapOnly ? insets.bottom + 92 : 30 }]}>
          {replay.playing && head ? (
            <View style={[styles.replayPill, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={[styles.replayDot, { backgroundColor: info.color }]} />
              <Text style={[styles.replayText, { color: c.text }]}>
                {formatKm(head.distanceM)} km
                {head.altitude != null ? `  ·  ${Math.round(head.altitude)} m n.p.m.` : ''}
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={replay.play}
              style={[styles.replayPill, { backgroundColor: c.card, borderColor: c.border }]}
              accessibilityRole="button"
              accessibilityLabel="Odtwórz przebieg trasy">
              <Icon name="play" size={14} color={info.color} />
              <Text style={[styles.replayText, { color: c.text }]}>Odtwórz przebieg</Text>
            </Pressable>
          )}
        </View>
        {mapOnly && (
          <View style={[styles.mapOnlyBottom, { bottom: insets.bottom + 20 }]}>
            <PrimaryButton title="Pokaż szczegóły trasy" icon="chevron-up" gradient={info.gradient} onPress={() => setMapOnly(false)} large />
          </View>
        )}
      </View>

      {/* ---- Szczegóły ---- */}
      {!mapOnly && (
        <ScrollView
          style={styles.sheet}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}>
          <View style={{ gap: 8 }}>
            <View style={styles.metaRow}>
              <DifficultyBadge difficulty={trail.difficulty} />
              <Text style={[styles.date, { color: c.subtext }]}>{formatDate(trail.createdAt)}</Text>
            </View>
            <Text style={[styles.title, { color: c.text }]}>{trail.name}</Text>
            {trail.notes ? <Text style={[styles.notes, { color: c.subtext }]}>“{trail.notes}”</Text> : null}
          </View>

          {/* Główne liczby */}
          <LinearGradient
            colors={[info.color + '33', info.color + '0A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { borderColor: info.color + '55' }]}>
            <View style={styles.heroMain}>
              <Text style={[styles.heroValue, { color: c.text }]}>{formatKm(trail.distanceM)}</Text>
              <Text style={[styles.heroUnit, { color: info.color }]}>km</Text>
            </View>
            <Text style={[styles.heroCaption, { color: c.subtext }]}>pokonanego szlaku</Text>
            <View style={styles.grid}>
              <StatTile
                big
                palette={c}
                icon="footsteps"
                iconColor={info.color}
                value={formatSteps(trail.steps, trail.stepsEstimated)}
                label="kroków"
              />
              <StatTile big palette={c} icon="time-outline" iconColor={info.color} value={formatDuration(trail.durationS)} label="czas" />
            </View>
            <View style={styles.grid}>
              <StatTile palette={c} icon="trending-up" iconColor={info.color} value={`${Math.round(trail.elevationGainM)} m`} label="podejścia" />
              <StatTile palette={c} icon="trending-down" iconColor={info.color} value={`${Math.round(trail.elevationLossM)} m`} label="zejścia" />
              <StatTile palette={c} icon="speedometer-outline" iconColor={info.color} value={averageSpeedKmh(trail.distanceM, trail.durationS).toFixed(1).replace('.', ',')} label="km/h śr." />
            </View>
            {trail.stepsEstimated && (
              <Text style={[styles.footnote, { color: c.subtext }]}>
                ~ kroki oszacowane z dystansu (telefon nie udostępnił krokomierza)
              </Text>
            )}
          </LinearGradient>

          <View style={{ gap: 10 }}>
            <SectionTitle title="Profil wysokości" palette={c} right={<Text style={{ color: c.subtext, fontSize: 12 }}>najwyżej {formatAltitude(trail.maxAltitudeM)}</Text>} />
            <ElevationChart
              profile={elevationProfile(trail.segments)}
              color={info.color}
              palette={c}
              distanceLabel={formatDistance(trail.distanceM)}
            />
          </View>

          <View style={{ gap: 10 }}>
            <SectionTitle title="Jak iść" palette={c} />
            <DirectionsCard trail={trail} me={me} palette={c} />
          </View>

          <View style={styles.actions}>
            <PrimaryButton title="Na mapie" icon="map-outline" color={c.cardAlt} onPress={onShowOnMap} flex />
            <PrimaryButton title="GPX" icon="share-outline" color={c.cardAlt} onPress={onShare} flex />
            <PrimaryButton title="Usuń" icon="trash-outline" color={c.cardAlt} textColor={c.danger} onPress={onDelete} flex />
          </View>

          <PrimaryButton title="Zamknij podgląd" icon="close" color={c.text} textColor={c.cardSolid} onPress={onClose} large />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 60 },
  mapTop: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  mapOnlyBottom: { position: 'absolute', left: 16, right: 16 },
  replayRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  replayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  replayDot: { width: 8, height: 8, borderRadius: 4 },
  replayText: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },

  sheet: { flex: 1, marginTop: -20 },
  sheetContent: { paddingHorizontal: 18, paddingTop: 4, gap: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  date: { fontSize: 13, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  notes: { fontSize: 15, fontStyle: 'italic', lineHeight: 21 },

  hero: { borderRadius: 24, padding: 16, gap: 10, borderWidth: 1 },
  heroMain: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 6 },
  heroValue: { fontSize: 64, fontWeight: '900', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  heroUnit: { fontSize: 24, fontWeight: '900', marginBottom: 12 },
  heroCaption: { textAlign: 'center', fontSize: 13, fontWeight: '600', marginTop: -10, marginBottom: 4 },
  grid: { flexDirection: 'row', gap: 8 },
  footnote: { fontSize: 11, textAlign: 'center' },

  actions: { flexDirection: 'row', gap: 8 },
});
