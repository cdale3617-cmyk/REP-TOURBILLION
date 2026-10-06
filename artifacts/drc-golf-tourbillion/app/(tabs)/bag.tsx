import React, { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/AppText';
import { Feather } from '@expo/vector-icons';
import { ActionButton, Card, Page, PageHeading } from '@/components/Primitives';
import { ClubIllustration } from '@/components/ClubIllustration';
import { useGolf, type Club } from '@/context/GolfContext';
import { useColors } from '@/hooks/useColors';

type Unit = 'm' | 'yd';
const toDisplay = (meters: number, unit: Unit) => Math.round(unit === 'yd' ? meters * 1.09361 : meters);
const fromDisplay = (value: number, unit: Unit) => Math.max(0, unit === 'yd' ? value / 1.09361 : value);
const parseNum = (text: string): number | null => {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

function NumberField({ testID, label, shown, onValid, validate, error }: {
  testID: string; label: string; shown: string; onValid: (n: number) => void; validate: (n: number) => boolean; error: string;
}) {
  const colors = useColors();
  const [text, setText] = useState(shown);
  useEffect(() => {
    // Adopt external changes (tile +/-, unit switch) unless the text already represents the same value.
    const n = parseNum(text);
    if (n === null || String(Math.round(n)) !== shown && String(n) !== shown) setText(shown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
  const n = parseNum(text);
  const invalid = n === null || !validate(n);
  return (
    <View style={styles.inputBox}>
      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        testID={testID}
        value={text}
        onChangeText={(t) => { setText(t); const v = parseNum(t); if (v !== null && validate(v)) onValid(v); }}
        onBlur={() => { if (invalid) setText(shown); }}
        keyboardType="decimal-pad"
        selectTextOnFocus
        style={[styles.numeric, { color: colors.foreground, borderColor: invalid ? colors.destructive : 'transparent' }]}
      />
      {invalid ? <Text style={[styles.err, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

function Tile({ club, unit, selected, onSelect, onStep }: { club: Club; unit: Unit; selected: boolean; onSelect: () => void; onStep: (d: number) => void }) {
  const colors = useColors();
  return (
    <View style={[styles.tile, { backgroundColor: colors.card, borderColor: selected ? colors.primary : colors.border, borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth }]}>
      <Pressable
        testID={`bag-tile-${club.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${club.name || 'Club'}, ${toDisplay(club.carryMeters, unit)} ${unit}. Edit club details`}
        accessibilityState={{ selected }}
        onPress={onSelect}
        style={styles.tileSelect}
      >
        <ClubIllustration name={club.name} size={36} />
        <View style={styles.tileInfo}>
          <Text numberOfLines={1} style={[styles.tileName, { color: colors.foreground }]}>{club.name || 'Club'}</Text>
          <Text numberOfLines={1} style={[styles.tileDist, { color: colors.foreground }]}>{toDisplay(club.carryMeters, unit)}<Text style={styles.tileUnit}> {unit}</Text></Text>
        </View>
      </Pressable>
      <View style={styles.tileControls}>
        <Pressable testID={`bag-minus-${club.id}`} accessibilityRole="button" accessibilityLabel={`Decrease ${club.name} carry`} onPress={(event) => { event.stopPropagation(); onStep(-1); }} style={[styles.step, { borderColor: colors.rim }]}>
          <Feather name="minus" size={16} color={colors.foreground} />
        </Pressable>
        <Pressable testID={`bag-plus-${club.id}`} accessibilityRole="button" accessibilityLabel={`Increase ${club.name} carry`} onPress={(event) => { event.stopPropagation(); onStep(1); }} style={[styles.step, { borderColor: colors.rim }]}>
          <Feather name="plus" size={16} color={colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

export default function BagScreen() {
  const colors = useColors();
  const { bag, unit, setUnit, updateClub, addClub, removeClub } = useGolf();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const club = bag.find((c) => c.id === selectedId) ?? bag[0] ?? null;

  const step = (c: Club, d: number) => {
    const next = Math.max(0, toDisplay(c.carryMeters, unit) + d);
    updateClub(c.id, { carryMeters: fromDisplay(next, unit) });
  };
  const remove = (id: string) => {
    const i = bag.findIndex((c) => c.id === id);
    const rest = bag.filter((c) => c.id !== id);
    setSelectedId(rest.length ? rest[Math.min(i, rest.length - 1)].id : null);
    removeClub(id);
  };
  const handleAdd = () => {
    addClub();
  };
  // After adding, bag grows: select the new club.
  const [lastLen, setLastLen] = useState(bag.length);
  useEffect(() => {
    if (bag.length > lastLen) setSelectedId(bag[bag.length - 1].id);
    setLastLen(bag.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bag.length]);

  const half = Math.ceil(bag.length / 2);
  const columns = [bag.slice(0, half), bag.slice(half)];

  const nextLower = club ? bag.reduce((n, i) => i.carryMeters > 0 && i.carryMeters < club.carryMeters && i.carryMeters > n ? i.carryMeters : n, 0) : 0;
  const gap = club && nextLower ? club.carryMeters - nextLower : null;

  return (
    <Page>
      <PageHeading eyebrow="Equipment" title="BAG" right={<Text style={[styles.count, { color: colors.foreground }]}>{bag.length}<Text style={[styles.countUnit, { color: colors.mutedForeground }]}> CLUBS</Text></Text>} />
      <Card style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>Carry distances</Text>
          <Text style={[styles.summarySub, { color: colors.mutedForeground }]}>Changes save automatically</Text>
        </View>
        <View style={[styles.segment, { backgroundColor: colors.muted }]}>
          {(['m', 'yd'] as const).map((option) => (
            <Pressable key={option} testID={`unit-${option}`} accessibilityRole="button" onPress={() => setUnit(option)} style={[styles.unitButton, unit === option && { backgroundColor: colors.primaryFill }]}>
              <Text style={[styles.unitText, { color: unit === option ? colors.primaryForeground : colors.mutedForeground }]}>{option === 'm' ? 'M' : 'YD'}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {bag.length === 0 ? (
        <Card style={{ padding: 18, alignItems: 'center', gap: 6 }}>
          <Feather name="briefcase" size={22} color={colors.mutedForeground} />
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>Your bag is empty</Text>
          <Text style={[styles.summarySub, { color: colors.mutedForeground }]}>Add a club to start setting distances.</Text>
        </Card>
      ) : (
        <View style={styles.grid}>
          {columns.map((col, ci) => (
            <View key={ci} style={styles.col}>
              {col.map((c) => (
                <Tile key={c.id} club={c} unit={unit} selected={club?.id === c.id} onSelect={() => setSelectedId(c.id)} onStep={(d) => { setSelectedId(c.id); step(c, d); }} />
              ))}
            </View>
          ))}
        </View>
      )}

      {club ? (
        <Card key={club.id} style={styles.clubCard}>
          <View style={styles.clubHeader}>
            <ClubIllustration name={club.name} size={44} />
            <TextInput
              testID={`club-name-${club.id}`}
              value={club.name}
              onChangeText={(name) => updateClub(club.id, { name })}
              placeholder="Club name"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.clubName, { color: colors.foreground, borderColor: colors.border }]}
            />
            <Pressable testID={`save-club-${club.id}`} accessibilityRole="button" accessibilityLabel={`Finish editing ${club.name}`} onPress={() => Keyboard.dismiss()} hitSlop={8} style={styles.finish}>
              <Feather name="check" size={17} color={colors.primary} />
              <Text style={[styles.finishText, { color: colors.primary }]}>Done</Text>
            </Pressable>
            <Pressable testID={`remove-club-${club.id}`} accessibilityRole="button" accessibilityLabel={`Remove ${club.name}`} onPress={() => remove(club.id)} hitSlop={8}>
              <Feather name="minus-circle" size={19} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <View style={styles.makeModelRow}>
            <View style={styles.makeModelField}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>MAKE</Text>
              <TextInput testID={`club-make-${club.id}`} accessibilityLabel={`Make of ${club.name}`} value={club.make ?? ''} onChangeText={(make) => updateClub(club.id, { make })} placeholder="e.g. Titleist" placeholderTextColor={colors.mutedForeground} autoCapitalize="words" maxLength={60} returnKeyType="next" style={[styles.detailInput, { color: colors.foreground, borderColor: colors.border }]} />
            </View>
            <View style={styles.makeModelField}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>MODEL</Text>
              <TextInput testID={`club-model-${club.id}`} accessibilityLabel={`Model of ${club.name}`} value={club.model ?? ''} onChangeText={(model) => updateClub(club.id, { model })} placeholder="e.g. T150" placeholderTextColor={colors.mutedForeground} autoCapitalize="words" maxLength={60} returnKeyType="done" style={[styles.detailInput, { color: colors.foreground, borderColor: colors.border }]} />
            </View>
          </View>
          <View style={styles.inputsRow}>
            <NumberField
              key={`carry-${club.id}-${unit}`}
              testID={`club-carry-${club.id}`}
              label={`CARRY · ${unit}`}
              shown={String(toDisplay(club.carryMeters, unit))}
              validate={(n) => n >= 0}
              error="Enter 0 or more"
              onValid={(n) => updateClub(club.id, { carryMeters: fromDisplay(n, unit) })}
            />
            <View style={[styles.inputDivider, { backgroundColor: colors.border }]} />
            <NumberField
              key={`loft-${club.id}`}
              testID={`club-loft-${club.id}`}
              label="LOFT · °"
              shown={String(club.loft)}
              validate={(n) => n >= 0 && n <= 90}
              error="0 to 90"
              onValid={(n) => updateClub(club.id, { loft: n })}
            />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>GAP</Text>
              <Text style={[styles.gapText, { color: colors.primary }]}>{gap ? `${toDisplay(gap, unit)} ${unit}` : '—'}</Text>
            </View>
          </View>
        </Card>
      ) : null}
      <ActionButton title="Add club" icon="plus" secondary onPress={handleAdd} testID="add-club" />
      <Text style={[styles.note, { color: colors.mutedForeground }]}>Saved automatically on this device. Gap is the difference to your next shorter club.</Text>
    </Page>
  );
}

const styles = StyleSheet.create({
  count: { fontSize: 22, lineHeight: 28, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
  countUnit: { fontSize: 11, letterSpacing: 1.4 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 14 },
  summaryTitle: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter_700Bold' },
  summarySub: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular', flexShrink: 1 },
  segment: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#46505D', padding: 3, flexDirection: 'row' },
  unitButton: { borderRadius: 7, minWidth: 42, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  unitText: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
  grid: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  col: { flex: 1, minWidth: 0, gap: 8 },
  tile: { borderRadius: 10, padding: 6, gap: 4, minWidth: 0, flexDirection: 'row', alignItems: 'center', minHeight: 78 },
  tileSelect: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 60 },
  tileInfo: { flex: 1, minWidth: 0, gap: 3 },
  tileName: { minWidth: 0, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold' },
  tileControls: { gap: 4 },
  step: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tileDist: { minWidth: 0, fontSize: 17, lineHeight: 22, fontFamily: 'Inter_700Bold' },
  tileUnit: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  clubCard: { padding: 14, gap: 12 },
  clubHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clubName: { flex: 1, minWidth: 0, minHeight: 40, borderBottomWidth: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', paddingVertical: 5 },
  finish: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  finishText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  makeModelRow: { flexDirection: 'row', gap: 12 },
  makeModelField: { flex: 1, minWidth: 0 },
  detailInput: { minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.03)', fontSize: 15, lineHeight: 21, fontFamily: 'Inter_500Medium', paddingVertical: 6, marginTop: 4 },
  inputsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  inputBox: { flex: 1, minWidth: 0 },
  inputLabel: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  numeric: { fontSize: 21, lineHeight: 27, fontFamily: 'Inter_600SemiBold', paddingTop: 4, minWidth: 0, width: '100%', borderBottomWidth: 1 },
  err: { fontSize: 11, lineHeight: 15, fontFamily: 'Inter_500Medium' },
  inputDivider: { width: 1, height: 38, marginTop: 4 },
  gapText: { fontSize: 15, lineHeight: 21, fontFamily: 'Inter_600SemiBold', marginTop: 7 },
  note: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular' },
});
