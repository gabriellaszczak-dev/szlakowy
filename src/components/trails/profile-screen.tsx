import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  Alert,
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

import { Avatar } from '@/components/trails/avatar';
import { GoalPicker } from '@/components/trails/onboarding';
import { THEMES, THEME_IDS, makePalette, type ThemeId } from '@/components/trails/palette';
import { Icon, PrimaryButton, RoundButton, SectionTitle } from '@/components/trails/ui';
import { computeTotals } from '@/lib/achievements';
import type { Profile } from '@/lib/profile';
import { formatKm, formatNumber, type Trail } from '@/lib/trails';

type Props = {
  visible: boolean;
  profile: Profile;
  trails: Trail[];
  onSave: (p: Profile) => void;
  onClose: () => void;
};

/** Pełnoekranowy profil: zdjęcie, imię, cel, motyw kolorów i statystyki „na zawsze”. */
export function ProfileScreen({ visible, profile, trails, onSave, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(profile.name);
  const [goal, setGoal] = useState(profile.weeklyGoalKm);
  const [avatar, setAvatar] = useState<string | null>(profile.avatar ?? null);
  const [theme, setTheme] = useState<ThemeId>(profile.theme ?? 'forest');
  const [wasVisible, setWasVisible] = useState(visible);

  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName(profile.name);
      setGoal(profile.weeklyGoalKm);
      setAvatar(profile.avatar ?? null);
      setTheme(profile.theme ?? 'forest');
    }
  }

  // Podgląd motywu na żywo – zanim zapiszesz.
  const c = makePalette(theme);
  const totals = computeTotals(trails);

  const pickPhoto = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.35,
        base64: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      setAvatar(a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri);
    } catch {
      Alert.alert('Nie udało się otworzyć zdjęć', 'Sprawdź, czy aplikacja ma dostęp do galerii.');
    }
  };

  const save = () =>
    onSave({
      ...profile,
      name: name.trim() || profile.name,
      weeklyGoalKm: goal,
      avatar,
      theme,
    });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.cardSolid }}>
        <LinearGradient colors={[c.night[0], c.cardSolid]} style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={styles.headerRow}>
            <RoundButton icon="arrow-back" label="Zamknij profil" palette={c} onPress={onClose} size={42} />
            <Text style={[styles.headerTitle, { color: c.text }]}>Profil</Text>
            <View style={{ width: 42 }} />
          </View>

          <Pressable onPress={pickPhoto} style={styles.avatarWrap} accessibilityLabel="Zmień zdjęcie profilowe">
            <Avatar name={name} avatar={avatar} size={104} palette={c} ring />
            <View style={[styles.camera, { backgroundColor: c.accent, borderColor: c.cardSolid }]}>
              <Icon name="camera" size={16} color={c.onAccent} />
            </View>
          </Pressable>
          {avatar ? (
            <Pressable onPress={() => setAvatar(null)} hitSlop={8}>
              <Text style={[styles.removePhoto, { color: c.subtext }]}>Usuń zdjęcie</Text>
            </Pressable>
          ) : (
            <Text style={[styles.removePhoto, { color: c.subtext }]}>Dotknij, aby dodać zdjęcie</Text>
          )}
        </LinearGradient>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.statsRow}>
            <Stat value={String(totals.trails)} label="tras" palette={c} />
            <Stat value={formatKm(totals.distanceM)} label="km" palette={c} />
            <Stat value={formatNumber(totals.steps)} label="kroków" palette={c} />
            <Stat value={formatNumber(totals.gainM)} label="m w górę" palette={c} />
          </View>

          <View style={{ gap: 8 }}>
            <SectionTitle title="Imię" palette={c} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Twoje imię"
              placeholderTextColor={c.subtext}
              maxLength={24}
              style={[styles.input, { backgroundColor: c.cardAlt, color: c.text, borderColor: c.border }]}
            />
          </View>

          <View style={{ gap: 8 }}>
            <SectionTitle title="Cel tygodniowy" palette={c} />
            <GoalPicker key={String(visible)} value={goal} onChange={setGoal} palette={c} />
          </View>

          <View style={{ gap: 8 }}>
            <SectionTitle title="Kolory aplikacji" palette={c} />
            <View style={styles.themes}>
              {THEME_IDS.map((id) => {
                const t = THEMES[id];
                const active = id === theme;
                return (
                  <Pressable key={id} onPress={() => setTheme(id)} style={styles.themeItem} accessibilityLabel={`Motyw ${t.name}`}>
                    <View style={[styles.swatchRing, { borderColor: active ? t.accent : 'transparent' }]}>
                      <LinearGradient colors={t.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.swatch}>
                        <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
                      </LinearGradient>
                    </View>
                    <Text style={[styles.themeName, { color: active ? c.text : c.subtext }]}>{t.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <PrimaryButton title="Zapisz profil" icon="checkmark" gradient={c.sunrise} large onPress={save} />
          {profile.joinedAt ? (
            <Text style={[styles.joined, { color: c.subtext }]}>
              Na szlaku od {new Date(profile.joinedAt).toLocaleDateString('pl-PL')}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Stat({ value, label, palette: c }: { value: string; label: string; palette: ReturnType<typeof makePalette> }) {
  return (
    <View style={[styles.stat, { backgroundColor: c.cardAlt }]}>
      <Text style={[styles.statValue, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: c.subtext }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  avatarWrap: { marginTop: 6 },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhoto: { fontSize: 13, fontWeight: '700' },

  content: { paddingHorizontal: 18, gap: 22 },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '900' },
  statLabel: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase' },

  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, borderWidth: 1 },

  themes: { flexDirection: 'row', justifyContent: 'space-between' },
  themeItem: { alignItems: 'center', gap: 6 },
  swatchRing: { borderWidth: 3, borderRadius: 30, padding: 3 },
  swatch: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  themeName: { fontSize: 12, fontWeight: '800' },
  joined: { textAlign: 'center', fontSize: 12 },
});
