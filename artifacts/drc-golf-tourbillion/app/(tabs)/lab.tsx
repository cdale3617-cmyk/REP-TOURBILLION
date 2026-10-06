import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card, Page, PageHeading, Pill } from '@/components/Primitives';
import { labTools } from '@/data/catalog';
import { useColors } from '@/hooks/useColors';
import { useGolf } from '@/context/GolfContext';

export default function LabScreen() {
  const colors = useColors();
  const router = useRouter();
  const { activities } = useGolf();
  return (
    <Page>
      <PageHeading eyebrow="Golf Lab" title="LAB" subtitle="Flight readings, impact analysis, shot dispersion, and focused practice." />
      <Card style={styles.hero}>
        <View style={[styles.heroOrb, { backgroundColor: colors.secondary }]}><Feather name="activity" size={22} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>Build a better read on your game.</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>Enter launch-monitor or coach readings, review swing video, and keep practice logs together. Camera video is not a measurement source.</Text>
        </View>
        <Pill tone="green">{activities.length} LOGS</Pill>
      </Card>
      {labTools.map((tool, index) => (
        <Pressable key={tool.slug} testID={`lab-tool-${tool.slug}`} accessibilityRole="button" onPress={() => router.push(`/tool/${tool.slug}`)} style={({ pressed }) => [styles.toolWrap, { opacity: pressed ? 0.72 : 1 }]}>
          <Card style={styles.toolCard}>
            <View style={[styles.toolIcon, { backgroundColor: colors.secondary }]}>
              <Feather name={tool.icon as keyof typeof Feather.glyphMap} size={17} color={colors.emerald} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toolTitle, { color: colors.foreground }]}>{tool.title}</Text>
              <Text style={[styles.toolDescription, { color: colors.mutedForeground }]}>{tool.description}</Text>
            </View>
            <Text style={[styles.number, { color: colors.mutedForeground }]}>{String(index + 1).padStart(2, '0')}</Text>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </Card>
        </Pressable>
      ))}
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  heroOrb: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter_700Bold' },
  heroSub: { fontSize: 14, lineHeight: 20, marginTop: 5, fontFamily: 'Inter_400Regular', flexShrink: 1 },
  toolWrap: { width: '100%' },
  toolCard: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 },
  toolIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  toolTitle: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter_700Bold' },
  toolDescription: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', marginTop: 5, flexShrink: 1 },
  number: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_700Bold' },
});