import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function NativeTabLayout() {
  const colors = useColors();
  return (
    <NativeTabs backgroundColor={colors.card} tintColor={colors.primary} iconColor={colors.mutedForeground} labelStyle={{ color: colors.foreground }}>
      <NativeTabs.Trigger name="index"><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} /><NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="round"><NativeTabs.Trigger.Icon sf={{ default: 'flag', selected: 'flag.fill' }} /><NativeTabs.Trigger.Label>Round</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="bag"><NativeTabs.Trigger.Icon sf={{ default: 'bag', selected: 'bag.fill' }} /><NativeTabs.Trigger.Label>Bag</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="lab"><NativeTabs.Trigger.Icon sf={{ default: 'flask', selected: 'flask.fill' }} /><NativeTabs.Trigger.Label>Lab</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="more"><NativeTabs.Trigger.Icon sf={{ default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' }} /><NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const screens: { name: string; title: string; icon: keyof typeof Feather.glyphMap; symbol: string }[] = [
    { name: 'index', title: 'HOME', icon: 'home', symbol: 'house' },
    { name: 'round', title: 'ROUND', icon: 'flag', symbol: 'flag' },
    { name: 'bag', title: 'BAG', icon: 'briefcase', symbol: 'bag' },
    { name: 'lab', title: 'LAB', icon: 'activity', symbol: 'flask' },
    { name: 'more', title: 'MORE', icon: 'grid', symbol: 'ellipsis.circle' },
  ];
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.mutedForeground,
      tabBarLabelStyle: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, marginTop: 3 },
      tabBarStyle: {
        position: 'absolute',
        backgroundColor: isIOS ? 'transparent' : colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.rim,
        elevation: 0,
        height: isWeb ? 84 : 70 + insets.bottom,
        paddingBottom: isWeb ? 8 : Math.max(insets.bottom, 5),
        paddingTop: 5,
      },
      tabBarBackground: () => isIOS
        ? <BlurView intensity={92} tint="dark" style={StyleSheet.absoluteFill} />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />,
    }}>
      {screens.map((screen) => <Tabs.Screen key={screen.name} name={screen.name} options={{
        title: screen.title,
        tabBarIcon: ({ color }) => isIOS ? <SymbolView name={screen.symbol as 'house'} tintColor={color} size={22} /> : <Feather name={screen.icon} size={21} color={color} />,
      }} />)}
    </Tabs>
  );
}

export default function TabLayout() {
  return isLiquidGlassAvailable() ? <NativeTabLayout /> : <ClassicTabLayout />;
}