import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Club } from '@/context/GolfContext';
import { ActionButton, Card, Field, Pill } from './Primitives';
import { useColors } from '@/hooks/useColors';

export function WedgeMatrixCard({ club, unit, entry, onSave, onSaveFull }: {
  club: Club; unit: 'm' | 'yd';
  entry?: { threeQuarter: number | null; half: number | null };
  onSave: (swing: 'threeQuarter' | 'half', value: number | null) => void;
  onSaveFull: (value: number) => void;
}) {
  const colors = useColors();
  const factor = unit === 'yd' ? 1.09361 : 1;
  const display = (value?: number | null) => value == null ? '' : String(Math.round(value * factor * 100) / 100);
  const savedFullCarry = display(club.carryMeters);
  const [full, setFull] = useState(savedFullCarry);
  const [threeQuarter, setThreeQuarter] = useState(display(entry?.threeQuarter));
  const [half, setHalf] = useState(display(entry?.half));
  const [message, setMessage] = useState('');
  useEffect(() => setFull(savedFullCarry), [savedFullCarry]);
  return <Card>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', flex: 1, fontSize: 17 }}>{club.name}</Text><Pill tone="muted">{club.loft}°</Pill>
    </View>
    <Field label={`Full carry · ${unit}`} value={full} onChangeText={setFull} keyboardType="decimal-pad" placeholder="Measured full carry" />
    <Field label={`Three-quarter carry · ${unit}`} value={threeQuarter} onChangeText={setThreeQuarter} keyboardType="decimal-pad" />
    <Field label={`Half carry · ${unit}`} value={half} onChangeText={setHalf} keyboardType="decimal-pad" />
    <ActionButton title="Save wedge distances" icon="check" secondary testID={`save-wedge-${club.id}`} onPress={() => {
      const parse = (text: string) => text.trim() ? Number(text.replace(',', '.')) / factor : null;
      const fullDistance = parse(full);
      const three = parse(threeQuarter), small = parse(half);
      if (fullDistance === null || !Number.isFinite(fullDistance) || fullDistance < 0) { setMessage('Enter a valid full carry distance.'); return; }
      if ([three, small].some((value) => value !== null && (!Number.isFinite(value) || value < 0))) { setMessage('Enter positive distances, or leave a field blank.'); return; }
      onSaveFull(fullDistance);
      onSave('threeQuarter', three); onSave('half', small);
      setMessage('Full, three-quarter and half distances updated.');
    }} />
    {message ? <Text style={{ color: colors.primary, lineHeight: 20 }}>{message}</Text> : null}
  </Card>;
}