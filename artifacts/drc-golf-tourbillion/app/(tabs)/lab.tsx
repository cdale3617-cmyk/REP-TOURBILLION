import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Page, PageHeading, Pill } from '@/components/Primitives';
import { ToolGroup, ToolRow } from '@/components/Instrument';
import { useDeviceMetrics } from '@/components/ExpandablePanel';
import { labTools } from '@/data/catalog';
import { useGolf } from '@/context/GolfContext';
import { useColors } from '@/hooks/useColors';

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
      <PageHeading eyebrow="Practice & analysis" title="LAB" subtitle={compact ? undefined : 'Enter monitor or coach readings. Camera video is not a measurement source.'} right={<Pill tone="muted">{activities.length} LOGS</Pill>} />
      <View testID="lab-group-training" style={[styles.feature, { borderColor: colors.rim, backgroundColor: colors.card }]}>
        <ToolRow first testID="lab-tool-training-plan" icon="calendar" title="Personalised Training" description="Weekly plan, drills and logged sessions." onPress={() => router.push('/tool/training-plan')} trailing={<Pill tone="gold">NEW</Pill>} />
      </View>
      <View style={wide ? styles.grid : styles.stack}>
        {sections.map((section) => {
          const items = section.slugs.map((slug) => labTools.find((tool) => tool.slug === slug)).filter((tool): tool is (typeof labTools)[number] => !!tool);
          return (
            <View key={section.title} style={wide ? styles.col : undefined}>
              <ToolGroup testID={`lab-group-${section.title.toLowerCase()}`} title={section.title} icon={section.icon} count={`${items.length} tools`}>
                {items.map((tool, index) => (
                  <ToolRow key={tool.slug} first={index === 0} index={index + 1} testID={`lab-tool-${tool.slug}`} icon={tool.icon as keyof typeof Feather.glyphMap} title={tool.title} description={tool.description} accessibilityLabel={`${tool.title}. ${tool.description}`} onPress={() => router.push(`/tool/${tool.slug}`)} />
                ))}
              </ToolGroup>
            </View>
          );
        })}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  feature: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  stack: { gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' },
  col: { flexBasis: '48%', flexGrow: 1 },
});
