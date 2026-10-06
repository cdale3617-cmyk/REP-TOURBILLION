import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useGolf } from '@/context/GolfContext';
import { useColors } from '@/hooks/useColors';
import { confirmAction } from '@/utils/confirmAction';
import { ActionButton, Card, EmptyNote } from './Primitives';

export function ManualHealthHistory() {
  const golf = useGolf();
  const colors = useColors();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function remove(id: string) {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      if (!await confirmAction('Delete manual health reading?', 'This removes only this manually entered reading from the app’s local log. It does not delete Samsung Health, Health Connect or Bluetooth data. Older exported backups may still contain the reading.')) return;
      golf.removeBiometric(id);
      setMessage('Manual reading removed from the local log.');
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Could not delete this reading.'); }
    finally { setBusy(false); }
  }
  return <Card>
    <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>Saved manual readings · {golf.biometrics.length}</Text>
    {golf.biometrics.length === 0 ? <EmptyNote>No manual biometrics recorded yet.</EmptyNote> : golf.biometrics.map(entry => <View key={entry.id} style={{ gap: 8, paddingVertical: 8 }}>
      <Text style={{ color: colors.foreground }}>{entry.heartRate} bpm · {entry.spo2}% SpO₂</Text>
      <Text style={{ color: colors.mutedForeground }}>{new Date(entry.createdAt).toLocaleString()}</Text>
      <ActionButton title="Delete manual reading" icon="trash-2" secondary disabled={busy || !golf.isReady || !!golf.storageError} testID={`delete-biometric-${entry.id}`} onPress={() => void remove(entry.id)} />
    </View>)}
    {message ? <Text style={{ color: colors.foreground }} testID="manual-history-message">{message}</Text> : null}
  </Card>;
}
