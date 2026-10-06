import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/AppText';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActionButton, Card, Page, Pill } from '@/components/Primitives';
import { ExpandablePanel, useDeviceMetrics } from '@/components/ExpandablePanel';
import { CaddieAssistant } from '@/components/CaddieAssistant';
import { WeatherCard } from '@/components/WeatherCard';
import { useGolf } from '@/context/GolfContext';
import { useColors } from '@/hooks/useColors';
import { AntiGlareButton } from '@/components/AntiGlareButton';
import type { WindReading } from '@/utils/wind';
import { useLiveGps } from '@/context/LiveGpsContext';

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { playerName, setPlayerName, courses, lastCourseId, activeRound, startRound, setLastCourseId, rounds, bag, unit } = useGolf();
  const { compact } = useDeviceMetrics();
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(playerName);
  const { gps: gpsPosition, error: gpsMessage, locating: gpsLoading, enabled: gpsEnabled, setEnabled: setGpsEnabled } = useLiveGps();
  const course = courses.find((item) => item.id === (activeRound?.courseId ?? lastCourseId)) ?? courses[0];
  const courseId = course?.id;
  const [windState, setWindState] = useState<{ courseId: string; reading: WindReading } | null>(null);
  const handleWindChange = useCallback((reading: WindReading | null) => {
    if (!courseId || !reading) {
      setWindState(null);
      return;
    }
    setWindState({ courseId, reading });
  }, [courseId]);
  const currentWind = windState?.courseId === courseId ? windState.reading : null;

  function goToRound(courseId = course?.id) {
    if (!activeRound) startRound(courseId);
    if (courseId) setLastCourseId(courseId);
    router.push('/round');
  }

  function locateFromHome() {
    setGpsEnabled(!gpsEnabled);
  }

  return (
    <Page>
      <AntiGlareButton />
      {compact ? null : <View accessibilityRole="header" accessible accessibilityLabel="DRC Golf Tempo" style={[styles.brandRow, { borderColor: colors.rim, backgroundColor: colors.surfaceRaised, boxShadow: `0px 6px 14px ${colors.shadow}` }]}>
        <View style={[styles.brandTrim, { backgroundColor: colors.primary, pointerEvents: 'none' }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.brand, { color: colors.primary }]}>DRC</Text>
          <Text style={[styles.brandSub, { color: colors.mutedForeground }]}>GOLF TEMPO</Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: colors.emerald, borderColor: colors.rim }]} />
      </View>}

      <View style={styles.welcomeRow}>
        <View style={{ flex: 1 }}>
          {compact ? null : <Text style={[styles.kicker, { color: colors.primary }]}>YOUR COURSE COMPANION</Text>}
          {editingName ? (
            <View style={styles.nameEdit}>
              <TextInput
                autoFocus
                value={draftName}
                onChangeText={setDraftName}
                onSubmitEditing={() => { setPlayerName(draftName.trim() || 'Dale'); setEditingName(false); }}
                returnKeyType="done"
                placeholder="Your name"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.nameInput, { color: colors.foreground, borderColor: colors.border }]}
              />
              <Pressable testID="save-welcome-name" accessibilityRole="button" accessibilityLabel="Save welcome name" onPress={() => { setPlayerName(draftName.trim() || 'Dale'); setEditingName(false); }}>
                <Feather name="check" size={19} color={colors.primary} />
              </Pressable>
            </View>
          ) : (
            <Pressable testID="edit-welcome-name" accessibilityRole="button" accessibilityLabel="Edit welcome name" onPress={() => { setDraftName(playerName); setEditingName(true); }} style={styles.nameLine}>
              <Text style={[styles.welcome, { color: colors.foreground }]}>Welcome {playerName}</Text>
              <Feather name="edit-2" size={14} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
        <Pill tone="green">GOLF LAB</Pill>
      </View>

      <Card style={styles.courseCard}>
        <View style={styles.courseHead}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={[styles.courseName, { color: colors.foreground }]}>{course?.name ?? 'Choose a course'}</Text>
            <Text style={[styles.smallText, { color: colors.mutedForeground }]}>{course?.area ?? 'Course library'} · PAR {course?.par ?? 72}</Text>
          </View>
          <Feather name="map-pin" size={18} color={colors.primary} />
        </View>
        {activeRound ? (
          <ActionButton title={`Continue round · hole ${activeRound.currentHole}`} icon="arrow-right" onPress={() => router.push('/round')} testID="continue-round" />
        ) : (
          <ActionButton title="Start a new round" icon="play" onPress={() => goToRound()} testID="quick-start-round" />
        )}
        <Pressable testID="open-course-library" accessibilityRole="button" onPress={() => router.push('/tool/course-library')} style={[styles.lastCourse, { borderTopColor: colors.border }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.lastCourseTitle, { color: colors.foreground }]}>Choose or find a course</Text>
            <Text style={[styles.smallText, { color: colors.mutedForeground }]}>Last course · {rounds[0] ? (courses.find((item) => item.id === rounds[0].courseId)?.name ?? 'Saved round') : course?.name ?? 'None saved yet'}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
      </Card>

      <View style={styles.quickRow}>
        <Pressable testID="home-enable-gps" accessibilityRole="button" onPress={locateFromHome} style={[styles.quickTile, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="crosshair" size={17} color={colors.primary} />
          <Text style={[styles.quickTileText, { color: colors.foreground }]}>{gpsLoading ? 'Finding GPS…' : gpsEnabled ? 'Stop live GPS' : 'Live GPS'}</Text>
        </Pressable>
        <Pressable testID="home-open-lab" accessibilityRole="button" onPress={() => router.push('/lab')} style={[styles.quickTile, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="activity" size={17} color={colors.primary} />
          <Text style={[styles.quickTileText, { color: colors.foreground }]}>Open the Lab</Text>
        </Pressable>
      </View>
      {gpsPosition ? <Text style={[styles.smallText, { color: colors.mutedForeground }]}>Live GPS · {gpsPosition.latitude.toFixed(5)}, {gpsPosition.longitude.toFixed(5)} · ±{gpsPosition.accuracy === null ? '?' : Math.round(gpsPosition.accuracy)} m</Text> : null}
      {gpsMessage ? <Text style={[styles.smallText, { color: colors.destructive }]}>{gpsMessage}</Text> : null}
      <ExpandablePanel testID="home-caddie-panel" title="Ask your caddie" icon="compass" subtitle={`${bag.length} clubs in bag`}>
      <Card style={{ ...styles.caddieCard, borderLeftColor: colors.primary }}>
        <View style={styles.caddieHead}>
          <View style={[styles.caddieIcon, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="compass" size={18} color={colors.emerald} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.caddieTitle, { color: colors.foreground }]}>Caddie Engine</Text>
            <Text style={[styles.smallText, { color: colors.mutedForeground }]}>READY FOR YOUR NEXT ROUND</Text>
          </View>
          <Feather name="more-horizontal" size={20} color={colors.mutedForeground} />
        </View>
        <CaddieAssistant
          clubs={bag}
          unit={unit}
          currentHole={activeRound?.currentHole}
          par={activeRound?.holes.find((item) => item.hole === activeRound.currentHole)?.par}
          wind={currentWind}
        />
        <View style={[styles.caddieFoot, { borderTopColor: colors.border }]}>
          <Text style={[styles.smallText, { color: colors.mutedForeground }]}>PERSONAL SETUP</Text>
          <Text style={[styles.caddieStat, { color: colors.primary }]}>{bag.length} CLUBS IN BAG</Text>
        </View>
      </Card>
      </ExpandablePanel>

      <ExpandablePanel testID="home-weather-panel" title="Course conditions" icon="cloud" subtitle={course?.name}>
        {course ? <WeatherCard latitude={course.latitude} longitude={course.longitude} onWindChange={handleWindChange} /> : null}
      </ExpandablePanel>

    </Page>
  );
}

const styles = StyleSheet.create({
  brandRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderRadius: 17 },
  brandTrim: { position: 'absolute', top: 0, left: 16, right: 16, height: 2, opacity: 0.9 },
  brand: { fontSize: 32, lineHeight: 38, fontFamily: 'serif', fontWeight: '700', letterSpacing: 2.1, includeFontPadding: false },
  brandSub: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_700Bold', letterSpacing: 1.6, marginTop: 1, flexShrink: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, marginHorizontal: 2 },
  welcomeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10, paddingTop: 4, paddingBottom: 3 },
  kicker: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_700Bold', letterSpacing: 0.85, marginBottom: 7 },
  nameLine: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  welcome: { fontSize: 20, lineHeight: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },
  nameEdit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameInput: { minWidth: 140, minHeight: 44, fontSize: 20, borderBottomWidth: 1, paddingVertical: 4, fontFamily: 'Inter_600SemiBold' },
  caddieCard: { padding: 12, gap: 10, borderLeftWidth: 3 },
  caddieHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  caddieIcon: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  caddieTitle: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter_700Bold' },
  smallText: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_500Medium', marginTop: 4, flexShrink: 1 },
  caddieFoot: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1 },
  caddieStat: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_700Bold', letterSpacing: 0.45 },
  courseCard: { padding: 12, gap: 10 },
  courseHead: { flexDirection: 'row', alignItems: 'center' },
  courseName: { fontSize: 16, lineHeight: 21, fontFamily: 'Inter_700Bold' },
  lastCourse: { minHeight: 44, borderTopWidth: 1, paddingTop: 10, gap: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastCourseTitle: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_600SemiBold' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickTile: { flexGrow: 1, flexBasis: 140, borderRadius: 12, borderWidth: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
  quickTileText: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
});