import React, { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ActionButton, Card, EmptyNote, IconButton, Page, PageHeading } from '@/components/Primitives';
import { useGolf } from '@/context/GolfContext';
import { useColors } from '@/hooks/useColors';
import { createBackup, parseBackup } from '@/utils/backup';
import { chooseBackup, exportBackup } from '@/utils/backupTransfer';
import { confirmAction } from '@/utils/confirmAction';

export default function BackupScreen() {
  const golf = useGolf();
  const router = useRouter();
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage(''); setFailed(false);
    try { await action(); }
    catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Backup operation failed.'); }
    finally { setBusy(false); }
  }
  return <Page>
    <IconButton icon="arrow-left" label="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
    <PageHeading title="Backup & restore" subtitle="Keep your golf data under your control, without an account or cloud service." />
    <Card><EmptyNote>JSON backups contain your name, bag, scorecards, active round, practice notes, checklist and measured biometric logs. Keep exported files private.</EmptyNote>
      <ActionButton title={busy ? 'Working…' : 'Export golf backup'} icon="download" disabled={busy} testID="export-backup" onPress={() => void run(async () => { await exportBackup(createBackup(golf)); setMessage('Backup export opened. Keep the file somewhere safe.'); })} />
    </Card>
    <Card><EmptyNote>Restore replaces your current golf data with the selected backup. Export a backup first if you want to keep your current scores or settings. Your saved video library is separate and will not be deleted.</EmptyNote>
      <ActionButton title="Choose backup to restore" icon="upload" secondary disabled={busy} testID="restore-backup" onPress={() => void run(async () => {
        const contents = await chooseBackup();
        if (contents === null) return;
        const snapshot = parseBackup(contents);
        const summary = `${snapshot.rounds.length} saved rounds, ${snapshot.bag.length} clubs and ${snapshot.activities.length} practice logs.`;
        if (!await confirmAction('Replace current golf data?', `${summary}\nYour current scores, settings and logs will be replaced. Videos are kept. Export your current data first if needed.`)) { setMessage('Restore cancelled. Current data is unchanged.'); return; }
        await golf.restoreSnapshot(snapshot);
        setMessage('Backup restored successfully on this device.');
      })} />
    </Card>
    {message ? <Card><Text testID="backup-message" style={{ color: failed ? colors.destructive : colors.primary, lineHeight: 21 }}>{message}</Text></Card> : null}
    <Card><EmptyNote>Video and green-photo files are not included in JSON backups. Green-read notes and photo references are included. Export videos from Saved videos and photos from Green Reading before changing devices or uninstalling. Missing photos after a restore are labelled; their notes remain available. Live weather and nearby directory search need internet.</EmptyNote><ActionButton title="Open saved videos" icon="film" secondary onPress={() => router.push('/videos')} /><ActionButton title="Open saved green photos" icon="image" secondary onPress={() => router.push('/tool/green-reading')} /></Card>
  </Page>;
}