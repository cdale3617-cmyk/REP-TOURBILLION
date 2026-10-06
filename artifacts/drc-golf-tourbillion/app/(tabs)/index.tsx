import React, { useCallback, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActionButton, Card, Page, Pill, SectionTitle } from '@/components/Primitives';
import { CaddieAssistant } from '@/components/CaddieAssistant';
import { WeatherCard } from '@/components/WeatherCard';
import { useGolf } from '@/context/GolfContext';
import { useColors } from '@/hooks/useColors';
import { AntiGlareButton } from '@/components/AntiGlareButton';
import type { WindReading } from '@/utils/wind';
import * as Location from 'expo-location';

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { playerName, setPlayerName, courses, lastCourseId, activeRound, startRound, setLastCourseId, rounds, bag, unit } = useGolf();
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(playerName);
  const [gpsPosition, setGpsPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsMessage, setGpsMessage] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
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

  async function locateFromHome() {
    setGpsLoading(true);
    setGpsMessage('');
    try {
      if (Platform.OS === 'web') {
        const position = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
          if (!navigator.geolocation) { reject(new Error('GPS is unavailable in this browser.')); return; }
          navigator.geolocation.getCurrentPosition(
            (result) => resolve({ latitude: result.coords.latitude, longitude: result.coords.longitude }),
            () => reject(new Error('Allow location access to use GPS.')),
            { enableHighAccuracy: true, timeout: 12000 },
          );
        });
        setGpsPosition(position);
      } else {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) { setGpsMessage('Allow location access to use GPS.'); return; }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setGpsPosition({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      }
    } catch {
      setGpsMessage('GPS unavailable. Check location permission and try outdoors.');
    } finally {
      setGpsLoading(false);
    }
  }

  return (
    <Page>
      <AntiGlareButton />
      <View accessibilityRole="header" accessible accessibilityLabel="DRC Golf Tempo" style={[styles.brandRow, { borderColor: colors.rim, backgroundColor: colors.surfaceRaised, boxShadow: `0px 6px 14px ${colors.shadow}` }]}>
        <View style={[styles.brandTrim, { backgroundColor: colors.primary, pointerEvents: 'none' }]} />
        <View style={[styles.logo, { borderColor: colors.primary, backgroundColor: colors.card }]}>
          <Image source={require('@/assets/images/icon.png')} style={styles.logoImage} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.brand, { color: colors.primary }]}>DRC</Text>
          <Text style={[styles.brandSub, { color: colors.mutedForeground }]}>GOLF TEMPO</Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: colors.emerald, borderColor: colors.rim }]} />
      </View>

      <View style={styles.welcomeRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.primary }]}>YOUR COURSE COMPANION</Text>
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

      <SectionTitle>Course conditions</SectionTitle>
      {course ? <WeatherCard latitude={course.latitude} longitude={course.longitude} onWindChange={handleWindChange} /> : null}

      <SectionTitle>Quick start</SectionTitle>
      <Card style={styles.courseCard}>
        <View style={styles.courseHead}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.courseName, { color: colors.foreground }]}>{course?.name ?? 'Choose a course'}</Text>
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
          <View>
            <Text style={[styles.lastCourseTitle, { color: colors.foreground }]}>Choose or find a course</Text>
            <Text style={[styles.smallText, { color: colors.mutedForeground }]}>Last course · {rounds[0] ? (courses.find((item) => item.id === rounds[0].courseId)?.name ?? 'Saved round') : course?.name ?? 'None saved yet'}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
      </Card>

      <View style={styles.quickRow}>
        <Pressable testID="home-enable-gps" accessibilityRole="button" disabled={gpsLoading} onPress={() => void locateFromHome()} style={[styles.quickTile, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="crosshair" size={17} color={colors.primary} />
          <Text style={[styles.quickTileText, { color: colors.foreground }]}>{gpsLoading ? 'Finding GPS…' : gpsPosition ? 'GPS locked' : 'Enable GPS'}</Text>
        </Pressable>
        <Pressable testID="home-open-lab" accessibilityRole="button" onPress={() => router.push('/lab')} style={[styles.quickTile, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="activity" size={17} color={colors.primary} />
          <Text style={[styles.quickTileText, { color: colors.foreground }]}>Open the Lab</Text>
        </Pressable>
      </View>
      {gpsPosition ? <Text style={[styles.smallText, { color: colors.mutedForeground }]}>GPS position · {gpsPosition.latitude.toFixed(5)}, {gpsPosition.longitude.toFixed(5)}</Text> : null}
      {gpsMessage ? <Text style={[styles.smallText, { color: colors.destructive }]}>{gpsMessage}</Text> : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  brandRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderRadius: 17 },
  brandTrim: { position: 'absolute', top: 0, left: 16, right: 16, height: 2, opacity: 0.9 },
  logo: { width: 50, height: 50, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 1 },
  logoImage: { width: 46, height: 46, borderRadius: 14 },
  brand: { fontSize: 39, lineHeight: 45, fontFamily: 'serif', fontWeight: '700', letterSpacing: 2.1, includeFontPadding: false },
  brandSub: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter_700Bold', letterSpacing: 1.6, marginTop: 1, flexShrink: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, marginHorizontal: 2 },
  welcomeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: 4, paddingBottom: 3 },
  kicker: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_700Bold', letterSpacing: 0.85, marginBottom: 7 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  welcome: { fontSize: 28, lineHeight: 35, fontFamily: 'serif', letterSpacing: -0.4 },
  nameEdit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameInput: { minWidth: 150, fontSize: 23, borderBottomWidth: 1, paddingVertical: 4, fontFamily: 'Inter_600SemiBold' },
  caddieCard: { padding: 16, gap: 13, borderLeftWidth: 3 },
  caddieHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  caddieIcon: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  caddieTitle: { fontSize: 17, lineHeight: 22, fontFamily: 'Inter_700Bold' },
  smallText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium', marginTop: 4, flexShrink: 1 },
  caddieFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1 },
  caddieStat: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_700Bold', letterSpacing: 0.45 },
  courseCard: { padding: 16, gap: 15 },
  courseHead: { flexDirection: 'row', alignItems: 'center' },
  courseName: { fontSize: 16, lineHeight: 21, fontFamily: 'Inter_700Bold' },
  lastCourse: { borderTopWidth: 1, paddingTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastCourseTitle: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter_600SemiBold' },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickTile: { flex: 1, borderRadius: 13, borderWidth: 1, minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
  quickTileText: { fontSize: 14, lineHeight: 19, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
});