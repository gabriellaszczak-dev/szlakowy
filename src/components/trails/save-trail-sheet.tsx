import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ElevationChart } from '@/components/trails/elevation-chart';
import { cardShadow, type TrailPalette } from '@/components/trails/palette';
import { DifficultyPicker, PrimaryButton, SectionTitle, StatTile } from '@/components/trails/ui';
import {
  DIFFICULTIES,
  computeStats,
  elevationProfile,
  formatDuration,
  formatKm,
  formatSteps,
  type Difficulty,
  type TrackPoint,
} from '@/lib/trails';

type Props = {
  visible: boolean;
  palette: TrailPalette;
  segments: TrackPoint[][];
  durationS: number;
  steps: number;
  stepsEstimated: boolean;
  initialDifficulty: Difficulty;
  defaultName: string;
  /** Miła wiadomość na koniec trasy. */
  message: { title: string; body: string };
  onSave: (data: { name: string; notes: string; difficulty: Difficulty }) => void;
  onDiscard: () => void;
  onResume: () => void;
};

export function SaveTrailSheet({
  visible,
  palette: c,
  segments,
  durationS,
  steps,
  stepsEstimated,
  initialDifficulty,
  defaultName,
  message,
  onSave,
  onDiscard,
  onResume,
}: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  const [wasVisible, setWasVisible] = useState(visible);

  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName('');
      setNotes('');
      setDifficulty(initialDifficulty);
    }
  }

  const stats = computeStats(segments);
  const profile = elevationProfile(segments);
  const info = DIFFICULTIES[difficulty];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onResume} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.backdrop, { backgroundColor: c.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: c.cardSolid, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 18 }} showsVerticalScrollIndicator={false}>
            <LinearGradient colors={info.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <Text style={styles.heroTitle}>{message.title}</Text>
              <View style={styles.heroRow}>
                <Text style={styles.heroKm}>{formatKm(stats.distanceM)}</Text>
                <Text style={styles.heroUnit}>km</Text>
              </View>
              <Text style={styles.heroBody}>{message.body}</Text>
            </LinearGradient>

            <View style={styles.row}>
              <StatTile palette={c} icon="footsteps" iconColor={info.color} value={formatSteps(steps, stepsEstimated)} label="kroków" />
              <StatTile palette={c} icon="time-outline" iconColor={info.color} value={formatDuration(durationS)} label="czas" />
              <StatTile palette={c} icon="trending-up" iconColor={info.color} value={`${Math.round(stats.elevationGainM)} m`} label="w górę" />
            </View>

            <ElevationChart profile={profile} color={info.color} palette={c} height={70} />

            <View style={{ gap: 8 }}>
              <SectionTitle title="Nazwa trasy" palette={c} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={defaultName}
                placeholderTextColor={c.subtext}
                style={[styles.input, { backgroundColor: c.cardAlt, color: c.text, borderColor: c.border }]}
                returnKeyType="done"
                maxLength={60}
              />
            </View>

            <View style={{ gap: 8 }}>
              <SectionTitle title="Trudność" palette={c} />
              <DifficultyPicker value={difficulty} onChange={setDifficulty} compact />
            </View>

            <View style={{ gap: 8 }}>
              <SectionTitle title="Notatki" palette={c} />
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="np. piękny widok z grani, błoto przy schronisku…"
                placeholderTextColor={c.subtext}
                style={[styles.input, styles.notes, { backgroundColor: c.cardAlt, color: c.text, borderColor: c.border }]}
                multiline
                maxLength={500}
              />
            </View>

            <PrimaryButton
              title="Zapisz trasę"
              icon="checkmark-circle"
              gradient={info.gradient}
              large
              onPress={() => onSave({ name: name.trim() || defaultName, notes: notes.trim(), difficulty })}
            />
            <View style={styles.row}>
              <PrimaryButton title="Wróć do trasy" icon="play" color={c.cardAlt} onPress={onResume} flex />
              <Pressable onPress={onDiscard} style={styles.discard} accessibilityRole="button">
                <Text style={{ color: c.danger, fontWeight: '800' }}>Odrzuć</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 10,
    maxHeight: '94%',
    ...cardShadow,
  },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  hero: { borderRadius: 24, paddingVertical: 20, paddingHorizontal: 18, alignItems: 'center', gap: 2 },
  heroTitle: { color: 'white', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  heroBody: { color: 'rgba(255,255,255,0.92)', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 2 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  heroKm: { color: 'white', fontSize: 52, fontWeight: '900', letterSpacing: -1.5 },
  heroUnit: { color: 'rgba(255,255,255,0.9)', fontSize: 20, fontWeight: '900', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, borderWidth: 1 },
  notes: { minHeight: 84, textAlignVertical: 'top' },
  discard: { paddingHorizontal: 16, paddingVertical: 14 },
});
