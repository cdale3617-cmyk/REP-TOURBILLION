import React from 'react';
import { Pressable, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { Feather } from '@expo/vector-icons';
import { useAppearance } from '@/context/AppearanceContext';
import { useColors } from '@/hooks/useColors';

export function AntiGlareButton() {
  const colors = useColors();
  const { antiGlare, ready, saving, error, toggleAntiGlare } = useAppearance();
  return (
    <View style={{ gap: 7 }}>
      <Pressable
        testID="anti-glare-toggle"
        accessibilityRole="switch"
        accessibilityLabel="Anti-glare"
        accessibilityState={{ checked: antiGlare, disabled: !ready || saving }}
        disabled={!ready || saving}
        onPress={() => { void toggleAntiGlare(); }}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, backgroundColor: colors.muted, opacity: ready && !saving ? 1 : 0.5 }}
      >
        <Feather name={antiGlare ? 'moon' : 'sun'} size={17} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 19, fontFamily: 'Inter_600SemiBold' }}>Anti-glare: {antiGlare ? 'ON' : 'OFF'}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11, lineHeight: 15, fontFamily: 'Inter_500Medium', letterSpacing: 0.4 }}>White text on black display mode</Text>
        </View>
        <View style={{ width: 40, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.rim, backgroundColor: antiGlare ? colors.primary : 'transparent', padding: 2, alignItems: antiGlare ? 'flex-end' : 'flex-start' }}>
          <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: antiGlare ? colors.background : colors.mutedForeground }} />
        </View>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.foreground, fontSize: 13, lineHeight: 19 }}>{error}</Text> : null}
    </View>
  );
}
