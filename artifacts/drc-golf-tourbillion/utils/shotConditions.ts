export type ShotLie = 'fairway' | 'rough' | 'bunker' | 'trees' | 'green';
export type ShotConditions = {
  lie?: ShotLie | null;
  surface?: 'grass' | 'mat' | null;
  wind?: 'calm' | 'headwind' | 'tailwind' | 'crosswind' | null;
};

export function inferShotLie(question: string): ShotLie | null {
  const explicit = question.match(/\b(?:from|in|on|ball is in|ball in|lie is)\s+(?:the\s+)?(?:(?:left|right|light|heavy|deep|thick|greenside)\s+)*(fairway|short grass|rough|fringe|bunker|sand|trees|green|putting surface)\b/i);
  if (explicit) {
    const word = explicit[1].toLowerCase();
    return word === 'sand' ? 'bunker' : word === 'fringe' ? 'rough' : word === 'short grass' ? 'fairway' : word === 'putting surface' ? 'green' : word as ShotLie;
  }
  const candidates: ShotLie[] = [];
  if (/\b(rough|fringe|thick grass)\b/i.test(question)) candidates.push('rough');
  if (/\b(bunker|sand trap|in the sand)\b/i.test(question) && !/\b(bunker|sand trap)\s+(ahead|beyond|to cross)\b/i.test(question)) candidates.push('bunker');
  if (/\b(fairway|short grass)\b/i.test(question)) candidates.push('fairway');
  if (/\b(trees|tree trouble|blocked out)\b/i.test(question) && !/\btrees\s+(ahead|beyond)\b/i.test(question)) candidates.push('trees');
  if (/\b(on the green|putting surface)\b/i.test(question)) candidates.push('green');
  return candidates.length === 1 ? candidates[0] : null;
}

export function resolveShotConditions(question: string, selected: ShotConditions = {}): { conditions: ShotConditions; error: string } {
  const inferred: ShotConditions = {
    lie: inferShotLie(question),
    surface: /\b(mat|mats)\b/i.test(question) ? 'mat' : /\b(grass range|off grass|from grass)\b/i.test(question) ? 'grass' : null,
    wind: /\b(headwind|into (?:the )?wind|against (?:the )?wind)\b/i.test(question) ? 'headwind'
      : /\b(tailwind|downwind|wind behind)\b/i.test(question) ? 'tailwind'
      : /\b(crosswind|left\s*(?:to|-)\s*right|right\s*(?:to|-)\s*left)\b/i.test(question) ? 'crosswind'
      : /\b(calm|no wind)\b/i.test(question) ? 'calm' : null,
  };
  for (const key of ['lie', 'surface', 'wind'] as const) {
    if (selected[key] && inferred[key] && selected[key] !== inferred[key]) {
      return { conditions: selected, error: `Conflicting ${key}: your selection says ${selected[key]}, but the question says ${inferred[key]}. Correct one before asking again; no club has been selected.` };
    }
  }
  return { conditions: { lie: selected.lie ?? inferred.lie, surface: selected.surface ?? inferred.surface, wind: selected.wind ?? inferred.wind }, error: '' };
}

export function matchesShotConditions(recorded: ShotConditions | undefined, requested: ShotConditions = {}): boolean {
  // Unknown current lie may use baseline/legacy records, never known recovery shots.
  if (!requested.lie && recorded?.lie && recorded.lie !== 'fairway') return false;
  return (['lie', 'surface', 'wind'] as const).every(key => !requested[key] || recorded?.[key] === requested[key]);
}

export function describeShotConditions(conditions: ShotConditions = {}): string {
  return `lie: ${conditions.lie ?? 'unknown'}, practice surface: ${conditions.surface ?? 'unknown'}, shot-relative wind: ${conditions.wind ?? 'unknown'}`;
}
