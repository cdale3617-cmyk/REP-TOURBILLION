import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText as Text } from './AppText';
import { useColors } from '@/hooks/useColors';

export function RoundScoreControls({ score, minimumScore, hole, total, played, blocked, onScore, onHole }: {
  score: number; minimumScore: number; hole: number; total: number; played: number;
  blocked: boolean; onScore: (score: number) => void; onHole: (hole: number) => void;
}) {
  const colors = useColors();
  const button = (id: string, label: string, icon: keyof typeof Feather.glyphMap, disabled: boolean, press: () => void) =>
    <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={press}
      style={[styles.button, { borderColor: colors.border, opacity: disabled ? 0.4 : 1 }]}>
      <Feather name={icon} size={18} color={colors.primary} />
    </Pressable>;
  return <View testID="round-primary-score" style={{ gap: 4 }}>
    <View style={styles.row}>
      {button('previous-hole', 'Previous hole', 'chevron-left', blocked || hole <= 1, () => onHole(hole - 1))}
      {button('score-minus', 'Subtract one stroke', 'minus', score <= minimumScore, () => onScore(Math.max(1, (score || 1) - 1)))}
      <View style={styles.score}>
        <Text style={[styles.number, { color: colors.foreground }]}>{score || '—'}</Text>
        <Text style={{ fontSize: 10, color: colors.mutedForeground }}>SCORE</Text>
      </View>
      {button('score-plus', 'Add one stroke', 'plus', score >= 99, () => onScore(score + 1))}
      {button('next-hole', 'Next hole', 'chevron-right', blocked || hole >= 18, () => onHole(hole + 1))}
    </View>
    <Text style={{ fontSize: 11, color: colors.mutedForeground, textAlign: 'center' }}>{played}/18 scored · Total {total || '—'}</Text>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'space-between' },
  button: { width: 44, height: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  score: { minWidth: 32, alignItems: 'center', flex: 1 },
  number: { fontSize: 24, lineHeight: 28, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
});
