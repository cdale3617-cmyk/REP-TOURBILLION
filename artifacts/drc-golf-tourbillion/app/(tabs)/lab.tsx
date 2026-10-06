import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card, Page, PageHeading, Pill } from '@/components/Primitives';
import { labTools } from '@/data/catalog';
import { useColors } from '@/hooks/useColors';
import { useGolf } from '@/context/GolfContext';

const sections = [
  { title: 'Measure', slugs: ['swing-monitor', 'shot-tracer', 'shot-pattern', 'wedge-matrix'] },
  { title: 'Practice', slugs: ['putting-practice', 'short-game', 'greenside-chipping', 'green-reading'] },
  { title: 'Review', slugs: ['score-comparison', 'round-overview', 'round-history'] },
  { title: 'Prepare', slugs: ['pre-round', 'club-equipment', 'biometrics'] },
];

export default function LabScreen() {
  const colors = useColors();
  const router = useRouter();
  const { activities } = useGolf();
  return (
    <Page>
      <PageHeading eyebrow="Golf Lab" title="LAB" subtitle="Flight readings, impact analysis, shot dispersion, and focused practice." />
      <Card style={styles.hero}>
        <View style={[styles.heroOrb, { backgroundColor: colors.secondary }]}><Feather name="activity" size={22} color={colors.primary} /></View>
        <View style={{ flex: 1, minWidth: 180 }}>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>Build a better read on your game.</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>Enter launch-monitor or coach readings, review swing video, and keep practice logs together. Camera video is not a measurement source.</Text>
        </View>
        <Pill tone="green">{activities.length} LOGS</Pill>
      </Card>
      {sections.map((section) => {
        const items = section.slugs.map((slug) => labTools.find((tool) => tool.slug === slug)).filter((tool): tool is (typeof labTools)[number] => !!tool);
        return (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>{section.title.toUpperCase()}</Text>
            <Card style={styles.group}>
              {items.map((tool, index) => (
                <Pressable key={tool.slug} testID={`lab-tool-${tool.slug}`} accessibilityRole="button" accessibilityLabel={`${tool.title}. ${tool.description}`} onPress={() => router.push(`/tool/${tool.slug}`)} style={({ pressed }) => [styles.row, { borderTopColor: colors.border, borderTopWidth: index === 0 ? 0 : 1, opacity: pressed ? 0.7 : 1 }]}>
                  <View style={[styles.toolIcon, { backgroundColor: colors.secondary }]}>
                    <Feather name={tool.icon as keyof typeof Feather.glyphMap} size={17} color={colors.emerald} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.toolTitle, { color: colors.foreground }]}>{tool.title}</Text>
                    <Text numberOfLines={2} style={[styles.toolDescription, { color: colors.mutedForeground }]}>{tool.description}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </Card>
          </View>
        );
      })}
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: 12 },
  heroOrb: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 15, lineHeight: 20, fontFamily: 'Inter_700Bold' },
  heroSub: { fontSize: 13, lineHeight: 19, marginTop: 5, fontFamily: 'Inter_400Regular', flexShrink: 1 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_700Bold', letterSpacing: 1.1, paddingHorizontal: 2 },
  group: { padding: 4, gap: 0 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 8 },
  toolIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  toolTitle: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_700Bold' },
  toolDescription: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular', marginTop: 3, flexShrink: 1 },
});