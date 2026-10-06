import React, { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText as Text } from '@/components/AppText';
import { useColors } from '@/hooks/useColors';

/** Small tracked caption used above every readout and group. */
export function Label({ children, tone }: { children: ReactNode; tone?: 'primary' | 'muted' }) {
  const colors = useColors();
  return <Text style={[styles.label, { color: tone === 'primary' ? colors.primary : colors.mutedForeground }]}>{children}</Text>;
}

/** Caption + tabular value + optional unit. Value is rendered exactly as supplied. */
export function Readout({ label, value, unit, size = 'md', align = 'left' }: { label: string; value: string | number; unit?: string; size?: 'sm' | 'md' | 'lg'; align?: 'left' | 'center' }) {
  const colors = useColors();
  const fs = size === 'lg' ? 40 : size === 'md' ? 26 : 19;
  return (
    <View style={{ minWidth: 0, alignItems: align === 'center' ? 'center' : 'flex-start' }}>
      <Label>{label}</Label>
      <Text style={[styles.value, { color: colors.foreground, fontSize: fs, lineHeight: fs + 6 }]}>
        {value}{unit ? <Text style={[styles.unit, { color: colors.mutedForeground }]}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

/** Row of readouts divided by hairlines. */
export function ReadoutStrip({ items }: { items: { label: string; value: string | number; unit?: string }[] }) {
  const colors = useColors();
  return (
    <View style={[styles.strip, { borderColor: colors.border, backgroundColor: colors.muted }]}>
      {items.map((item, i) => (
        <View key={item.label} style={[styles.stripCell, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.rim }]}>
          <Readout label={item.label} value={item.value} unit={item.unit} size="sm" />
        </View>
      ))}
    </View>
  );
}

/** Live-state toggle: dot + label, 44px target. */
export function StatusToggle({ label, active, requested, actionLabel, icon = 'crosshair', onPress, testID, compact }: { label: string; active?: boolean; requested?: boolean; actionLabel?: string; icon?: keyof typeof Feather.glyphMap; onPress: () => void; testID?: string; compact?: boolean }) {
  const colors = useColors();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={actionLabel ?? label} accessibilityState={{ selected: requested ?? !!active }} onPress={onPress}
      style={({ pressed }) => [styles.toggle, { borderColor: active ? colors.primary : colors.rim, backgroundColor: active ? colors.secondary : colors.muted, opacity: pressed ? 0.75 : 1, flexGrow: compact ? 0 : 1 }]}>
      <View style={[styles.dot, { backgroundColor: active ? colors.primary : 'transparent', borderColor: active ? colors.primary : colors.mutedForeground }]} />
      <Feather name={icon} size={16} color={colors.primary} />
      <Text numberOfLines={1} style={[styles.toggleText, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

/** Grouped index list: titled card, hairline-divided rows. */
export function ToolGroup({ title, count, icon, testID, children }: { title: string; count?: string; icon?: keyof typeof Feather.glyphMap; testID?: string; children: ReactNode }) {
  const colors = useColors();
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const wide = width >= 768 && height >= 600;
  const expanded = wide || open;
  return (
    <View style={[styles.group, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Pressable testID={testID} accessibilityRole={wide ? 'header' : 'button'} accessibilityLabel={`${title}, ${count ?? ''}`}
        accessibilityState={{ expanded }} disabled={wide} onPress={() => setOpen(value => !value)}
        style={[styles.groupHead, { borderBottomColor: colors.border, borderBottomWidth: expanded ? StyleSheet.hairlineWidth : 0, backgroundColor: colors.surfaceRaised }]}>
        {icon ? <Feather name={icon} size={14} color={colors.primary} /> : null}
        <Text style={[styles.groupTitle, { color: colors.foreground }]}>{title.toUpperCase()}</Text>
        <View style={{ flex: 1 }} />
        {count ? <Text style={[styles.label, { color: colors.mutedForeground }]}>{count}</Text> : null}
        {!wide ? <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} /> : null}
      </Pressable>
      <View style={{ display: expanded ? 'flex' : 'none' }}>{children}</View>
    </View>
  );
}

export function ToolRow({ index, icon, title, description, onPress, testID, accessibilityLabel, first, trailing }: { index?: number; icon: keyof typeof Feather.glyphMap; title: string; description?: string; onPress: () => void; testID?: string; accessibilityLabel?: string; first?: boolean; trailing?: ReactNode }) {
  const colors = useColors();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} onPress={onPress}
      style={({ pressed }) => [styles.row, { borderTopColor: colors.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, backgroundColor: pressed ? colors.secondary : 'transparent' }]}>
      {index !== undefined ? <Text style={[styles.index, { color: colors.mutedForeground }]}>{String(index).padStart(2, '0')}</Text> : null}
      <View style={[styles.well, { borderColor: colors.border, backgroundColor: colors.muted }]}><Feather name={icon} size={16} color={colors.primary} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.foreground }]}>{title}</Text>
        {description ? <Text numberOfLines={2} style={[styles.rowDesc, { color: colors.mutedForeground }]}>{description}</Text> : null}
      </View>
      {trailing}
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, lineHeight: 15, fontFamily: 'Inter_700Bold', letterSpacing: 1.4, textTransform: 'uppercase' },
  value: { fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  unit: { fontSize: 13, fontFamily: 'Inter_500Medium', letterSpacing: 0 },
  strip: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, overflow: 'hidden' },
  stripCell: { flex: 1, minWidth: 0, paddingHorizontal: 12, paddingVertical: 9 },
  toggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexShrink: 1 },
  dot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1 },
  toggleText: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
  group: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },
  groupHead: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  groupTitle: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_700Bold', letterSpacing: 1.8 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  index: { width: 20, fontSize: 11, fontFamily: 'Inter_600SemiBold', fontVariant: ['tabular-nums'], letterSpacing: 0.4 },
  well: { width: 34, height: 34, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, lineHeight: 20, fontFamily: 'Inter_600SemiBold' },
  rowDesc: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular', marginTop: 1 },
});
