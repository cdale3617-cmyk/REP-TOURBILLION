import React, { useEffect, useState } from 'react';
import { Image, Platform, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import * as ImagePicker from 'expo-image-picker';
import { ActionButton, Card, EmptyNote, Field } from './Primitives';
import { useGolf, type PracticeActivity } from '@/context/GolfContext';
import { useColors } from '@/hooks/useColors';
import { createGreenPhotoName } from '@/utils/greenPhotoReference';
import { deleteGreenPhoto, getGreenPhotoUri, releaseGreenPhotoUri, shareGreenPhoto, storeGreenPhoto } from '@/utils/greenPhotoFiles';

function SavedGreenRead({ entry }: { entry: PracticeActivity }) {
  const colors = useColors();
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let loadedUri: string | undefined;
    if (entry.greenPhotoFile) {
      void getGreenPhotoUri(entry.greenPhotoFile).then(value => {
        loadedUri = value;
        if (active) setUri(value);
        else releaseGreenPhotoUri(value);
      }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Photo is unavailable.'); });
    }
    return () => { active = false; if (loadedUri) releaseGreenPhotoUri(loadedUri); };
  }, [entry.greenPhotoFile]);
  return <Card>
    <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{entry.note}</Text>
    <Text style={{ color: colors.mutedForeground }}>{new Date(entry.createdAt).toLocaleString()}</Text>
    {uri ? <Image source={{ uri }} accessibilityLabel="Saved green photo" style={{ width: '100%', height: 220, borderRadius: 12 }} onError={() => { setUri(null); setError('Saved photo could not be displayed. The note is still available.'); }} /> : null}
    {error ? <EmptyNote>{error}</EmptyNote> : null}
    {!entry.greenPhotoFile ? <EmptyNote>This older green read contains a note only.</EmptyNote> : <ActionButton title="Export green photo" icon="share" secondary testID={`export-green-photo-${entry.id}`} onPress={() => void shareGreenPhoto(entry.greenPhotoFile!).catch(err => setError(err instanceof Error ? err.message : 'Photo export failed.'))} />}
  </Card>;
}

export function GreenReadings() {
  const golf = useGolf();
  const colors = useColors();
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function choose(useCamera: boolean) {
    setMessage('');
    try {
      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('Camera permission is required to capture a green.');
      } else if (Platform.OS !== 'android') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error('Photo-library permission is required.');
      }
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Could not choose a photo.'); }
  }

  async function save() {
    if (busy || !note.trim()) return;
    if (!golf.isReady || golf.storageError) { setMessage('Resolve the local storage warning before saving a green read.'); return; }
    setBusy(true); setMessage('');
    let fileName: string | undefined;
    try {
      if (photo) {
        fileName = createGreenPhotoName(photo.uri, photo.mimeType);
        await storeGreenPhoto(photo.uri, fileName);
      }
      golf.addActivity({ tool: 'green-reading', title: 'Green read', note: note.trim(), ...(fileName ? { greenPhotoFile: fileName } : {}) });
      setNote(''); setPhoto(null); setMessage('Green read saved locally.');
    } catch (err) {
      if (fileName) await deleteGreenPhoto(fileName).catch(() => undefined);
      setMessage(err instanceof Error ? err.message : 'Could not save the green read.');
    } finally { setBusy(false); }
  }

  const saved = golf.activities.filter(entry => entry.tool === 'green-reading');
  return <>
    <Card>
      {photo ? <Image source={{ uri: photo.uri }} accessibilityLabel="Selected green photo" style={{ width: '100%', height: 220, borderRadius: 12 }} /> : <EmptyNote>Capture or choose a green photo, or save a note on its own.</EmptyNote>}
      <View style={{ gap: 8 }}>
        <ActionButton title="Capture green" icon="camera" disabled={busy} onPress={() => void choose(true)} />
        <ActionButton title="Choose photo" icon="image" secondary disabled={busy} testID="choose-green-photo" onPress={() => void choose(false)} />
      </View>
      <Field label="Line, slope & pace note" value={note} onChangeText={setNote} placeholder="e.g. Gentle right-to-left, uphill pace" testID="green-read-note" />
      <ActionButton title={busy ? 'Saving green read…' : 'Save green read'} icon="save" secondary disabled={busy || !note.trim() || note.trim().length > 20000} onPress={() => void save()} testID="save-green-read" />
      {message ? <Text style={{ color: colors.foreground }} testID="green-read-message">{message}</Text> : null}
      <EmptyNote>Photos are copied into private local storage, not kept in temporary picker files. JSON backups keep the notes and photo references only; export each photo separately before changing devices. A photo is not a slope measurement.</EmptyNote>
    </Card>
    <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>Saved green reads · {saved.length}</Text>
    {saved.map(entry => <SavedGreenRead key={entry.id} entry={entry} />)}
  </>;
}
