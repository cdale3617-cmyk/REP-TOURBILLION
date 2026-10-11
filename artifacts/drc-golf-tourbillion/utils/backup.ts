import { z } from 'zod';
import type { GolfState, HoleScore, HolePerformance } from '@/context/GolfContext';
import { GREEN_PHOTO_PATTERN } from './greenPhotoReference';
import { trainingStateSchema } from './training';

const id = z.string().min(1).max(200);
const text = z.string().max(20000);
const date = z.string().datetime({ offset: true });
const shotConditions = z.object({
  lie: z.enum(['fairway', 'rough', 'bunker', 'trees', 'green']).nullable().optional(),
  surface: z.enum(['grass', 'mat']).nullable().optional(),
  wind: z.enum(['calm', 'headwind', 'tailwind', 'crosswind']).nullable().optional(),
}).strict();
const finite = z.number().finite();
export const golfActivityMetricsSchema = z.object({
  source: z.literal('manual-launch-monitor-or-coach'),
  distanceUnit: z.enum(['m', 'yd']).optional(),
  ballSpeedMph: finite.min(1).max(250).optional(),
  clubSpeedMph: finite.min(1).max(200).optional(),
  apex: finite.min(0).max(2000).optional(),
  carry: finite.min(0).max(1000).optional(),
  clubPathDeg: finite.min(-30).max(30).optional(),
  faceAngleDeg: finite.min(-30).max(30).optional(),
  tempoRatio: finite.min(0.5).max(5).optional(),
  maxForceBodyWeightPct: finite.min(0).max(500).optional(),
  torqueNm: finite.min(0).max(1000).optional(),
  forceTransferPct: finite.min(0).max(100).optional(),
  pressureLeftPct: finite.min(0).max(100).optional(),
  pressureRightPct: finite.min(0).max(100).optional(),
}).refine((metrics) => Object.entries(metrics).some(([key, value]) => key !== 'source' && key !== 'distanceUnit' && value !== undefined), 'Manual metric entry must include at least one reading');
const phoneMotionSchema = z.object({
  source: z.literal('phone-motion-sensors'),
  capturedAt: date,
  durationMs: finite.int().min(500).max(30_000),
  accelerometerSampleCount: z.number().int().min(5).max(10_000),
  gyroscopeSampleCount: z.number().int().min(5).max(10_000),
  peakDynamicAccelerationG: finite.min(0).max(200),
  peakRotationDegPerSecond: finite.min(0).max(4_000),
});
const hole = z.object({
  hole: z.number().int().min(1).max(18), par: z.number().int().min(1).max(10), score: z.number().int().min(1).max(99).nullable(),
  putts: z.number().int().min(0).max(99).nullable().optional(),
  penalties: z.number().int().min(0).max(99).nullable().optional(),
  fairway: z.enum(['hit', 'miss']).nullable().optional(),
  greenInRegulation: z.boolean().nullable().optional(),
}).refine(value => value.score === null || (value.putts ?? 0) + (value.penalties ?? 0) <= value.score, 'Putts and penalty strokes must be included in the total score')
  .refine(value => value.par > 3 || value.fairway == null, 'Fairways are not recorded on par-3 or shorter holes')
  .refine(value => value.par >= 3 || value.greenInRegulation == null, 'GIR is not applicable below par 3');

export function validateHolePerformance(existing: HoleScore, patch: HolePerformance): HoleScore {
  if (existing.score === null) throw new Error('Record the total hole score before saving statistics.');
  const result = hole.safeParse({
    ...existing,
    putts: patch.putts === undefined ? existing.putts : patch.putts,
    penalties: patch.penalties === undefined ? existing.penalties : patch.penalties,
    fairway: patch.fairway === undefined ? existing.fairway : patch.fairway,
    greenInRegulation: patch.greenInRegulation === undefined ? existing.greenInRegulation : patch.greenInRegulation,
  });
  if (!result.success) throw new Error('Use whole-number putts and penalties from 0 to 99, included in the total score. Fairways apply only to par-4 or longer holes.');
  return result.data;
}
const round = z.object({
  id, courseId: id, startedAt: date, finishedAt: date.optional(),
  currentHole: z.number().int().min(1).max(18),
  holes: z.array(hole).length(18).refine((rows) => new Set(rows.map((row) => row.hole)).size === 18, 'Duplicate holes'),
});
const uniqueIds = <T extends { id: string }>(rows: T[]) => new Set(rows.map((row) => row.id)).size === rows.length;
const dailyPin = z.object({
  courseId: id, hole: z.number().int().min(1).max(18),
  latitude: finite.min(-90).max(90), longitude: finite.min(-180).max(180),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  capturedAt: date, fixTimestamp: finite, expiresAt: date,
  accuracy: finite.positive().max(10), provenance: z.literal('user-device-gps'), onGreenConfirmed: z.literal(true),
}).refine((pin) => {
  const captured = Date.parse(pin.capturedAt);
  const expires = Date.parse(pin.expiresAt);
  return pin.fixTimestamp <= captured && captured - pin.fixTimestamp <= 10000
    && expires > captured && expires - captured <= 86400000;
}, 'Invalid pin capture timing');
export const golfStateSchema = z.object({
  training: trainingStateSchema.default({ plans: [], sessions: [] }),
  playerName: z.string().min(1).max(100), unit: z.enum(['m', 'yd']), lastCourseId: id,
  courses: z.array(z.object({
    id, name: z.string().min(1).max(200), area: text, par: z.number().int().min(1).max(180),
    latitude: finite.min(-90).max(90), longitude: finite.min(-180).max(180),
    address: text.optional(), phone: text.optional(), website: text.optional(), source: text.optional(),
  })).min(1).refine(uniqueIds, 'Duplicate courses'),
  bag: z.array(z.object({
    id, name: z.string().max(200), make: z.string().max(120).optional(), model: z.string().max(120).optional(),
    carryMeters: finite.min(0), loft: finite.min(0).max(90),
  })).refine(uniqueIds, 'Duplicate clubs'),
  activeRound: round.nullable(), rounds: z.array(round).refine(uniqueIds, 'Duplicate rounds'),
  activities: z.array(z.object({ id, tool: text, title: text, note: text, value: finite.optional(), lateral: finite.optional(), clubId: id.optional(), clubSetupKey: z.string().max(1000).optional(), shotConditions: shotConditions.optional(), metrics: golfActivityMetricsSchema.optional(), phoneMotion: phoneMotionSchema.optional(), greenPhotoFile: z.string().regex(GREEN_PHOTO_PATTERN).optional(), createdAt: date })).refine(uniqueIds, 'Duplicate logs'),
  biometrics: z.array(z.object({ id, heartRate: finite.min(20).max(250), spo2: finite.min(50).max(100), createdAt: date })).refine(uniqueIds, 'Duplicate readings'),
  checklist: z.array(text),
  wedgeMatrix: z.record(z.string(), z.object({ threeQuarter: finite.min(0).nullable(), half: finite.min(0).nullable() })),
  dailyPins: z.array(dailyPin).default([]).refine((pins) => new Set(pins.map((pin) => `${pin.courseId}:${pin.hole}`)).size === pins.length, 'Duplicate pins'),
}).refine((state) => {
  const courseIds = new Set(state.courses.map((course) => course.id));
  return courseIds.has(state.lastCourseId) && (!state.activeRound || courseIds.has(state.activeRound.courseId))
    && state.rounds.every((item) => courseIds.has(item.courseId)) && state.dailyPins.every((pin) => courseIds.has(pin.courseId));
}, 'A scorecard refers to a missing course');

export function validateGolfState(input: unknown): GolfState {
  const result = golfStateSchema.safeParse(input);
  if (!result.success) throw new Error('This file contains invalid golf data. Nothing has been replaced.');
  return result.data;
}

export function createBackup(state: GolfState): string {
  // Keep the established file-format marker after the cosmetic rebrand so
  // existing backups and older installations remain mutually compatible.
  return JSON.stringify({ app: 'DRC Golf Tourbillion', version: 1, exportedAt: new Date().toISOString(), data: validateGolfState(state) }, null, 2);
}

export function parseBackup(contents: string): GolfState {
  if (contents.length > 10 * 1024 * 1024) throw new Error('Backup is too large (maximum 10 MB).');
  let input: unknown;
  try { input = JSON.parse(contents); } catch { throw new Error('Choose a valid DRC Golf Tempo JSON backup.'); }
  const envelope = z.object({ app: z.literal('DRC Golf Tourbillion'), version: z.literal(1), exportedAt: date, data: z.unknown() }).safeParse(input);
  if (!envelope.success) throw new Error('This is not a supported DRC Golf Tempo backup.');
  return validateGolfState(envelope.data.data);
}