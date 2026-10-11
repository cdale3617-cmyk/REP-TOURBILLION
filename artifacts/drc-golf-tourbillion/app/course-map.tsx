import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, Card, EmptyNote, Page, PageHeading, Pill } from '@/components/Primitives';
import { HoleMap } from '@/components/HoleMap';
import { AppText as Text } from '@/components/AppText';
import { Label } from '@/components/Instrument';
import { useGolf } from '@/context/GolfContext';
import { useColors } from '@/hooks/useColors';
import { useCourseMap } from '@/hooks/useCourseMap';
import { getRoundMapHeight } from '@/utils/roundViewport';
import { getHoleMapLayout } from '@/utils/holeMapLayout';
import { isCapricornBoundary, capricornChampionshipCourse } from '@/utils/capricornChampionship';
import { courseMapHref, resolveMapCourse } from '@/utils/courseMapNavigation';
import { useCourseWeather } from '@/hooks/useCourseWeather';
import { useLiveGps } from '@/context/LiveGpsContext';
import { getTargetDistance } from '@/utils/courseGeometry';

export default function CourseMapScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { courses, isReady } = useGolf();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const landscape = width >= 520 && height < 600 && width / height >= 1.18;
  const mapHeight = getRoundMapHeight(height, fontScale, insets.top, insets.bottom, Platform.OS === 'web', landscape);
  const layout = getHoleMapLayout(width, height);
  const course = useMemo(() => resolveMapCourse(params as Record<string, string | string[] | undefined>, courses), [params, courses]);
  const courseMap = useCourseMap(course);
  const geometry = courseMap.geometry;
  const weather = useCourseWeather(geometry?.latitude ?? course?.latitude, geometry?.longitude ?? course?.longitude);
  const { gps, now, enabled, setEnabled, error: gpsError } = useLiveGps();
  const holes = useMemo(() => [...(geometry?.holes ?? [])].sort((a, b) => a.hole - b.hole), [geometry]);
  const [picked, setPicked] = useState<{ courseId: string; hole: number } | null>(null);
  const pickedIndex = course && picked?.courseId === course.id ? holes.findIndex((h) => h.hole === picked.hole) : -1;
  const index = pickedIndex >= 0 ? pickedIndex : 0;
  const current = holes[index];
  const distance = getTargetDistance(gps, current?.target, now);
  const wind = weather.isError ? null : weather.data ?? null;
  const position = distance.meters !== null ? gps : null;
  const go = (next: number) => { if (course && holes[next]) setPicked({ courseId: course.id, hole: holes[next].hole }); };
  const hasData = !!(courseMap.map || holes.length || geometry?.features?.length);

  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/tool/course-library'); };
  const backButton = <ActionButton secondary icon="arrow-left" title="Back" testID="course-map-back" onPress={back} />;

  if (!isReady) return <Page><ActivityIndicator color={colors.primary} /></Page>;
  if (!course) {
    return (
      <Page>
        <PageHeading title="COURSE MAP" subtitle="Course not found" />
        <Card>
          <EmptyNote>This course link is missing or not recognised. Nothing was changed. Pick a course from the library to view its holes.</EmptyNote>
          {backButton}
        </Card>
      </Page>
    );
  }

  const controls = (
    <View style={{ gap: 9 }}>
      <View style={styles.row}>
        <View style={styles.cell}><ActionButton secondary icon="chevron-left" title="Previous" testID="course-map-previous" disabled={!current || index <= 0} onPress={() => go(index - 1)} /></View>
        <View style={styles.cell}><ActionButton secondary icon="chevron-right" title="Next" testID="course-map-next" disabled={!current || index >= holes.length - 1} onPress={() => go(index + 1)} /></View>
      </View>
      <ActionButton secondary icon="navigation" title={enabled ? 'Stop live GPS' : 'Enable live GPS'} testID="course-map-gps" onPress={() => setEnabled(!enabled)} />
      {distance.meters === null ? <Text style={[styles.small, { color: colors.mutedForeground }]}>{gpsError || distance.reason}</Text> : null}
      {!wind ? <Text style={[styles.small, { color: colors.mutedForeground }]}>{weather.isError ? 'Wind unavailable. No direction is assumed.' : 'Loading course-area wind…'}</Text> : null}
      <ActionButton icon="download" secondary testID="course-map-load" disabled={courseMap.busy}
        title={courseMap.busy ? 'Loading free course map…' : hasData ? 'Refresh free course map' : 'Load free course map'}
        onPress={() => void courseMap.load()} />
      {courseMap.busy ? <ActivityIndicator color={colors.primary} /> : null}
      {courseMap.error ? <Text accessibilityRole="alert" style={[styles.small, { color: colors.destructive }]}>{courseMap.error}</Text> : null}
      {isCapricornBoundary(course) ? <>
        <Text style={[styles.small, { color: colors.mutedForeground }]}>This club boundary contains two layouts. Viewing is read-only; your rounds and pins are not changed.</Text>
        <ActionButton icon="flag" testID="course-map-championship" title="View Championship holes" onPress={() => router.replace(courseMapHref(capricornChampionshipCourse))} />
      </> : null}
      {courseMap.map && geometry && !geometry.holes.length ? <Text style={[styles.small, { color: colors.mutedForeground }]}>Mapped surface outlines exist, but no unambiguous numbered hole paths were found. No hole is chosen by guesswork.</Text> : null}
      <Text style={[styles.small, { color: colors.mutedForeground }]}>{geometry
        ? `${geometry.source} · ${holes.length} numbered paths · ${geometry.features?.length ?? 0} mapped surfaces · data ${geometry.checkedAt.slice(0, 10)}${courseMap.map ? courseMap.cached ? ' · saved offline' : ' · not saved offline' : ''}. Not satellite imagery; missing features remain unknown. Refresh needs internet.`
        : 'No map loaded yet. Download real OpenStreetMap layouts where available; coverage varies and nothing is invented.'}</Text>
    </View>
  );

  return (
    <Page>
      <PageHeading eyebrow="Course map" title={course.name} subtitle="Read-only hole viewer, independent of any round."
        right={<Pill tone="muted">{holes.length ? `${holes.length} mapped` : 'Unmapped'}</Pill>} />
      <Card style={{ gap: 9, padding: 10 }}>
        <View style={styles.row}>
          <Label tone="primary">{current ? `Hole ${current.hole}` : 'No mapped hole'}</Label>
          <View style={{ flex: 1 }} />
          <Label>{current ? (current.par ? `Par ${current.par}` : 'Par unknown') : 'Tee to target'}</Label>
        </View>
        {current ? <Text testID="course-map-current-hole" accessibilityLabel={`Current hole ${current.hole}`} style={[styles.small, { color: colors.mutedForeground }]}>
          Current hole: {current.hole} · {index + 1} of {holes.length} mapped</Text> : null}
        {layout.sideBySide ? (
          <View style={styles.split}>
            <View style={{ flex: 1, minWidth: 0 }}><HoleMap geometry={current} features={geometry?.features} availableHeight={mapHeight} position={position} wind={wind} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>{controls}</View>
          </View>
        ) : <>
          <HoleMap geometry={current} features={geometry?.features} availableHeight={mapHeight} position={position} wind={wind} />
          {controls}
        </>}
      </Card>
      {backButton}
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cell: { flex: 1, minWidth: 0 },
  split: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  small: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_500Medium', letterSpacing: 0.2 },
});
