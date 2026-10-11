import data from '../data/capricorn-championship.json';
import type { GolfCourse, GolfState } from '../context/GolfContext';
import { capricornChampionshipGeometry } from './courseGeometry';
import type { OsmElement } from './courseMapData';

export const CAPRICORN_CHAMPIONSHIP_ID = data.courseId;
export const CAPRICORN_BOUNDARY_ID = 'osm-way-332993065';
const { holes, latitude, longitude } = capricornChampionshipGeometry;
export const capricornChampionshipCourse: GolfCourse = {
  id: CAPRICORN_CHAMPIONSHIP_ID, name: 'Capricorn Resort · Championship Course',
  area: 'Yeppoon, Queensland', par: 72, latitude, longitude,
  source: 'OpenStreetMap · reviewed Championship layout',
};

export function isCapricornBoundary(course?: GolfCourse) {
  return !!course && (course.id === CAPRICORN_BOUNDARY_ID
    || (course.name.trim().toLowerCase() === 'mercure capricorn resort golf'
      && Math.abs(course.latitude - latitude) < 0.03 && Math.abs(course.longitude - longitude) < 0.03));
}

// Only an explicit selection reassigns the current round. Historical cards,
// daily pins, scores and performance readings are not rewritten.
export function selectCapricornChampionship(state: GolfState): GolfState {
  const id = state.activeRound?.courseId ?? state.lastCourseId;
  const course = state.courses.find(c => c.id === id);
  if (!isCapricornBoundary(course) && id !== CAPRICORN_CHAMPIONSHIP_ID) return state;
  return {
    ...state, lastCourseId: CAPRICORN_CHAMPIONSHIP_ID,
    courses: [capricornChampionshipCourse, ...state.courses.filter(c => c.id !== CAPRICORN_CHAMPIONSHIP_ID)],
    activeRound: state.activeRound ? {
      ...state.activeRound, courseId: CAPRICORN_CHAMPIONSHIP_ID,
      holes: state.activeRound.holes.map(hole => ({
        ...hole, par: holes.find(h => h.hole === hole.hole)?.par ?? hole.par,
      })),
    } : state.activeRound,
  };
}

// Stable, reviewed way membership avoids inferring a layout from numbering,
// object order or nearest neighbours. If endpoints have changed substantially,
// leave them out rather than silently changing the reviewed playing direction.
export function scopeChampionshipMap(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { elements?: unknown }).elements)) return raw;
  const response = raw as { elements: OsmElement[] };
  return { ...response, elements: response.elements.flatMap(e => {
    if (e?.tags?.golf !== 'hole') return [e];
    const known = holes.find(h => e.type === 'way' && h.osmWayId === String(e.id) && String(h.hole) === e.tags?.ref);
    if (!known || !e.geometry || e.geometry.length < 2) return [];
    const near = (point: { lat: number; lon: number }, target: { latitude: number; longitude: number }) =>
      Number.isFinite(point.lat) && Number.isFinite(point.lon)
      && Math.abs(point.lat - target.latitude) < 0.0002 && Math.abs(point.lon - target.longitude) < 0.0002;
    const first = e.geometry[0], last = e.geometry[e.geometry.length - 1];
    const forward = near(first, known.path[0]) && near(last, known.target);
    const reverse = near(last, known.path[0]) && near(first, known.target);
    if (!forward && !reverse) return [];
    return [{ ...e, tags: { ...e.tags, par: String(known.par) },
      geometry: forward ? e.geometry : [...e.geometry].reverse() }];
  }) };
}
