import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Page, PageHeading, Pill } from '@/components/Primitives';
import { ExpandablePanel, useDeviceMetrics } from '@/components/ExpandablePanel';
import { moreTools } from '@/data/catalog';
import { useColors } from '@/hooks/useColors';
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
      <PageHeading title="MORE" subtitle={compact ? undefined : 'Round tools, course details, and records.'} />
      <View style={wide ? styles.grid : styles.stack}>
        {all.filter((g) => g.tools.length).map((g, gi) => (
          <View key={g.title} style={wide ? styles.col : undefined}>
            <ExpandablePanel testID={`more-group-${gi}`} title={g.title} icon={g.icon} subtitle={`${g.tools.length} ${g.tools.length === 1 ? 'tool' : 'tools'}`}>
              {g.tools.map((tool, i) => (
                <Pressable key={tool.slug} testID={`more-${tool.slug}`} accessibilityRole="button" onPress={() => router.push(`/tool/${tool.slug}`)} style={({ pressed }) => [styles.row, { borderTopColor: colors.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, opacity: pressed ? 0.7 : 1 }]}>
                  <View style={[styles.icon, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Feather name={tool.icon as keyof typeof Feather.glyphMap} size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.title, { color: colors.foreground }]}>{tool.title}</Text>
                  {tool.slug === 'settings' ? <Pill tone="muted">DEVICE</Pill> : null}
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </ExpandablePanel>
          </View>
        ))}
      </View>
      <Text style={[styles.privacy, { color: colors.mutedForeground }]}>Round scores, club setup, and practice logs stay on this device.</Text>
      <Text testID="installed-build-version" style={[styles.privacy, { color: colors.mutedForeground }]}>DRC Golf Tempo · {appConfig.expo.version} · Android build {appConfig.expo.android.versionCode}</Text>
    </Page>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  col: { flexBasis: '48%', flexGrow: 1 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingVertical: 6 },
  icon: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 15, lineHeight: 21, fontFamily: 'Inter_600SemiBold' },
  privacy: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', marginTop: 2 },
});
