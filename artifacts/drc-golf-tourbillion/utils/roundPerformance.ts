import type { GolfRound, HoleScore } from '@/context/GolfContext';

export type RoundFocus = { title: string; reason: string; practice: string; tool: string | null };
export type RoundPerformanceSummary = {
  rounds: number; scoredHoles: number; totalScore: number; toPar: number;
  puttsRecorded: number; totalPutts: number; averagePutts: number | null; threePuttHoles: number;
  penaltiesRecorded: number; totalPenalties: number;
  fairwayEligible: number; fairwaysRecorded: number; fairwaysHit: number;
  greenEligible: number; greensRecorded: number; greensHit: number;
  focus: RoundFocus;
};

function scored(round: GolfRound): HoleScore[] {
  return round.holes.filter(hole => hole.score !== null && Number.isFinite(hole.score));
}

export function sortPerformanceRounds(rounds: GolfRound[]): GolfRound[] {
  return [...rounds].sort((a, b) =>
    Date.parse(b.finishedAt ?? b.startedAt) - Date.parse(a.finishedAt ?? a.startedAt));
}

export function summarizeRoundPerformance(rounds: GolfRound[]): RoundPerformanceSummary {
  const holes = rounds.flatMap(scored);
  const putts = holes.filter(hole => typeof hole.putts === 'number');
  const penalties = holes.filter(hole => typeof hole.penalties === 'number');
  const fairwayEligible = holes.filter(hole => hole.par > 3);
  const fairways = fairwayEligible.filter(hole => hole.fairway === 'hit' || hole.fairway === 'miss');
  const greenEligible = holes.filter(hole => hole.par >= 3);
  const greens = greenEligible.filter(hole => typeof hole.greenInRegulation === 'boolean');
  const summary: RoundPerformanceSummary = {
    rounds: rounds.filter(round => scored(round).length > 0).length, scoredHoles: holes.length,
    totalScore: holes.reduce((sum, hole) => sum + hole.score!, 0),
    toPar: holes.reduce((sum, hole) => sum + hole.score! - hole.par, 0),
    puttsRecorded: putts.length, totalPutts: putts.reduce((sum, hole) => sum + hole.putts!, 0),
    averagePutts: putts.length ? putts.reduce((sum, hole) => sum + hole.putts!, 0) / putts.length : null,
    threePuttHoles: putts.filter(hole => hole.putts! >= 3).length,
    penaltiesRecorded: penalties.length, totalPenalties: penalties.reduce((sum, hole) => sum + hole.penalties!, 0),
    fairwayEligible: fairwayEligible.length, fairwaysRecorded: fairways.length,
    fairwaysHit: fairways.filter(hole => hole.fairway === 'hit').length,
    greenEligible: greenEligible.length, greensRecorded: greens.length,
    greensHit: greens.filter(hole => hole.greenInRegulation === true).length,
    focus: { title: 'Build a clearer picture', reason: 'Record at least 3 relevant holes in an area before using it to choose a practice focus. Missing statistics remain unknown.', practice: 'Add hole statistics during a round or edit a saved scorecard.', tool: null },
  };
  if (summary.penaltiesRecorded >= 3 && summary.totalPenalties > 0) {
    summary.focus = {
      title: 'Reduce penalty strokes',
      reason: `${summary.totalPenalties} penalty strokes recorded on ${summary.penaltiesRecorded} tracked holes. These are already included in your scores; their causes are not recorded.`,
      practice: 'Use conservative targets with Caddie, then practise a controlled start line in Shot Pattern. Do not assume every penalty came from a tee shot.',
      tool: 'shot-pattern',
    };
  } else if (summary.puttsRecorded >= 3 && summary.threePuttHoles > 0) {
    summary.focus = {
      title: 'Practise putting distance control',
      reason: `${summary.threePuttHoles} three-or-more-putt holes out of ${summary.puttsRecorded} tracked holes. Starting putt distances and green difficulty are unknown.`,
      practice: 'Use Putting Practice for repeatable long-putt pace and short-putt finishing drills.',
      tool: 'putting-practice',
    };
  } else if (summary.greensRecorded >= 3 && summary.greensHit / summary.greensRecorded < 0.5) {
    summary.focus = {
      title: 'Work on approach and recovery consistency',
      reason: `${summary.greensRecorded - summary.greensHit} missed greens out of ${summary.greensRecorded} tracked holes. A missed green does not identify which earlier shot caused it.`,
      practice: 'Calibrate comfortable wedge distances and favour reachable, open targets rather than tight flags.',
      tool: 'wedge-matrix',
    };
  } else if (summary.fairwaysRecorded >= 3 && summary.fairwaysHit / summary.fairwaysRecorded < 0.5) {
    summary.focus = {
      title: 'Practise tee-shot direction',
      reason: `${summary.fairwaysRecorded - summary.fairwaysHit} missed fairways out of ${summary.fairwaysRecorded} tracked eligible holes. This is not a count of strokes lost.`,
      practice: 'Record carry and lateral miss with your tee club in Shot Pattern; build a repeatable start line.',
      tool: 'shot-pattern',
    };
  } else if ([summary.puttsRecorded, summary.penaltiesRecorded, summary.greensRecorded, summary.fairwaysRecorded].some(count => count >= 3)) {
    summary.focus = {
      title: 'Keep strengths consistent',
      reason: 'No clear practice priority appears under the coach’s simple rules in the tracked sample. This does not prove every area is strong.',
      practice: 'Continue balanced practice and record more complete rounds before making major changes.',
      tool: null,
    };
  }
  return summary;
}

function holeSignature(round: GolfRound): string {
  return scored(round).sort((a, b) => a.hole - b.hole).map(hole => `${hole.hole}:${hole.par}`).join('|');
}

export function comparePerformanceRounds(rounds: GolfRound[]): {
  latest: GolfRound; previous: GolfRound; holes: number; scoreChange: number;
} | null {
  const candidates = sortPerformanceRounds(rounds).filter(round => scored(round).length > 0);
  const latest = candidates[0];
  if (!latest) return null;
  const signature = holeSignature(latest);
  const previous = candidates.slice(1).find(round => round.courseId === latest.courseId && holeSignature(round) === signature);
  if (!previous) return null;
  return {
    latest, previous, holes: scored(latest).length,
    scoreChange: summarizeRoundPerformance([latest]).totalScore - summarizeRoundPerformance([previous]).totalScore,
  };
}
