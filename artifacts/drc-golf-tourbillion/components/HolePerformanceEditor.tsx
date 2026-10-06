import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ActionButton, Card, EmptyNote, Field, SectionTitle } from '@/components/Primitives';
import { GolfRound, HoleScore, useGolf } from '@/context/GolfContext';
import { useColors } from '@/hooks/useColors';

type Fairway = 'hit' | 'miss' | null;
type Gir = boolean | null;

function textOf(value: number | null | undefined): string {
  return typeof value === 'number' ? String(value) : '';
}

function parseCount(text: string, label: string): { value: number | null; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) return { value: null };
  if (!/^\d{1,2}$/.test(trimmed)) return { value: null, error: `${label} must be a whole number, 0 or more.` };
  return { value: Number(trimmed) };
}

function Choice({ label, selected, onPress, testID, disabled }: { label: string; selected: boolean; onPress: () => void; testID: string; disabled?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
        backgroundColor: selected ? colors.primaryFill : colors.muted,
        borderColor: selected ? colors.rim : colors.border,
        opacity: disabled ? 0.42 : 1,
      }}
    >
      <Text style={{ color: selected ? colors.primaryForeground : colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 14, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

export function HolePerformanceEditor({ roundId, hole, onDirtyChange }: { roundId: string; hole: HoleScore; onDirtyChange?: (dirty: boolean) => void }) {
  const colors = useColors();
  const { setHolePerformance, isReady, storageError } = useGolf();
  const savedPutts = textOf(hole.putts);
  const savedPenalties = textOf(hole.penalties);
  const savedFairway: Fairway = hole.fairway ?? null;
  const savedGir: Gir = typeof hole.greenInRegulation === 'boolean' ? hole.greenInRegulation : null;
  const [putts, setPutts] = useState(savedPutts);
  const [penalties, setPenalties] = useState(savedPenalties);
  const [fairway, setFairway] = useState<Fairway>(savedFairway);
  const [gir, setGir] = useState<Gir>(savedGir);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Re-sync drafts only when saved stat fields change (restore, other edit); score changes don't touch drafts.
  const signature = `${savedPutts}|${savedPenalties}|${savedFairway}|${savedGir}`;
  const lastSignature = useRef(signature);
  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    setPutts(savedPutts); setPenalties(savedPenalties); setFairway(savedFairway); setGir(savedGir);
    setError(''); setMessage('');
  }, [signature, savedPutts, savedPenalties, savedFairway, savedGir]);

  const dirty = putts.trim() !== savedPutts || penalties.trim() !== savedPenalties || fairway !== savedFairway || gir !== savedGir;
  const dirtyRef = useRef(onDirtyChange);
  dirtyRef.current = onDirtyChange;
  useEffect(() => { dirtyRef.current?.(dirty); }, [dirty]);
  useEffect(() => () => { dirtyRef.current?.(false); }, []);

  const hasScore = hole.score !== null && Number.isFinite(hole.score);
  const fairwayNA = hole.par <= 3;
  const girNA = hole.par < 3;
  const locked = !isReady || !!storageError;
  const disabled = locked || !hasScore;
  const live = useMemo(() => {
    const p = parseCount(putts, 'Putts');
    const n = parseCount(penalties, 'Penalties');
    const fieldError = p.error ?? n.error;
    if (fieldError) return { p, n, problem: fieldError };
    if (hasScore && (p.value ?? 0) + (n.value ?? 0) > hole.score!) return { p, n, problem: `Putts and penalties total ${(p.value ?? 0) + (n.value ?? 0)}, more than the hole score of ${hole.score}.` };
    return { p, n, problem: '' };
  }, [putts, penalties, hasScore, hole.score]);

  function save() {
    if (live.problem) { setError(live.problem); return; }
    try {
      setHolePerformance(roundId, hole.hole, {
        putts: live.p.value,
        penalties: live.n.value,
        fairway: fairwayNA ? null : fairway,
        greenInRegulation: girNA ? null : gir,
      });
      setError('');
      setMessage('Hole statistics updated. Local saving runs automatically.');
    } catch (e) {
      setMessage('');
      setError(e instanceof Error ? e.message : 'Statistics could not be saved. Your edits are still here.');
    }
  }
  function discard() {
    setPutts(savedPutts); setPenalties(savedPenalties); setFairway(savedFairway); setGir(savedGir);
    setError(''); setMessage('');
  }
  const shownError = error || (dirty ? live.problem : '');
  const muted = { color: colors.mutedForeground, fontSize: 13, lineHeight: 19 } as const;
  const label = { color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.45, textTransform: 'uppercase' } as const;

  return (
    <Card>
      <SectionTitle>{`Hole ${hole.hole} statistics`}</SectionTitle>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>Par {hole.par}</Text>
        <Text testID="hole-total-score" style={{ color: colors.foreground, fontSize: 15, fontFamily: 'Inter_700Bold' }}>
          {hasScore ? `Total score ${hole.score}` : 'No score yet'}
        </Text>
      </View>
      {!hasScore ? <EmptyNote>Enter the hole score first. Statistics are recorded against a scored hole.</EmptyNote> : null}
      <Text style={muted}>Penalty strokes are already included in the total score. Count putts only on the putting surface. Leave a box blank if unknown; 0 means none.</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}><Field testID="hole-putts" label="Putts" value={putts} onChangeText={(t) => { setPutts(t); setError(''); setMessage(''); }} keyboardType="numeric" placeholder="Unknown" editable={!disabled} /></View>
        <View style={{ flex: 1 }}><Field testID="hole-penalties" label="Penalties" value={penalties} onChangeText={(t) => { setPenalties(t); setError(''); setMessage(''); }} keyboardType="numeric" placeholder="Unknown" editable={!disabled} /></View>
      </View>
      <View style={{ gap: 7 }}>
        <Text style={label}>Fairway</Text>
        {fairwayNA ? <Text style={muted}>Not applicable on a par {hole.par}.</Text> : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Choice testID="performance-fairway-hit" label="Hit" selected={fairway === 'hit'} disabled={disabled} onPress={() => { setFairway('hit'); setMessage(''); }} />
            <Choice testID="performance-fairway-miss" label="Missed" selected={fairway === 'miss'} disabled={disabled} onPress={() => { setFairway('miss'); setMessage(''); }} />
            <Choice testID="performance-fairway-unknown" label="Unknown" selected={fairway === null} disabled={disabled} onPress={() => { setFairway(null); setMessage(''); }} />
          </View>
        )}
      </View>
      <View style={{ gap: 7 }}>
        <Text style={label}>Green in regulation</Text>
        <Text style={muted}>Reach the putting surface in par minus 2 strokes or fewer, including penalties: one on a par 3, two on a par 4, three on a par 5.</Text>
        {girNA ? <Text style={muted}>Not applicable below par 3.</Text> : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Choice testID="performance-gir-hit" label="Hit" selected={gir === true} disabled={disabled} onPress={() => { setGir(true); setMessage(''); }} />
            <Choice testID="performance-gir-miss" label="Missed" selected={gir === false} disabled={disabled} onPress={() => { setGir(false); setMessage(''); }} />
            <Choice testID="performance-gir-unknown" label="Unknown" selected={gir === null} disabled={disabled} onPress={() => { setGir(null); setMessage(''); }} />
          </View>
        )}
      </View>
      {locked ? <Text style={{ color: colors.destructive, fontSize: 14, lineHeight: 20 }}>Editing is paused until local storage is ready and any storage warning is resolved.</Text> : null}
      {shownError ? <Text testID="hole-performance-error" style={{ color: colors.destructive, fontSize: 14, lineHeight: 20 }}>{shownError}</Text> : null}
      {message && !dirty ? <Text testID="hole-performance-saved" style={{ color: colors.emerald, fontSize: 14 }}>{message}</Text> : null}
      {dirty ? <Text style={muted}>Unsaved changes.</Text> : null}
      <ActionButton testID="save-hole-performance" title="Save statistics" icon="check" disabled={disabled || !dirty || !!live.problem} onPress={save} />
      <ActionButton testID="discard-hole-performance" title="Discard edits" icon="rotate-ccw" secondary disabled={!dirty} onPress={discard} />
    </Card>
  );
}

export function SavedRoundPerformanceEditor({ round }: { round: GolfRound }) {
  const colors = useColors();
  const scoredHoles = round.holes.filter((h) => h.score !== null && Number.isFinite(h.score));
  const [selected, setSelected] = useState<number | null>(scoredHoles[0]?.hole ?? null);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState('');
  const hole = scoredHoles.find((h) => h.hole === selected) ?? scoredHoles[0];

  if (!hole) return <Card><EmptyNote>This scorecard has no scored holes, so there are no statistics to edit.</EmptyNote></Card>;

  function choose(n: number) {
    if (n === hole.hole) return;
    if (dirty) { setNotice(`Save or discard your edits on hole ${hole.hole} before choosing another hole.`); return; }
    setNotice(''); setSelected(n);
  }
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {scoredHoles.map((h) => {
          const on = h.hole === hole.hole;
          return (
            <Pressable key={h.hole} testID={`performance-select-hole-${h.hole}`} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => choose(h.hole)}
              style={{ width: 46, height: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.primaryFill : colors.muted, borderColor: on ? colors.rim : colors.border, opacity: dirty && !on ? 0.5 : 1 }}>
              <Text style={{ color: on ? colors.primaryForeground : colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 15 }}>{h.hole}</Text>
            </Pressable>
          );
        })}
      </View>
      {notice ? <Text style={{ color: colors.destructive, fontSize: 14, lineHeight: 20 }}>{notice}</Text> : null}
      <HolePerformanceEditor key={`${round.id}-${hole.hole}`} roundId={round.id} hole={hole} onDirtyChange={(d) => { setDirty(d); if (!d) setNotice(''); }} />
    </View>
  );
}
