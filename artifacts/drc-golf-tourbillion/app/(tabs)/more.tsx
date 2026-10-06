import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { Page, PageHeading, Pill } from '@/components/Primitives';
import { ToolGroup, ToolRow } from '@/components/Instrument';
import { useDeviceMetrics } from '@/components/ExpandablePanel';
import { moreTools } from '@/data/catalog';
import appConfig from '../../app.json';

const groups: { title: string; icon: keyof typeof Feather.glyphMap; slugs: string[] }[] = [
  { title: 'Round', icon: 'flag', slugs: ['round-overview', 'pre-round', 'round-history', 'scorecard', 'strokes-gained', 'fusion'] },
  { title: 'Courses & equipment', icon: 'map', slugs: ['course-library', 'course-information', 'club-equipment'] },
  { title: 'Records & help', icon: 'book-open', slugs: ['records', 'how-to'] },
  { title: 'Device', icon: 'settings', slugs: ['settings'] },
];

export default function MoreScreen() {
  const colors = useColors();
  const router = useRouter();
  const { wide, compact } = useDeviceMetrics();
  const used = new Set(groups.flatMap((g) => g.slugs));
  const all = groups.map((g) => ({ title: g.title, icon: g.icon, tools: g.slugs.map((s) => moreTools.find((t) => t.slug === s)).filter((t): t is (typeof moreTools)[number] => !!t) }));
  const rest = moreTools.filter((t) => !used.has(t.slug));
  if (rest.length) all.push({ title: 'Other', icon: 'grid', tools: rest });
  return (
    <Page>
      <PageHeading eyebrow="Courses, health & history" title="MORE" subtitle={compact ? undefined : 'Round tools, course details, and records.'} />
      <View style={wide ? styles.grid : styles.stack}>
        {all.filter((g) => g.tools.length).map((g, gi) => (
          <View key={g.title} style={wide ? styles.col : undefined}>
            <ToolGroup testID={`more-group-${gi}`} title={g.title} icon={g.icon} count={`${g.tools.length} ${g.tools.length === 1 ? 'tool' : 'tools'}`}>
              {g.tools.map((tool, i) => (
                <ToolRow key={tool.slug} first={i === 0} testID={`more-${tool.slug}`} icon={tool.icon as keyof typeof Feather.glyphMap} title={tool.title} onPress={() => router.push(`/tool/${tool.slug}`)} trailing={tool.slug === 'settings' ? <Pill tone="muted">DEVICE</Pill> : null} />
              ))}
            </ToolGroup>
          </View>
        ))}
      </View>
      <Text style={[styles.privacy, { color: colors.mutedForeground }]}>Round scores, club setup, and practice logs stay on this device.</Text>
      <Text testID="installed-build-version" style={[styles.privacy, { color: colors.mutedForeground }]}>DRC Golf Tempo · {appConfig.expo.version} · Android build {appConfig.expo.android.versionCode}</Text>
    </Page>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' },
  col: { flexBasis: '48%', flexGrow: 1 },
  privacy: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: 2 },
});
