import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActionButton, Card, EmptyNote, Page, PageHeading, Pill } from '@/components/Primitives';
import { HoleMap } from '@/components/HoleMap';
import { CaddieAssistant } from '@/components/CaddieAssistant';
import { DailyPinCapture } from '@/components/DailyPinCapture';
import { WeatherCard } from '@/components/WeatherCard';
import { useGolf } from '@/context/GolfContext';
import { useColors } from '@/hooks/useColors';
import { useLiveGps } from '@/context/LiveGpsContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getRoundMapHeight } from '@/utils/roundViewport';
import { RoundScoreControls } from '@/components/RoundScoreControls';
import { ExpandablePanel } from '@/components/ExpandablePanel';
import { getTargetDistance, isDailyPinCurrent } from '@/utils/courseGeometry';
import { useCourseMap } from '@/hooks/useCourseMap';
import { getHoleMapLayout } from '@/utils/holeMapLayout';
import { WindReading } from '@/utils/wind';
import { HolePerformanceEditor } from '@/components/HolePerformanceEditor';
import { AntiGlareButton } from '@/components/AntiGlareButton';
import { AppText as Text } from '@/components/AppText';
import { Label, StatusToggle } from '@/components/Instrument';

export default function RoundScreen() {
  const colors = useColors();
  const router = useRouter();
  const { width: windowWidth, height: windowHeight, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const landscape = windowWidth >= 520 && windowHeight < 600 && windowWidth / windowHeight >= 1.18;
  const mapHeight = getRoundMapHeight(windowHeight, fontScale, insets.top, insets.bottom, Platform.OS === 'web', landscape);
  const holeMapLayout = getHoleMapLayout(windowWidth, windowHeight);
  const [windState, setWindState] = useState<{ courseId: string; reading: WindReading } | null>(null);
  const [statsDirty, setStatsDirty] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { courses, activeRound, lastCourseId, startRound, setCurrentHole, setHoleScore, finishRound, unit, rounds, dailyPins, removeDailyPin, bag, isReady, storageError } = useGolf();
  const { gps, error: gpsError, now, enabled, setEnabled, retry, locating } = useLiveGps();
  const gpsButtonLabel = gpsError ? 'GPS error' : locating ? 'Finding GPS' : gps ? 'GPS live' : 'Live GPS';
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
   const courseMap = useCourseMap(course);
   const geometry = courseMap.geometry;
  const holeGeometry = geometry?.holes.find((item) => item.hole === (activeRound?.currentHole ?? 1));
   const targetLabel = holeGeometry?.targetKind === 'path-end' ? 'Mapped hole end' : 'Green reference';
  const { meters: gpsDistance, reason: distanceStatus } = getTargetDistance(gps, holeGeometry?.target, now);
  const displayDistance = gpsDistance === null ? null : Math.round(unit === 'yd' ? gpsDistance * 1.09361 : gpsDistance);
  const recordedPin = dailyPins.find((pin) => pin.courseId === course?.id && pin.hole === activeRound?.currentHole);
  const dailyPin = recordedPin && isDailyPinCurrent(recordedPin, now) ? recordedPin : undefined;
  const pinDistance = getTargetDistance(gps, dailyPin, now);
  const displayPinDistance = pinDistance.meters === null ? null : Math.round(unit === 'yd' ? pinDistance.meters * 1.09361 : pinDistance.meters);
  const mapActions = <View style={{ gap: 6, marginVertical: 6 }}>
    <ActionButton secondary icon="download" title={courseMap.busy ? 'Loading free course map…' : courseMap.map || geometry?.features?.length ? 'Refresh free course map' : 'Load free course map'}
      testID="load-course-map" disabled={!course || courseMap.busy} onPress={() => void courseMap.load()} />
    {courseMap.busy ? <ActivityIndicator color={colors.primary} /> : null}
    {courseMap.error ? <Text accessibilityRole="alert" style={[styles.bodySmall, { color: colors.destructive }]}>{courseMap.error}</Text> : null}
    {courseMap.map ? <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>{geometry?.holes.length ?? 0}/18 numbered paths · {geometry?.features?.length ?? 0} mapped surfaces · {courseMap.cached ? 'Saved offline' : 'Not saved offline'} · downloaded {courseMap.map.downloadedAt.slice(0, 10)}{courseMap.map.omitted ? ` · ${courseMap.map.omitted} unsupported or ambiguous features omitted` : ''}. Missing features remain unknown; maps may change. Refresh needs internet.</Text>
      : <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>{geometry?.features?.length ? `${geometry.holes.length} numbered paths and ${geometry.features.length} sourced surfaces ${geometry.source === 'OpenStreetMap · source-checked' ? 'bundled offline' : 'available in this session; offline cache unavailable'}. Data ${geometry.checkedAt.slice(0, 10)}. Refresh requires internet.` : 'Download real OpenStreetMap layouts where available. Course and hole coverage varies. No fairways or hazards are invented.'}</Text>}
  </View>;

  function begin() {
    startRound(lastCourseId);
  }

  return (
    <Page>
      <PageHeading title={activeRound ? `Hole ${activeRound.currentHole} · Par ${hole?.par ?? '—'}` : 'ROUND'} subtitle={landscape ? undefined : course?.name ?? 'Choose a course to get started'} eyebrow={course?.name && !landscape ? undefined : undefined} right={<Pill tone="muted">{played}/18 SCORED</Pill>} />
      {!activeRound ? (
          <Card style={styles.emptyCard}>
            <View style={styles.pair}><Label tone="primary">Hole 1{holeGeometry?.par ? ` · Par ${holeGeometry.par}` : ''}</Label><View style={{ flex: 1 }} /><Label>North up</Label></View>
            <HoleMap geometry={holeGeometry} features={geometry?.features} availableHeight={mapHeight} />
            {mapActions}
          <View style={styles.emptyCopy}>
             <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>Start to keep score and use live GPS. The map shows the sourced playing path, not a satellite image.</Text>
          </View>
          <View style={[styles.courseReadiness, { borderTopColor: colors.border }]}>
            <Text style={[styles.bodySmall, { color: colors.primary }]}>{course?.name ?? 'COURSE NOT SELECTED'}</Text>
             <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>{geometry ? `${geometry.holes.length}/18 numbered hole paths available · ${geometry.source}` : 'Load free mapped layouts below; some courses or holes are not mapped.'}</Text>
          </View>
           <ActionButton title="Start round · hole 1" icon="play" onPress={begin} disabled={!course || !isReady || !!storageError} testID="start-round" />
           <View style={styles.pair}>
             <View style={styles.pairCell}><StatusToggle testID="enable-gps" label={gpsButtonLabel} active={!!gps} requested={enabled} actionLabel={enabled ? 'Stop live GPS' : 'Enable live GPS'} onPress={() => setEnabled(!enabled)} /></View>
             <View style={styles.pairCell}><ActionButton title="Choose course" icon="map-pin" secondary onPress={() => router.push('/tool/course-library')} testID="round-choose-course" /></View>
           </View>
           {gps ? <Text style={[styles.bodySmall, { color: colors.primary }]}>Live position · {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)} · ±{gps.accuracy === null ? '?' : Math.round(gps.accuracy)} m</Text> : null}
           {locating ? <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>Finding GPS…</Text> : null}
           {gpsError ? <>
             <Text style={[styles.bodySmall, { color: colors.destructive }]}>{gpsError}</Text>
             <ActionButton title="Retry GPS" onPress={retry} secondary testID="retry-gps" />
             {gpsError.includes('settings') && Platform.OS !== 'web' ? <ActionButton title="Open location settings" onPress={() => void Linking.openSettings()} secondary testID="gps-settings" /> : null}
           </> : null}
           <ActionButton title="Round Performance Coach" icon="trending-up" secondary onPress={() => router.push('/tool/score-comparison')} testID="open-round-coach" />
          {rounds.length > 0 ? <Text style={[styles.lastRound, { color: colors.mutedForeground }]}>Last saved card · {rounds[0].holes.filter((item) => item.score !== null).length} holes recorded</Text> : null}
        </Card>
      ) : (
        <>
          <Card style={styles.roundCard}>
             {!landscape ? <View style={styles.courseRow}>
              <View style={{ flex: 1 }}>
                 <Label>{targetLabel} · north up</Label>
              </View>
             </View> : null}
            {holeMapLayout.sideBySide ? (
              <View style={styles.splitHoleRow}>
                <View style={styles.splitHoleMap}>
                   <HoleMap geometry={holeGeometry} features={geometry?.features} position={gpsDistance !== null ? gps : null} dailyPin={dailyPin} wind={currentWind} availableHeight={mapHeight} />
                </View>
                <View style={styles.splitHoleDistance}>
                   <View style={[styles.readout, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                     <View style={{ flex: 1, minWidth: 0 }}>
                       <Label>To {targetLabel.toLowerCase()}</Label>
                       <Text style={[styles.distance, { color: colors.foreground }]}>{displayDistance !== null ? `${displayDistance}` : '—'}<Text style={[styles.unit, { color: colors.mutedForeground }]}> {unit}</Text></Text>
                     </View>
                     <StatusToggle testID="enable-gps" label={gpsButtonLabel} active={!!gps} requested={enabled} actionLabel={enabled ? 'Stop live GPS' : 'Enable live GPS'} onPress={() => setEnabled(!enabled)} compact />
                   </View>
                   <Text numberOfLines={1} style={[styles.micro, { color: colors.mutedForeground }]}>{gps ? `Live GPS · ±${gps.accuracy === null ? '?' : Math.round(gps.accuracy)} m${!holeGeometry ? ' · No mapped green' : ''}` : locating ? 'Finding GPS…' : enabled ? 'GPS needs attention' : 'Tap Live GPS to start'}</Text>
                   <RoundScoreControls score={score} minimumScore={minimumScore} hole={activeRound.currentHole} total={total} played={played} blocked={statsDirty || !isReady}
                     onScore={(nextScore) => setHoleScore(activeRound.currentHole, nextScore)} onHole={setCurrentHole} />
                </View>
              </View>
            ) : (
              <>
                  <HoleMap geometry={holeGeometry} features={geometry?.features} position={gpsDistance !== null ? gps : null} dailyPin={dailyPin} wind={currentWind} availableHeight={mapHeight} />
                <View style={[styles.readout, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                     <Label>To {targetLabel.toLowerCase()}</Label>
                    <Text style={[styles.distance, { color: colors.foreground }]}>{displayDistance !== null ? `${displayDistance}` : '—'}<Text style={[styles.unit, { color: colors.mutedForeground }]}> {unit}</Text></Text>
                  </View>
                  <StatusToggle testID="enable-gps" label={gpsButtonLabel} active={!!gps} requested={enabled} actionLabel={enabled ? 'Stop live GPS' : 'Enable live GPS'} onPress={() => setEnabled(!enabled)} compact />
                </View>
                 <Text numberOfLines={1} style={[styles.micro, { color: colors.mutedForeground }]}>{gps
                   ? `Live GPS · ±${gps.accuracy === null ? '?' : Math.round(gps.accuracy)} m${!holeGeometry ? ' · No mapped green' : ''}`
                   : locating ? 'Finding GPS…' : enabled ? 'GPS needs attention' : 'Tap Live GPS to start'}</Text>
              </>
            )}
              {!holeMapLayout.sideBySide ? <RoundScoreControls score={score} minimumScore={minimumScore} hole={activeRound.currentHole} total={total} played={played} blocked={statsDirty || !isReady}
                onScore={(nextScore) => setHoleScore(activeRound.currentHole, nextScore)} onHole={setCurrentHole} /> : null}
              {mapActions}
              {gpsError ? <View style={styles.permissionRow}>
               <Pressable testID="retry-gps" accessibilityRole="button" accessibilityLabel={`${gpsError} Retry GPS`} onPress={retry} style={{ minHeight: 44, justifyContent: 'center', flex: 1 }}>
                 <Text numberOfLines={2} style={[styles.bodySmall, { color: colors.destructive }]}>{gpsError} · Retry</Text>
               </Pressable>
               {gpsError.includes('settings') && Platform.OS !== 'web' ? <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[styles.bodySmall, { color: colors.primary }]}>Settings</Text></Pressable> : null}
             </View> : null}
             <Pressable testID="round-map-details-toggle" accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }} onPress={() => setDetailsOpen(v => !v)} style={styles.detailsToggle}>
               <Text style={[styles.bodySmall, { color: colors.primary }]}>Today’s pin & map details</Text>
               <Feather name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
             </Pressable>
             <View style={{ display: detailsOpen ? 'flex' : 'none', gap: 10 }}>
             {geometry && holeGeometry ? (
              <View style={{ gap: 8 }}>
                <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>{geometry.source} · HOLE {activeRound.currentHole} · {geometry.holes.length}/18 MAPPED · DATA {geometry.checkedAt.slice(0, 10)}</Text>
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
              {holeGeometry && holeGeometry.targetKind !== 'path-end' ? <DailyPinCapture key={`${activeRound.id}:${activeRound.currentHole}`} roundId={activeRound.id} courseId={activeRound.courseId} hole={activeRound.currentHole} target={holeGeometry.target} replacing={!!dailyPin} /> : <Text style={[styles.body, { color: colors.mutedForeground }]}>Pin capture requires a mapped green reference for this hole; a playing-path endpoint is not treated as a green.</Text>}
            </View>
             </View>
          </Card>

           <ExpandablePanel title="Caddie advice" icon="compass" testID="round-caddie-toggle">
             <Card style={{ ...styles.adviceCard, borderLeftColor: colors.primary }}>
               <View style={styles.adviceHead}><Feather name="compass" size={16} color={colors.primary} /><Text style={[styles.adviceLabel, { color: colors.primary }]}>CADDIE ENGINE</Text></View>
               <CaddieAssistant clubs={bag} unit={unit} currentHole={activeRound.currentHole} par={hole?.par} liveDistanceMeters={holeGeometry?.targetKind === 'path-end' ? null : gpsDistance} wind={currentWind} />
             </Card>
           </ExpandablePanel>
           {course ? <ExpandablePanel title="Course weather" icon="cloud" testID="round-weather-toggle"><WeatherCard latitude={geometry?.latitude ?? course.latitude} longitude={geometry?.longitude ?? course.longitude} onWindChange={handleWindChange} /></ExpandablePanel> : null}

           <ExpandablePanel title="Round tools & statistics" icon="bar-chart-2" testID="round-tools-toggle">
          {hole ? <HolePerformanceEditor key={`${activeRound.id}:${hole.hole}`} roundId={activeRound.id} hole={hole} onDirtyChange={setStatsDirty} /> : null}
          {statsDirty ? <EmptyNote>Save statistics or discard your edits before changing holes or finishing the round.</EmptyNote> : null}
          {(hole?.putts ?? 0) + (hole?.penalties ?? 0) > 0 ? <EmptyNote>Total score cannot be reduced below the recorded putts plus penalties. Correct those statistics first if needed.</EmptyNote> : null}
          <ActionButton title="Save scorecard & finish round" icon="check" secondary disabled={statsDirty || !isReady || !!storageError} onPress={() => { setEnabled(false); finishRound(); router.push('/'); }} testID="finish-round" />
          <ActionButton title="Round Performance Coach" icon="trending-up" secondary onPress={() => router.push('/tool/score-comparison')} testID="open-round-coach" />
          <EmptyNote>Live distances require GPS accuracy within 30 m. Pin capture requires a new fix within 10 m accuracy and 60 m of this hole’s mapped green, plus your on-green confirmation. Recorded pins expire at local midnight and remain separate from sourced green references. Neither is survey-grade.</EmptyNote>
           </ExpandablePanel>
        </>
      )}
      <AntiGlareButton />
    </Page>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pairCell: { flex: 1, minWidth: 0 },
  readout: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
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
  distance: { fontSize: 30, lineHeight: 34, fontFamily: 'Inter_700Bold', marginTop: 0, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
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