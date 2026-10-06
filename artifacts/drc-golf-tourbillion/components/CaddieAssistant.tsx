import React, { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useGolf } from '@/context/GolfContext';
import { buildCaddieReply } from '@/utils/caddieAdvice';
import type { CaddieAdviceContext } from '@/utils/caddieAdvice';
import { buildShotProfiles } from '@/utils/shotProfiles';
import { Field } from './Primitives';
import { ShotConditionsPicker } from './ShotConditionsPicker';
import { resolveShotConditions, type ShotConditions } from '@/utils/shotConditions';

export function CaddieAssistant(props: CaddieAdviceContext) {
  const colors = useColors();
  const { activities, bag } = useGolf();
  const [conditions, setConditions] = useState<ShotConditions>({});
  const [minimumCarry, setMinimumCarry] = useState('');
  const [maximumCarry, setMaximumCarry] = useState('');
  const [troubleSide, setTroubleSide] = useState<'left' | 'right' | undefined>();
  const [question, setQuestion] = useState('');
  const resolved = useMemo(() => resolveShotConditions(question, conditions), [question, conditions]);
  const profiles = useMemo(() => buildShotProfiles(bag, activities, resolved.conditions), [bag, activities, resolved]);
  const readyCount = profiles.filter(profile => profile.count >= 5).length;
  const [answer, setAnswer] = useState('Ask about a shot. Include your lie, distance and wind direction. Example: “Ball in right rough, 156 m out, wind left to right.”');
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState('');

  const latestFlight = activities.find((entry) =>
    entry.tool === 'shot-tracer'
    && entry.metrics?.source === 'manual-launch-monitor-or-coach'
    && [entry.metrics.ballSpeedMph, entry.metrics.clubSpeedMph, entry.metrics.apex, entry.metrics.carry].some((value) => value !== undefined),
  );
  const latestImpact = activities.find((entry) =>
    entry.tool === 'swing-monitor'
    && entry.metrics?.source === 'manual-launch-monitor-or-coach'
    && [
      entry.metrics.clubPathDeg, entry.metrics.faceAngleDeg, entry.metrics.tempoRatio,
      entry.metrics.maxForceBodyWeightPct, entry.metrics.torqueNm, entry.metrics.forceTransferPct,
      entry.metrics.pressureLeftPct, entry.metrics.pressureRightPct,
    ].some((value) => value !== undefined),
  );
  const latestPhoneMotion = activities.find((entry) => entry.phoneMotion?.source === 'phone-motion-sensors');
  const caddieContext = {
    ...props,
    shotProfiles: profiles,
    shotConditions: conditions,
    recentFlight: latestFlight?.metrics ? { ...latestFlight.metrics, createdAt: latestFlight.createdAt } : undefined,
    recentImpact: latestImpact?.metrics ? { ...latestImpact.metrics, createdAt: latestImpact.createdAt } : undefined,
    recentPhoneMotion: latestPhoneMotion?.phoneMotion,
  };

  useEffect(() => () => { void Speech.stop(); }, []);
  useEffect(() => {
    setMinimumCarry(''); setMaximumCarry(''); setTroubleSide(undefined);
    setConditions({});
    setAnswer('Ask about a shot. Include your lie, distance and wind direction. Recorded club ranges become available after 5 carry-and-side shots per club.');
    void Speech.stop().catch(() => undefined);
    setSpeaking(false);
  }, [props.unit, props.currentHole]);

  function askCaddie() {
    const trimmed = question.trim();
    if (!trimmed) return;
    if (resolved.error) { setAnswer(resolved.error); void Speech.stop().catch(() => undefined); setSpeaking(false); return; }
    const factor = props.unit === 'yd' ? 1.09361 : 1;
    const minimum = minimumCarry.trim() ? Number(minimumCarry.replace(',', '.')) / factor : undefined;
    const maximum = maximumCarry.trim() ? Number(maximumCarry.replace(',', '.')) / factor : undefined;
    if ([minimum, maximum].some(value => value !== undefined && (!Number.isFinite(value) || value <= 0 || value > 1000))
      || (minimum !== undefined && maximum !== undefined && minimum >= maximum)) {
      setAnswer('Check your carry limits: use positive distances up to 1000 m (1094 yd), with “Must carry” below “Trouble beyond”. Your question has not been cleared.');
      void Speech.stop().catch(() => undefined); setSpeaking(false);
      return;
    }
    setAnswer(buildCaddieReply(trimmed, { ...caddieContext, shotLimits: { minimumCarryMeters: minimum, maximumCarryMeters: maximum, troubleSide } }));
    // Retain the question so condition edits and the visible matching count agree.
    setSpeechError('');
    Keyboard.dismiss();
    void Speech.stop().then(() => setSpeaking(false)).catch(() => setSpeaking(false));
  }

  function speakAnswer() {
    if (!answer) return;
    setSpeechError('');
    setSpeaking(true);
    Speech.speak(answer, {
      language: 'en-AU',
      rate: 0.92,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => {
        setSpeaking(false);
        setSpeechError('Phone speech is unavailable. Check that a text-to-speech voice is installed.');
      },
    });
  }

  function stopSpeaking() {
    void Speech.stop().then(() => setSpeaking(false)).catch(() => setSpeaking(false));
  }

  return (
    <View style={styles.container}>
      <View style={styles.answerFooter}>
        <Text testID="caddie-profile-count" style={[styles.modeLabel, { color: colors.primary }]}>{readyCount} {readyCount === 1 ? 'CLUB' : 'CLUBS'} WITH 5+ SHOTS</Text>
        <Pressable testID="caddie-record-shots" accessibilityRole="button" accessibilityLabel="Record measured shots in Shot Pattern" onPress={() => router.push('/tool/shot-pattern')} style={styles.recordButton}>
          <Feather name="target" size={16} color={colors.primary} />
          <Text style={[styles.speechLabel, { color: colors.primary }]}>Record shots</Text>
        </Pressable>
      </View>
      <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>Personal ranges use your latest 40 measured carry-and-side entries per club, not starter bag distances. Older name-only shots are used only for a unique matching club. New shots retain their club identity after a rename; shots from a different recorded make, model or loft are excluded.</Text>
      <ShotConditionsPicker value={conditions} onChange={setConditions} prefix="caddie" title="Shot conditions · optional" />
      <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>Ranges use the latest 40 matching records per club. Your question can also identify lie or wind. Known recovery shots are not pooled into normal-carry comparisons; untagged legacy shots are not assumed to match a requested condition.</Text>
      <Text style={[styles.modeLabel, { color: colors.foreground }]}>YOUR LANDING LIMITS · OPTIONAL</Text>
      <View style={styles.limitRow}>
        <View style={{ flex: 1 }}><Field label={`Must carry · ${props.unit}`} value={minimumCarry} onChangeText={setMinimumCarry} keyboardType="decimal-pad" placeholder="e.g. 140" testID="caddie-minimum-carry" /></View>
        <View style={{ flex: 1 }}><Field label={`Trouble beyond · ${props.unit}`} value={maximumCarry} onChangeText={setMaximumCarry} keyboardType="decimal-pad" placeholder="e.g. 165" testID="caddie-maximum-carry" /></View>
      </View>
      <View style={styles.troubleRow}>
        {([undefined, 'left', 'right'] as const).map(side => <Pressable key={side ?? 'none'} testID={`caddie-trouble-${side ?? 'none'}`} accessibilityRole="button" accessibilityState={{ selected: side === troubleSide }} onPress={() => setTroubleSide(side)} style={[styles.troubleButton, { borderColor: side === troubleSide ? colors.primary : colors.border, backgroundColor: colors.muted }]}>
          <Text style={[styles.speechLabel, { color: side === troubleSide ? colors.primary : colors.mutedForeground }]}>{side ? `Trouble ${side}` : 'No side marked'}</Text>
        </Pressable>)}
      </View>
      <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>You supply these limits; the app does not locate hazards. Leave blank if unknown. Changes apply to your next question.</Text>
      <View style={[styles.answerBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Text testID="caddie-answer" accessibilityLiveRegion="polite" style={[styles.answer, { color: colors.foreground }]}>{answer}</Text>
        <View style={styles.answerFooter}>
          <Text style={[styles.modeLabel, { color: colors.mutedForeground }]}>OFFLINE ADVICE</Text>
          <Pressable
            testID={speaking ? 'caddie-stop-speech' : 'caddie-speak'}
            accessibilityRole="button"
            accessibilityLabel={speaking ? 'Stop reading advice' : 'Read advice aloud'}
            onPress={speaking ? stopSpeaking : speakAnswer}
            style={({ pressed }) => [styles.speechButton, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name={speaking ? 'square' : 'volume-2'} size={15} color={colors.primary} />
            <Text style={[styles.speechLabel, { color: colors.primary }]}>{speaking ? 'Stop' : 'Read aloud'}</Text>
          </Pressable>
        </View>
      </View>
      {speechError ? <Text style={[styles.error, { color: colors.destructive }]}>{speechError}</Text> : null}
      <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.muted }]}>
        <TextInput
          testID="caddie-question-input"
          accessibilityLabel="Ask the caddie a question"
          value={question}
          onChangeText={setQuestion}
          placeholder={`Ask about your shot, e.g. rough, 156 ${props.unit} out, wind left to right`}
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={320}
          textAlignVertical="top"
          returnKeyType="send"
          onSubmitEditing={askCaddie}
          blurOnSubmit
          style={[styles.input, { color: colors.foreground }]}
        />
        <Pressable
          testID="caddie-send"
          accessibilityRole="button"
          accessibilityLabel="Send question to the caddie"
          disabled={!question.trim()}
          onPress={askCaddie}
          style={({ pressed }) => [
            styles.sendButton,
            { backgroundColor: colors.primaryFill, opacity: !question.trim() ? 0.45 : pressed ? 0.78 : 1 },
          ]}
        >
          <Feather name="arrow-up" size={18} color={colors.primaryForeground} />
        </Pressable>
      </View>
      <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>Advice is a snapshot; ask again when your distance or conditions change. Uses recorded shot patterns, your question and limits, bag carries, round/weather data and saved Lab references. Phone motion describes the phone only; Flight/Impact entries remain manual. No automatic ball measurement, hazard detection or exact-lie assessment.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  limitRow: { flexDirection: 'row', gap: 9 },
  troubleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  troubleButton: { minHeight: 44, paddingHorizontal: 9, justifyContent: 'center', borderWidth: 1, borderRadius: 10 },
  recordButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  container: { gap: 9, minWidth: 0 },
  answerBox: { borderWidth: 1, borderRadius: 12, padding: 13, gap: 11 },
  answer: { fontSize: 15, lineHeight: 23, fontFamily: 'Inter_400Regular' },
  answerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  modeLabel: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_700Bold', letterSpacing: 0.7 },
  speechButton: { minHeight: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  speechLabel: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_600SemiBold' },
  inputRow: { minHeight: 60, borderWidth: 1, borderRadius: 13, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, fontSize: 16, lineHeight: 23, paddingHorizontal: 8, paddingVertical: 8, fontFamily: 'Inter_400Regular' },
  sendButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  disclaimer: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  error: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium' },
});
