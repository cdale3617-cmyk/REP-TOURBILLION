import React, { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText as Text } from '@/components/AppText';
import { useColors } from '@/hooks/useColors';

export function useDeviceMetrics() {
  const { width, height } = useWindowDimensions();
  return { width, height, compact: height < 700, wide: width >= 768 && height >= 600 };
}

type Props = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Feather.glyphMap;
  defaultOpen?: boolean;
  testID?: string;
  children: ReactNode;
};

/** Labelled one-tap panel. Children stay mounted when collapsed so their state and data survive. */
export function ExpandablePanel({ title, subtitle, icon, defaultOpen = false, testID, children }: Props) {
  const colors = useColors();
  const { wide } = useDeviceMetrics();
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = open || wide;
  return (
    <View style={[styles.wrap, { borderColor: colors.rim, backgroundColor: colors.card }]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={`${title}${subtitle ? `. ${subtitle}` : ''}`}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [styles.head, { opacity: pressed ? 0.75 : 1 }]}
      >
        {icon ? <View style={[styles.well, { borderColor: colors.border, backgroundColor: colors.muted }]}><Feather name={icon} size={16} color={colors.primary} /></View> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          {subtitle ? <Text numberOfLines={1} style={[styles.sub, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
        </View>
        {wide ? null : <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />}
      </Pressable>
      <View style={[styles.body, { display: isOpen ? 'flex' : 'none' }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },
  head: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  well: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, letterSpacing: 0.3, lineHeight: 20, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium' },
  body: { paddingHorizontal: 8, paddingBottom: 8, gap: 8 },
});
