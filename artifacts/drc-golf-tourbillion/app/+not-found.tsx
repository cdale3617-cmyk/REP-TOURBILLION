import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export default function NotFoundScreen() {
  const colors = useColors();

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.instrument, { backgroundColor: colors.card, borderColor: colors.rim }]}>
          <View style={[styles.mark, { backgroundColor: colors.secondary, borderColor: colors.emerald }]}>
            <Feather name="compass" size={21} color={colors.emerald} />
          </View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>DRC GOLF TEMPO</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>This screen doesn&apos;t exist.</Text>
          <Link href="/" style={[styles.link, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
            <Text style={[styles.linkText, { color: colors.secondaryForeground }]}>Go to home screen!</Text>
            <Feather name="arrow-right" size={16} color={colors.primary} />
          </Link>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    minHeight: '100%',
  },
  instrument: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    padding: 24,
    borderWidth: 1,
    borderRadius: 16,
    gap: 12,
  },
  mark: { width: 52, height: 52, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  eyebrow: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_700Bold', letterSpacing: 1.1 },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    lineHeight: 31,
  },
  link: {
    marginTop: 4,
    minHeight: 48,
    width: '100%',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  linkText: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter_600SemiBold',
  },
});
