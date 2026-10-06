import React, { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { useGolf } from '@/context/GolfContext';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import * as Haptics from 'expo-haptics';

export function Page({ children, contentStyle }: { children: ReactNode; contentStyle?: object }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isReady, storageError } = useGolf();
  if (!isReady) return <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={colors.primary} /></View>;
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentInsetAdjustmentBehavior="automatic"
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.page,
          { paddingTop: Platform.OS === 'web' ? 67 : Math.max(insets.top, 12) + 8, paddingBottom: Platform.OS === 'web' ? 118 : 108 },
          contentStyle,
        ]}
      >
        {storageError ? <View style={{ borderWidth: 1, borderColor: colors.destructive, borderRadius: 12, padding: 12 }}><Text style={{ color: colors.destructive, fontSize: 14, lineHeight: 21 }}>{storageError}</Text></View> : null}
        {children}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

export function PageHeading({ eyebrow, title, subtitle, right }: { eyebrow?: string; title: string; subtitle?: string; right?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.heading, { borderBottomColor: colors.rim }]}>
      <View style={[styles.headingMarker, { backgroundColor: colors.primary }]} />
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.rim, borderRadius: colors.radius, boxShadow: `0px 7px 16px ${colors.shadow}` }, style]}>
      <LinearGradient
        colors={[colors.surfaceRaised, colors.card]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: colors.radius, pointerEvents: 'none' }]}
      />
      <View style={[styles.cardInnerRim, { borderColor: colors.border, borderRadius: colors.radius - 4, pointerEvents: 'none' }]} />
      <View style={[styles.cardTrim, { backgroundColor: colors.primary, pointerEvents: 'none' }]} />
      {children}
    </View>
  );
}

export function SectionTitle({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.sectionTitle}>
      <Text style={[styles.sectionText, { color: colors.foreground }]}>{children}</Text>
      {trailing}
    </View>
  );
}

export function ActionButton({ title, onPress, icon, secondary, disabled, testID }: { title: string; onPress: () => void; icon?: keyof typeof Feather.glyphMap; secondary?: boolean; disabled?: boolean; testID?: string }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      disabled={disabled}
      onPress={() => { void Haptics.selectionAsync().catch(() => undefined); onPress(); }}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: secondary ? colors.secondary : colors.primaryFill, borderColor: secondary ? colors.emerald : colors.rim, boxShadow: `0px 3px 8px ${colors.shadow}`, transform: [{ translateY: pressed ? 1 : 0 }], opacity: disabled ? 0.42 : pressed ? 0.86 : 1 },
      ]}
    >
      {icon ? <Feather name={icon} size={18} color={secondary ? colors.secondaryForeground : colors.primaryForeground} /> : null}
      <Text style={[styles.actionText, { color: secondary ? colors.secondaryForeground : colors.primaryForeground }]}>{title}</Text>
    </Pressable>
  );
}

export function Pill({ children, tone = 'gold' }: { children: ReactNode; tone?: 'gold' | 'green' | 'muted' }) {
  const colors = useColors();
  const bg = tone === 'gold' ? colors.primaryFill : tone === 'green' ? colors.secondary : colors.muted;
  const fg = tone === 'gold' ? colors.primaryForeground : tone === 'green' ? colors.secondaryForeground : colors.mutedForeground;
  return <View style={[styles.pill, { backgroundColor: bg }]}><Text style={[styles.pillText, { color: fg }]}>{children}</Text></View>;
}

export function Field({ label, value, onChangeText, keyboardType = 'default', placeholder, testID, editable = true }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: 'default' | 'numeric' | 'decimal-pad'; placeholder?: string; testID?: string; editable?: boolean }) {
  const colors = useColors();
  return (
    <View style={{ gap: 7 }}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        editable={editable}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        selectionColor={colors.primary}
        style={[styles.field, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
      />
    </View>
  );
}

export function IconButton({ icon, onPress, label, testID }: { icon: keyof typeof Feather.glyphMap; onPress: () => void; label: string; testID?: string }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} testID={testID} onPress={onPress} style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.65 : 1 }]}>
      <Feather name={icon} size={18} color={colors.primary} />
    </Pressable>
  );
}

export function EmptyNote({ children }: { children: string }) {
  const colors = useColors();
  return <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 21 }}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: { paddingHorizontal: 18, gap: 18 },
  heading: { flexDirection: 'row', alignItems: 'stretch', gap: 12, marginBottom: 2, paddingBottom: 15, borderBottomWidth: StyleSheet.hairlineWidth },
  headingMarker: { width: 3, borderRadius: 2, opacity: 0.9 },
  eyebrow: { fontSize: 12, letterSpacing: 1.5, fontFamily: 'Inter_700Bold', marginBottom: 7 },
  title: { fontSize: 31, lineHeight: 37, fontFamily: 'Georgia', letterSpacing: -0.7 },
  subtitle: { fontSize: 16, lineHeight: 24, fontFamily: 'Inter_400Regular', marginTop: 7, maxWidth: 360, flexShrink: 1 },
  card: {
    borderWidth: 1,
    padding: 16,
    gap: 13,
  },
  cardInnerRim: { position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderWidth: StyleSheet.hairlineWidth, opacity: 0.42 },
  cardTrim: { position: 'absolute', top: 0, left: 17, right: 17, height: 2, opacity: 0.8 },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 7, paddingHorizontal: 1 },
  sectionText: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: 0.1 },
  action: { minHeight: 52, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1 },
  actionText: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: 0.1, textAlign: 'center', flexShrink: 1 },
  pill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_700Bold', letterSpacing: 0.55, textTransform: 'uppercase', flexShrink: 1 },
  fieldLabel: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.45, textTransform: 'uppercase' },
  field: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 16, lineHeight: 22, fontFamily: 'Inter_500Medium' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});