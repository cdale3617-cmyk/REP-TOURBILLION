/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#F4F0E5',
    tint: '#E0BD68',
    background: '#06130F',
    foreground: '#F4F0E5',
    card: '#0D241D',
    cardForeground: '#F4F0E5',
    primary: '#E0BD68',
    primaryForeground: '#0B1A14',
    secondary: '#16412F',
    secondaryForeground: '#E2F1E4',
    muted: '#102C23',
    mutedForeground: '#BDCDC1',
    accent: '#C99D54',
    accentForeground: '#10211D',
    destructive: '#C9725C',
    destructiveForeground: '#FFF7EF',
    overlay: 'rgba(0,0,0,0.62)',
    shadow: 'rgba(0,0,0,0.46)',
    border: '#385A48',
    input: '#416850',
    emerald: '#49A875',
    surfaceRaised: '#16382A',
    rim: '#8B7544',
    mapBase: '#102C27',
    mapContour: '#22443A',
    mapRough: '#47724F',
    mapFairway: '#61885B',
    mapOuterGreen: '#82946A',
    mapGreen: '#A9AD77',
  },

  dark: {
    text: '#F4F0E5',
    tint: '#E0BD68',
    background: '#06130F',
    foreground: '#F4F0E5',
    card: '#0D241D',
    cardForeground: '#F4F0E5',
    primary: '#E0BD68',
    primaryForeground: '#0B1A14',
    secondary: '#16412F',
    secondaryForeground: '#E2F1E4',
    muted: '#102C23',
    mutedForeground: '#BDCDC1',
    accent: '#C99D54',
    accentForeground: '#10211D',
    destructive: '#C9725C',
    destructiveForeground: '#FFF7EF',
    overlay: 'rgba(0,0,0,0.62)',
    shadow: 'rgba(0,0,0,0.46)',
    border: '#385A48',
    input: '#416850',
    emerald: '#49A875',
    surfaceRaised: '#16382A',
    rim: '#8B7544',
    mapBase: '#102C27',
    mapContour: '#22443A',
    mapRough: '#47724F',
    mapFairway: '#61885B',
    mapOuterGreen: '#82946A',
    mapGreen: '#A9AD77',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 18,
};

// Preserve the approved artwork/theme when off; the optional display mode
// changes UI surfaces and text only, not course geometry or saved golf data.
export const antiGlareColors = {
  ...colors.dark,
  text: '#FFFFFF', tint: '#FFFFFF', foreground: '#FFFFFF',
  background: '#000000', card: '#101010', cardForeground: '#FFFFFF',
  primary: '#FFFFFF', primaryForeground: '#FFFFFF',
  secondary: '#1A1A1A', secondaryForeground: '#FFFFFF',
  muted: '#171717', mutedForeground: '#FFFFFF',
  accent: '#FFFFFF', accentForeground: '#FFFFFF',
  destructive: '#FFFFFF', destructiveForeground: '#FFFFFF',
  emerald: '#FFFFFF', surfaceRaised: '#151515',
  border: '#666666', input: '#666666', rim: '#888888',
};

export function resolveColors(scheme: string | null | undefined, antiGlare: boolean) {
  const palette = antiGlare ? antiGlareColors : scheme === 'dark' ? colors.dark : colors.light;
  return { ...palette, primaryFill: antiGlare ? '#242424' : palette.primary, radius: colors.radius };
}

export default colors;
