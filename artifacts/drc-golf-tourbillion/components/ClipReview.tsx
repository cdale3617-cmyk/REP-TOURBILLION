import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { useColors } from '@/hooks/useColors';
import { ActivityIndicator } from 'react-native';
import { ActionButton, EmptyNote } from './Primitives';

export function ClipReview({ uri }: { uri: string }) {
  const [slow, setSlow] = useState(false);
  const colors = useColors();
  const player = useVideoPlayer(uri, (instance) => { instance.loop = false; });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  return <View style={{ gap: 12 }}>
    <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
    {status === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}
    {status === 'error' ? <EmptyNote>This device or browser cannot play this video. Choose a compatible video or export the saved clip for another player. The original saved file is kept.</EmptyNote> : null}
    <View style={styles.buttons}>
      <ActionButton title="Play / restart" icon="play" secondary disabled={status !== 'readyToPlay'} onPress={() => { player.currentTime = 0; player.play(); }} />
      <ActionButton title={slow ? '0.25× slow' : '1× speed'} icon="clock" secondary disabled={status === 'error'} onPress={() => { player.playbackRate = slow ? 1 : 0.25; setSlow(!slow); }} />
    </View>
    <EmptyNote>Scrub, pause or review in slow motion using the playback controls.</EmptyNote>
  </View>;
}
const styles = StyleSheet.create({ video: { width: '100%', height: 300, borderRadius: 13 }, buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 } });