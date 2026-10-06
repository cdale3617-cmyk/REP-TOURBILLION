/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Charcoal, white and silver palette (user-selected). The app deliberately
 * uses the same dark palette for both device schemes; `emerald` is a legacy
 * token name that now resolves to silver.
 */

const colors = {
  light: {
    text: '#F4F6FA',
    tint: '#BEC7D3',
    background: '#11151B',
    foreground: '#F4F6FA',
    card: '#1A2029',
    cardForeground: '#F4F6FA',
    primary: '#BEC7D3',
    primaryForeground: '#11151B',
    secondary: '#2E3743',
    secondaryForeground: '#F4F6FA',
    muted: '#1D242D',
    mutedForeground: '#BEC7D3',
    accent: '#A9B3C1',
    accentForeground: '#11151B',
    destructive: '#E0806C',
    destructiveForeground: '#11151B',
    overlay: 'rgba(0,0,0,0.62)',
    shadow: 'rgba(0,0,0,0.46)',
    border: '#3C4552',
    input: '#566171',
    emerald: '#BEC7D3',
    surfaceRaised: '#242B35',
    rim: '#7C8795',
    mapBase: '#161B22',
    mapContour: '#2C3440',
    mapRough: '#4A5360',
    mapFairway: '#6B7684',
    mapOuterGreen: '#98A2B0',
    mapGreen: '#D5DBE4',
  },

  dark: {
    text: '#F4F6FA',
    tint: '#BEC7D3',
    background: '#11151B',
    foreground: '#F4F6FA',
    card: '#1A2029',
    cardForeground: '#F4F6FA',
    primary: '#BEC7D3',
    primaryForeground: '#11151B',
    secondary: '#2E3743',
    secondaryForeground: '#F4F6FA',
    muted: '#1D242D',
    mutedForeground: '#BEC7D3',
    accent: '#A9B3C1',
    accentForeground: '#11151B',
    destructive: '#E0806C',
    destructiveForeground: '#11151B',
    overlay: 'rgba(0,0,0,0.62)',
    shadow: 'rgba(0,0,0,0.46)',
    border: '#3C4552',
    input: '#566171',
    emerald: '#BEC7D3',
    surfaceRaised: '#242B35',
    rim: '#7C8795',
    mapBase: '#161B22',
    mapContour: '#2C3440',
    mapRough: '#4A5360',
    mapFairway: '#6B7684',
    mapOuterGreen: '#98A2B0',
    mapGreen: '#D5DBE4',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 18,
};

// Preserve the selected charcoal/white/silver theme when off; the optional display mode
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
