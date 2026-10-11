import type { GolfCourse } from '../context/GolfContext';
import { canonicalCourseId } from './courseGeometry';
import { parseCourseMap, type OsmElement } from './courseMapData';

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
export async function queryOverpass(query: string, signal: AbortSignal, native = false, fetcher = fetch): Promise<unknown> {
  const response = await fetcher(OVERPASS_URL, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded',
      ...(native ? { 'User-Agent': 'DRC-Golf-Tempo/1.0 (personal on-demand golf course maps)' } : {}) },
    body: `data=${encodeURIComponent(query)}`,
  }).catch(e => {
    if (signal.aborted) throw e;
    throw new Error('Cannot reach the free map service. Saved maps remain available; check internet or try later.');
  });
  if (!response.ok) throw new Error(`OpenStreetMap service unavailable (${response.status}). Saved maps remain usable; try later.`);
  const text = await response.text();
  if (text.length > 12_000_000) throw new Error('This map response is too large to load safely.');
  try { return JSON.parse(text); } catch { throw new Error('The map service returned invalid data. Try later.'); }
}
const literal = (value: string) => JSON.stringify(value);
const regex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function courseSearchQuery(name: string) {
  const clean = name.trim();
  if (clean.length < 3 || clean.length > 100) throw new Error('Enter a course name between 3 and 100 characters.');
  return `[out:json][timeout:20];nwr["leisure"="golf_course"]["name"~${literal(regex(clean))},i];out center tags 40;`;
}
export function parseCourseDirectory(raw: unknown): GolfCourse[] {
  const data = raw as { remark?: string; elements?: OsmElement[] } | null;
  if (!data || data.remark || !Array.isArray(data.elements)) throw new Error('The course directory returned an incomplete result. Try later.');
  return data.elements.flatMap(e => {
    if (!e || typeof e !== 'object') return [];
    const tags = Object.fromEntries(Object.entries(e.tags ?? {}).filter(([, value]) => typeof value === 'string'));
    const latitude = e.center?.lat ?? e.lat, longitude = e.center?.lon ?? e.lon;
    if (tags.leisure !== 'golf_course' || !tags.name || tags.name.length > 200 || !['node', 'way', 'relation'].includes(e.type)
      || !Number.isSafeInteger(e.id) || e.id <= 0 || !Number.isFinite(latitude) || !Number.isFinite(longitude)
      || Math.abs(latitude!) > 90 || Math.abs(longitude!) > 180) return [];
    const par = Number(tags.par);
    return [{
      id: `osm-${e.type}-${e.id}`, name: tags.name, latitude: latitude!, longitude: longitude!,
      area: tags['addr:city'] ?? tags['addr:suburb'] ?? tags['addr:country'] ?? 'OpenStreetMap course',
      par: Number.isInteger(par) && par >= 1 && par <= 180 ? par : 72,
      address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(' '),
      phone: tags.phone ?? tags['contact:phone'], website: tags.website ?? tags['contact:website'], source: 'OpenStreetMap',
    }];
  });
}
export function courseLayoutQuery(osmKey: string) {
  const match = /^(way|relation)-([1-9]\d{0,14})$/.exec(osmKey);
  if (!match) throw new Error('Select a mapped course boundary from the worldwide course search.');
  return `[out:json][timeout:25];${match[1]}(${match[2]})->.course;.course map_to_area->.area;
    (.course;way(area.area)["golf"];relation(area.area)["golf"];
    way(area.area)["natural"~"^(water|wood)$"];relation(area.area)["natural"~"^(water|wood)$"];
    way(area.area)["landuse"="forest"];relation(area.area)["landuse"="forest"];
    way(area.area)["waterway"="riverbank"];);out geom;`;
}
export async function downloadCourseMap(course: GolfCourse, signal: AbortSignal, native = false, fetcher = fetch) {
  const id = canonicalCourseId(course.id);
  let key = id === 'pacific-golf-club' ? 'relation-1668736' : /^osm-(way|relation)-[1-9]\d{0,14}$/.test(id) ? id.slice(4) : '';
  if (!key) {
    const result = parseCourseDirectory(await queryOverpass(courseSearchQuery(course.name), signal, native, fetcher));
    const normal = (s: string) => s.trim().toLocaleLowerCase();
    const matches = result.filter(c => normal(c.name) === normal(course.name)
      && Math.abs(c.latitude - course.latitude) < 0.03 && Math.abs(c.longitude - course.longitude) < 0.03
      && /^osm-(way|relation)-/.test(c.id));
    if (matches.length !== 1) throw new Error('This course has no unambiguous mapped boundary. Choose its boundary entry in worldwide search; some courses are mapped only as a point.');
    key = matches[0].id.slice(4);
  }
  return parseCourseMap(await queryOverpass(courseLayoutQuery(key), signal, native, fetcher), id, key);
}
