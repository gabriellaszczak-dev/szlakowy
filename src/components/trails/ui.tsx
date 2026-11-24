import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { cardShadow, type TrailPalette } from '@/components/trails/palette';
import { DIFFICULTIES, DIFFICULTY_KEYS, type Difficulty } from '@/lib/trails';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 18, color }: { name: IconName; size?: number; color: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

/** Ciemna, szklista karta nad mapą. */
export function GlassCard({
  palette: c,
  children,
  style,
}: {
  palette: TrailPalette;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.glass, { backgroundColor: c.card, borderColor: c.border }, style]}>{children}</View>
  );
}

export function StatTile({
  value,
  label,
  palette: c,
  icon,
  iconColor,
  big,
}: {
  value: string;
  label: string;
  palette: TrailPalette;
  icon?: IconName;
  iconColor?: string;
  big?: boolean;
}) {
  return (
    <View style={[styles.tile, { backgroundColor: c.cardAlt }, big && styles.tileBig]}>
      {icon && (
        <View style={styles.tileIcon}>
          <Icon name={icon} size={big ? 18 : 14} color={iconColor ?? c.subtext} />
        </View>
      )}
      <Text
        style={[styles.tileValue, { color: c.text }, big && styles.tileValueBig]}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.tileLabel, { color: c.subtext }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Duże karty trudności z gradientem – kolor szlaku jak na górskich znakach. */
export function DifficultyPicker({
  value,
  onChange,
  compact,
}: {
  value: Difficulty | null;
  onChange: (d: Difficulty) => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.pickerCol, compact && styles.pickerRow]}>
      {DIFFICULTY_KEYS.map((d) => {
        const selected = value === d;
        const info = DIFFICULTIES[d];
        const dimmed = value != null && !selected;
        return (
          <Pressable
            key={d}
            onPress={() => onChange(d)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Trudność: ${info.label}`}
            style={({ pressed }) => [
              compact && { flex: 1 },
              { opacity: dimmed ? 0.4 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}>
            <LinearGradient
              colors={info.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.diffCard, compact && styles.diffCardCompact, selected && styles.diffSelected]}>
              <Text style={compact ? styles.diffEmojiSmall : styles.diffEmoji}>{info.emoji}</Text>
              <View style={{ flex: compact ? undefined : 1, alignItems: compact ? 'center' : 'flex-start' }}>
                <Text style={styles.diffLabel}>{info.label}</Text>
                <Text style={styles.diffSub} numberOfLines={compact ? 1 : 2}>
                  {compact ? info.description : `${info.description} · ${info.hint}`}
                </Text>
              </View>
              {!compact && <Icon name="chevron-forward" size={20} color="rgba(255,255,255,0.85)" />}
            </LinearGradient>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const info = DIFFICULTIES[difficulty];
  return (
    <LinearGradient colors={info.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.badge}>
      <Text style={styles.badgeText}>
        {info.emoji} {info.label}
      </Text>
    </LinearGradient>
  );
}

export function PrimaryButton({
  title,
  onPress,
  color,
  gradient,
  textColor = 'white',
  icon,
  flex,
  large,
}: {
  title: string;
  onPress: () => void;
  color?: string;
  gradient?: readonly [string, string];
  textColor?: string;
  icon?: IconName;
  flex?: boolean;
  large?: boolean;
}) {
  const content = (
    <View style={styles.primaryInner}>
      {icon && <Icon name={icon} size={large ? 22 : 18} color={textColor} />}
      <Text style={[styles.primaryText, { color: textColor }, large && styles.primaryTextLarge]}>{title}</Text>
    </View>
  );
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        flex && { flex: 1 },
        { opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}>
      {gradient ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.primary, large && styles.primaryLarge]}>
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.primary, large && styles.primaryLarge, { backgroundColor: color }]}>{content}</View>
      )}
    </Pressable>
  );
}

export function RoundButton({
  icon,
  onPress,
  palette: c,
  size = 48,
  background,
  iconColor,
  label,
}: {
  icon: IconName;
  onPress: () => void;
  palette: TrailPalette;
  size?: number;
  background?: string;
  iconColor?: string;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.round,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background ?? c.card,
          borderColor: c.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <Icon name={icon} size={size * 0.45} color={iconColor ?? c.text} />
    </Pressable>
  );
}

export function SectionTitle({ title, palette: c, right }: { title: string; palette: TrailPalette; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: c.subtext }]}>{title}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  glass: { borderRadius: 24, borderWidth: 1, ...cardShadow },

  tile: { flex: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  tileBig: { paddingVertical: 14, borderRadius: 18 },
  tileIcon: { marginBottom: 2 },
  tileValue: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tileValueBig: { fontSize: 24, fontWeight: '900' },
  tileLabel: { fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600' },

  pickerCol: { gap: 10 },
  pickerRow: { flexDirection: 'row', gap: 8 },
  diffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  diffCardCompact: { flexDirection: 'column', gap: 4, paddingHorizontal: 6, paddingVertical: 12 },
  diffSelected: { borderWidth: 2, borderColor: 'white' },
  diffEmoji: { fontSize: 30 },
  diffEmojiSmall: { fontSize: 22 },
  diffLabel: { color: 'white', fontWeight: '900', fontSize: 17 },
  diffSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12, marginTop: 1 },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { color: 'white', fontWeight: '800', fontSize: 12 },

  primary: { paddingVertical: 14, borderRadius: 16, alignItems: 'center', paddingHorizontal: 14 },
  primaryLarge: { paddingVertical: 18, borderRadius: 20 },
  primaryInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryText: { fontSize: 15.5, fontWeight: '800' },
  primaryTextLarge: { fontSize: 18, fontWeight: '900', letterSpacing: 0.2 },

  round: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, ...cardShadow },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 11.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
});
