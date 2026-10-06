import React from 'react';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';

type ClubType = 'driver' | 'wood' | 'hybrid' | 'iron' | 'wedge' | 'putter';

function getClubType(name: string): ClubType {
  const normalized = name.toLowerCase();
  if (normalized.includes('putter')) return 'putter';
  if (normalized.includes('wedge') || /\b(?:pw|gw|sw|lw)\b/i.test(name)) return 'wedge';
  if (normalized.includes('hybrid') || /\d+h\b/i.test(name)) return 'hybrid';
  if (normalized.includes('driver')) return 'driver';
  if (normalized.includes('wood') || /\d+w\b/i.test(name)) return 'wood';
  return 'iron';
}

export function ClubIllustration({ name }: { name: string }) {
  const colors = useColors();
  const type = getClubType(name);
  return (
    <Svg width={34} height={34} viewBox="0 0 40 40">
      <Path d="M31 6 L16 30" stroke={colors.foreground} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M30 4 L34 6" stroke={colors.mutedForeground} strokeWidth={4} strokeLinecap="round" />
      {type === 'putter' ? (
        <Rect x={7} y={29} width={15} height={5} rx={2.5} fill={colors.primary} />
      ) : type === 'driver' || type === 'wood' ? (
        <Ellipse
          cx={11}
          cy={33}
          rx={type === 'driver' ? 7.2 : 6}
          ry={type === 'driver' ? 4.6 : 4}
          fill={colors.primary}
        />
      ) : type === 'hybrid' ? (
        <Path d="M7.5 33 L10 28.5 L19.5 29.5 L22 33.5 L19.5 36 L9 35.5 Z" fill={colors.primary} />
      ) : type === 'wedge' ? (
        <Path d="M8 34.5 L10 29 L20.5 28 L23 32.5 L20 36 L10 36 Z" fill={colors.primary} />
      ) : (
        <Path d="M9 34 L11 29 L20 29.5 L22 33 L19.5 35.5 L10 35.5 Z" fill={colors.primary} />
      )}
    </Svg>
  );
}
