import { distanceMeters, type Coordinate, type MapFeature, type VerifiedHole } from './courseGeometry';
import { pointInMappedPolygon } from './mappedPolygons';

function samples(path: Coordinate[], spacing = 3): Coordinate[] {
  return path.flatMap((end, i) => {
    if (!i) return [end];
    const start = path[i - 1];
    const steps = Math.max(1, Math.ceil(distanceMeters(start, end) / spacing));
    return Array.from({ length: steps }, (_, n) => ({
      latitude: start.latitude + (end.latitude - start.latitude) * (n + 1) / steps,
      longitude: start.longitude + (end.longitude - start.longitude) * (n + 1) / steps,
    }));
  });
}

/** These are suggested lines derived from mapped coordinates, never surveyed routes. */
export function getHoleStrategies(hole: VerifiedHole, features: MapFeature[]) {
  const greens = features.filter(f => f.kind === 'green' && pointInMappedPolygon(hole.target, f.rings));
  const fairways = features.filter(f => f.kind === 'fairway');
  if (!greens.length || !fairways.length) return {
    safe: null, aggressive: null,
    reason: `Routes unavailable: ${!fairways.length ? 'verified fairway coverage' : 'a verified target green'} is missing. A playing-path line alone cannot establish a safe route.`,
  };
  const mapped = [...fairways, ...greens, ...features.filter(f => f.kind === 'tee')];
  const hazards = features.filter(f => ['water', 'bunker', 'trees'].includes(f.kind));
  const pathSamples = samples(hole.path);
  // Require full mapped landing-surface coverage. Unknown gaps are not safe.
  const covered = pathSamples.every(p => mapped.some(f => pointInMappedPolygon(p, f.rings)));
  const blocked = pathSamples.some(p => hazards.some(f => pointInMappedPolygon(p, f.rings)));
  const safe = covered && !blocked ? hole.path : null;
  // A direct aggressive comparison is only offered after the conservative
  // baseline is supported, and only when it actually differs from that path.
  const direct = [hole.path[0], hole.target];
  const pathLength = hole.path.slice(1).reduce((sum, p, i) => sum + distanceMeters(hole.path[i], p), 0);
  const aggressive = safe && pathLength - distanceMeters(...direct as [Coordinate, Coordinate]) > 5 ? direct : null;
  return {
    safe, aggressive,
    reason: safe
      ? 'Yellow follows the mapped playing path. Red, when shown, cuts directly to the mapped green and may cross hazards. Suggestions only, not guaranteed safe shots; unmapped hazards and changing conditions remain unknown.'
      : 'Routes unavailable: mapped landing surfaces do not cover the whole playing path, or it crosses a mapped hazard. Unknown gaps are not assumed safe.',
  };
}

/** Nearest sourced outline vertices in the selected-hole corridor, not invented targets. */
export function getHoleFeatureTargets(hole: VerifiedHole, features: MapFeature[]) {
  const pathSamples = samples(hole.path, 10);
  return features.filter(f => ['green', 'bunker', 'water', 'trees'].includes(f.kind)).flatMap(f => {
    if (f.kind === 'green' && !pointInMappedPolygon(hole.target, f.rings)) return [];
    let coordinate: Coordinate | undefined;
    let nearest = Infinity;
    for (const point of f.rings.flat()) {
      const d = Math.min(...pathSamples.map(p => distanceMeters(p, point)));
      if (d < nearest) { nearest = d; coordinate = point; }
    }
    return coordinate && nearest <= 45 ? [{ id: f.id, kind: f.kind, coordinate }] : [];
  });
}
