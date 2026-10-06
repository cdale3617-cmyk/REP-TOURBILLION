import React from 'react';
import { Pressable, Text, View } from 'react-native';
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
        style={{ minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderWidth: 1, borderColor: colors.rim, borderRadius: 12, backgroundColor: colors.secondary, opacity: ready && !saving ? 1 : 0.5 }}
      >
        <Feather name={antiGlare ? 'moon' : 'sun'} size={18} color={colors.foreground} />
        <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: 'Inter_700Bold' }}>Anti-glare: {antiGlare ? 'ON' : 'OFF'}</Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.foreground, fontSize: 13, lineHeight: 19 }}>{error}</Text> : null}
    </View>
  );
}
