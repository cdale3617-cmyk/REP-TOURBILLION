import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ActionButton, Card, EmptyNote, Pill, SectionTitle } from '@/components/Primitives';
import { GolfRound, useGolf } from '@/context/GolfContext';
import { useColors } from '@/hooks/useColors';
import { comparePerformanceRounds, sortPerformanceRounds, summarizeRoundPerformance } from '@/utils/roundPerformance';

const TOOL_LABELS: Record<string, string> = {
  'shot-pattern': 'Shot Pattern',
  'putting-practice': 'Putting Practice',
  'wedge-matrix': 'Wedge Matrix',
};

function pct(part: number, whole: number): string {
  return whole ? `${Math.round((part / whole) * 100)}%` : 'Unknown';
}

export function RoundPerformanceCoach() {
  const colors = useColors();
  const router = useRouter();
  const { rounds, courses } = useGolf();
  const [courseId, setCourseId] = useState<string | null>(null);

  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? 'Unknown course';
  const usedCourseIds = useMemo(() => Array.from(new Set(rounds.map((r) => r.courseId))), [rounds]);
  useEffect(() => {
    if (courseId && !usedCourseIds.includes(courseId)) setCourseId(null);
  }, [courseId, usedCourseIds]);
  const filtered = useMemo(() => sortPerformanceRounds(courseId ? rounds.filter((r) => r.courseId === courseId) : rounds), [rounds, courseId]);
  const summary = useMemo(() => summarizeRoundPerformance(filtered), [filtered]);
  const comparison = useMemo(() => comparePerformanceRounds(filtered), [filtered]);
  const recent = filtered.filter((r) => r.holes.some((h) => h.score !== null)).slice(0, 5);

  const muted = { color: colors.mutedForeground, fontSize: 14, lineHeight: 21 } as const;

  if (!rounds.length) {
    return (
      <Card>
        <SectionTitle>Round performance</SectionTitle>
        <EmptyNote>No saved rounds yet. Finish a round and add hole statistics to see tracked putting, penalties, fairways and greens here.</EmptyNote>
        <ActionButton testID="coach-open-round" title="Open Round" icon="flag" onPress={() => router.push('/round' as never)} />
      </Card>
    );
  }

  const metrics: { key: string; label: string; value: string; detail: string }[] = [
    { key: 'putts', label: 'Putting', value: summary.averagePutts === null ? 'Unknown' : `${summary.averagePutts.toFixed(2)} per hole`, detail: `${summary.puttsRecorded} of ${summary.scoredHoles} scored holes tracked. Three-putt or worse: ${summary.threePuttHoles}.` },
    { key: 'penalties', label: 'Penalty strokes', value: summary.penaltiesRecorded ? String(summary.totalPenalties) : 'Unknown', detail: `${summary.penaltiesRecorded} of ${summary.scoredHoles} scored holes tracked. Already included in scores.` },
    { key: 'fairways', label: 'Fairways hit', value: summary.fairwaysRecorded ? `${summary.fairwaysHit} of ${summary.fairwaysRecorded} (${pct(summary.fairwaysHit, summary.fairwaysRecorded)})` : 'Unknown', detail: `${summary.fairwaysRecorded} of ${summary.fairwayEligible} eligible holes tracked (par 4 and above).` },
    { key: 'greens', label: 'Greens in regulation', value: summary.greensRecorded ? `${summary.greensHit} of ${summary.greensRecorded} (${pct(summary.greensHit, summary.greensRecorded)})` : 'Unknown', detail: `${summary.greensRecorded} of ${summary.greenEligible} eligible holes tracked (par 3 and above).` },
  ];
  const toolLabel = summary.focus.tool ? TOOL_LABELS[summary.focus.tool] ?? 'Open practice tool' : null;

  return (
    <View style={{ gap: 16 }}>
      {usedCourseIds.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[null, ...usedCourseIds].map((id) => {
            const on = id === courseId;
            return (
              <Pressable key={id ?? 'all'} testID={`coach-course-${id ?? 'all'}`} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setCourseId(id)}
                style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, justifyContent: 'center', backgroundColor: on ? colors.primaryFill : colors.muted, borderColor: on ? colors.rim : colors.border }}>
                <Text style={{ color: on ? colors.primaryForeground : colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>{id ? courseName(id) : 'All courses'}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Card>
        <SectionTitle trailing={<Pill tone="muted">{`${summary.rounds} saved round${summary.rounds === 1 ? '' : 's'}`}</Pill>}>Tracked performance</SectionTitle>
        <Text style={muted}>Across all saved scorecards for this course filter; only scored holes are included.</Text>
        {metrics.map((m) => (
          <View key={m.key} testID={`coach-metric-${m.key}`} style={{ gap: 3 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.45, textTransform: 'uppercase' }}>{m.label}</Text>
            <Text style={{ color: colors.foreground, fontSize: 20, fontFamily: 'Georgia' }}>{m.value}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>{m.detail}</Text>
          </View>
        ))}
        <Text style={muted}>Blank statistics are unknown, never counted as zero.</Text>
      </Card>

      <Card>
        <SectionTitle>Practice focus</SectionTitle>
        <Text testID="coach-focus-title" style={{ color: colors.foreground, fontSize: 20, fontFamily: 'Georgia' }}>{summary.focus.title}</Text>
        <Text style={muted}>{summary.focus.reason}</Text>
        <Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 22 }}>{summary.focus.practice}</Text>
        {summary.focus.tool ? (
          <ActionButton testID="coach-focus-tool" title={`Open ${toolLabel}`} icon="target" secondary onPress={() => router.push({ pathname: '/tool/[slug]', params: { slug: summary.focus.tool as string } })} />
        ) : null}
        <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
          Simple rules need at least 3 tracked relevant holes. This is not a precise strokes-gained model, and it cannot tell why a green was missed.
        </Text>
      </Card>

      <Card>
        <SectionTitle>Trend</SectionTitle>
        {comparison ? (
          <View testID="coach-trend" style={{ gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 20, fontFamily: 'Georgia' }}>
              {comparison.scoreChange === 0 ? 'Same total as last time' : `${Math.abs(comparison.scoreChange)} stroke${Math.abs(comparison.scoreChange) === 1 ? '' : 's'} ${comparison.scoreChange > 0 ? 'worse' : 'better'}`}
            </Text>
            <Text style={muted}>Latest against the previous round at {courseName(comparison.latest.courseId)} over the same {comparison.holes} scored holes and pars.</Text>
            <Text style={muted}>Course conditions, tee changes and difficulty are not adjusted for.</Text>
          </View>
        ) : (
          <Text testID="coach-trend-none" style={muted}>No comparison yet. A fair trend needs two saved rounds on the same course with the same scored holes and pars. Totals across different holes or courses are never compared.</Text>
        )}
      </Card>

      <Card>
        <SectionTitle>Recent scorecards</SectionTitle>
        {recent.length ? recent.map((round: GolfRound) => {
          const s = summarizeRoundPerformance([round]);
          return (
            <Pressable key={round.id} testID={`coach-round-${round.id}`} accessibilityRole="link" onPress={() => router.push({ pathname: '/tool/[slug]', params: { slug: 'scorecard', roundId: round.id } })}
              style={{ minHeight: 56, paddingVertical: 8, gap: 2, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>{courseName(round.courseId)}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                {new Date(round.finishedAt ?? round.startedAt).toLocaleDateString()} · {s.scoredHoles} holes · {s.totalScore} strokes · {s.puttsRecorded} with putts tracked
              </Text>
              <Text style={{ color: colors.primary, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>Review and edit stats</Text>
            </Pressable>
          );
        }) : <EmptyNote>No saved rounds with scored holes for this filter.</EmptyNote>}
      </Card>
    </View>
  );
}
