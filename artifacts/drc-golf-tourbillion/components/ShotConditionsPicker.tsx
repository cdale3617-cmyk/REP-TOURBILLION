import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { useColors } from '@/hooks/useColors';
import { describeShotConditions, type ShotConditions } from '@/utils/shotConditions';

const groups = [
  { key: 'lie', label: 'Lie / shot situation', options: [['unknown', 'Unknown'], ['fairway', 'Fairway / tee'], ['rough', 'Rough / fringe'], ['bunker', 'Bunker'], ['trees', 'Tree recovery'], ['green', 'Putting']] },
  { key: 'surface', label: 'Comparable practice surface', options: [['unknown', 'Unknown'], ['grass', 'Grass'], ['mat', 'Mat']] },
  { key: 'wind', label: 'Wind relative to the shot', options: [['unknown', 'Unknown'], ['calm', 'Calm'], ['headwind', 'Into'], ['tailwind', 'Behind'], ['crosswind', 'Across']] },
] as const;

export function ShotConditionsPicker({ value, onChange, prefix, title, initiallyOpen = false }: {
  value: ShotConditions; onChange: (value: ShotConditions) => void; prefix: string; title: string; initiallyOpen?: boolean;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(initiallyOpen);
  return <View style={{ gap: 8 }}>
    <Pressable testID={`${prefix}-conditions-toggle`} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 14 }}>{open ? '−' : '+'} {title}</Text>
    </Pressable>
    <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>{describeShotConditions(value)}</Text>
    {open ? <>
      {groups.map(group => <View key={group.key} style={{ gap: 6 }}>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{group.label}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {group.options.map(([option, label]) => {
            const selected = (value[group.key] ?? 'unknown') === option;
            return <Pressable key={option} testID={`${prefix}-${group.key}-${option}`} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onChange({ ...value, [group.key]: option === 'unknown' ? null : option })} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primaryFill : colors.muted }}>
              <Text style={{ color: selected ? colors.primaryForeground : colors.foreground, fontSize: 13 }}>{label}</Text>
            </Pressable>;
          })}
        </View>
      </View>)}
      <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>Use only conditions you know. Requested conditions exclude unknown and different records. These tags are your observations, not measurements or automatic carry adjustments.</Text>
    </> : null}
  </View>;
}
