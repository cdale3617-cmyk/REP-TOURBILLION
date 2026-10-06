import React from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ActionButton, Card, Page, PageHeading, Pill, SectionTitle } from '@/components/Primitives';
import { ClubIllustration } from '@/components/ClubIllustration';
import { useGolf } from '@/context/GolfContext';
import { useColors } from '@/hooks/useColors';

const toDisplay = (meters: number, unit: 'm' | 'yd') => Math.round(unit === 'yd' ? meters * 1.09361 : meters);
const toMeters = (value: string, unit: 'm' | 'yd') => {
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? Math.max(0, unit === 'yd' ? number / 1.09361 : number) : 0;
};

export default function BagScreen() {
  const colors = useColors();
  const { bag, unit, setUnit, updateClub, addClub, removeClub } = useGolf();
  const wedges = bag.filter((club) => /wedge|^pw$|^gw$|^sw$|^lw$/i.test(club.name));
  return (
    <Page>
      <PageHeading eyebrow="Equipment" title="BAG" subtitle="Set each club’s make, model, loft and measured carry. The Caddie uses your saved club details." />
      <Card style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>{bag.length} clubs in your bag</Text>
          <Text style={[styles.summarySub, { color: colors.mutedForeground }]}>{wedges.length} wedges · {unit === 'm' ? 'Metric' : 'Imperial'} carry display</Text>
        </View>
        <View style={[styles.segment, { backgroundColor: colors.muted }]}>
          {(['m', 'yd'] as const).map((option) => (
            <Pressable key={option} testID={`unit-${option}`} accessibilityRole="button" onPress={() => setUnit(option)} style={[styles.unitButton, unit === option && { backgroundColor: colors.primaryFill }]}>
              <Text style={[styles.unitText, { color: unit === option ? colors.primaryForeground : colors.mutedForeground }]}>{option === 'm' ? 'M' : 'YD'}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <SectionTitle trailing={<Pill>{unit === 'm' ? 'CARRY · M' : 'CARRY · YD'}</Pill>}>Club setup</SectionTitle>
      {bag.map((club) => {
        const nextLowerCarry = bag.reduce(
          (nearest, item) => item.carryMeters > 0 && item.carryMeters < club.carryMeters && item.carryMeters > nearest
            ? item.carryMeters
            : nearest,
          0,
        );
        const carryGap = nextLowerCarry ? club.carryMeters - nextLowerCarry : null;
        return (
        <Card key={`${club.id}-${unit}`} style={styles.clubCard}>
          <View style={styles.clubHeader}>
            <View style={[styles.clubIcon, { backgroundColor: colors.secondary }]}><ClubIllustration name={club.name} /></View>
            <TextInput
              testID={`club-name-${club.id}`}
              value={club.name}
              onChangeText={(name) => updateClub(club.id, { name })}
              placeholder="Club name"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.clubName, { color: colors.foreground, borderColor: colors.border }]}
            />
            <Pressable testID={`save-club-${club.id}`} accessibilityRole="button" accessibilityLabel={`Finish editing ${club.name}`} onPress={() => Keyboard.dismiss()} hitSlop={8}>
              <Feather name="check" size={17} color={colors.primary} />
            </Pressable>
            <Pressable testID={`remove-club-${club.id}`} accessibilityRole="button" accessibilityLabel={`Remove ${club.name}`} onPress={() => removeClub(club.id)} hitSlop={8}>
              <Feather name="minus-circle" size={17} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <View style={styles.makeModelRow}>
            <View style={styles.makeModelField}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>MAKE</Text>
              <TextInput
                testID={`club-make-${club.id}`}
                accessibilityLabel={`Make of ${club.name}`}
                value={club.make ?? ''}
                onChangeText={(make) => updateClub(club.id, { make })}
                placeholder="e.g. Titleist"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                maxLength={60}
                returnKeyType="next"
                style={[styles.detailInput, { color: colors.foreground, borderColor: colors.border }]}
              />
            </View>
            <View style={styles.makeModelField}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>MODEL</Text>
              <TextInput
                testID={`club-model-${club.id}`}
                accessibilityLabel={`Model of ${club.name}`}
                value={club.model ?? ''}
                onChangeText={(model) => updateClub(club.id, { model })}
                placeholder="e.g. T150"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                maxLength={60}
                returnKeyType="done"
                style={[styles.detailInput, { color: colors.foreground, borderColor: colors.border }]}
              />
            </View>
          </View>
          <View style={styles.inputsRow}>
            <View style={styles.inputBox}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>CARRY · {unit}</Text>
              <TextInput
                testID={`club-carry-${club.id}`}
                defaultValue={String(toDisplay(club.carryMeters, unit))}
                onEndEditing={(event) => updateClub(club.id, { carryMeters: toMeters(event.nativeEvent.text, unit) })}
                keyboardType="decimal-pad"
                selectTextOnFocus
                style={[styles.numeric, { color: colors.foreground }]}
              />
            </View>
            <View style={[styles.inputDivider, { backgroundColor: colors.border }]} />
            <View style={styles.inputBox}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>LOFT · °</Text>
              <TextInput
                testID={`club-loft-${club.id}`}
                defaultValue={String(club.loft)}
                onEndEditing={(event) => {
                  const value = Number(event.nativeEvent.text.replace(',', '.'));
                  if (Number.isFinite(value)) updateClub(club.id, { loft: Math.max(0, Math.min(90, value)) });
                }}
                keyboardType="decimal-pad"
                selectTextOnFocus
                style={[styles.numeric, { color: colors.foreground }]}
              />
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>GAP</Text>
              <Text style={[styles.gapText, { color: colors.primary }]}>{carryGap ? `${toDisplay(carryGap, unit)} ${unit}` : '—'}</Text>
            </View>
          </View>
        </Card>
        );
      })}
      <ActionButton title="Add club" icon="plus" secondary onPress={addClub} testID="add-club" />
      <Text style={[styles.note, { color: colors.mutedForeground }]}>Replace starting carry numbers with your measured distances. Gap is the difference to your next shorter club. Changes save on this device.</Text>
    </Page>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15 },
  summaryTitle: { fontSize: 17, lineHeight: 23, fontFamily: 'Inter_700Bold' },
  summarySub: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', marginTop: 5, flexShrink: 1 },
  segment: { borderRadius: 12, padding: 3, flexDirection: 'row' },
  unitButton: { borderRadius: 9, minWidth: 42, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  unitText: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
  clubCard: { padding: 14, gap: 14 },
  clubHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clubIcon: { height: 40, width: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  clubName: { flex: 1, minWidth: 0, minHeight: 40, borderBottomWidth: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', paddingVertical: 5 },
  makeModelRow: { flexDirection: 'row', gap: 12 },
  makeModelField: { flex: 1, minWidth: 0 },
  detailInput: { minHeight: 42, borderBottomWidth: 1, fontSize: 15, lineHeight: 21, fontFamily: 'Inter_500Medium', paddingVertical: 6 },
  inputsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputBox: { flex: 1, minWidth: 0 },
  inputLabel: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.35 },
  numeric: { fontSize: 21, lineHeight: 27, fontFamily: 'Inter_600SemiBold', paddingTop: 4, minWidth: 0, width: '100%' },
  inputDivider: { width: 1, height: 38 },
  gapText: { fontSize: 15, lineHeight: 21, fontFamily: 'Inter_600SemiBold', marginTop: 7 },
  note: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', marginTop: -1 },
});