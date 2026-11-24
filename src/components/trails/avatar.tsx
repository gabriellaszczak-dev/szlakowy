import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { TrailPalette } from '@/components/trails/palette';

/** Zdjęcie profilowe albo pierwsza litera imienia na gradiencie motywu. */
export function Avatar({
  name,
  avatar,
  size = 42,
  palette: c,
  ring,
}: {
  name: string;
  avatar?: string | null;
  size?: number;
  palette: TrailPalette;
  ring?: boolean;
}) {
  const radius = size * 0.34;
  const ringStyle = ring ? { borderWidth: 3, borderColor: c.accent, padding: 2, borderRadius: radius + 5 } : null;

  return (
    <View style={ringStyle}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={{ width: size, height: size, borderRadius: radius }} />
      ) : (
        <LinearGradient colors={c.sunrise} style={[styles.fallback, { width: size, height: size, borderRadius: radius }]}>
          <Text style={[styles.initial, { fontSize: size * 0.45 }]}>{(name.charAt(0) || '?').toUpperCase()}</Text>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: 'white', fontWeight: '900' },
});
