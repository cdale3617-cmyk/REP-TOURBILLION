import { z } from 'zod';
import type { GolfRound, PracticeActivity } from '@/context/GolfContext';
import { summarizeRoundPerformance, sortPerformanceRounds } from './roundPerformance';

export const drillIds = ['putting', 'dispersion', 'short-game'] as const;
export type DrillId = (typeof drillIds)[number];
export const trainingDrills: Record<DrillId, { title: string; tool: string; instructions: string[] }> = {
  putting: {
    title: 'Pace & short putts', tool: 'putting-practice',
    instructions: [
      'Warm up with five long putts, aiming to finish close rather than force a make.',
      'Choose one short distance and putt ten balls from the same starting spot. Repeat twice.',
      'Log makes, misses and the actual distance in Putting Practice. Keep the distance consistent for comparisons.',
    ],
  },
  dispersion: {
    title: 'Controlled start line', tool: 'shot-pattern',
    instructions: [
      'Choose one club and a safe target. Make ten controlled swings rather than chasing maximum distance.',
      'Use measured carry and left/right miss only if you can obtain them. Tag the actual lie, surface and wind.',
      'Record results in Shot Pattern. If measurements are unavailable, keep a session note instead; never guess distances.',
    ],
  },
  'short-game': {
    title: 'Landing-zone control', tool: 'short-game',
    instructions: [
      'Choose three safe short-game targets inside 100 m, at distances comfortable for you.',
      'Play five balls to each target, focusing on a repeatable landing area and clean contact.',
      'Log the repetitions and a note about club, target and contact in inside 100m.',
    ],
  },
};

/** Local-calendar Monday, without UTC or daylight-saving week shifts. */
export function getTrainingWeekKey(date = new Date()): string {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
}
export const trainingPlanSchema = z.object({
  weekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(key => getTrainingWeekKey(new Date(`${key}T12:00:00`)) === key, 'Use a valid Monday week start.'),
  createdAt: z.string().datetime({ offset: true }),
  weeklySessions: z.number().int().min(1).max(7),
  sessionMinutes: z.number().int().min(5).max(90),
  drillIds: z.array(z.enum(drillIds)).min(1).max(3).refine(ids => new Set(ids).size === ids.length),
  source: z.enum(['starter', 'personalised']),
  reason: z.string().min(1).max(2000),
});
export const trainingSessionSchema = z.object({
  id: z.string().min(1).max(200),
  weekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  drillId: z.enum(drillIds),
  durationMinutes: z.number().int().min(1).max(180),
  note: z.string().max(2000),
  createdAt: z.string().datetime({ offset: true }),
});
export const trainingStateSchema = z.object({
  plans: z.array(trainingPlanSchema).refine(plans => new Set(plans.map(p => p.weekKey)).size === plans.length),
  sessions: z.array(trainingSessionSchema).refine(sessions => new Set(sessions.map(s => s.id)).size === sessions.length),
}).refine(state => state.sessions.every(s => state.plans.some(p => p.weekKey === s.weekKey && p.drillIds.includes(s.drillId))), 'A training session must belong to its saved weekly plan.');
export type TrainingPlan = z.infer<typeof trainingPlanSchema>;
export type TrainingSession = z.infer<typeof trainingSessionSchema>;
export type TrainingState = z.infer<typeof trainingStateSchema>;

/** Recover existing putting logs only when their exact, known format is valid. */
function puttingSets(activities: PracticeActivity[]) {
  return activities.filter(a => a.tool === 'putting-practice').flatMap(a => {
    const match = a.note.match(/^(\d+)\/(\d+) made from (\d+(?:[.,]\d+)?) (m|yd)$/);
    if (!match || !Number.isFinite(Date.parse(a.createdAt))) return [];
    const made = Number(match[1]), attempts = Number(match[2]);
    const distance = Number(match[3].replace(',', '.')) * (match[4] === 'yd' ? 0.9144 : 1);
    if (attempts <= 0 || made > attempts || distance <= 0 || distance > 100) return [];
    return [{ made, attempts, distance: Math.round(distance * 100) / 100, createdAt: a.createdAt }];
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function getPuttingTrend(activities: PracticeActivity[]) {
  const sets = puttingSets(activities);
  // Do not compare putting success across different starting distances.
  for (const distance of [...new Set(sets.map(s => s.distance))]) {
    const matching = sets.filter(s => s.distance === distance).slice(0, 6);
    if (matching.length < 6) continue;
    const rate = (group: typeof matching) => group.reduce((n, s) => n + s.made, 0) / group.reduce((n, s) => n + s.attempts, 0) * 100;
    return { distanceMeters: distance, latestPercent: rate(matching.slice(0, 3)), previousPercent: rate(matching.slice(3)), sets: 6 };
  }
  return null;
}

export function buildTrainingPlan(rounds: GolfRound[], activities: PracticeActivity[], now = new Date(), weeklySessions = 3, sessionMinutes = 20): TrainingPlan {
  const summary = summarizeRoundPerformance(sortPerformanceRounds(rounds).slice(0, 12));
  let primary: DrillId = 'putting';
  let source: TrainingPlan['source'] = 'starter';
  let reason = 'Not enough relevant results yet. This balanced starter plan is not a diagnosis. Record hole statistics and practice results to personalise future plans.';
  if (summary.focus.tool) {
    primary = summary.focus.tool === 'putting-practice' ? 'putting' : summary.focus.tool === 'shot-pattern' ? 'dispersion' : 'short-game';
    source = 'personalised';
    reason = `${summary.focus.reason} Based on tracked holes in up to your latest 12 saved rounds; missing statistics remain unknown.`;
  } else {
    const sets = puttingSets(activities);
    const recent = sets.filter(s => s.distance === sets[0]?.distance).slice(0, 3);
    const attempts = recent.reduce((n, s) => n + s.attempts, 0);
    if (recent.length >= 3 && attempts >= 30) {
      source = 'personalised';
      const made = recent.reduce((n, s) => n + s.made, 0);
      reason = `${made}/${attempts} putts made from ${recent[0].distance} m across your latest three matching-distance sets. Keep putting in the plan and repeat at that distance to monitor change. Practice conditions can differ.`;
    }
  }
  return trainingPlanSchema.parse({
    weekKey: getTrainingWeekKey(now), createdAt: now.toISOString(), weeklySessions, sessionMinutes,
    drillIds: [primary, ...drillIds.filter(id => id !== primary)], source, reason,
  });
}

export function getTrainingProgress(plan: TrainingPlan, sessions: TrainingSession[]) {
  const matching = sessions.filter(s => s.weekKey === plan.weekKey);
  return {
    completedSessions: matching.length,
    completedMinutes: matching.reduce((sum, s) => sum + s.durationMinutes, 0),
    targetMinutes: plan.weeklySessions * plan.sessionMinutes,
    percent: Math.min(100, Math.round(matching.length / plan.weeklySessions * 100)),
  };
}
