import { z } from 'zod';
import type { CourseGeometry, MapFeature, Coordinate, VerifiedHole } from './courseGeometry';

const coordinate = z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) });
const ring = z.array(coordinate).min(4).max(12000).refine(r => r[0].latitude === r.at(-1)?.latitude && r[0].longitude === r.at(-1)?.longitude, 'Open map boundary');
export const courseMapSchema = z.object({
  courseId: z.string().min(1).max(200),
  osmKey: z.string().regex(/^(way|relation)-[1-9]\d{0,14}$/),
  downloadedAt: z.string().datetime(),
  geometry: z.object({
    latitude: coordinate.shape.latitude, longitude: coordinate.shape.longitude,
    checkedAt: z.string().datetime(),
    source: z.literal('OpenStreetMap · community mapped'),
    sourceUrl: z.string().regex(/^https:\/\/www\.openstreetmap\.org\/(way|relation)\/[1-9]\d{0,14}$/),
    holes: z.array(z.object({
      hole: z.number().int().min(1).max(18), par: z.number().int().min(1).max(10).optional(),
      osmWayId: z.string().regex(/^[1-9]\d{0,14}$/),
      path: z.array(coordinate).min(2).max(2000), target: coordinate,
      targetKind: z.enum(['green-reference', 'path-end']),
    }).refine(h => h.target.latitude === h.path.at(-1)?.latitude && h.target.longitude === h.path.at(-1)?.longitude)).max(18)
      .refine(h => new Set(h.map(x => x.hole)).size === h.length),
    features: z.array(z.object({
      id: z.string().min(1).max(100), kind: z.enum(['fairway', 'green', 'bunker', 'water', 'tee', 'rough', 'trees']),
      rings: z.array(ring).min(1).max(100),
    })).max(1500),
  }),
  omitted: z.number().int().min(0),
}).refine(m => m.geometry.sourceUrl.endsWith(m.osmKey.replace('-', '/')), 'Course source mismatch')
  .refine(m => !/^osm-(way|relation)-/.test(m.courseId) || m.courseId === `osm-${m.osmKey}`, 'Course identifier mismatch')
  .refine(m => m.courseId !== 'pacific-golf-club' || m.osmKey === 'relation-1668736', 'Pacific course source mismatch');
export type DownloadedCourseMap = z.infer<typeof courseMapSchema>;
export type OsmElement = {
  type: string; id: number; lat?: number; lon?: number;
  center?: { lat: number; lon: number }; tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  members?: { role: string; geometry?: { lat: number; lon: number }[] }[];
};

const coord = (p: { lat: number; lon: number }): Coordinate | null => {
  const parsed = coordinate.safeParse({ latitude: p.lat, longitude: p.lon });
  return parsed.success ? parsed.data : null;
};
const same = (a: Coordinate, b: Coordinate) => a.latitude === b.latitude && a.longitude === b.longitude;
function points(raw?: { lat: number; lon: number }[]) {
  if (!raw || raw.length > 12000) return [];
  const result = raw.map(coord);
  return result.every(Boolean) ? result as Coordinate[] : [];
}
function closeRings(element: OsmElement): Coordinate[][] {
  const parts = element.type === 'way' ? [points(element.geometry)] : (element.members ?? []).filter(m => ['', 'outer', 'inner'].includes(m.role)).map(m => points(m.geometry));
  const remaining = parts.filter(p => p.length >= 2).map(p => [...p]);
  const rings: Coordinate[][] = [];
  while (remaining.length) {
    const path = remaining.shift()!;
    while (!same(path[0], path[path.length - 1])) {
      const i = remaining.findIndex(p => same(path[path.length - 1], p[0]) || same(path[path.length - 1], p[p.length - 1]));
      if (i < 0) break;
      const next = remaining.splice(i, 1)[0];
      if (!same(path[path.length - 1], next[0])) next.reverse();
      path.push(...next.slice(1));
    }
    if (path.length >= 4 && same(path[0], path[path.length - 1])) rings.push(path);
  }
  return rings;
}
function featureKind(t: Record<string, string>): MapFeature['kind'] | null {
  if (['fairway', 'green', 'bunker', 'tee', 'rough'].includes(t.golf)) return t.golf as MapFeature['kind'];
  if (t.natural === 'water' || t.waterway === 'riverbank' || ['water_hazard', 'lateral_water_hazard'].includes(t.golf)) return 'water';
  if (t.natural === 'wood' || t.landuse === 'forest') return 'trees';
  return null;
}

function inside(point: Coordinate, rings: Coordinate[][]) {
  let result = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i], b = r[j];
    if ((a.latitude > point.latitude) !== (b.latitude > point.latitude)
      && point.longitude < (b.longitude - a.longitude) * (point.latitude - a.latitude) / (b.latitude - a.latitude) + a.longitude) result = !result;
  }
  return result;
}

export function parseCourseMap(raw: unknown, courseId: string, osmKey: string, now = new Date()): DownloadedCourseMap {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid map response.');
  const data = raw as { remark?: string; elements?: OsmElement[] };
  if (data.remark || !Array.isArray(data.elements) || data.elements.length > 10000) throw new Error('The map service returned an incomplete response. Try again later.');
  const boundary = data.elements.find(e => e && `${e.type}-${e.id}` === osmKey && e.tags?.leisure === 'golf_course');
  const boundaryRings = boundary ? closeRings(boundary) : [];
  if (!boundary || !boundaryRings.length) throw new Error('A mapped course boundary is required to associate holes safely.');
  const centre = boundary.center ? coord(boundary.center) : boundaryRings[0][0];
  if (!centre) throw new Error('The course has invalid coordinates.');
  let omitted = 0;
  const candidates: VerifiedHole[] = [];
  const features: MapFeature[] = [];
  for (const e of data.elements) {
    if (!e || typeof e !== 'object' || !Number.isSafeInteger(e.id) || !['node', 'way', 'relation'].includes(e.type)) throw new Error('Invalid map element returned.');
    const tags = e.tags ?? {};
    if (tags.golf === 'hole' && e.type === 'way') {
      const hole = Number(tags.ref), path = points(e.geometry);
      if (!/^\d{1,2}$/.test(tags.ref ?? '') || hole < 1 || hole > 18 || path.length < 2 || path.length > 2000 || same(path[0], path[path.length - 1])
        || !inside(path[0], boundaryRings) || !inside(path[path.length - 1], boundaryRings)) { omitted++; continue; }
      const par = Number(tags.par);
      candidates.push({ hole, osmWayId: String(e.id), path, target: path[path.length - 1],
        ...(Number.isInteger(par) && par >= 1 && par <= 10 ? { par } : {}) });
    }
    const kind = featureKind(tags);
    if (kind) {
      const rings = closeRings(e);
      if (!rings.length) { omitted++; continue; }
      features.push({ id: `${e.type}-${e.id}`, kind, rings });
    }
  }
  // Multiple numbered loops at one club are ambiguous; never pick one arbitrarily.
  const holes = candidates.filter(h => candidates.filter(x => x.hole === h.hole).length === 1).sort((a, b) => a.hole - b.hole);
  for (const h of holes) h.targetKind = features.some(f => f.kind === 'green' && inside(h.target, f.rings)) ? 'green-reference' : 'path-end';
  omitted += candidates.length - holes.length;
  const geometry: CourseGeometry = { ...centre, holes, features, checkedAt: now.toISOString(),
    source: 'OpenStreetMap · community mapped', sourceUrl: `https://www.openstreetmap.org/${osmKey.replace('-', '/')}` };
  return courseMapSchema.parse({ courseId, osmKey, downloadedAt: now.toISOString(), geometry, omitted });
}
