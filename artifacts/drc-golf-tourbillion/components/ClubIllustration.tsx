import React from 'react';
import { Image } from 'react-native';

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

const SOURCES: Record<ClubType, number> = {
  driver: require('../assets/images/clubs/driver.png'),
  wood: require('../assets/images/clubs/wood.png'),
  hybrid: require('../assets/images/clubs/hybrid.png'),
  iron: require('../assets/images/clubs/iron.png'),
  wedge: require('../assets/images/clubs/wedge.png'),
  putter: require('../assets/images/clubs/putter.png'),
};

export function ClubIllustration({ name, size = 60 }: { name: string; size?: number }) {
  return (
    <Image
      source={SOURCES[getClubType(name)]}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessible={false}
    />
  );
}
