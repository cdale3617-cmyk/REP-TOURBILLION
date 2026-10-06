import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/AppText';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActionButton, Card, Page } from '@/components/Primitives';
import { Label, ReadoutStrip, StatusToggle } from '@/components/Instrument';
import { ExpandablePanel } from '@/components/ExpandablePanel';
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

  const roundsSaved = rounds.length;
  return (
    <Page>
      <View accessibilityRole="header" accessible accessibilityLabel="DRC Golf Tempo" style={[styles.masthead, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.brand, { color: colors.foreground }]}>DRC</Text>
          <Text style={[styles.brandSub, { color: colors.mutedForeground }]}>GOLF TEMPO</Text>
        </View>
        <StatusToggle testID="home-enable-gps" label={gpsMessage ? 'GPS error' : gpsLoading ? 'Finding GPS' : gpsPosition ? 'GPS live' : 'GPS off'}
          active={!!gpsPosition} requested={gpsEnabled} actionLabel={gpsEnabled ? 'Stop live GPS' : 'Enable live GPS'} onPress={locateFromHome} compact />
      </View>
      {gpsPosition ? <Text style={[styles.smallText, { color: colors.mutedForeground }]}>Live GPS · {gpsPosition.latitude.toFixed(5)}, {gpsPosition.longitude.toFixed(5)} · ±{gpsPosition.accuracy === null ? '?' : Math.round(gpsPosition.accuracy)} m</Text> : null}
      {gpsMessage ? <Text style={[styles.smallText, { color: colors.destructive }]}>{gpsMessage}</Text> : null}

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
          <Pressable testID="save-welcome-name" accessibilityRole="button" accessibilityLabel="Save welcome name" style={styles.nameBtn} onPress={() => { setPlayerName(draftName.trim() || 'Dale'); setEditingName(false); }}>
            <Feather name="check" size={19} color={colors.primary} />
          </Pressable>
        </View>
      ) : (
        <Pressable testID="edit-welcome-name" accessibilityRole="button" accessibilityLabel="Edit welcome name" onPress={() => { setDraftName(playerName); setEditingName(true); }} style={styles.nameLine}>
          <Text style={[styles.welcome, { color: colors.foreground }]}>Welcome {playerName}</Text>
          <Feather name="edit-2" size={13} color={colors.mutedForeground} />
        </Pressable>
      )}

      <Card style={styles.courseCard}>
        <View style={styles.courseHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Label tone="primary">{activeRound ? `Round in progress · hole ${activeRound.currentHole}` : 'Next round'}</Label>
            <Text numberOfLines={2} style={[styles.courseName, { color: colors.foreground }]}>{course?.name ?? 'Choose a course'}</Text>
            <Text style={[styles.smallText, { color: colors.mutedForeground }]}>{course?.area ?? 'Course library'} · Par {course?.par ?? 72}</Text>
          </View>
        </View>
        {activeRound ? (
          <ActionButton title={`Continue round · hole ${activeRound.currentHole}`} icon="arrow-right" onPress={() => router.push('/round')} testID="continue-round" />
        ) : (
          <ActionButton title="Start a new round" icon="play" onPress={() => goToRound()} testID="quick-start-round" />
        )}
        <Pressable testID="open-course-library" accessibilityRole="button" onPress={() => router.push('/tool/course-library')} style={[styles.lastCourse, { borderTopColor: colors.border }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.lastCourseTitle, { color: colors.foreground }]}>Choose or find a course</Text>
            <Text numberOfLines={1} style={[styles.smallText, { color: colors.mutedForeground }]}>Last course · {rounds[0] ? (courses.find((item) => item.id === rounds[0].courseId)?.name ?? 'Saved round') : course?.name ?? 'None saved yet'}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
      </Card>

      <ReadoutStrip items={[{ label: 'Clubs', value: bag.length }, { label: 'Rounds saved', value: roundsSaved }, { label: 'Distance unit', value: unit.toUpperCase() }]} />

      <Pressable testID="home-open-lab" accessibilityRole="button" onPress={() => router.push('/lab')} style={({ pressed }) => [styles.labLink, { borderColor: colors.border, backgroundColor: pressed ? colors.secondary : colors.muted }]}>
        <Feather name="activity" size={17} color={colors.primary} />
        <Text style={[styles.lastCourseTitle, { color: colors.foreground, flex: 1 }]}>Open the Lab</Text>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>

      <ExpandablePanel testID="home-caddie-panel" title="Ask your caddie" icon="compass" subtitle={`${bag.length} clubs in bag`}>
        <View style={styles.caddieBody}>
          <CaddieAssistant
            clubs={bag}
            unit={unit}
            currentHole={activeRound?.currentHole}
            par={activeRound?.holes.find((item) => item.hole === activeRound.currentHole)?.par}
            wind={currentWind}
          />
        </View>
      </ExpandablePanel>

      <ExpandablePanel testID="home-weather-panel" title="Course conditions" icon="cloud" subtitle={course?.name}>
        {course ? <WeatherCard latitude={course.latitude} longitude={course.longitude} onWindChange={handleWindChange} /> : null}
      </ExpandablePanel>
      <AntiGlareButton />
    </Page>
  );
}

const styles = StyleSheet.create({
  masthead: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12 },
  brand: { fontSize: 28, lineHeight: 32, fontFamily: 'serif', fontWeight: '700', letterSpacing: 8, includeFontPadding: false },
  brandSub: { fontSize: 11, lineHeight: 14, fontFamily: 'Inter_700Bold', letterSpacing: 4.5 },
  nameLine: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  welcome: { fontSize: 18, lineHeight: 24, fontFamily: 'Inter_600SemiBold' },
  nameEdit: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameInput: { minWidth: 140, minHeight: 44, fontSize: 18, borderBottomWidth: 1, paddingVertical: 4, fontFamily: 'Inter_600SemiBold' },
  nameBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  caddieBody: { paddingTop: 2 },
  smallText: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_500Medium', flexShrink: 1 },
  courseCard: { padding: 14, gap: 12 },
  courseHead: { flexDirection: 'row', alignItems: 'center' },
  courseName: { fontSize: 19, lineHeight: 25, fontFamily: 'Inter_700Bold', marginTop: 2 },
  lastCourse: { minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastCourseTitle: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_600SemiBold' },
  labLink: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12 },
});
