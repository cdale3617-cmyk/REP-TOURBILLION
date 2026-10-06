import pacificHoles from '../data/pacific-holes.json';

export type Coordinate = { latitude: number; longitude: number };
export type VerifiedHole = {
  hole: number;
  par: number;
  osmWayId: string;
  path: Coordinate[];
  target: Coordinate;
};
export type CourseGeometry = {
  holes: VerifiedHole[];
  checkedAt: string;
  source: string;
  sourceUrl: string;
  latitude: number;
  longitude: number;
};

const holes: VerifiedHole[] = pacificHoles.map((item) => {
  const path = item.path.map(([latitude, longitude]) => ({ latitude, longitude }));
  return { ...item, path, target: path[path.length - 1] };
});
const pacific: CourseGeometry = {
  holes,
  checkedAt: '2026-10-04',
  source: 'OpenStreetMap · source-checked',
  sourceUrl: 'https://www.openstreetmap.org/relation/1668736',
  latitude: -27.5166,
  longitude: 153.1064,
};

export function getCourseGeometry(courseId?: string): CourseGeometry | null {
  return courseId === 'pacific-golf-club' || courseId === 'osm-relation-1668736' ? pacific : null;
}

export function canonicalCourseId(courseId: string): string {
  return getCourseGeometry(courseId) ? 'pacific-golf-club' : courseId;
}

export function migrateMappedCourseReference<T extends { courseId: string }>(
  record: T,
  targetCourseId: string,
): T {
  const geometry = getCourseGeometry(targetCourseId);
  return geometry && getCourseGeometry(record.courseId) === geometry
    ? { ...record, courseId: targetCourseId }
    : record;
}

export function mergeDiscoveredCourse<T extends { id: string; latitude: number; longitude: number }>(
  courses: T[],
  discovered: T,
): { id: string; courses: T[] } {
  const id = canonicalCourseId(discovered.id);
  const geometry = getCourseGeometry(id);
  const existing = courses.find((course) => course.id === id);
  const refreshed = {
    ...existing,
    ...discovered,
    id,
    ...(geometry ? { latitude: geometry.latitude, longitude: geometry.longitude } : {}),
  } as T;
  return {
    id,
    courses: [refreshed, ...courses.filter((course) => canonicalCourseId(course.id) !== id)],
  };
}

export function distanceMeters(from: Coordinate, to: Coordinate): number {
  const rad = (value: number) => value * Math.PI / 180;
  const a = Math.sin(rad(to.latitude - from.latitude) / 2) ** 2
    + Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude))
    * Math.sin(rad(to.longitude - from.longitude) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export type DeviceFix = Coordinate & { accuracy: number | null; timestamp: number; mocked?: boolean };

export type DailyPin = Coordinate & {
  courseId: string;
  hole: number;
  date: string;
  capturedAt: string;
  fixTimestamp: number;
  expiresAt: string;
  accuracy: number;
  provenance: 'user-device-gps';
  onGreenConfirmed: true;
};

export function localDate(now: number): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isDailyPinCurrent(pin: DailyPin, now: number): boolean {
  return pin.date === localDate(now) && Date.parse(pin.capturedAt) <= now
    && now < Date.parse(pin.expiresAt);
}

// Proximity is a safety check, not proof of green containment. The golfer must
// explicitly confirm they are beside the flag on this hole.
export function getPinCaptureProblem(fix: DeviceFix | null, target: Coordinate | undefined, requestedAt: number, now: number): string | null {
  if (!target) return 'This hole has no source-checked green reference. Pin capture is unavailable.';
  if (!fix) return 'Waiting for a new GPS fix. Stand beside the flag outdoors.';
  if (fix.mocked) return 'Simulated GPS cannot be used to record a pin.';
  if (![fix.latitude, fix.longitude, fix.timestamp, requestedAt, now].every(Number.isFinite)
    || Math.abs(fix.latitude) > 90 || Math.abs(fix.longitude) > 180) return 'Invalid GPS fix. Retry outdoors.';
  if (fix.timestamp < requestedAt || now - fix.timestamp > 10000 || fix.timestamp > now)
    return 'Waiting for a fresh fix taken after you started capture.';
  if (fix.accuracy === null || !Number.isFinite(fix.accuracy) || fix.accuracy <= 0 || fix.accuracy > 10)
    return 'Pin capture needs GPS accuracy within 10 m. Stay beside the flag and retry.';
  if (distanceMeters(fix, target) > 60) return 'You are more than 60 m from this hole’s mapped green reference. Check the hole; no pin was saved.';
  return null;
}

export function createDailyPin(courseId: string, hole: number, fix: DeviceFix, requestedAt: number, now: number): DailyPin {
  const target = getCourseGeometry(courseId)?.holes.find((item) => item.hole === hole)?.target;
  const problem = getPinCaptureProblem(fix, target, requestedAt, now);
  if (problem) throw new Error(problem);
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return {
    courseId, hole, latitude: fix.latitude, longitude: fix.longitude,
    accuracy: fix.accuracy!, date: localDate(now), capturedAt: new Date(now).toISOString(),
    fixTimestamp: fix.timestamp, expiresAt: new Date(Math.min(midnight.getTime(), now + 86400000)).toISOString(),
    provenance: 'user-device-gps', onGreenConfirmed: true,
  };
}

// Never turn an absent, old, inaccurate or off-course fix into a yardage.
export function getTargetDistance(fix: DeviceFix | null, target: Coordinate | undefined, now: number) {
  if (!target) return { meters: null, reason: 'No verified geometry for this hole.' };
  if (!fix) return { meters: null, reason: 'Enable GPS on the course to measure distance.' };
  if (![fix.latitude, fix.longitude, fix.timestamp].every(Number.isFinite)
    || Math.abs(fix.latitude) > 90 || Math.abs(fix.longitude) > 180) {
    return { meters: null, reason: 'Invalid GPS fix. Try again outdoors.' };
  }
  if (now - fix.timestamp > 30000 || fix.timestamp > now + 5000) {
    return { meters: null, reason: 'GPS fix expired. Waiting for a fresh position.' };
  }
  if (fix.accuracy === null || !Number.isFinite(fix.accuracy) || fix.accuracy < 0 || fix.accuracy > 30) {
    return { meters: null, reason: 'GPS accuracy is too low. Move outdoors for a better fix.' };
  }
  const meters = distanceMeters(fix, target);
  if (meters > 3000) return { meters: null, reason: 'You are away from this course. Distance is unavailable.' };
  return { meters, reason: 'Straight-line distance to mapped green reference; not today’s pin.' };
}