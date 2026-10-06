import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { useFocusEffect } from 'expo-router';
import { ActionButton } from './Primitives';
import { useGolf } from '@/context/GolfContext';
import { useColors } from '@/hooks/useColors';
import { useDevicePosition } from '@/hooks/useDevicePosition';
import { getPinCaptureProblem, type Coordinate } from '@/utils/courseGeometry';

export function DailyPinCapture({ roundId, courseId, hole, target, replacing }: {
  roundId: string; courseId: string; hole: number; target: Coordinate; replacing: boolean;
}) {
  const colors = useColors();
  const { recordDailyPin } = useGolf();
  const { gps, now, error, enabled, setEnabled, retry } = useDevicePosition();
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'capture'>('idle');
  const [requestedAt, setRequestedAt] = useState(0);
  const [message, setMessage] = useState('');
  useFocusEffect(useCallback(() => () => { setEnabled(false); setPhase('idle'); }, [setEnabled]));
  const problem = getPinCaptureProblem(gps, target, requestedAt, now);
  const textStyle = { color: colors.mutedForeground, fontSize: 15, lineHeight: 23 };

  function beginFix() {
    setRequestedAt(Date.now());
    setMessage('');
    setPhase('capture');
    setEnabled(true);
    retry();
  }

  function save() {
    if (!gps) return;
    try {
      recordDailyPin(roundId, courseId, hole, gps, requestedAt);
      setEnabled(false);
      setPhase('idle');
      setMessage('Pin recorded on this device. It expires at local midnight; the mapped green is unchanged.');
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : 'Pin capture failed. Try again.'); }
  }

  return (
    <View style={{ gap: 10 }}>
      {phase === 'idle' ? (
        <ActionButton title={replacing ? 'Record a replacement for today’s pin' : 'Record today’s pin'} icon="flag" secondary
          onPress={() => { setMessage(''); setPhase('confirm'); }} testID="record-daily-pin" />
      ) : (
        <>
          <Text style={textStyle}>Hole {hole}: stand beside the actual flag on the green. Only confirm if you are there now, not on the tee or fairway. {replacing ? 'Saving will replace your recorded pin for this hole today. ' : ''}The sourced green reference is never changed.</Text>
          {phase === 'confirm' ? (
            <ActionButton title={`I’m beside the flag on hole ${hole}`} icon="check" onPress={beginFix} testID="confirm-on-green" />
          ) : (
            <>
              <Text style={textStyle}>{error || problem || 'Fresh fix ready. Save while standing beside the flag.'}</Text>
              {gps ? <Text style={textStyle}>Accuracy ±{gps.accuracy === null ? 'unknown' : gps.accuracy.toFixed(1)} m · fix age {Math.max(0, Math.floor((now - gps.timestamp) / 1000))}s</Text> : null}
              {!gps && !error && enabled ? <ActivityIndicator color={colors.primary} /> : null}
              <ActionButton title="Save today’s pin" icon="check" disabled={!enabled || !!problem} onPress={save} testID="save-daily-pin" />
              <ActionButton title="Retry fresh GPS fix" icon="refresh-cw" secondary onPress={beginFix} />
              {error.includes('settings') && Platform.OS !== 'web' ? <ActionButton title="Open location settings" secondary onPress={() => void Linking.openSettings().catch(() => setMessage('Could not open Settings. Open device location settings manually.'))} /> : null}
            </>
          )}
          <ActionButton title="Cancel pin capture" icon="x" secondary onPress={() => { setEnabled(false); setPhase('idle'); setMessage(''); }} testID="cancel-daily-pin" />
        </>
      )}
      {message ? <Text style={textStyle}>{message}</Text> : null}
    </View>
  );
}