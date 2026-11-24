import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cardShadow, type TrailPalette } from '@/components/trails/palette';
import { PrimaryButton } from '@/components/trails/ui';
import { DEFAULT_GOAL_KM, GOAL_PRESETS, type Profile } from '@/lib/profile';

/** Wybór tygodniowego celu: gotowe kafelki + własna wartość. */
export function GoalPicker({
  value,
  onChange,
  palette: c,
}: {
  value: number;
  onChange: (km: number) => void;
  palette: TrailPalette;
}) {
  const isPreset = GOAL_PRESETS.includes(value);
  const [custom, setCustom] = useState(isPreset ? '' : String(value));

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.chips}>
        {GOAL_PRESETS.map((km) => {
          const active = value === km && custom === '';
          return (
            <Pressable
              key={km}
              onPress={() => {
                setCustom('');
                onChange(km);
              }}
              style={[
                styles.chip,
                { borderColor: active ? c.accent : c.border, backgroundColor: active ? c.accent : c.cardAlt },
              ]}>
              <Text style={[styles.chipValue, { color: active ? '#0D1513' : c.text }]}>{km}</Text>
              <Text style={[styles.chipUnit, { color: active ? '#0D1513' : c.subtext }]}>km</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={custom}
        onChangeText={(t: string) => {
          const clean = t.replace(/[^0-9]/g, '').slice(0, 3);
          setCustom(clean);
          const n = parseInt(clean, 10);
          if (n > 0) onChange(n);
        }}
        placeholder="albo wpisz własny cel (km)"
        placeholderTextColor={c.subtext}
        keyboardType="number-pad"
        style={[styles.input, { backgroundColor: c.cardAlt, color: c.text, borderColor: c.border }]}
      />
    </View>
  );
}

/** Ekran powitalny – pojawia się tylko przy pierwszym uruchomieniu. */
export function Onboarding({ palette: c, onDone }: { palette: TrailPalette; onDone: (p: Profile) => void }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<0 | 1>(0);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState(DEFAULT_GOAL_KM);
  const trimmed = name.trim();

  return (
    <LinearGradient colors={['#1B3A31', '#0D1513', '#0D1513']} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.screen, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.hero}>
          <Text style={styles.mountains}>🏔️</Text>
          <Text style={[styles.brand, { color: c.text }]}>Szlakowy</Text>
          <Text style={[styles.tagline, { color: c.subtext }]}>Twoje trasy w górach – zapisane krok po kroku.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.dots}>
            {[0, 1].map((i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i === step ? c.accent : c.border }]} />
            ))}
          </View>

          {step === 0 ? (
            <>
              <Text style={[styles.question, { color: c.text }]}>Cześć! Jak masz na imię?</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Twoje imię"
                placeholderTextColor={c.subtext}
                autoFocus
                autoCapitalize="words"
                returnKeyType="next"
                maxLength={24}
                onSubmitEditing={() => trimmed && setStep(1)}
                style={[styles.input, styles.nameInput, { backgroundColor: c.cardAlt, color: c.text, borderColor: c.border }]}
              />
              <PrimaryButton
                title="Dalej"
                icon="arrow-forward"
                gradient={trimmed ? c.sunrise : undefined}
                color={trimmed ? undefined : c.cardAlt}
                textColor={trimmed ? 'white' : c.subtext}
                large
                onPress={() => trimmed && setStep(1)}
              />
            </>
          ) : (
            <>
              <Text style={[styles.question, { color: c.text }]}>Ile km chcesz przejść w tygodniu, {trimmed}?</Text>
              <Text style={[styles.hint, { color: c.subtext }]}>Cel zmienisz w każdej chwili.</Text>
              <GoalPicker value={goal} onChange={setGoal} palette={c} />
              <PrimaryButton
                title="Ruszajmy!"
                icon="walk"
                gradient={c.sunrise}
                large
                onPress={() => onDone({ name: trimmed, weeklyGoalKm: goal })}
              />
              <Pressable onPress={() => setStep(0)} hitSlop={8} style={{ alignSelf: 'center' }}>
                <Text style={{ color: c.subtext, fontWeight: '700' }}>Wróć</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

/** Edycja imienia i celu – otwierana z ekranu głównego. */
export function ProfileSheet({
  visible,
  profile,
  palette: c,
  onSave,
  onClose,
}: {
  visible: boolean;
  profile: Profile;
  palette: TrailPalette;
  onSave: (p: Profile) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(profile.name);
  const [goal, setGoal] = useState(profile.weeklyGoalKm);
  const [wasVisible, setWasVisible] = useState(visible);

  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName(profile.name);
      setGoal(profile.weeklyGoalKm);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.backdrop, { backgroundColor: c.overlay }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: c.cardSolid, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
          <Text style={[styles.question, { color: c.text }]}>Twój profil</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Imię"
            placeholderTextColor={c.subtext}
            maxLength={24}
            style={[styles.input, { backgroundColor: c.cardAlt, color: c.text, borderColor: c.border }]}
          />
          <Text style={[styles.label, { color: c.subtext }]}>Cel tygodniowy</Text>
          <GoalPicker key={String(visible)} value={goal} onChange={setGoal} palette={c} />
          <PrimaryButton
            title="Zapisz"
            icon="checkmark"
            gradient={c.sunrise}
            large
            onPress={() => onSave({ name: name.trim() || profile.name, weeklyGoalKm: goal })}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, justifyContent: 'space-between' },
  hero: { alignItems: 'center', gap: 8, marginTop: 20 },
  mountains: { fontSize: 72 },
  brand: { fontSize: 38, fontWeight: '900', letterSpacing: -1 },
  tagline: { fontSize: 15.5, textAlign: 'center', lineHeight: 22, maxWidth: 280 },

  card: { borderRadius: 28, borderWidth: 1, padding: 20, gap: 16, ...cardShadow },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center' },
  dot: { width: 22, height: 4, borderRadius: 2 },
  question: { fontSize: 21, fontWeight: '900', letterSpacing: -0.3 },
  hint: { fontSize: 13, marginTop: -8 },
  label: { fontSize: 11.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },

  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, borderWidth: 1 },
  nameInput: { fontSize: 20, fontWeight: '700', paddingVertical: 15 },

  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, borderRadius: 14, borderWidth: 1.5, paddingVertical: 10, alignItems: 'center' },
  chipValue: { fontSize: 18, fontWeight: '900' },
  chipUnit: { fontSize: 11, fontWeight: '700' },

  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 10, gap: 14, ...cardShadow },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 4 },
});
