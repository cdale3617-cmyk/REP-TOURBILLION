import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Page, PageHeading, Pill } from '@/components/Primitives';
import { ExpandablePanel, useDeviceMetrics } from '@/components/ExpandablePanel';
import { labTools } from '@/data/catalog';
import { useColors } from '@/hooks/useColors';
import { useGolf } from '@/context/GolfContext';

const sections: { title: string; icon: keyof typeof Feather.glyphMap; slugs: string[] }[] = [
  { title: 'Measure', icon: 'activity', slugs: ['swing-monitor', 'shot-tracer', 'shot-pattern', 'wedge-matrix'] },
  { title: 'Practice', icon: 'target', slugs: ['putting-practice', 'short-game', 'greenside-chipping', 'green-reading'] },
  { title: 'Review', icon: 'bar-chart-2', slugs: ['score-comparison', 'round-overview', 'round-history'] },
  { title: 'Prepare', icon: 'clipboard', slugs: ['pre-round', 'club-equipment', 'biometrics'] },
];

export default function LabScreen() {
  const colors = useColors();
  const router = useRouter();
  const { activities } = useGolf();
  const { wide, compact } = useDeviceMetrics();
  return (
    <Page>
      <PageHeading title="LAB" subtitle={compact ? undefined : 'Enter monitor or coach readings. Camera video is not a measurement source.'} right={<Pill tone="green">{activities.length} LOGS</Pill>} />
      <View style={wide ? styles.grid : styles.stack}>
        {sections.map((section, si) => {
          const items = section.slugs.map((slug) => labTools.find((tool) => tool.slug === slug)).filter((tool): tool is (typeof labTools)[number] => !!tool);
          return (
            <View key={section.title} style={wide ? styles.col : undefined}>
              <ExpandablePanel testID={`lab-group-${section.title.toLowerCase()}`} title={section.title} icon={section.icon} subtitle={`${items.length} tools`}>
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
              </ExpandablePanel>
            </View>
          );
        })}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  col: { flexBasis: '48%', flexGrow: 1 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, paddingVertical: 8 },
  toolIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  toolTitle: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_700Bold' },
  toolDescription: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular', marginTop: 3, flexShrink: 1 },
});
