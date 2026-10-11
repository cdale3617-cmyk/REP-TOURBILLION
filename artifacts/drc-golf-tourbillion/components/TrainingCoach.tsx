import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AppText as Text, AppTextInput as TextInput } from '@/components/AppText';
import { ActionButton, Card, EmptyNote, Field, Page, PageHeading, Pill, SectionTitle } from '@/components/Primitives';
import { Label, ReadoutStrip } from '@/components/Instrument';
import { useGolf } from '@/context/GolfContext';
import { useColors } from '@/hooks/useColors';
import {
  buildTrainingPlan, getPuttingTrend, getTrainingProgress, getTrainingWeekKey, trainingDrills,
  type DrillId, type TrainingPlan, type TrainingSession,
} from '@/utils/training';

// Drafts survive navigation within the app session.
const draft = { weekKey: '', goalsEdited: false, sessions: '3', minutes: '20', logDrill: null as DrillId | null, logMinutes: '', logNote: '' };

const errText = (e: unknown) => (e instanceof Error ? e.message : 'The change could not be saved.');
const fmtDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? 'Unknown date' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
const weekLabel = (key: string) => fmtDate(`${key}T12:00:00`);

export function TrainingCoach() {
  const colors = useColors();
  const router = useRouter();
  const golf = useGolf();
  const { isReady, storageError, rounds, activities, training } = golf;
  const [now, setNow] = useState(() => new Date());
  const [sessionsText, setSessionsText] = useState(draft.sessions);
  const [minutesText, setMinutesText] = useState(draft.minutes);
  const [logDrill, setLogDrill] = useState<DrillId | null>(draft.logDrill);
  const [logMinutes, setLogMinutes] = useState(draft.logMinutes);
  const [logNote, setLogNote] = useState(draft.logNote);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { draft.sessions = sessionsText; draft.minutes = minutesText; draft.logDrill = logDrill; draft.logMinutes = logMinutes; draft.logNote = logNote; });
  useEffect(() => {
    const refresh = () => setNow(prev => (getTrainingWeekKey(prev) === getTrainingWeekKey(new Date()) ? prev : new Date()));
    const sub = AppState.addEventListener('change', s => { if (s === 'active') refresh(); });
    const timer = setInterval(refresh, 60000);
    return () => { sub.remove(); clearInterval(timer); };
  }, []);

  const weekKey = getTrainingWeekKey(now);
  const plans = training.plans;
  const saved = plans.find(p => p.weekKey === weekKey);
  useEffect(() => {
    if (!isReady) return;
    if (draft.weekKey !== weekKey) {
      draft.weekKey = weekKey;
      draft.goalsEdited = false;
      resetLog();
      setConfirmId(null);
    }
    if (!draft.goalsEdited) {
      setSessionsText(String(saved?.weeklySessions ?? 3));
      setMinutesText(String(saved?.sessionMinutes ?? 20));
    }
  }, [isReady, weekKey, saved?.weeklySessions, saved?.sessionMinutes]);
  const preview = useMemo<TrainingPlan | null>(() => {
    const s = Number(sessionsText), m = Number(minutesText);
    try { return buildTrainingPlan(rounds, activities, now, s, m); } catch { return null; }
  }, [rounds, activities, now, sessionsText, minutesText]);
  const trend = useMemo(() => getPuttingTrend(activities), [activities]);
  const locked = !isReady || !!storageError;
  const goalsValid = !!preview;
  const plan = saved ?? preview;
  const progress = saved ? getTrainingProgress(saved, training.sessions) : null;
  const archived = [...plans].filter(p => p.weekKey !== weekKey).sort((a, b) => b.weekKey.localeCompare(a.weekKey));
  const currentSessions = saved ? training.sessions.filter(s => s.weekKey === weekKey).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];

  function run(fn: () => void, ok: string) {
    setError(''); setNotice('');
    try { fn(); setNotice(ok); } catch (e) { setError(errText(e)); }
  }
  function savePlan() {
    if (!preview) return;
    run(() => {
      golf.saveTrainingPlan(saved ? { ...saved, weeklySessions: preview.weeklySessions, sessionMinutes: preview.sessionMinutes } : preview);
      draft.goalsEdited = false;
    }, saved ? 'Weekly goals updated. Drills stay as saved.' : 'Plan saved for this week.');
  }
  function resetLog() { setEditId(null); setLogDrill(null); setLogMinutes(''); setLogNote(''); }
  function submitLog() {
    if (!saved) return;
    const drillId = logDrill ?? saved.drillIds[0];
    const durationMinutes = Number(logMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 180) { setError('Duration must be a whole number from 1 to 180 minutes.'); return; }
    const note = logNote.trim();
    run(() => {
      if (editId) golf.updateTrainingSession(editId, { drillId, durationMinutes, note });
      else golf.logTrainingSession({ weekKey: saved.weekKey, drillId, durationMinutes, note });
      resetLog();
    }, editId ? 'Session updated.' : 'Session logged.');
  }
  function startEdit(s: TrainingSession) {
    setEditId(s.id); setLogDrill(s.drillId); setLogMinutes(String(s.durationMinutes)); setLogNote(s.note); setConfirmId(null); setError(''); setNotice('');
  }
  function remove(id: string) {
    run(() => { golf.removeTrainingSession(id); if (editId === id) resetLog(); setConfirmId(null); }, 'Session deleted.');
  }

  const selDrill = logDrill ?? saved?.drillIds[0] ?? 'putting';
  const Chip = ({ id, on, onPress }: { id: DrillId; on: boolean; onPress: () => void }) => (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress}
      style={[styles.chip, { borderColor: on ? colors.primary : colors.rim, backgroundColor: on ? colors.secondary : colors.muted }]}>
      <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{trainingDrills[id].title}</Text>
    </Pressable>
  );

  return (
    <Page>
      <Pressable testID="training-back" accessibilityRole="button" accessibilityLabel="Back to Lab"
        onPress={() => router.replace('/lab')} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Feather name="arrow-left" size={20} color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1 }}>BACK TO LAB</Text>
      </Pressable>
      <PageHeading eyebrow="Lab" title="TRAINING" subtitle="A weekly plan built from your recorded data. Logged sessions show effort, not improved skill."
        right={<Pill tone="muted">WK {weekLabel(weekKey)}</Pill>} />

      {error ? <View accessibilityRole="alert" style={[styles.msg, { borderColor: colors.destructive }]}><Text style={{ color: colors.destructive, fontSize: 14, lineHeight: 20 }}>{error}</Text></View> : null}
      {notice && !error ? <View accessibilityLiveRegion="polite" style={[styles.msg, { borderColor: colors.rim }]}><Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 20 }}>{notice}</Text></View> : null}

      <Card>
        <View style={styles.row}>
          <Label tone="primary">{saved ? 'Saved plan' : 'Suggested plan, not saved'}</Label>
          {plan ? <Pill tone={plan.source === 'personalised' ? 'gold' : 'muted'}>{plan.source}</Pill> : null}
        </View>
        {plan ? <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 21 }}>{plan.reason}</Text> : <EmptyNote>Enter goals within range to see a plan.</EmptyNote>}
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label="Sessions / week (1-7)" value={sessionsText} onChangeText={value => { draft.goalsEdited = true; setSessionsText(value); }} keyboardType="numeric" testID="training-sessions" editable={!locked} /></View>
          <View style={{ flex: 1 }}><Field label="Minutes / session (5-90)" value={minutesText} onChangeText={value => { draft.goalsEdited = true; setMinutesText(value); }} keyboardType="numeric" testID="training-minutes" editable={!locked} /></View>
        </View>
        {!goalsValid ? <Text style={{ color: colors.destructive, fontSize: 13 }}>Use whole numbers: 1-7 sessions and 5-90 minutes.</Text> : null}
        <ActionButton testID="training-save-plan" icon="check" title={saved ? 'Update weekly goals' : 'Save this week\'s plan'} disabled={locked || !goalsValid} onPress={savePlan} />
        {locked ? <EmptyNote>{!isReady ? 'Loading saved data.' : 'Saving is paused until the storage warning is resolved. Your drafts are kept.'}</EmptyNote> : null}
        {saved ? <EmptyNote>Drills are frozen once saved; new data will only inform next week's plan.</EmptyNote> : null}
      </Card>

      {saved && progress ? (
        <Card>
          <Label>Progress this week (self-reported)</Label>
          <ReadoutStrip items={[
            { label: 'Sessions', value: `${progress.completedSessions}/${saved.weeklySessions}` },
            { label: 'Minutes', value: `${progress.completedMinutes}/${progress.targetMinutes}` },
            { label: 'Session goal', value: `${progress.percent}%` },
          ]} />
        </Card>
      ) : null}

      {plan ? (
        <>
          <SectionTitle>Drills</SectionTitle>
          {plan.drillIds.map((id, i) => (
            <Card key={id}>
              <View style={styles.row}>
                <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: 'Inter_700Bold', flex: 1 }}>{i + 1}. {trainingDrills[id].title}</Text>
                {i === 0 ? <Pill tone="green">Focus</Pill> : null}
              </View>
              {trainingDrills[id].instructions.map((t, n) => <Text key={n} style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>{n + 1}. {t}</Text>)}
              <ActionButton secondary icon="arrow-right" title="Open practice tool" testID={`training-open-${id}`} onPress={() => router.push(`/tool/${trainingDrills[id].tool}`)} />
            </Card>
          ))}
        </>
      ) : null}

      {saved ? (
        <>
          <SectionTitle>{editId ? 'Edit session' : 'Log a completed session'}</SectionTitle>
          <Card>
            <View style={styles.chips}>{saved.drillIds.map(id => <Chip key={id} id={id} on={selDrill === id} onPress={() => setLogDrill(id)} />)}</View>
            <Field label="Actual minutes (1-180)" value={logMinutes} onChangeText={setLogMinutes} keyboardType="numeric" placeholder={String(saved.sessionMinutes)} testID="training-log-minutes" editable={!locked} />
            <View style={{ gap: 7 }}>
              <Text style={[styles.lab, { color: colors.mutedForeground }]}>Note</Text>
              <TextInput accessibilityLabel="Session note" testID="training-log-note" multiline editable={!locked} value={logNote} onChangeText={setLogNote} maxLength={2000} placeholder="What you actually did"
                placeholderTextColor={colors.mutedForeground} style={[styles.note, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]} />
            </View>
            <ActionButton testID="training-log-submit" icon="save" title={editId ? 'Save changes' : 'Log session'} disabled={locked} onPress={submitLog} />
            {editId ? <ActionButton secondary title="Cancel edit" onPress={resetLog} /> : null}
          </Card>

          <SectionTitle>This week's sessions</SectionTitle>
          {currentSessions.length === 0 ? <Card><EmptyNote>No sessions logged yet. Sessions are only recorded when you log them.</EmptyNote></Card> : currentSessions.map(s => (
            <Card key={s.id}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>{trainingDrills[s.drillId].title}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{fmtDate(s.createdAt)} · {s.durationMinutes} min</Text>
                </View>
              </View>
              {s.note ? <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>{s.note}</Text> : null}
              {confirmId === s.id ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.destructive, fontSize: 14 }}>Delete this session log permanently?</Text>
                  <ActionButton testID={`training-confirm-delete-${s.id}`} icon="trash-2" title="Confirm delete" disabled={locked} onPress={() => remove(s.id)} />
                  <ActionButton secondary title="Keep session" onPress={() => setConfirmId(null)} />
                </View>
              ) : (
                <View style={styles.row}>
                  <View style={{ flex: 1 }}><ActionButton secondary icon="edit-2" title="Edit" disabled={locked} onPress={() => startEdit(s)} /></View>
                  <View style={{ flex: 1 }}><ActionButton secondary icon="trash-2" title="Delete" disabled={locked} testID={`training-delete-${s.id}`} onPress={() => setConfirmId(s.id)} /></View>
                </View>
              )}
            </Card>
          ))}
        </>
      ) : null}

      <SectionTitle>Putting comparison</SectionTitle>
      <Card>
        {trend ? (
          <>
            <ReadoutStrip items={[
              { label: 'Latest 3 sets', value: trend.latestPercent.toFixed(1), unit: '%' },
              { label: 'Previous 3', value: trend.previousPercent.toFixed(1), unit: '%' },
              { label: 'Distance', value: trend.distanceMeters, unit: 'm' },
            ]} />
            <EmptyNote>Weighted make rate across six sets from the same distance. Conditions can differ between sessions, so treat this as an indication only.</EmptyNote>
          </>
        ) : <EmptyNote>No trend yet. Six putting sets at the same distance are required, logged in Putting Practice. Conditions may differ between sessions.</EmptyNote>}
      </Card>

      <SectionTitle>Archived weeks</SectionTitle>
      {archived.length === 0 ? <Card><EmptyNote>Earlier weeks will appear here with their actual completion counts.</EmptyNote></Card> : archived.map(p => {
        const pr = getTrainingProgress(p, training.sessions);
        return (
          <Card key={p.weekKey}>
            <View style={styles.row}>
              <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: 'Inter_700Bold', flex: 1 }}>Week of {weekLabel(p.weekKey)}</Text>
              <Pill tone="muted">{p.source}</Pill>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>{pr.completedSessions} of {p.weeklySessions} sessions · {pr.completedMinutes} of {pr.targetMinutes} min logged</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{p.drillIds.map(id => trainingDrills[id].title).join(', ')}</Text>
          </Card>
        );
      })}
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center' },
  msg: { borderWidth: 1, borderRadius: 12, padding: 12 },
  lab: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.45, textTransform: 'uppercase' },
  note: { minHeight: 76, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, lineHeight: 21, textAlignVertical: 'top', fontFamily: 'Inter_500Medium' },
});
