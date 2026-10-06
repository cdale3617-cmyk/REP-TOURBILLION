import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActionButton, Card, EmptyNote, IconButton, Page, PageHeading } from '@/components/Primitives';
import { ClipReview } from '@/components/ClipReview';
import { listVideoReviews, removeVideoReview, VideoReview } from '@/utils/videoArchive';
import { getVideoUri, releaseVideoUri, shareVideoFile } from '@/utils/videoFiles';
import { confirmAction } from '@/utils/confirmAction';
import { useColors } from '@/hooks/useColors';

function SavedClip({ review }: { review: VideoReview }) {
  const [uri, setUri] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let loadedUri = '';
    getVideoUri(review.fileName).then((result) => {
      loadedUri = result;
      if (active) setUri(result); else releaseVideoUri(result);
    }).catch((err: Error) => { if (active) setError(err.message); });
    return () => { active = false; if (loadedUri) releaseVideoUri(loadedUri); };
  }, [review.fileName]);
  return error ? <EmptyNote>{error}</EmptyNote> : uri ? <ClipReview uri={uri} /> : <ActivityIndicator />;
}
export default function VideosScreen() {
  const router = useRouter();
  const colors = useColors();
  const [reviews, setReviews] = useState<VideoReview[]>([]);
  const [selected, setSelected] = useState<VideoReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(() => {
    setError('');
    setLoading(true);
    listVideoReviews().then(setReviews).catch((err: Error) => setError(err.message)).finally(() => setLoading(false));
  }, []);
  useFocusEffect(refresh);
  async function remove(review: VideoReview) {
    if (!await confirmAction('Delete saved video?', 'This permanently deletes this clip and its video-library note from this device. Other practice logs are kept.')) return;
    setBusy(true); setError('');
    try {
      if (selected?.id === review.id) setSelected(null);
      await removeVideoReview(review);
      refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Video could not be deleted.'); }
    finally { setBusy(false); }
  }
  return <Page>
    <IconButton icon="arrow-left" label="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
    <PageHeading title="Saved videos" subtitle="Swing and shot clips stored on this device. No account or server required." />
    {error ? <Card><Text style={{ color: colors.destructive }}>{error}</Text><ActionButton title="Retry" secondary onPress={refresh} /></Card> : null}
    {loading ? <ActivityIndicator color={colors.primary} /> : reviews.length === 0 ? <Card><EmptyNote>No videos saved yet. Record or select a clip, then save it to your video library.</EmptyNote><ActionButton title="Record a swing" icon="video" onPress={() => router.push('/record')} /></Card> : null}
    {selected ? <Card><SavedClip key={selected.id} review={selected} /><EmptyNote>{selected.note || 'No review note.'}</EmptyNote><ActionButton title="Close playback" secondary onPress={() => setSelected(null)} /></Card> : null}
    {reviews.map((review) => <Card key={review.id}>
      <Text style={{ color: colors.foreground, fontSize: 17, fontFamily: 'Inter_600SemiBold' }}>{review.tool === 'shot-tracer' ? 'Shot video' : 'Swing video'}</Text>
      <EmptyNote>{`${new Date(review.createdAt).toLocaleString()}${review.note ? `\n${review.note}` : ''}`}</EmptyNote>
      <ActionButton title="Review video" icon="play" disabled={busy} onPress={() => setSelected(review)} testID={`play-video-${review.id}`} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <ActionButton title="Export video" icon="share" secondary disabled={busy} onPress={() => { setError(''); void shareVideoFile(review.fileName).catch((err: Error) => setError(err.message)); }} />
        <ActionButton title="Delete video" icon="trash-2" secondary disabled={busy} onPress={() => void remove(review)} testID={`delete-video-${review.id}`} />
      </View>
    </Card>)}
    <Card><EmptyNote>Videos take space on this device and are not included in JSON backups. Export clips separately before clearing app data or changing phones. Browser storage can also be cleared by your browser.</EmptyNote></Card>
  </Page>;
}