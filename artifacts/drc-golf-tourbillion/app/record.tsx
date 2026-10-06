import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { ClipReview } from '@/components/ClipReview';
import { archiveVideo } from '@/utils/videoArchive';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActionButton, Card, EmptyNote, Field, IconButton, Page, PageHeading, Pill } from '@/components/Primitives';
import { useGolf } from '@/context/GolfContext';
import { useColors } from '@/hooks/useColors';

export default function RecordingScreen() {
  const colors = useColors();
  const router = useRouter();
  const { tool } = useLocalSearchParams<{ tool?: string }>();
  const toolSlug = tool === 'shot-tracer' ? 'shot-tracer' : 'swing-monitor';
  const { addActivity } = useGolf();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [message, setMessage] = useState('');
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [saving, setSaving] = useState(false);
  const [savedVideoId, setSavedVideoId] = useState('');

  async function saveClip() {
    if (!previewUri || saving || savedVideoId) return;
    setSaving(true); setMessage('');
    try {
      const review = await archiveVideo(previewUri, toolSlug, reviewNote, previewMime);
      setSavedVideoId(review.id);
      addActivity({ tool: toolSlug, title: toolSlug === 'shot-tracer' ? 'Shot video saved' : 'Swing video saved', note: reviewNote.trim() || 'Saved in the on-device video library.' });
      setMessage('Video and review note saved. Reopen them from Saved videos.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Video could not be saved. Please try again.'); }
    finally { setSaving(false); }
  }

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  async function startRecording() {
    if (Platform.OS === 'web') { setMessage('Video recording is available on your phone. Choose a video to review in this preview.'); return; }
    if (!permission?.granted) { await requestPermission(); return; }
    if (!cameraReady || !camera.current) { setMessage('Wait for the camera preview to finish loading.'); return; }
    setMessage('');
    setElapsed(0);
    setRecording(true);
    try {
      const result = await camera.current.recordAsync({ maxDuration: 90 });
      if (result?.uri) setPreviewUri(result.uri);
    } catch {
      setMessage('Recording could not be completed. Check camera access and try again.');
    } finally {
      setRecording(false);
    }
  }

  async function chooseVideo() {
    setMessage('');
    try {
      // Android's system picker grants access only to the selected clip.
      if (Platform.OS !== 'android') {
        const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libraryPermission.granted) { setMessage('Photo-library access is needed to choose a video.'); return; }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
      if (!result.canceled && result.assets[0]) {
        setPreviewUri(result.assets[0].uri);
        setPreviewMime(result.assets[0].mimeType ?? '');
      }
    } catch {
      setMessage('Could not open the video library.');
    }
  }

  return (
    <Page>
      <View style={styles.topBar}>
        <IconButton icon="arrow-left" label="Back" onPress={() => { if (recording) camera.current?.stopRecording(); if (router.canGoBack()) router.back(); else router.replace('/'); }} />
        <Text style={[styles.topText, { color: colors.primary }]}>CAPTURE & REVIEW</Text>
        <Pill tone={recording ? 'gold' : 'muted'}>{recording ? `${elapsed}s REC` : previewUri ? 'REVIEW' : 'READY'}</Pill>
      </View>
      <PageHeading title={toolSlug === 'shot-tracer' ? 'Shot Tracer' : 'Swing Monitor'} subtitle={previewUri ? 'Review the clip before saving your session note.' : 'Stable phone. Full swing in frame. One clear capture.'} />
      <Text style={[styles.small, { color: colors.mutedForeground }]}>Video capture and playback only. This camera does not measure ball flight or swing biomechanics.</Text>
      {previewUri ? (
        <Card>
          <ClipReview uri={previewUri} />
          {savedVideoId ? <EmptyNote>{reviewNote || 'Video saved without a review note.'}</EmptyNote> : <Field label="Review note" value={reviewNote} onChangeText={setReviewNote} placeholder="Club, contact, direction, or takeaway" />}
          <ActionButton title={saving ? 'Saving video…' : savedVideoId ? 'Video saved' : 'Save video & review note'} icon="save" disabled={saving || !!savedVideoId} onPress={() => void saveClip()} testID="save-video-review" />
          <ActionButton title="Open saved videos" icon="film" secondary disabled={saving} onPress={() => router.push('/videos')} />
          <ActionButton title="Record another clip" icon="video" secondary disabled={saving} onPress={() => { setPreviewUri(null); setPreviewMime(''); setSavedVideoId(''); setReviewNote(''); setCameraReady(false); setMessage(''); }} />
          <EmptyNote>Save to keep a copy in this app’s local video library. Export saved clips before uninstalling the app or clearing its data.</EmptyNote>
        </Card>
      ) : Platform.OS === 'web' ? (
        <Card>
          <View style={[styles.cameraEmpty, { backgroundColor: colors.muted }]}><Feather name="video" size={34} color={colors.primary} /><Text style={[styles.cameraHint, { color: colors.foreground }]}>Choose a video to review</Text></View>
          <EmptyNote>This browser preview cannot record camera video. On your phone, the recording screen uses the real device camera with Start and Stop controls.</EmptyNote>
          <ActionButton title="Choose swing or shot video" icon="film" onPress={() => void chooseVideo()} testID="choose-video" />
        </Card>
      ) : !permission?.granted ? (
        <Card>
          <Feather name="camera" size={32} color={colors.primary} />
          <Text style={[styles.cameraHint, { color: colors.foreground }]}>Camera access</Text>
          <EmptyNote>Allow camera access to record. Video is muted, so microphone recording is not required.</EmptyNote>
          <ActionButton title={permission?.canAskAgain === false ? 'Open device settings' : 'Allow camera access'} icon="camera" onPress={() => permission?.canAskAgain === false ? void Linking.openSettings() : void requestPermission()} testID="allow-camera" />
          <ActionButton title="Choose an existing video" icon="film" secondary onPress={() => void chooseVideo()} />
        </Card>
      ) : (
        <Card style={{ padding: 10 }}>
          <View style={styles.cameraFrame}>
            <CameraView
              ref={camera}
              style={StyleSheet.absoluteFill}
              facing={facing}
              mode="video"
              mute
              onCameraReady={() => setCameraReady(true)}
              onMountError={() => setMessage('The camera could not start. Close other camera apps and try again.')}
            />
            <View style={[styles.crosshair, { borderColor: colors.primary, pointerEvents: 'none' }]} />
            <View style={styles.cameraTop}><Pill tone="muted">{recording ? 'RECORDING' : 'ALIGN YOUR SWING'}</Pill><Text style={[styles.time, { color: colors.foreground }]}>{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</Text></View>
          </View>
          <View style={styles.captureControls}>
            <Pressable testID="switch-camera" accessibilityRole="button" accessibilityLabel="Switch camera" disabled={recording} onPress={() => { setFacing(facing === 'back' ? 'front' : 'back'); setCameraReady(false); }}><Feather name="refresh-cw" size={21} color={colors.mutedForeground} /></Pressable>
            <Pressable testID={recording ? 'stop-recording' : 'start-recording'} accessibilityRole="button" accessibilityLabel={recording ? 'Stop recording' : 'Start recording'} onPress={() => recording ? camera.current?.stopRecording() : void startRecording()} style={[styles.recordButton, { borderColor: colors.primary }]}>
              <View style={[recording ? styles.stopSquare : styles.recordCircle, { backgroundColor: colors.primary }]} />
            </Pressable>
            <Pressable testID="choose-video-native" accessibilityRole="button" accessibilityLabel="Choose a video" disabled={recording} onPress={() => void chooseVideo()}><Feather name="film" size={21} color={colors.mutedForeground} /></Pressable>
          </View>
          <Text style={[styles.recordLabel, { color: colors.foreground }]}>{recording ? 'Tap to stop recording' : 'Tap to start recording'}</Text>
        </Card>
      )}
      {message ? <Card><Text style={[styles.small, { color: colors.primary }]}>{message}</Text></Card> : null}
      {!previewUri ? <ActionButton title="Open saved videos" icon="film" secondary disabled={recording} onPress={() => router.push('/videos')} /> : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: -10 },
  topText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_700Bold', letterSpacing: 0.65 },
  video: { width: '100%', height: 300, borderRadius: 13 },
  reviewControls: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  small: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular' },
  cameraEmpty: { height: 230, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 14 },
  cameraHint: { fontSize: 16, lineHeight: 23, fontFamily: 'Inter_600SemiBold', textAlign: 'center', paddingHorizontal: 14 },
  cameraFrame: { height: 360, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  cameraTop: { position: 'absolute', left: 14, right: 14, top: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  time: { fontSize: 14, lineHeight: 19, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
  crosshair: { position: 'absolute', left: '25%', top: '20%', width: '50%', height: '55%', borderWidth: 1, opacity: 0.6 },
  captureControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingVertical: 12 },
  recordButton: { height: 70, width: 70, borderRadius: 35, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  recordCircle: { height: 56, width: 56, borderRadius: 28 },
  stopSquare: { height: 25, width: 25, borderRadius: 5 },
  recordLabel: { textAlign: 'center', letterSpacing: 0.3, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium', paddingBottom: 8 },
});