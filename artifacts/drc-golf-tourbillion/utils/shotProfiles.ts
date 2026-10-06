import type { Club, PracticeActivity } from '@/context/GolfContext';
import { matchesShotConditions, type ShotConditions } from './shotConditions';

export type ShotProfile = {
  clubId: string;
  count: number;
  medianCarry: number;
  lowCarry: number;
  highCarry: number;
  minCarry: number;
  maxCarry: number;
  medianSide: number;
  lowSide: number;
  highSide: number;
  lastRecordedAt: string;
  conditions?: ShotConditions;
};

// Equipment identity deliberately excludes display name and the editable bag carry.
export function clubSetupKey(club: Pick<Club, 'make' | 'model' | 'loft'>): string {
  return JSON.stringify([club.make?.trim().toLowerCase() ?? '', club.model?.trim().toLowerCase() ?? '', club.loft ?? null]);
}

export function shotBelongsToClub(entry: PracticeActivity, club: Club, bag: Club[]): boolean {
  if (entry.tool !== 'shot-pattern') return false;
  if (entry.clubId) return entry.clubId === club.id && (!entry.clubSetupKey || entry.clubSetupKey === clubSetupKey(club));
  // Never reinterpret an explicitly linked, deleted club as a similarly named replacement.
  return entry.title === club.name && bag.filter(item => item.name === entry.title).length === 1;
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const low = Math.floor(position);
  return sorted[low] + (sorted[Math.ceil(position)] - sorted[low]) * (position - low);
}

export function buildShotProfiles(bag: Club[], activities: PracticeActivity[], conditions?: ShotConditions): ShotProfile[] {
  return bag.flatMap(club => {
    const shots = activities.filter(entry => shotBelongsToClub(entry, club, bag)
      && matchesShotConditions(entry.shotConditions, conditions)
      && typeof entry.value === 'number' && Number.isFinite(entry.value) && entry.value > 0 && entry.value <= 1000
      && typeof entry.lateral === 'number' && Number.isFinite(entry.lateral) && Math.abs(entry.lateral) <= 1000
      && Number.isFinite(Date.parse(entry.createdAt)))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 40);
    if (!shots.length) return [];
    const carries = shots.map(entry => entry.value!);
    const sides = shots.map(entry => entry.lateral!);
    return [{
      clubId: club.id, count: shots.length,
      medianCarry: percentile(carries, 0.5), lowCarry: percentile(carries, 0.1), highCarry: percentile(carries, 0.9),
      minCarry: Math.min(...carries), maxCarry: Math.max(...carries),
      medianSide: percentile(sides, 0.5), lowSide: percentile(sides, 0.1), highSide: percentile(sides, 0.9),
      lastRecordedAt: shots[0].createdAt,
      conditions,
    }];
  });
}
