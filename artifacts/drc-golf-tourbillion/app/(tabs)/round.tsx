import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActionButton, Card, EmptyNote, Page, PageHeading, Pill, SectionTitle } from '@/components/Primitives';
import { HoleMap } from '@/components/HoleMap';
import { CaddieAssistant } from '@/components/CaddieAssistant';
import { DailyPinCapture } from '@/components/DailyPinCapture';
import { WeatherCard } from '@/components/WeatherCard';
import { useGolf } from '@/context/GolfContext';
import { useColors } from '@/hooks/useColors';
import { useDevicePosition } from '@/hooks/useDevicePosition';
import { getCourseGeometry, getTargetDistance, isDailyPinCurrent } from '@/utils/courseGeometry';
import { getHoleMapLayout } from '@/utils/holeMapLayout';
import { WindReading } from '@/utils/wind';
import { HolePerformanceEditor } from '@/components/HolePerformanceEditor';
import { AntiGlareButton } from '@/components/AntiGlareButton';
import { AppText as Text } from '@/components/AppText';

export default function RoundScreen() {
  const colors = useColors();
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const holeMapLayout = getHoleMapLayout(windowWidth, windowHeight);
  const [windState, setWindState] = useState<{ courseId: string; reading: WindReading } | null>(null);
  const [statsDirty, setStatsDirty] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { courses, activeRound, lastCourseId, startRound, setCurrentHole, setHoleScore, finishRound, unit, rounds, dailyPins, removeDailyPin, bag, isReady, storageError } = useGolf();
  const { gps, error: gpsError, now, enabled, setEnabled, retry, locating } = useDevicePosition();
  useFocusEffect(useCallback(() => () => setEnabled(false), [setEnabled]));
  const course = courses.find((item) => item.id === (activeRound?.courseId ?? lastCourseId));
  const handleWindChange = useCallback((reading: WindReading | null) => {
    if (!course || !reading) {
      setWindState(null);
      return;
    }
    setWindState({ courseId: course.id, reading });
  }, [course?.id]);
  const currentWind = windState !== null && windState.courseId === course?.id ? windState.reading : null;
  const hole = activeRound?.holes.find((item) => item.hole === activeRound.currentHole);
  const score = hole?.score ?? 0;
  const minimumScore = Math.max(1, (hole?.putts ?? 0) + (hole?.penalties ?? 0));
  const played = activeRound?.holes.filter((item) => item.score !== null).length ?? 0;
  const total = useMemo(() => activeRound?.holes.reduce((sum, item) => sum + (item.score ?? 0), 0) ?? 0, [activeRound]);
  const relative = score && hole ? score - hole.par : null;
  const geometry = getCourseGeometry(course?.id);
  const holeGeometry = geometry?.holes.find((item) => item.hole === (activeRound?.currentHole ?? 1));
  const { meters: gpsDistance, reason: distanceStatus } = getTargetDistance(gps, holeGeometry?.target, now);
  const displayDistance = gpsDistance === null ? null : Math.round(unit === 'yd' ? gpsDistance * 1.09361 : gpsDistance);
  const recordedPin = dailyPins.find((pin) => pin.courseId === course?.id && pin.hole === activeRound?.currentHole);
  const dailyPin = recordedPin && isDailyPinCurrent(recordedPin, now) ? recordedPin : undefined;
  const pinDistance = getTargetDistance(gps, dailyPin, now);
  const displayPinDistance = pinDistance.meters === null ? null : Math.round(unit === 'yd' ? pinDistance.meters * 1.09361 : pinDistance.meters);

  function begin() {
    startRound(lastCourseId);
  }

  return (
    <Page>
      <PageHeading title={activeRound ? `Hole ${activeRound.currentHole} · Par ${hole?.par ?? '—'}` : 'ROUND'} subtitle={course?.name ?? 'Choose a course to get started'} right={<Pill tone="green">{played}/18</Pill>} />
      {!activeRound ? (
          <Card style={styles.emptyCard}>
           <Text style={[styles.courseName, { color: colors.foreground }]}>Hole 1{holeGeometry ? ` · Par ${holeGeometry.par}` : ''}</Text>
           <HoleMap geometry={holeGeometry} />
          <View style={styles.emptyCopy}>
             <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>Start to keep score and use live GPS. The map shows the sourced playing path, not a satellite image.</Text>
          </View>
          <View style={[styles.courseReadiness, { borderTopColor: colors.border }]}>
            <Text style={[styles.bodySmall, { color: colors.primary }]}>{course?.name ?? 'COURSE NOT SELECTED'}</Text>
            <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>{geometry ? '18 source-checked hole paths available' : 'GPS distances unavailable for this course'}</Text>
          </View>
           <ActionButton title="Start round · hole 1" icon="play" onPress={begin} disabled={!course || !isReady || !!storageError} testID="start-round" />
           <ActionButton title="Choose another course" icon="map-pin" secondary onPress={() => router.push('/tool/course-library')} testID="round-choose-course" />
          <ActionButton title="Round Performance Coach" icon="trending-up" secondary onPress={() => router.push('/tool/score-comparison')} testID="open-round-coach" />
          {rounds.length > 0 ? <Text style={[styles.lastRound, { color: colors.mutedForeground }]}>Last saved card · {rounds[0].holes.filter((item) => item.score !== null).length} holes recorded</Text> : null}
        </Card>
      ) : (
        <>
          <Card style={styles.roundCard}>
            <View style={styles.courseRow}>
              <View style={{ flex: 1 }}>
                 <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>GREEN REFERENCE · NORTH UP</Text>
              </View>
              {holeMapLayout.sideBySide ? (
                <View style={styles.compactHoleNav}>
                  <Pressable testID="split-previous-hole" accessibilityRole="button" accessibilityLabel="Previous hole" disabled={statsDirty || activeRound.currentHole <= 1} onPress={() => setCurrentHole(activeRound.currentHole - 1)} style={[styles.holeNavButton, { borderColor: colors.border, opacity: statsDirty || activeRound.currentHole <= 1 ? 0.4 : 1 }]}><Feather name="chevron-left" size={18} color={colors.foreground} /></Pressable>
                  <Pressable testID="split-next-hole" accessibilityRole="button" accessibilityLabel="Next hole" disabled={statsDirty || activeRound.currentHole >= 18} onPress={() => setCurrentHole(activeRound.currentHole + 1)} style={[styles.holeNavButton, { borderColor: colors.border, opacity: statsDirty || activeRound.currentHole >= 18 ? 0.4 : 1 }]}><Feather name="chevron-right" size={18} color={colors.foreground} /></Pressable>
                </View>
              ) : null}
            </View>
            {holeMapLayout.sideBySide ? (
              <View style={styles.splitHoleRow}>
                <View style={styles.splitHoleMap}>
                  <HoleMap geometry={holeGeometry} position={gpsDistance !== null ? gps : null} dailyPin={dailyPin} wind={currentWind} />
                </View>
                <View style={styles.splitHoleDistance}>
                  <View>
                    <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>GREEN REFERENCE DISTANCE</Text>
                    <Text style={[styles.distance, { color: colors.foreground }]}>{displayDistance !== null ? `${displayDistance}` : '—'}<Text style={[styles.unit, { color: colors.mutedForeground }]}> {unit}</Text></Text>
                  </View>
                  <Pill tone={gpsDistance !== null ? 'green' : 'muted'}>{gpsDistance !== null ? 'GPS ACTIVE' : locating ? 'FINDING GPS' : 'NO DISTANCE'}</Pill>
                  <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>{distanceStatus}</Text>
                  <ActionButton title={enabled ? 'Stop GPS' : 'Enable live GPS distance'} icon="crosshair" onPress={() => setEnabled(!enabled)} disabled={!holeGeometry} testID="enable-gps" />
                  <View style={[styles.splitAdvice, { borderTopColor: colors.border }]}>
                    <View style={styles.adviceHead}><Feather name="compass" size={16} color={colors.primary} /><Text style={[styles.adviceLabel, { color: colors.primary }]}>CADDIE ENGINE</Text></View>
                    <CaddieAssistant clubs={bag} unit={unit} currentHole={activeRound.currentHole} par={hole?.par} liveDistanceMeters={gpsDistance} wind={currentWind} />
                  </View>
                </View>
              </View>
            ) : (
              <>
                <HoleMap geometry={holeGeometry} position={gpsDistance !== null ? gps : null} dailyPin={dailyPin} wind={currentWind} />
                <View style={styles.mapFooter}>
                  <View>
                    <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>GREEN REFERENCE DISTANCE</Text>
                    <Text style={[styles.distance, { color: colors.foreground }]}>{displayDistance !== null ? `${displayDistance}` : '—'}<Text style={[styles.unit, { color: colors.mutedForeground }]}> {unit}</Text></Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 7 }}>
                    <Pill tone={gpsDistance !== null ? 'green' : 'muted'}>{gpsDistance !== null ? 'GPS ACTIVE' : locating ? 'FINDING GPS' : 'NO DISTANCE'}</Pill>
                  </View>
                </View>
                 <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>{distanceStatus}</Text>
                <ActionButton title={enabled ? 'Stop GPS' : 'Enable live GPS distance'} icon="crosshair" onPress={() => setEnabled(!enabled)} disabled={!holeGeometry} testID="enable-gps" />
              </>
            )}
             <Pressable testID="round-map-details-toggle" accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }} onPress={() => setDetailsOpen(v => !v)} style={styles.detailsToggle}>
               <Text style={[styles.bodySmall, { color: colors.primary }]}>Today’s pin & map details</Text>
               <Feather name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
             </Pressable>
             <View style={{ display: detailsOpen ? 'flex' : 'none', gap: 10 }}>
             {geometry && holeGeometry ? (
              <View style={{ gap: 8 }}>
                <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>SOURCE-CHECKED HOLE {activeRound.currentHole} · {geometry.holes.length}/18 MAPPED · CHECKED {geometry.checkedAt}</Text>
                <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://www.openstreetmap.org/way/${holeGeometry.osmWayId}`)}>
                  <Text style={[styles.bodySmall, { color: colors.primary }]}>View source hole on OpenStreetMap</Text>
                </Pressable>
                <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')}>
                  <Text style={[styles.bodySmall, { color: colors.primary }]}>© OpenStreetMap contributors · ODbL</Text>
                </Pressable>
              </View>
            ) : null}
            {gpsError && enabled ? <ActionButton title="Retry GPS" icon="refresh-cw" secondary onPress={retry} /> : null}
            {gps ? <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>GPS accuracy ±{gps.accuracy === null ? 'unknown' : Math.round(gps.accuracy)} m · fix age {Math.max(0, Math.floor((now - gps.timestamp) / 1000))}s</Text> : null}
            {gpsError ? (
              <View style={styles.permissionRow}>
                <Text style={[styles.bodySmall, { color: colors.destructive, flex: 1 }]}>{gpsError}</Text>
                {gpsError.includes('settings') && Platform.OS !== 'web' ? <Pressable onPress={() => void Linking.openSettings()}><Text style={[styles.bodySmall, { color: colors.primary }]}>Settings</Text></Pressable> : null}
              </View>
            ) : null}
            {locating ? <ActivityIndicator color={colors.primary} /> : null}
            <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 }}>
              <Text style={[styles.bodySmall, { color: colors.primary }]}>TODAY’S PIN · USER-RECORDED</Text>
              {dailyPin ? (
                <>
                  <Text style={[styles.distance, { color: colors.foreground }]}>{displayPinDistance ?? '—'}<Text style={[styles.unit, { color: colors.mutedForeground }]}> {unit}</Text></Text>
                  <Text style={[styles.body, { color: colors.mutedForeground }]}>{pinDistance.meters === null ? pinDistance.reason : 'Straight-line distance to your recorded flag position, not source-checked geometry.'}</Text>
                  <Text style={[styles.body, { color: colors.mutedForeground }]}>Hole {dailyPin.hole} · {dailyPin.date} · captured {new Date(dailyPin.capturedAt).toLocaleTimeString()} · accuracy ±{dailyPin.accuracy.toFixed(1)} m</Text>
                  <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>Your device GPS · you confirmed being beside the flag · expires at local midnight · not survey-grade</Text>
                  <ActionButton title="Remove today’s pin" icon="x" secondary onPress={() => removeDailyPin(dailyPin.courseId, dailyPin.hole)} testID="remove-daily-pin" />
                </>
              ) : (
                <Text style={[styles.body, { color: colors.mutedForeground }]}>{recordedPin ? 'The previous pin has expired and is not used for distance. Record the current flag placement again.' : 'No current pin recorded for this hole. Green-reference distance above remains the sourced target.'}</Text>
              )}
              {holeGeometry ? <DailyPinCapture key={`${activeRound.id}:${activeRound.currentHole}`} roundId={activeRound.id} courseId={activeRound.courseId} hole={activeRound.currentHole} target={holeGeometry.target} replacing={!!dailyPin} /> : <Text style={[styles.body, { color: colors.mutedForeground }]}>Pin capture requires a source-checked green reference for this hole.</Text>}
            </View>
             </View>
          </Card>

          {course ? <WeatherCard latitude={geometry?.latitude ?? course.latitude} longitude={geometry?.longitude ?? course.longitude} onWindChange={handleWindChange} /> : null}

          <SectionTitle>Score</SectionTitle>
          <Card style={styles.scoreCard}>
            <View style={styles.scoreSummary}>
              <View style={styles.scoreControl}>
                <Pressable testID="score-minus" accessibilityRole="button" accessibilityLabel="Subtract one stroke" disabled={!isReady || score <= minimumScore} onPress={() => setHoleScore(activeRound.currentHole, Math.max(1, (score || 1) - 1))} style={[styles.stepper, { borderColor: colors.border, opacity: score <= minimumScore ? 0.4 : 1 }]}><Feather name="minus" size={18} color={colors.foreground} /></Pressable>
                <View style={{ alignItems: 'center', minWidth: 68 }}>
                  <Text style={[styles.scoreNum, { color: colors.foreground }]}>{score || '—'}</Text>
                  <Text style={[styles.micro, { color: colors.mutedForeground }]}>{relative === null ? 'NOT SCORED' : relative === 0 ? 'EVEN' : `${relative > 0 ? '+' : ''}${relative} TO PAR`}</Text>
                </View>
                <Pressable testID="score-plus" accessibilityRole="button" accessibilityLabel="Add one stroke" disabled={!isReady || score >= 99} onPress={() => setHoleScore(activeRound.currentHole, score + 1)} style={[styles.stepper, { borderColor: colors.border }]}><Feather name="plus" size={18} color={colors.primary} /></Pressable>
              </View>
            </View>
            <View style={[styles.totalLine, { borderTopColor: colors.border }]}>
              <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>{played} HOLES RECORDED</Text>
              <Text style={[styles.total, { color: colors.foreground }]}>TOTAL <Text style={{ color: colors.primary }}>{total || '—'}</Text></Text>
            </View>
          </Card>
           {!holeMapLayout.sideBySide ? (
             <Card style={{ ...styles.adviceCard, borderLeftColor: colors.primary }}>
               <View style={styles.adviceHead}><Feather name="compass" size={16} color={colors.primary} /><Text style={[styles.adviceLabel, { color: colors.primary }]}>CADDIE ENGINE</Text></View>
               <CaddieAssistant clubs={bag} unit={unit} currentHole={activeRound.currentHole} par={hole?.par} liveDistanceMeters={gpsDistance} wind={currentWind} />
             </Card>
           ) : null}

          {hole ? <HolePerformanceEditor key={`${activeRound.id}:${hole.hole}`} roundId={activeRound.id} hole={hole} onDirtyChange={setStatsDirty} /> : null}
          {statsDirty ? <EmptyNote>Save statistics or discard your edits before changing holes or finishing the round.</EmptyNote> : null}
          {(hole?.putts ?? 0) + (hole?.penalties ?? 0) > 0 ? <EmptyNote>Total score cannot be reduced below the recorded putts plus penalties. Correct those statistics first if needed.</EmptyNote> : null}
          {!holeMapLayout.sideBySide ? <View style={styles.navRow}>
            <ActionButton title="Previous" icon="arrow-left" secondary disabled={statsDirty || activeRound.currentHole <= 1} onPress={() => setCurrentHole(activeRound.currentHole - 1)} testID="previous-hole" />
            <ActionButton title="Next hole" icon="arrow-right" onPress={() => setCurrentHole(activeRound.currentHole + 1)} disabled={statsDirty || activeRound.currentHole >= 18} testID="next-hole" />
          </View> : null}
          <ActionButton title="Save scorecard & finish round" icon="check" secondary disabled={statsDirty || !isReady || !!storageError} onPress={() => { setEnabled(false); finishRound(); router.push('/'); }} testID="finish-round" />
          <ActionButton title="Round Performance Coach" icon="trending-up" secondary onPress={() => router.push('/tool/score-comparison')} testID="open-round-coach" />
          <EmptyNote>Live distances require GPS accuracy within 30 m. Pin capture requires a new fix within 10 m accuracy and 60 m of this hole’s mapped green, plus your on-green confirmation. Recorded pins expire at local midnight and remain separate from sourced green references. Neither is survey-grade.</EmptyNote>
        </>
      )}
      <AntiGlareButton />
    </Page>
  );
}

const styles = StyleSheet.create({
  roundCard: { gap: 9, padding: 10 },
  detailsToggle: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compactHoleNav: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  holeNavButton: { width: 34, height: 34, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  splitHoleRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  splitHoleMap: { flex: 1, minWidth: 0 },
  splitHoleDistance: { flex: 1, minWidth: 0, justifyContent: 'space-between', gap: 8, paddingVertical: 5 },
  courseName: { fontSize: 17, lineHeight: 23, fontFamily: 'Inter_700Bold', flexShrink: 1, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 23, fontFamily: 'Inter_400Regular' },
  bodySmall: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_500Medium', letterSpacing: 0.2 },
  micro: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_400Regular' },
  mapFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center' },
  distance: { fontSize: 28, lineHeight: 34, fontFamily: 'Inter_700Bold', marginTop: 3, fontVariant: ['tabular-nums'], letterSpacing: -0.8 },
  unit: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  permissionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  adviceCard: { gap: 10, borderLeftWidth: 2 },
  splitAdvice: { gap: 8, borderTopWidth: 1, paddingTop: 12 },
  adviceHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  adviceLabel: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_700Bold', letterSpacing: 0.7 },
  scoreCard: { gap: 12 },
  scoreSummary: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  scoreControl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepper: { width: 46, height: 46, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 36, lineHeight: 43, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'], letterSpacing: -0.8 },
  totalLine: { borderTopWidth: 1, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  total: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, fontVariant: ['tabular-nums'] },
  navRow: { flexDirection: 'row', gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 7 },
  emptyCard: { gap: 12, padding: 14 },
  emptyIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emptyCopy: { gap: 3 },
  courseReadiness: { borderTopWidth: 1, paddingTop: 12, gap: 5 },
  lastRound: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_500Medium' },
});