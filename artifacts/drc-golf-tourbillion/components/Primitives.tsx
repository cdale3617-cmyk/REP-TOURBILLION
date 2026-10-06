import React, { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/AppText';
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
  const { height } = useWindowDimensions();
  const short = height < 700;
  const { isReady, storageError } = useGolf();
  if (!isReady) return <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={colors.primary} /></View>;
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1 }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.page,
          { paddingTop: Platform.OS === 'web' ? (short ? 16 : Math.min(67, Math.round(height * 0.07))) : Math.max(insets.top, short ? 6 : 12) + (short ? 4 : 8), paddingBottom: Platform.OS === 'web' ? (short ? 96 : 118) : 70 + insets.bottom + (short ? 12 : 24), gap: short ? 9 : 13 },
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
    <View style={styles.heading}>
      <View style={styles.headingRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {eyebrow ? <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{eyebrow.toUpperCase()}</Text> : null}
          <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        </View>
        {right}
      </View>
      <View style={[styles.rule, { backgroundColor: colors.border }]}><View style={[styles.ruleMark, { backgroundColor: colors.primary }]} /></View>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.rim, borderRadius: colors.radius, boxShadow: `0px 6px 16px ${colors.shadow}` }, style]}>
      <LinearGradient
        colors={[colors.surfaceRaised, colors.card]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: colors.radius, pointerEvents: 'none' }]}
      />
      <LinearGradient colors={['transparent', colors.primary, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.cardTrim, { pointerEvents: 'none' }]} />
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
  const metal = !secondary && colors.primaryFill === colors.primary;
  const fg = secondary ? colors.secondaryForeground : colors.primaryForeground;
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      disabled={disabled}
      onPress={() => { void Haptics.selectionAsync().catch(() => undefined); onPress(); }}
      style={({ pressed }) => [
        styles.action,
        { overflow: 'hidden', backgroundColor: secondary ? colors.secondary : colors.primaryFill, borderColor: secondary ? colors.rim : metal ? colors.primary : colors.foreground, boxShadow: secondary ? 'none' : `0px 3px 8px ${colors.shadow}`, transform: [{ scale: pressed ? 0.985 : 1 }], opacity: disabled ? 0.42 : pressed ? 0.88 : 1 },
      ]}
    >
      {metal ? <LinearGradient colors={['#E8ECF1', '#B3BCC8']} style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]} /> : null}
      {icon ? <Feather name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.actionText, { color: fg }]}>{title}</Text>
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
  page: { paddingHorizontal: 14, gap: 13, flexGrow: 1 },
  heading: { gap: 8, marginBottom: 2 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  rule: { height: StyleSheet.hairlineWidth },
  ruleMark: { width: 36, height: 2, marginTop: -0.5 },
  eyebrow: { fontSize: 11, lineHeight: 15, letterSpacing: 2, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  title: { fontSize: 22, lineHeight: 28, fontFamily: 'Inter_700Bold', letterSpacing: 3 },
  subtitle: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', maxWidth: 420, flexShrink: 1 },
  card: {
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  cardInnerRim: { position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderWidth: StyleSheet.hairlineWidth, opacity: 0.42 },
  cardTrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, opacity: 0.55 },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 7, paddingHorizontal: 1 },
  sectionText: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1.1, textTransform: 'uppercase' },
  action: { minHeight: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1 },
  actionText: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 0.2, textAlign: 'center', flexShrink: 1 },
  pill: { borderRadius: 4, paddingHorizontal: 9, paddingVertical: 5, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_700Bold', letterSpacing: 0.55, textTransform: 'uppercase', flexShrink: 1 },
  fieldLabel: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.45, textTransform: 'uppercase' },
  field: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, fontSize: 16, lineHeight: 22, fontFamily: 'Inter_500Medium' },
  iconButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});