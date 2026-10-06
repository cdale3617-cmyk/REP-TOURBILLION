import React, { useEffect, useRef, useState } from 'react';
import { clubSetupKey, shotBelongsToClub } from '@/utils/shotProfiles';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { ActionButton, Card, EmptyNote, Field, IconButton, Page, PageHeading, Pill } from '@/components/Primitives';
import { GolfCourse, GolfRound, useGolf } from '@/context/GolfContext';
import { labTools, moreTools, preRoundItems } from '@/data/catalog';
import { useColors } from '@/hooks/useColors';
import { WedgeMatrixCard } from '@/components/WedgeMatrixCard';
import { canonicalCourseId, getCourseGeometry } from '@/utils/courseGeometry';
import { golfActivityMetricsSchema } from '@/utils/backup';
import { summarizePhoneMotion, type MotionVector3 } from '@/utils/phoneMotion';
import { GreenReadings } from '@/components/GreenReadings';
import { ManualHealthHistory } from '@/components/ManualHealthHistory';
import { SavedRoundPerformanceEditor } from '@/components/HolePerformanceEditor';
import { RoundPerformanceCoach } from '@/components/RoundPerformanceCoach';
import { WeatherCard } from '@/components/WeatherCard';
import { ShotConditionsPicker } from '@/components/ShotConditionsPicker';
import { describeShotConditions, type ShotConditions } from '@/utils/shotConditions';

const flightFields = [
  { key: 'ballSpeedMph', label: 'Ball speed', unit: 'mph' },
  { key: 'clubSpeedMph', label: 'Club speed', unit: 'mph' },
  { key: 'apex', label: 'Apex height', unit: 'distance' },
  { key: 'carry', label: 'Carry', unit: 'distance' },
] as const;
const kineticsFields = [
  { key: 'clubPathDeg', label: 'Club path', unit: '°' },
  { key: 'faceAngleDeg', label: 'Face angle', unit: '°' },
  { key: 'tempoRatio', label: 'Tempo ratio', unit: ':1' },
  { key: 'maxForceBodyWeightPct', label: 'Max force', unit: '% body weight' },
  { key: 'torqueNm', label: 'Torque', unit: 'Nm' },
  { key: 'forceTransferPct', label: 'Force transfer', unit: '%' },
  { key: 'pressureLeftPct', label: 'Pressure · left', unit: '%' },
  { key: 'pressureRightPct', label: 'Pressure · right', unit: '%' },
] as const;
const metricLabels: Record<string, string> = {
  ballSpeedMph: 'Ball speed',
  clubSpeedMph: 'Club speed',
  apex: 'Apex',
  carry: 'Carry',
  clubPathDeg: 'Club path',
  faceAngleDeg: 'Face angle',
  tempoRatio: 'Tempo ratio',
  maxForceBodyWeightPct: 'Max force',
  torqueNm: 'Torque',
  forceTransferPct: 'Force transfer',
  pressureLeftPct: 'Left pressure',
  pressureRightPct: 'Right pressure',
};

function scoreTotal(round: GolfRound) {
  return round.holes.reduce((total, hole) => total + (hole.score ?? 0), 0);
}
function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
function expectedStrokes(distance: number) {
  if (distance <= 0) return 0;
  const reference = [[1, 1.05], [10, 1.5], [25, 2.15], [50, 2.4], [100, 2.65], [150, 2.95], [200, 3.35], [300, 3.8], [500, 4.8]];
  const index = reference.findIndex(([d]) => distance <= d);
  if (index === 0) return reference[0][1];
  if (index < 0) return reference[reference.length - 1][1];
  const [d0, s0] = reference[index - 1];
  const [d1, s1] = reference[index];
  return s0 + ((distance - d0) / (d1 - d0)) * (s1 - s0);
}

async function currentPosition(): Promise<{ latitude: number; longitude: number }> {
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('GPS is unavailable in this browser.')); return; }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        () => reject(new Error('Location permission was not granted.')),
        { enableHighAccuracy: true, timeout: 12000 },
      );
    });
  }
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Location permission is needed to find nearby courses.');
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}

export default function ToolScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ slug: string; roundId?: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const tool = [...labTools, ...moreTools].find((item) => item.slug === slug);
  const golf = useGolf();
  const [note, setNote] = useState('');
  const [carry, setCarry] = useState('');
  const [lateral, setLateral] = useState('0');
  const [practiceConditions, setPracticeConditions] = useState<ShotConditions>({});
  const [clubId, setClubId] = useState(golf.bag.find((club) => club.name === '7 Iron')?.id ?? golf.bag[0]?.id ?? '');
  const [attempts, setAttempts] = useState(0);
  const [made, setMade] = useState(0);
  const [practiceDistance, setPracticeDistance] = useState('3');
  const [reps, setReps] = useState(0);
  const [heartRate, setHeartRate] = useState('');
  const [spo2, setSpo2] = useState('');
  const [startDistance, setStartDistance] = useState('150');
  const [endDistance, setEndDistance] = useState('20');
  const [message, setMessage] = useState('');
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});
  const [findingCourses, setFindingCourses] = useState(false);
  const [discovered, setDiscovered] = useState<GolfCourse[]>([]);
  const [guidesOpen, setGuidesOpen] = useState(true);
  const [motionCapturing, setMotionCapturing] = useState(false);
  const [motionElapsedMs, setMotionElapsedMs] = useState(0);
  const motionActive = useRef(false);
  const motionStartedAt = useRef(0);
  const accelerationSamples = useRef<MotionVector3[]>([]);
  const rotationSamples = useRef<MotionVector3[]>([]);
  const motionSubscriptions = useRef<{ remove: () => void }[]>([]);
  const motionStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeOrLatest = params.roundId ? golf.rounds.find((round) => round.id === params.roundId) : golf.activeRound ?? golf.rounds[0];
  const selectedCourse = golf.courses.find((course) => course.id === golf.lastCourseId) ?? golf.courses[0];
  const selectedClub = golf.bag.find((club) => club.id === clubId);
  const toolActivities = golf.activities.filter((entry) => entry.tool === slug);
  const latestPhoneMotion = toolActivities.find((entry) => entry.phoneMotion)?.phoneMotion;
  const wedges = golf.bag.filter((club) => /wedge|^pw$|^gw$|^sw$|^lw$/i.test(club.name));
  const fullRounds = golf.rounds.filter((round) => round.holes.every((hole) => hole.score !== null));
  const strokesGained = expectedStrokes(Number(startDistance)) - expectedStrokes(Number(endDistance)) - 1;

  useEffect(() => {
    if (!motionCapturing) return;
    const timer = setInterval(() => setMotionElapsedMs(Date.now() - motionStartedAt.current), 250);
    return () => clearInterval(timer);
  }, [motionCapturing]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && motionActive.current) {
        motionActive.current = false;
        if (motionStopTimer.current) clearTimeout(motionStopTimer.current);
        motionStopTimer.current = null;
        motionSubscriptions.current.forEach((subscription) => subscription.remove());
        motionSubscriptions.current = [];
        setMotionCapturing(false);
        setMessage('Motion capture stopped when the app left the foreground. Nothing was saved.');
      }
    });
    return () => {
      appStateSubscription.remove();
      motionActive.current = false;
      if (motionStopTimer.current) clearTimeout(motionStopTimer.current);
      motionSubscriptions.current.forEach((subscription) => subscription.remove());
      motionSubscriptions.current = [];
    };
  }, []);

  if (!tool) {
    return <Page><PageHeading title="Tool not found" /><ActionButton title="Back to Lab" onPress={() => router.replace('/lab')} /></Page>;
  }

  function logPractice(title: string, activityNote: string, value?: number, side?: number) {
    golf.addActivity({ tool: slug, title, note: activityNote, value, lateral: side });
    setMessage('Saved to this device.');
  }

  function saveManualMetrics(mode: 'flight' | 'kinetics') {
    const fields = mode === 'flight' ? flightFields : kineticsFields;
    const metrics: Record<string, string | number> = { source: 'manual-launch-monitor-or-coach' };
    if (mode === 'flight') metrics.distanceUnit = golf.unit;
    let invalid = false;
    for (const field of fields) {
      const raw = manualInputs[field.key]?.trim();
      if (!raw) continue;
      const value = Number(raw.replace(',', '.'));
      if (!Number.isFinite(value)) { invalid = true; break; }
      metrics[field.key] = value;
    }
    if (invalid) { setMessage('Enter numbers only, or leave a reading blank.'); return; }
    const checked = golfActivityMetricsSchema.safeParse(metrics);
    if (!checked.success) {
      setMessage(checked.error.issues[0]?.message ?? 'Check the entered readings and try again.');
      return;
    }
    const label = mode === 'flight' ? 'Flight readings' : 'Kinetics readings';
    golf.addActivity({
      tool: slug,
      title: label,
      note: 'Manually entered from a launch monitor or coach. Camera records video only.',
      metrics: checked.data,
    });
    setManualInputs({});
    setMessage('Manual readings saved on this device.');
  }

  function stopPhoneMotionCapture(autoStopped = false) {
    if (!motionActive.current) return;
    motionActive.current = false;
    if (motionStopTimer.current) clearTimeout(motionStopTimer.current);
    motionStopTimer.current = null;
    motionSubscriptions.current.forEach((subscription) => subscription.remove());
    motionSubscriptions.current = [];
    setMotionCapturing(false);

    try {
      const summary = summarizePhoneMotion(
        accelerationSamples.current,
        rotationSamples.current,
        motionStartedAt.current,
        Date.now(),
      );
      golf.addActivity({
        tool: 'swing-monitor',
        title: 'Phone motion capture',
        note: 'Accelerometer and gyroscope readings from a securely body-worn phone. Device motion only; not club, impact or ball-flight measurements.',
        phoneMotion: summary,
      });
      setMessage(autoStopped
        ? '30-second phone-motion capture saved. These readings describe phone movement only.'
        : 'Phone-motion capture saved. These readings describe phone movement only.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Phone-motion capture could not be saved. Try again.');
    }
  }

  async function startPhoneMotionCapture() {
    if (Platform.OS === 'web') {
      setMessage('Phone-motion capture needs the installed app on a device with accelerometer and gyroscope sensors.');
      return;
    }
    if (motionActive.current) return;
    motionActive.current = true;
    accelerationSamples.current = [];
    rotationSamples.current = [];
    setMotionElapsedMs(0);
    setMessage('');
    try {
      const [accelerometerAvailable, gyroscopeAvailable] = await Promise.all([
        Accelerometer.isAvailableAsync(),
        Gyroscope.isAvailableAsync(),
      ]);
      if (!motionActive.current) return;
      if (!accelerometerAvailable || !gyroscopeAvailable) {
        throw new Error('This phone does not expose both required motion sensors. No reading was saved.');
      }

      Accelerometer.setUpdateInterval(20);
      Gyroscope.setUpdateInterval(20);
      motionStartedAt.current = Date.now();
      motionSubscriptions.current = [
        Accelerometer.addListener(({ x, y, z }) => {
          if (motionActive.current && accelerationSamples.current.length < 10_000) {
            accelerationSamples.current.push({ x, y, z });
          }
        }),
        Gyroscope.addListener(({ x, y, z }) => {
          if (motionActive.current && rotationSamples.current.length < 10_000) {
            rotationSamples.current.push({ x, y, z });
          }
        }),
      ];
      setMotionCapturing(true);
      setMessage('Capture started. Make one swing with the phone secured at your waist, then stop and save.');
      motionStopTimer.current = setTimeout(() => stopPhoneMotionCapture(true), 30_000);
    } catch (error) {
      motionActive.current = false;
      motionSubscriptions.current.forEach((subscription) => subscription.remove());
      motionSubscriptions.current = [];
      setMotionCapturing(false);
      setMessage(error instanceof Error ? error.message : 'Phone-motion sensors could not start.');
    }
  }

  function startRoundAtCourse(course: GolfCourse) {
    golf.addCourse(course);
    if (golf.activeRound) golf.finishRound();
    golf.startRound(canonicalCourseId(course.id));
    router.push('/round');
  }

  async function nearbyCourses() {
    setFindingCourses(true);
    setMessage('');
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const position = await currentPosition();
      const query = `[out:json][timeout:20];(nwr["leisure"="golf_course"](around:30000,${position.latitude},${position.longitude}););out center tags;`;
      timeout = setTimeout(() => controller.abort(), 25000);
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(Platform.OS !== 'web' ? { 'User-Agent': 'DRC-Golf-Tempo/1.0 (on-demand nearby golf course lookup)' } : {}),
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('The course directory is currently unavailable.');
      const data = await response.json() as { remark?: string; elements: { id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };
      if (data.remark || !Array.isArray(data.elements)) throw new Error('The course directory could not complete this search. Try again.');
      const results: GolfCourse[] = data.elements.filter((element) => element.tags?.name && (element.center || (element.lat !== undefined && element.lon !== undefined))).map((element) => {
        const tags = element.tags ?? {};
        return {
          id: `osm-${element.type}-${element.id}`,
          name: tags.name,
          area: tags['addr:city'] ?? 'Nearby course',
          par: Number(tags.par) || 72,
          latitude: element.center?.lat ?? element.lat ?? position.latitude,
          longitude: element.center?.lon ?? element.lon ?? position.longitude,
          address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(' '),
          phone: tags.phone ?? tags['contact:phone'],
          website: tags.website ?? tags['contact:website'],
          source: 'OpenStreetMap',
        };
      });
      setDiscovered(results);
      setMessage(results.length ? `Found ${results.length} courses near your position.` : 'No courses were found nearby. Saved course references are still available below.');
    } catch (error) {
      setMessage(controller.signal.aborted
        ? 'Course lookup timed out. Try again; saved courses are still available.'
        : error instanceof Error ? error.message : 'Course lookup failed. Try again.');
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      setFindingCourses(false);
    }
  }

  function roundSummary(round: GolfRound | undefined, table = false) {
    if (!round) return <Card><EmptyNote>No round data yet. Start a round and record a score to build this view.</EmptyNote><ActionButton title="Open Round" icon="flag" onPress={() => router.push('/round')} /></Card>;
    const course = golf.courses.find((item) => item.id === round.courseId);
    const recorded = round.holes.filter((hole) => hole.score !== null);
    const parPlayed = recorded.reduce((sum, hole) => sum + hole.par, 0);
    const relative = scoreTotal(round) - parPlayed;
    return (
      <Card>
        <View style={styles.inlineRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{course?.name ?? 'Saved course'}</Text>
            <Text style={[styles.small, { color: colors.mutedForeground }]}>{formatDate(round.startedAt)}</Text>
          </View>
          <Pill tone={round.finishedAt ? 'muted' : 'green'}>{round.finishedAt ? 'SAVED' : 'LIVE'}</Pill>
        </View>
        <View style={styles.statsRow}>
          <View><Text style={[styles.bigStat, { color: colors.primary }]}>{scoreTotal(round) || '—'}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>TOTAL SCORE</Text></View>
          <View><Text style={[styles.bigStat, { color: colors.foreground }]}>{recorded.length}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>HOLES</Text></View>
          <View><Text style={[styles.bigStat, { color: colors.foreground }]}>{recorded.length ? `${relative > 0 ? '+' : ''}${relative}` : '—'}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>TO PAR</Text></View>
        </View>
        {table ? (
          <View style={{ gap: 8 }}>
            <View style={[styles.scoreRow, { borderBottomColor: colors.border, borderBottomWidth: 1, paddingBottom: 9 }]}><Text style={[styles.small, { color: colors.mutedForeground, flex: 1 }]}>HOLE</Text><Text style={[styles.small, { color: colors.mutedForeground, width: 60 }]}>PAR</Text><Text style={[styles.small, { color: colors.mutedForeground, width: 60 }]}>SCORE</Text></View>
            {round.holes.map((hole) => <View key={hole.hole} style={styles.scoreRow}><Text style={[styles.body, { color: colors.foreground, flex: 1 }]}>{String(hole.hole).padStart(2, '0')}</Text><Text style={[styles.body, { color: colors.mutedForeground, width: 60 }]}>{hole.par}</Text><Text style={[styles.body, { color: colors.primary, width: 60 }]}>{hole.score ?? '—'}</Text></View>)}
          </View>
        ) : null}
      </Card>
    );
  }

  function content() {
    if (slug === 'swing-monitor' || slug === 'shot-tracer') {
      const isTracer = slug === 'shot-tracer';
      const latestManual = toolActivities.find((entry) => entry.metrics);
      const metricFields = isTracer ? flightFields : kineticsFields;
      const distanceUnit = latestManual?.metrics?.distanceUnit ?? golf.unit;
      const presentMetrics = latestManual?.metrics
        ? Object.entries(latestManual.metrics).filter(([key, value]) => key !== 'source' && key !== 'distanceUnit' && value !== undefined)
        : [];
      const carryValue = latestManual?.metrics?.carry;
      const apexValue = latestManual?.metrics?.apex;
      const ballSpeed = latestManual?.metrics?.ballSpeedMph;
      const clubSpeed = latestManual?.metrics?.clubSpeedMph;
      const smashFactor = typeof ballSpeed === 'number' && typeof clubSpeed === 'number' && clubSpeed > 0
        ? ballSpeed / clubSpeed
        : null;
      const impactMetrics = presentMetrics.filter(([key]) => key === 'faceAngleDeg' || key === 'clubPathDeg');
      const supportingMetrics = presentMetrics.filter(([key]) => key !== 'faceAngleDeg' && key !== 'clubPathDeg');
      const profileEnd = typeof carryValue === 'number' ? Math.min(290, Math.max(38, 24 + (carryValue / 600) * 266)) : 290;
      const profileHeight = typeof apexValue === 'number' ? Math.max(12, 92 - (apexValue / 150) * 78) : 24;
      return (
        <>
          <Card style={styles.instrumentCard}>
            <View style={styles.instrumentHead}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.instrumentEyebrow, { color: colors.primary }]}>{isTracer ? '01 / FLIGHT DECK' : '02 / KINETICS'}</Text>
                <Text style={[styles.instrumentTitle, { color: colors.foreground }]}>{isTracer ? 'Flight readings' : 'Impact analysis'}</Text>
              </View>
              <Pill tone="muted">{isTracer ? 'VIDEO ONLY' : 'PHONE MOTION'}</Pill>
            </View>
            {isTracer ? (
              <View style={[styles.flightProfile, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.profileLabel, { color: colors.primary }]}>VISUAL PROFILE · ENTERED VALUES</Text>
                {typeof carryValue === 'number' && typeof apexValue === 'number' ? (
                  <Svg width="100%" height={104} viewBox="0 0 300 110">
                    <Line x1="12" y1="94" x2="290" y2="94" stroke={colors.border} />
                    <Line x1="12" y1="14" x2="12" y2="95" stroke={colors.border} />
                    <Path d={`M 12 94 Q ${Math.max(22, profileEnd * 0.48)} ${profileHeight} ${profileEnd} 94`} fill="none" stroke={colors.primary} strokeWidth="2.5" />
                    <Circle cx="12" cy="94" r="4" fill={colors.primary} />
                    <Circle cx={profileEnd} cy="94" r="4" fill={colors.primary} />
                    <SvgText x="13" y="107" fontSize="12" fill={colors.mutedForeground}>START</SvgText>
                    <SvgText x={profileEnd - 6} y="107" textAnchor="end" fontSize="12" fill={colors.mutedForeground}>CARRY</SvgText>
                  </Svg>
                ) : (
                  <View style={styles.profileEmpty}>
                    <Feather name="activity" size={19} color={colors.mutedForeground} />
                    <Text style={[styles.small, { color: colors.mutedForeground }]}>Enter apex and carry to display a visual profile.</Text>
                  </View>
                )}
                <Text style={[styles.profileDisclaimer, { color: colors.mutedForeground }]}>Illustrative curve only. Uses entered carry and apex; not a 6DoF engine or physics simulation.</Text>
              {smashFactor !== null ? (
                <View style={[styles.smashStrip, { borderTopColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>SMASH FACTOR</Text>
                    <Text style={[styles.smashValue, { color: colors.foreground }]}>{smashFactor.toFixed(2)}</Text>
                  </View>
                  <Text style={[styles.profileDisclaimer, { color: colors.mutedForeground, flex: 1 }]}>Calculated from your entered ball and club speeds.</Text>
                </View>
              ) : null}
              </View>
            ) : (
              <View style={[styles.kineticsStatus, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Feather name="video" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.profileLabel, { color: colors.primary }]}>CAMERA CLIP · VIDEO ONLY</Text>
                  <Text style={[styles.small, { color: colors.mutedForeground }]}>No club, impact or body measurements are taken from video.</Text>
                </View>
              </View>
            )}
            <Text style={[styles.sourceNote, { color: colors.foreground }]}>{isTracer ? 'S24 FLIGHT LIMIT' : 'S24 SENSOR LIMIT'}</Text>
            <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
              {isTracer
                ? 'The camera saves video only; it cannot automatically measure ball speed, club speed, apex or carry. Record those values only when a validated measurement source supplies them.'
                : 'Phone sensors below capture phone movement only. They cannot validate club path, face angle, impact force, torque or foot pressure; keep those as external readings.'}
            </Text>
            <ActionButton title={isTracer ? 'Open shot camera' : 'Open swing camera'} icon="video" onPress={() => router.push({ pathname: '/record', params: { tool: slug } })} testID={`record-${slug}`} />
            <ActionButton title="Review saved videos" icon="film" secondary onPress={() => router.push('/videos')} testID={`videos-${slug}`} />
          </Card>

          {!isTracer ? (
            <Card style={styles.motionCaptureCard}>
              <View style={styles.metricSectionHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>Automatic phone-motion capture</Text>
                  <Text style={[styles.small, { color: colors.mutedForeground }]}>Accelerometer + gyroscope · one swing per capture</Text>
                </View>
                <Pill tone={motionCapturing ? 'gold' : 'muted'}>
                  {motionCapturing ? `${Math.min(30, Math.floor(motionElapsedMs / 1000))}s` : 'DEVICE SENSORS'}
                </Pill>
              </View>
              <Text style={[styles.body, { color: colors.mutedForeground }]}>
                Secure the phone at your waist before swinging. Do not hold it or attach it to a club. This logs phone motion, not golf biomechanics or ball data.
              </Text>
              {Platform.OS === 'web' ? (
                <EmptyNote>Sensor capture runs in the installed phone app. The browser preview cannot verify live device motion.</EmptyNote>
              ) : null}
              <ActionButton
                title={Platform.OS === 'web'
                  ? 'Available in installed app'
                  : motionCapturing ? 'Stop & save motion' : 'Start motion capture'}
                icon={motionCapturing ? 'square' : 'activity'}
                disabled={Platform.OS === 'web'}
                onPress={() => motionCapturing ? stopPhoneMotionCapture() : void startPhoneMotionCapture()}
                testID="phone-motion-capture"
              />
              {latestPhoneMotion ? (
                <View style={[styles.motionSummary, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Text style={[styles.profileLabel, { color: colors.primary }]}>LATEST PHONE-MOTION RECORD</Text>
                  <Text style={[styles.small, { color: colors.mutedForeground }]}>{formatDate(latestPhoneMotion.capturedAt)} · {latestPhoneMotion.accelerometerSampleCount} accel / {latestPhoneMotion.gyroscopeSampleCount} gyro samples</Text>
                  <View style={styles.motionStats}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.readingLabel, { color: colors.mutedForeground }]}>PEAK PHONE ROTATION</Text>
                      <Text style={[styles.readingValue, { color: colors.foreground }]}>{latestPhoneMotion.peakRotationDegPerSecond.toFixed(1)}<Text style={[styles.readingUnit, { color: colors.primary }]}> °/s</Text></Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.readingLabel, { color: colors.mutedForeground }]}>DYNAMIC ACCELERATION</Text>
                      <Text style={[styles.readingValue, { color: colors.foreground }]}>{latestPhoneMotion.peakDynamicAccelerationG.toFixed(2)}<Text style={[styles.readingUnit, { color: colors.primary }]}> g</Text></Text>
                    </View>
                  </View>
                  <Text style={[styles.profileDisclaimer, { color: colors.mutedForeground }]}>Phone-motion reference only; not a measured club or ball result.</Text>
                </View>
              ) : <EmptyNote>No phone-motion captures saved yet. The phone must provide both motion sensors.</EmptyNote>}
            </Card>
          ) : null}

          <Card style={styles.measurementCard}>
            <View style={styles.metricSectionHead}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Optional monitor / coach readings</Text>
              <Text style={[styles.manualLabel, { color: colors.primary }]}>MANUAL INPUT</Text>
            </View>
            {metricFields.map((field) => (
              <Field
                key={field.key}
                testID={`manual-${slug}-${field.key}`}
                label={`${field.label} · ${field.unit === 'distance' ? golf.unit : field.unit}`}
                value={manualInputs[field.key] ?? ''}
                onChangeText={(value) => setManualInputs((current) => ({ ...current, [field.key]: value }))}
                keyboardType="decimal-pad"
                placeholder="Enter measured value"
              />
            ))}
            <ActionButton title="Save manual readings" icon="save" onPress={() => saveManualMetrics(isTracer ? 'flight' : 'kinetics')} testID={`save-manual-${slug}`} />
          </Card>

          <Card style={styles.recentMetricsCard}>
            <View style={styles.metricSectionHead}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>{isTracer ? 'Recent flight result' : 'Impact analysis'}</Text>
              <Feather name="database" size={16} color={colors.primary} />
            </View>
            {latestManual && presentMetrics.length ? (
              <>
                <Text style={[styles.small, { color: colors.mutedForeground }]}>{formatDate(latestManual.createdAt)} · Launch monitor / coach entry</Text>
                {!isTracer && impactMetrics.length ? (
                  <View style={styles.impactPair}>
                    {impactMetrics.map(([key, value]) => (
                      <View key={key} style={[styles.impactCell, { borderColor: colors.border, backgroundColor: colors.background }]}>
                        <Text style={[styles.readingLabel, { color: colors.mutedForeground }]}>{metricLabels[key] ?? key}</Text>
                        <Text style={[styles.impactValue, { color: colors.foreground }]}>{value}<Text style={[styles.readingUnit, { color: colors.primary }]}> °</Text></Text>
                        <Text style={[styles.impactCaption, { color: colors.mutedForeground }]}>SOURCE SIGN CONVENTION</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <View style={styles.readingGrid}>
                  {(isTracer ? presentMetrics : supportingMetrics).map(([key, value]) => {
                    const unit = key === 'ballSpeedMph' ? 'mph'
                      : key === 'clubSpeedMph' ? 'mph'
                      : key === 'apex' || key === 'carry' ? distanceUnit
                        : key === 'clubPathDeg' || key === 'faceAngleDeg' ? '°'
                          : key === 'tempoRatio' ? ':1'
                            : key === 'torqueNm' ? 'Nm' : '%';
                    return (
                      <View key={key} style={[styles.readingCell, { borderColor: colors.border, backgroundColor: colors.background }]}>
                        <Text style={[styles.readingLabel, { color: colors.mutedForeground }]}>{metricLabels[key] ?? key}</Text>
                        <Text style={[styles.readingValue, { color: colors.foreground }]}>{value}<Text style={[styles.readingUnit, { color: colors.primary }]}> {unit}</Text></Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={[styles.small, { color: colors.mutedForeground }]}>{latestManual.note}</Text>
              </>
            ) : <EmptyNote>No manual readings saved yet. Enter values from your launch monitor or coach above.</EmptyNote>}
          </Card>

          {toolActivities.some((entry) => !entry.metrics && !entry.phoneMotion) ? (
            <Card><Text style={[styles.cardTitle, { color: colors.foreground }]}>Saved review notes</Text>{toolActivities.filter((entry) => !entry.metrics && !entry.phoneMotion).slice(0, 8).map((entry) => <View key={entry.id}><Text style={[styles.body, { color: colors.foreground }]}>{entry.title}</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>{entry.note} · {formatDate(entry.createdAt)}</Text></View>)}</Card>
          ) : null}
        </>
      );
    }
    if (slug === 'shot-pattern') {
      const eligibleClubs = golf.bag.filter((club) => club.carryMeters > 0);
      const shots = selectedClub ? toolActivities.filter((entry) =>
        shotBelongsToClub(entry, selectedClub, golf.bag) && Number.isFinite(entry.value) && Number.isFinite(entry.lateral),
      ) : [];
      const factor = golf.unit === 'yd' ? 1.09361 : 1;
      const carryValues = shots.map((entry) => (entry.value ?? 0) * factor);
      const lateralValues = shots.map((entry) => (entry.lateral ?? 0) * factor);
      const maximumCarry = Math.max(20, ...carryValues);
      const carryCeiling = Math.ceil(maximumCarry / 20) * 20;
      const lateralExtent = Math.max(golf.unit === 'yd' ? 10 : 10, ...lateralValues.map((value) => Math.abs(value)));
      const lateralCeiling = Math.ceil(lateralExtent / 5) * 5;
      const meanCarry = shots.length ? carryValues.reduce((sum, value) => sum + value, 0) / shots.length : null;
      const meanLateral = shots.length ? lateralValues.reduce((sum, value) => sum + value, 0) / shots.length : null;
      const left = 55, right = 316, top = 18, bottom = 190;
      return (
        <>
          <Card>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Record a measured shot</Text>
            <Text style={[styles.small, { color: colors.mutedForeground }]}>Choose the club, then enter where this shot finished. These values are your measured data.</Text>
            <View style={styles.wrapChips}>{eligibleClubs.map((club) => <Pressable key={club.id} testID={`select-shot-club-${club.id}`} accessibilityRole="button" accessibilityState={{ selected: clubId === club.id }} onPress={() => setClubId(club.id)} style={[styles.chip, { backgroundColor: clubId === club.id ? colors.primaryFill : colors.secondary }]}><Text style={[styles.chipText, { color: clubId === club.id ? colors.primaryForeground : colors.mutedForeground }]}>{club.name}</Text></Pressable>)}</View>
            <Field label={`Carry distance · ${golf.unit}`} value={carry} onChangeText={setCarry} keyboardType="decimal-pad" placeholder="Measured carry" />
            <Field label={`Side of target · ${golf.unit} (left − / right +)`} value={lateral} onChangeText={setLateral} keyboardType="default" />
            <ShotConditionsPicker value={practiceConditions} onChange={setPracticeConditions} prefix="practice" title="Record practice conditions · optional" initiallyOpen />
            <ActionButton title="Record shot" icon="plus" disabled={!selectedClub} onPress={() => {
              const value = Number(carry.replace(',', '.'));
              const side = Number(lateral.replace(',', '.'));
              if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(side)) { setMessage('Enter a carry above zero and a number for left or right of target.'); return; }
              const metres = golf.unit === 'yd' ? value / 1.09361 : value;
              const lateralMeters = golf.unit === 'yd' ? side / 1.09361 : side;
              if (!selectedClub || !golf.isReady || golf.storageError) { setMessage('Resolve the storage warning before recording a shot.'); return; }
              if (metres > 1000 || Math.abs(lateralMeters) > 1000) { setMessage('Carry and lateral distances must not exceed 1000 m.'); return; }
              golf.addActivity({
                tool: 'shot-pattern', title: selectedClub.name,
                note: `${value} ${golf.unit} carry · ${side} ${golf.unit} from target; ${describeShotConditions(practiceConditions)}`,
                shotConditions: { ...practiceConditions },
                value: metres, lateral: lateralMeters, clubId: selectedClub.id, clubSetupKey: clubSetupKey(selectedClub),
              });
              setMessage('Shot saved locally.');
              setCarry(''); setLateral('0');
            }} testID="log-shot-pattern" />
            {eligibleClubs.length === 0 ? <EmptyNote>Add clubs with a saved carry in Bag before recording shot patterns.</EmptyNote> : null}
          </Card>
          <Card>
            <View style={styles.inlineRow}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Your shot dispersion</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>{selectedClub?.name ?? 'Select a club'}</Text></View><Pill tone="muted">{shots.length} {shots.length === 1 ? 'SHOT' : 'SHOTS'}</Pill></View>
            <Svg width="100%" height="232" viewBox="0 0 340 232">
              {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                const y = bottom - step * (bottom - top);
                return <React.Fragment key={step}><Line x1={left} y1={y} x2={right} y2={y} stroke={colors.border} strokeOpacity={step === 0 ? 0.9 : 0.5} /><SvgText x="48" y={y + 4} textAnchor="end" fontSize="12" fill={colors.mutedForeground}>{Math.round(carryCeiling * step)}</SvgText></React.Fragment>;
              })}
              <Line x1={left} y1={top} x2={left} y2={bottom} stroke={colors.border} />
              <Line x1={(left + right) / 2} y1={top} x2={(left + right) / 2} y2={bottom} stroke={colors.primary} strokeWidth="2" strokeDasharray="5 4" />
              <SvgText x={(left + right) / 2} y="16" textAnchor="middle" fontSize="12" fontWeight="700" fill={colors.primary}>TARGET</SvgText>
              {shots.map((entry) => {
                const side = (entry.lateral ?? 0) * factor;
                const distance = (entry.value ?? 0) * factor;
                const cx = (left + right) / 2 + (side / lateralCeiling) * ((right - left) / 2);
                const cy = bottom - (distance / carryCeiling) * (bottom - top);
                return <Circle key={entry.id} cx={cx} cy={cy} r="5" fill={colors.primary} stroke={colors.background} strokeWidth="1.5" />;
              })}
              <SvgText x={left} y="211" textAnchor="middle" fontSize="12" fill={colors.mutedForeground}>LEFT</SvgText>
              <SvgText x={(left + right) / 2} y="211" textAnchor="middle" fontSize="12" fill={colors.primary}>TARGET</SvgText>
              <SvgText x={right} y="211" textAnchor="middle" fontSize="12" fill={colors.mutedForeground}>RIGHT</SvgText>
              <SvgText x={left} y="16" textAnchor="start" fontSize="12" fill={colors.mutedForeground}>CARRY ↑ · {golf.unit}</SvgText>
            </Svg>
            <Text style={[styles.axisCaption, { color: colors.mutedForeground }]}>Lateral miss · {golf.unit} · left / target / right</Text>
            {shots.length ? <View style={[styles.summaryStrip, { borderTopColor: colors.border }]}>
              <View><Text style={[styles.summaryValue, { color: colors.foreground }]}>{meanCarry?.toFixed(1)} {golf.unit}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>MEAN CARRY</Text></View>
              <View><Text style={[styles.summaryValue, { color: colors.foreground }]}>{Math.abs(meanLateral ?? 0).toFixed(1)} {golf.unit} {Math.abs(meanLateral ?? 0) < 0.05 ? 'on line' : (meanLateral ?? 0) < 0 ? 'left' : 'right'}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>AVERAGE SIDE</Text></View>
            </View> : <EmptyNote>{selectedClub ? `No measured ${selectedClub.name} shots yet. Record a shot above; this chart will use only that club’s saved carry and side-to-target values.` : 'Choose a club with a saved carry in Bag to record and view its measured shots.'}</EmptyNote>}
            {shots.length > 0 ? <><Text style={[styles.small, { color: colors.mutedForeground }]}>Each dot is one saved shot. The dashed line marks your target; the vertical scale shows measured carry.</Text><View style={styles.tipInline}><Text style={[styles.tipHeading, { color: colors.primary }]}>COACH CUE</Text><Text style={[styles.body, { color: colors.foreground }]}>Use the cluster—not your best shot—to choose a safe start line. A repeated miss is useful information, not a reason to change the data.</Text></View></> : null}
          </Card>
        </>
      );
    }
    if (slug === 'putting-practice') {
      return <>
      <Card>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Build a repeatable roll</Text>
        <Text style={[styles.small, { color: colors.mutedForeground }]}>Keep the starting spot and target fixed. Count one result after each putt.</Text>
        <Field label={`Practice distance · ${golf.unit}`} value={practiceDistance} onChangeText={setPracticeDistance} keyboardType="decimal-pad" />
        <View style={styles.statsRow}><View><Text style={[styles.bigStat, { color: colors.primary }]}>{made}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>MADE</Text></View><View><Text style={[styles.bigStat, { color: colors.foreground }]}>{attempts}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>ATTEMPTS</Text></View><View><Text style={[styles.bigStat, { color: colors.foreground }]}>{attempts ? Math.round(made / attempts * 100) : 0}%</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>SUCCESS</Text></View></View>
        <View style={styles.twoButtons}><ActionButton title="Made" icon="check" onPress={() => { setMade(made + 1); setAttempts(attempts + 1); }} /><ActionButton title="Missed" icon="x" secondary onPress={() => setAttempts(attempts + 1)} /></View>
        <ActionButton title="Save practice set" icon="save" secondary disabled={!attempts} onPress={() => { logPractice('Putting set', `${made}/${attempts} made from ${practiceDistance} ${golf.unit}`, attempts ? made / attempts * 100 : 0); setAttempts(0); setMade(0); }} testID="save-putting-set" />
      </Card>
      <Card><Text style={[styles.tipHeading, { color: colors.primary }]}>PRACTICE CUE</Text><Text style={[styles.body, { color: colors.foreground }]}>On longer putts, focus on finishing the ball close rather than forcing a make. Keep your pace steady.</Text></Card>
      </>;
    }
    if (slug === 'short-game') {
      return <Card>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Practice set</Text>
        <View style={styles.statsRow}><View><Text style={[styles.bigStat, { color: colors.primary }]}>{reps}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>REPS THIS SET</Text></View><Feather name="flag" size={26} color={colors.mutedForeground} /></View>
        <ActionButton title="Log a rep" icon="plus" onPress={() => setReps(reps + 1)} />
        <Field label="Session note" value={note} onChangeText={setNote} placeholder="Club, target, or contact note" />
        <ActionButton title="Save practice set" icon="save" secondary disabled={!reps} onPress={() => { logPractice(`${reps} practice reps`, note || 'Practice set completed.', reps); setReps(0); setNote(''); }} />
      </Card>;
    }
    if (slug === 'greenside-chipping') {
      return <>
      <Card>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Practice set</Text>
        <Text style={[styles.small, { color: colors.mutedForeground }]}>Use one landing spot and one shot shape for this set. Log each attempt after it finishes.</Text>
        <View style={styles.statsRow}><View><Text style={[styles.bigStat, { color: colors.primary }]}>{reps}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>REPS THIS SET</Text></View><Feather name="flag" size={26} color={colors.mutedForeground} /></View>
        <ActionButton title="Log a rep" icon="plus" onPress={() => setReps(reps + 1)} />
        <Field label="Session note" value={note} onChangeText={setNote} placeholder="Club, target, or contact note" />
        <ActionButton title="Save practice set" icon="save" secondary disabled={!reps} onPress={() => { logPractice(`${reps} practice reps`, note || 'Practice set completed.', reps); setReps(0); setNote(''); }} />
      </Card>
      <Card><Text style={[styles.tipHeading, { color: colors.primary }]}>PRACTICE CUE</Text><Text style={[styles.body, { color: colors.foreground }]}>Pick a landing point, then let the ball roll out. A predictable landing spot is easier to repeat than aiming straight at the hole.</Text></Card>
      </>;
    }
    if (slug === 'wedge-matrix') {
      return <>
        <Card><Text style={[styles.tipHeading, { color: colors.primary }]}>PRACTICE CUE</Text><Text style={[styles.body, { color: colors.foreground }]}>Measure each swing length with the same ball and a clear target. Full carry is shared with Bag and Caddie; half and three-quarter values are stored as wedge practice distances.</Text></Card>
        {wedges.length ? wedges.map((club) => {
          return <WedgeMatrixCard key={`${club.id}-${golf.unit}`} club={club} unit={golf.unit} entry={golf.wedgeMatrix[club.id]} onSave={(swing, value) => golf.setWedgeDistance(club.id, swing, value)} onSaveFull={(value) => golf.updateClub(club.id, { carryMeters: value })} />;
        }) : <Card><EmptyNote>Add wedges to Bag to create your matrix.</EmptyNote></Card>}
      </>;
    }
    if (slug === 'green-reading') {
      return <>
      <GreenReadings />
      <Card><Text style={[styles.tipHeading, { color: colors.primary }]}>READING CUE</Text><Text style={[styles.body, { color: colors.foreground }]}>Look from behind the ball and the hole. Note the high side, slope direction and needed pace before choosing a start line.</Text></Card>
      </>;
    }
    if (slug === 'biometrics') {
      const readings = golf.deviceReadings;
      const { health, ble } = readings;
      const showReading = (label: string, reading?: { value: number; measuredAt: string; source: string }) =>
        <View style={{ gap: 4 }}>
          <Text style={[styles.body, { color: colors.foreground }]}>{label}: {reading ? reading.value : 'No reading'}</Text>
          {reading ? <Text style={[styles.small, { color: colors.mutedForeground }]}>{new Date(reading.measuredAt).toLocaleString()} · {reading.source}</Text> : null}
        </View>;
      const runDeviceAction = (action: () => Promise<void>) => {
        void action().catch(error => setMessage(error instanceof Error ? error.message : String(error)));
      };
      return <>
        <Card>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Android Health Connect</Text>
          <EmptyNote>For your Galaxy Watch: sync measured readings to Samsung Health on your S24 Ultra, enable sharing of heart rate and oxygen saturation with Health Connect, then allow read access here. No separate Bluetooth sensor or direct watch pairing with this app is needed. Available data depends on what the watch and Samsung Health share; these are synced readings, not a live watch feed.</EmptyNote>
          <EmptyNote>{readings.deviceBuildNote}</EmptyNote>
          <Pill tone="muted">{health.status.toUpperCase()}</Pill>
          <EmptyNote>{health.message}</EmptyNote>
          {showReading('Historical heart rate · bpm', health.heartRate)}
          {showReading('Historical SpO₂ · %', health.oxygen)}
          <ActionButton title={health.status === 'busy' ? 'Reading Health Connect…' : 'Allow access / refresh readings'} icon="heart" disabled={health.status === 'busy'} onPress={() => runDeviceAction(readings.readHealth)} testID="read-health" />
          <ActionButton title="Health Connect settings" secondary icon="settings" disabled={health.status === 'busy' || Platform.OS !== 'android'} onPress={() => runDeviceAction(readings.openHealthSettings)} />
          <EmptyNote>Permission is requested only when you tap. We read heart rate and oxygen saturation only, never write to Health Connect, and never send these readings to a server. Access can be revoked in Health Connect settings. Sensor and health readings remain in memory, not saved history. This is not a medical monitor.</EmptyNote>
        </Card>
        <Card>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Optional Bluetooth heart-rate monitor</Text>
          <Pill tone="muted">{ble.scanning ? 'SCANNING' : ble.connected ? 'CONNECTED' : ble.status.toUpperCase()}</Pill>
          <EmptyNote>{ble.message}</EmptyNote>
          <EmptyNote>Choose a monitor that supports the standard BLE Heart Rate Service (0x180D). Proprietary watches, glucose meters, blood-pressure devices and oximeters are not supported by this connection. No specific sensor model has been verified yet.</EmptyNote>
          {ble.connected ? <Text style={[styles.body, { color: colors.foreground }]}>{ble.connected.name}</Text> : null}
          {showReading('Last received heart rate · bpm', ble.heartRate)}
          <ActionButton title={ble.scanning ? 'Scanning…' : 'Scan for monitors'} icon="bluetooth" disabled={ble.status === 'busy' || !!ble.connected} onPress={() => runDeviceAction(readings.scanSensors)} testID="scan-sensors" />
          {ble.scanning ? <ActionButton title="Stop scan" secondary onPress={() => runDeviceAction(readings.stopScan)} /> : null}
          {!ble.connected ? ble.devices.map(sensor => <View key={sensor.id} style={{ gap: 4 }}>
            <Text style={[styles.small, { color: colors.mutedForeground }]}>{sensor.id}</Text>
            <ActionButton title={`Connect ${sensor.name}`} icon="bluetooth" secondary disabled={ble.status === 'busy' && !ble.scanning} onPress={() => runDeviceAction(() => readings.connectSensor(sensor))} />
          </View>) : null}
          {ble.connected || (ble.status === 'busy' && !ble.scanning) ? <ActionButton title="Disconnect / cancel" secondary onPress={() => runDeviceAction(readings.disconnect)} testID="disconnect-sensor" /> : null}
          {Platform.OS === 'android' ? <ActionButton title="Android app permission settings" secondary icon="settings" onPress={() => runDeviceAction(() => Linking.openSettings())} /> : null}
          <EmptyNote>Collection stops when the app goes into the background. A displayed reading is the last packet received, not a guarantee that the sensor is still measuring. Bluetooth does not supply SpO₂ through the Heart Rate Service.</EmptyNote>
        </Card>
        <Card>
          <View style={styles.inlineRow}><Feather name="heart" size={20} color={colors.primary} /><Text style={[styles.cardTitle, { color: colors.foreground, flex: 1 }]}>Measured readings</Text><Pill tone="muted">MANUAL LOG</Pill></View>
          <EmptyNote>Manual alternative: enter readings measured by your own device. These are saved locally and kept separate from Health Connect and Bluetooth readings.</EmptyNote>
          <Field label="Heart rate · bpm" value={heartRate} onChangeText={setHeartRate} keyboardType="numeric" />
          <Field label="SpO₂ · %" value={spo2} onChangeText={setSpo2} keyboardType="decimal-pad" />
          <ActionButton title="Save measured readings" icon="save" onPress={() => {
            const hr = Number(heartRate), oxygen = Number(spo2);
            if (!heartRate.trim() || !spo2.trim() || !Number.isFinite(hr) || !Number.isFinite(oxygen) || hr < 20 || hr > 250 || oxygen < 50 || oxygen > 100) { setMessage('Enter a heart rate from 20–250 bpm and SpO₂ from 50–100%.'); return; }
            golf.addBiometric(hr, oxygen);
            setMessage('Measured readings saved locally.');
            setHeartRate(''); setSpo2('');
          }} testID="save-biometrics" />
        </Card>
        <ManualHealthHistory />
      </>;
    }
    if (slug === 'pre-round') {
      const geometry = getCourseGeometry(selectedCourse?.id);
      const checked = preRoundItems.filter((item) => golf.checklist.includes(item)).length;
      return <>
        <Card>
          <View style={styles.inlineRow}>
            <Feather name="flag" size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.foreground, flex: 1 }]}>{selectedCourse?.name ?? 'Choose your course'}</Text>
          </View>
          <EmptyNote>Confirm your tee time and check-in with the club. This checklist does not book or verify a reservation.</EmptyNote>
          <ActionButton title="Check course details" icon="info" secondary testID="pre-round-course-details" onPress={() => router.push('/tool/course-information')} />
        </Card>
        {selectedCourse ? <WeatherCard key={selectedCourse.id} latitude={geometry?.latitude ?? selectedCourse.latitude} longitude={geometry?.longitude ?? selectedCourse.longitude} /> : <Card><EmptyNote>Select a course to see its current weather.</EmptyNote><ActionButton title="Choose a course" icon="map" secondary onPress={() => router.push('/tool/course-library')} /></Card>}
        <Card>
          <View style={styles.inlineRow}>
            <Text style={[styles.cardTitle, { color: colors.foreground, flex: 1 }]}>Ready for the first tee</Text>
            <Pill tone="green">{checked}/{preRoundItems.length}</Pill>
          </View>
          <EmptyNote>Weather above shows current course-area conditions, not a forecast for your tee time. Check closures and playing conditions with the club.</EmptyNote>
          {preRoundItems.map((item) => (
            <Pressable key={item} testID={`checklist-${item}`} accessibilityRole="checkbox" accessibilityLabel={item} accessibilityState={{ checked: golf.checklist.includes(item) }} onPress={() => golf.toggleChecklistItem(item)} style={styles.checkRow}>
              <Feather name={golf.checklist.includes(item) ? 'check-square' : 'square'} size={20} color={golf.checklist.includes(item) ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.body, { color: colors.foreground, flex: 1 }]}>{item}</Text>
            </Pressable>
          ))}
          <EmptyNote>Checks stay saved on this device. Untick items to check them again before your next round.</EmptyNote>
        </Card>
      </>;
    }
    if (slug === 'club-equipment') {
      return <Card><Text style={[styles.cardTitle, { color: colors.foreground }]}>{golf.bag.length} clubs configured</Text>{golf.bag.map((club) => <View key={club.id} style={styles.inlineRow}><Text style={[styles.body, { color: colors.foreground, flex: 1 }]}>{club.name}</Text><Text style={[styles.small, { color: colors.primary }]}>{Math.round(golf.unit === 'yd' ? club.carryMeters * 1.09361 : club.carryMeters)} {golf.unit}</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>{club.loft}°</Text></View>)}<ActionButton title="Edit your bag" icon="sliders" onPress={() => router.push('/bag')} /></Card>;
    }
    if (slug === 'round-overview' || slug === 'scorecard') return <>
      {roundSummary(activeOrLatest, slug === 'scorecard')}
      {slug === 'scorecard' && activeOrLatest ? <SavedRoundPerformanceEditor key={activeOrLatest.id} round={activeOrLatest} /> : null}
      <ActionButton title="Round Performance Coach" icon="trending-up" secondary onPress={() => router.push('/tool/score-comparison')} />
    </>;
    if (slug === 'score-comparison') return <RoundPerformanceCoach />;
    if (slug === 'round-history') {
      return <>
        {golf.rounds.length === 0 ? <Card><EmptyNote>No saved rounds yet. Finish a round to add your first scorecard.</EmptyNote><ActionButton title="Open Round" onPress={() => router.push('/round')} icon="flag" /></Card> : golf.rounds.map(round => <Pressable key={round.id} onPress={() => router.push({ pathname: '/tool/[slug]', params: { slug: 'scorecard', roundId: round.id } })}><Card><View style={styles.inlineRow}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{golf.courses.find((course) => course.id === round.courseId)?.name ?? 'Saved course'}</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>{formatDate(round.startedAt)} · {round.holes.filter((hole) => hole.score !== null).length}/18 holes</Text></View><Text style={[styles.bigStat, { color: colors.primary }]}>{scoreTotal(round)}</Text></View></Card></Pressable>)}
      </>;
    }
    if (slug === 'strokes-gained') {
      const sgLogs = golf.activities.filter((activity) => activity.tool === 'strokes-gained');
      const total = sgLogs.reduce((sum, activity) => sum + (activity.value ?? 0), 0);
      return <Card><View style={styles.inlineRow}><Text style={[styles.cardTitle, { color: colors.foreground, flex: 1 }]}>Shot estimate</Text><Pill tone="muted">SIMPLIFIED MODEL</Pill></View><Field label="Starting distance · yards" value={startDistance} onChangeText={setStartDistance} keyboardType="decimal-pad" /><Field label="Ending distance · yards (0 = holed)" value={endDistance} onChangeText={setEndDistance} keyboardType="decimal-pad" /><Text style={[styles.bigStat, { color: colors.primary }]}>{Number.isFinite(strokesGained) ? `${strokesGained >= 0 ? '+' : ''}${strokesGained.toFixed(2)}` : '—'}</Text><EmptyNote>Estimated strokes gained for one shot. The reference curve is illustrative and does not distinguish lies or course difficulty.</EmptyNote><ActionButton title="Save shot estimate" icon="save" onPress={() => { if (!Number.isFinite(strokesGained) || Number(startDistance) < 0 || Number(endDistance) < 0) { setMessage('Enter non-negative numeric distances.'); return; } logPractice('Strokes gained estimate', `${startDistance} yd → ${endDistance} yd`, strokesGained); }} /><Text style={[styles.small, { color: colors.mutedForeground }]}>{sgLogs.length} saved shots · estimated total {total >= 0 ? '+' : ''}{total.toFixed(2)}</Text></Card>;
    }
    if (slug === 'fusion') {
      return <Card><Text style={[styles.cardTitle, { color: colors.foreground }]}>Your data, together</Text><View style={styles.statsRow}><View><Text style={[styles.bigStat, { color: colors.primary }]}>{golf.rounds.length}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>ROUNDS</Text></View><View><Text style={[styles.bigStat, { color: colors.foreground }]}>{golf.activities.length}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>PRACTICE LOGS</Text></View><View><Text style={[styles.bigStat, { color: colors.foreground }]}>{golf.bag.length}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>CLUBS</Text></View></View><EmptyNote>{golf.activities.length ? 'Your latest practice notes are below. Look for repeated contact, direction, or distance patterns before your next round.' : 'Start with a round scorecard and one practice set. Fusion will summarize your saved activity here.'}</EmptyNote>{golf.activities.slice(0, 5).map((activity) => <View key={activity.id}><Text style={[styles.body, { color: colors.foreground }]}>{activity.title}</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>{activity.note}</Text></View>)}</Card>;
    }
    if (slug === 'records') {
      const best = fullRounds.length ? Math.min(...fullRounds.map(scoreTotal)) : null;
      return <Card><Text style={[styles.cardTitle, { color: colors.foreground }]}>Personal records</Text><View style={styles.statsRow}><View><Text style={[styles.bigStat, { color: colors.primary }]}>{best ?? '—'}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>BEST 18-HOLE SCORE</Text></View><View><Text style={[styles.bigStat, { color: colors.foreground }]}>{fullRounds.length}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>COMPLETE ROUNDS</Text></View></View><EmptyNote>Best score includes only scorecards with all 18 holes recorded. Partial cards remain available in Round History.</EmptyNote></Card>;
    }
    if (slug === 'course-library') {
      return <>
        <Card><Text style={[styles.cardTitle, { color: colors.foreground }]}>Find a course near you</Text><EmptyNote>Public OpenStreetMap results include phone, website, and address fields when available.</EmptyNote><ActionButton title={findingCourses ? 'Finding nearby courses…' : 'Find nearby courses'} icon="map-pin" disabled={findingCourses} onPress={() => void nearbyCourses()} testID="find-nearby-courses" />{findingCourses ? <ActivityIndicator color={colors.primary} /> : null}</Card>
        {[...discovered, ...golf.courses.filter((course) => !discovered.some((item) => item.id === course.id))].map((course) => (
          <Card key={course.id}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${course.name} course details`} onPress={() => { golf.addCourse(course); router.push('/tool/course-information'); }}>
              <View style={styles.inlineRow}><Feather name="map-pin" size={18} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{course.name}</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>{course.area} · {course.source}</Text><Text style={[styles.small, { color: getCourseGeometry(course.id) ? colors.primary : colors.mutedForeground }]}>{getCourseGeometry(course.id) ? '18/18 source-checked hole paths' : 'No verified hole geometry · GPS distances unavailable'}</Text></View><Feather name="chevron-right" size={16} color={colors.mutedForeground} /></View>
            </Pressable>
            <ActionButton title="Start round at this course" icon="flag" onPress={() => startRoundAtCourse(course)} />
          </Card>
        ))}
      </>;
    }
    if (slug === 'course-information') {
      return selectedCourse ? <Card><Text style={[styles.cardTitle, { color: colors.foreground }]}>{selectedCourse.name}</Text><Text style={[styles.body, { color: colors.mutedForeground }]}>{selectedCourse.area}</Text><Pill tone="green">CURRENT COURSE</Pill><ActionButton title="Start new round" icon="flag" onPress={() => startRoundAtCourse(selectedCourse)} /><Text style={[styles.small, { color: colors.mutedForeground }]}>Course reference: {selectedCourse.latitude.toFixed(4)}, {selectedCourse.longitude.toFixed(4)}</Text><Text style={[styles.body, { color: colors.foreground }]}>{selectedCourse.address || 'Street address not listed in this directory entry.'}</Text>{selectedCourse.phone ? <ActionButton title={selectedCourse.phone} icon="phone" secondary onPress={() => void Linking.openURL(`tel:${selectedCourse.phone}`)} /> : <EmptyNote>Phone number not listed. Search nearby courses to load directory contact details.</EmptyNote>}{selectedCourse.website ? <ActionButton title="Open course website" icon="external-link" secondary onPress={() => void Linking.openURL(selectedCourse.website?.startsWith('http') ? selectedCourse.website : `https://${selectedCourse.website}`)} /> : <EmptyNote>Website not listed in this entry.</EmptyNote>}<ActionButton title="Browse course library" icon="map" onPress={() => router.push('/tool/course-library')} /></Card> : <Card><EmptyNote>No course selected.</EmptyNote></Card>;
    }
    if (slug === 'settings') {
      return <>
        <Card><Text style={[styles.cardTitle, { color: colors.foreground }]}>Distance unit</Text><View style={styles.twoButtons}><ActionButton title={golf.unit === 'm' ? 'Metres · selected' : 'Metres'} onPress={() => golf.setUnit('m')} secondary={golf.unit !== 'm'} /><ActionButton title={golf.unit === 'yd' ? 'Yards · selected' : 'Yards'} onPress={() => golf.setUnit('yd')} secondary={golf.unit !== 'yd'} /></View></Card>
        <Card><Text style={[styles.cardTitle, { color: colors.foreground }]}>Connections</Text>{[
          ['GPS & course positioning', 'Permission requested on the Round screen.'],
          ['Weather & wind', 'Open-Meteo live course-area forecast.'],
          ['Course directory', 'OpenStreetMap nearby search and contact fields.'],
          ['Camera & video', 'Device camera, library selection, and playback review.'],
          ['Health data', `Health Connect: ${golf.deviceReadings.health.status}. Native Android build required; open Biometrics.`],
          ['BLE sensors', golf.deviceReadings.ble.connected ? `Connected: ${golf.deviceReadings.ble.connected.name}` : 'Standard BLE heart-rate monitors. Native Android build required; open Biometrics.'],
        ].map(([name, status]) => <View key={name}><Text style={[styles.body, { color: colors.foreground }]}>{name}</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>{status}</Text></View>)}<ActionButton title="Open health & sensor connections" icon="heart" secondary onPress={() => router.push('/tool/biometrics')} /></Card>
        <Card><Text style={[styles.cardTitle, { color: colors.foreground }]}>Private on-device storage</Text><EmptyNote>Scores, bag settings, practice notes, and manual biometric readings are saved only in this app’s local storage. There is no sign-in or cloud sync.</EmptyNote></Card>
        <Card><ActionButton title="Backup & restore golf data" icon="download" onPress={() => router.push('/backup')} testID="open-backup" /><ActionButton title="Saved videos" icon="film" secondary onPress={() => router.push('/videos')} /></Card>
      </>;
    }
    if (slug === 'how-to') {
      return <>{labTools.map((guide) => <Card key={guide.slug}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{guide.title}</Text>{guide.howTo.map((step, index) => <Text key={step} style={[styles.body, { color: colors.mutedForeground }]}>{index + 1}. {step}</Text>)}<ActionButton title="Open tool" icon="arrow-right" secondary onPress={() => router.push(`/tool/${guide.slug}`)} /></Card>)}</>;
    }
    return <Card><EmptyNote>Open this tool from the Lab to begin.</EmptyNote></Card>;
  }

  return (
    <Page>
      <View style={styles.topBar}><IconButton icon="arrow-left" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} label="Back" /><Text style={[styles.topBarText, { color: colors.primary }]}>DRC GOLF LAB</Text><Feather name={tool.icon as keyof typeof Feather.glyphMap} size={17} color={colors.primary} /></View>
      <PageHeading title={tool.title} subtitle={tool.description} />
      {content()}
      {message ? <Card><Text style={[styles.body, { color: colors.primary }]}>{message}</Text></Card> : null}
      {slug !== 'how-to' ? (
        <Card>
          <Pressable onPress={() => setGuidesOpen(!guidesOpen)} style={styles.inlineRow} accessibilityRole="button"><Feather name="book-open" size={16} color={colors.primary} /><Text style={[styles.cardTitle, { color: colors.foreground, flex: 1 }]}>How To</Text><Feather name={guidesOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} /></Pressable>
          {guidesOpen ? tool.howTo.map((step, index) => <View key={step} style={styles.guideRow}><Text style={[styles.guideIndex, { color: colors.primary }]}>{String(index + 1).padStart(2, '0')}</Text><Text style={[styles.body, { color: colors.mutedForeground, flex: 1 }]}>{step}</Text></View>) : null}
        </Card>
      ) : null}
      {toolActivities.length > 0 && !['swing-monitor', 'shot-tracer', 'shot-pattern', 'strokes-gained', 'fusion'].includes(slug) ? <Card><Text style={[styles.cardTitle, { color: colors.foreground }]}>Recent local activity</Text>{toolActivities.slice(0, 5).map((entry) => <View key={entry.id}><Text style={[styles.body, { color: colors.foreground }]}>{entry.title}</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>{entry.note} · {formatDate(entry.createdAt)}</Text></View>)}</Card> : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: -10 },
  topBarText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter_700Bold', flexShrink: 1 },
  body: { fontSize: 15, lineHeight: 23, fontFamily: 'Inter_400Regular' },
  small: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', marginTop: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  bigStat: { fontSize: 28, lineHeight: 34, fontFamily: 'Inter_700Bold', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8, marginTop: 3 },
  twoButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 14, lineHeight: 19, fontFamily: 'Inter_600SemiBold' },
  greenPhoto: { width: '100%', height: 210, borderRadius: 13 },
  imageEmpty: { minHeight: 140, borderRadius: 13, alignItems: 'center', justifyContent: 'center', gap: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 42 },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  guideRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  guideIndex: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_700Bold', marginTop: 3 },
  axisCaption: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 0 },
  summaryStrip: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, marginTop: 10, paddingTop: 12 },
  summaryValue: { fontSize: 16, lineHeight: 23, fontFamily: 'Inter_700Bold', flexShrink: 1 },
  tipHeading: { fontSize: 12, lineHeight: 18, letterSpacing: 0.8, fontFamily: 'Inter_700Bold' },
  tipInline: { gap: 4, marginTop: 10, paddingTop: 8 },
  instrumentCard: { padding: 14, gap: 12, borderTopWidth: 2 },
  motionCaptureCard: { padding: 14, gap: 12, borderTopWidth: 2 },
  motionSummary: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 7 },
  motionStats: { flexDirection: 'row', gap: 12, borderTopWidth: 1, paddingTop: 9, marginTop: 3 },
  instrumentHead: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  instrumentEyebrow: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_700Bold', letterSpacing: 0.7, marginBottom: 4 },
  instrumentTitle: { fontSize: 19, lineHeight: 25, letterSpacing: -0.2, fontFamily: 'Inter_700Bold' },
  flightProfile: { borderWidth: 1, borderRadius: 12, padding: 11, minHeight: 148 },
  smashStrip: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, paddingTop: 9, marginTop: 5 },
  smashValue: { fontSize: 22, lineHeight: 26, fontFamily: 'Inter_700Bold', marginTop: 3 },
  profileLabel: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  profileEmpty: { height: 92, alignItems: 'center', justifyContent: 'center', gap: 5 },
  profileDisclaimer: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', flexShrink: 1 },
  kineticsStatus: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sourceNote: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_700Bold', letterSpacing: 0.7, marginBottom: 0 },
  disclaimer: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular' },
  measurementCard: { padding: 14, gap: 12 },
  metricSectionHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  manualLabel: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  recentMetricsCard: { padding: 14, gap: 10 },
  readingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  readingCell: { width: '48%', minHeight: 80, borderWidth: 1, borderRadius: 10, padding: 10, justifyContent: 'space-between' },
  impactPair: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  impactCell: { flex: 1, minWidth: '46%', minHeight: 100, borderWidth: 1, borderRadius: 10, padding: 10, justifyContent: 'space-between', gap: 6 },
  impactValue: { fontSize: 23, lineHeight: 28, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
  impactCaption: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_700Bold', letterSpacing: 0.2, flexShrink: 1 },
  readingLabel: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.1, flexShrink: 1 },
  readingValue: { fontSize: 19, lineHeight: 25, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'], flexShrink: 1 },
  readingUnit: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_600SemiBold' },
});
