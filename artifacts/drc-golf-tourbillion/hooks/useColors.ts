import { useColorScheme } from 'react-native';
import { resolveColors } from '@/constants/colors';
import { useAppearance } from '@/context/AppearanceContext';

/**
 * Returns the design tokens for the current color scheme.
 *
 * The returned object contains all color tokens for the active palette
 * plus scheme-independent values like `radius`.
 *
 * Falls back to the light palette when no dark key is defined in
 * constants/colors.ts (the scaffold ships light-only by default).
 * When a sibling web artifact's dark tokens are synced into a `dark`
 * key, this hook will automatically switch palettes based on the
 * device's appearance setting.
 * The saved anti-glare preference overrides the device palette.
 */
export function useColors() {
  const scheme = useColorScheme();
  const { antiGlare } = useAppearance();
  return resolveColors(scheme, antiGlare);
}
