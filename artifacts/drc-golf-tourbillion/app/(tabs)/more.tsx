import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card, Page, PageHeading, Pill } from '@/components/Primitives';
import { moreTools } from '@/data/catalog';
import { useColors } from '@/hooks/useColors';

export default function MoreScreen() {
  const colors = useColors();
  const router = useRouter();
  return (
    <Page>
      <PageHeading eyebrow="Your game" title="MORE" subtitle="Round tools, course details, and personal records." />
      {moreTools.map((tool) => (
        <Pressable key={tool.slug} testID={`more-${tool.slug}`} accessibilityRole="button" onPress={() => router.push(`/tool/${tool.slug}`)} style={({ pressed }) => [styles.wrap, { opacity: pressed ? 0.72 : 1 }]}>
          <Card style={styles.row}>
            <Feather name={tool.icon as keyof typeof Feather.glyphMap} size={18} color={colors.primary} />
            <Text style={[styles.title, { color: colors.foreground }]}>{tool.title}</Text>
            {tool.slug === 'settings' ? <Pill tone="muted">DEVICE</Pill> : null}
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </Card>
        </Pressable>
      ))}
      <Text style={[styles.privacy, { color: colors.mutedForeground }]}>Round scores, club setup, and practice logs stay on this device.</Text>
    </Page>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  title: { flex: 1, fontSize: 16, lineHeight: 22, fontFamily: 'Inter_600SemiBold' },
  privacy: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', marginTop: 2 },
});