import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GolfCourse } from '../context/GolfContext';
import { canonicalCourseId, getCourseGeometry, registerCourseGeometry } from '../utils/courseGeometry';
import { courseMapSchema, type DownloadedCourseMap } from '../utils/courseMapData';
import { downloadCourseMap } from '../utils/courseMapApi';

const keyFor = (id: string) => `drc-course-map-v1:${encodeURIComponent(id)}`;
const CHUNK = 450000;
export async function readMap(id: string): Promise<DownloadedCourseMap | null> {
  const raw = await AsyncStorage.getItem(keyFor(id));
  if (!raw) return null;
  const index = JSON.parse(raw) as { keys: string[] };
  if (!Array.isArray(index.keys) || !index.keys.length || index.keys.length > 32
    || !index.keys.every(k => typeof k === 'string' && k.startsWith(`${keyFor(id)}:`))) throw new Error('Invalid cached map index.');
  const entries = await AsyncStorage.multiGet(index.keys);
  if (entries.some(([, value]) => value === null)) throw new Error('An offline map part is missing.');
  const map = courseMapSchema.parse(JSON.parse(entries.map(([, v]) => v).join('')));
  if (map.courseId !== id) throw new Error('The offline map belongs to a different course.');
  return map;
}
export async function writeMap(map: DownloadedCourseMap) {
  const json = JSON.stringify(courseMapSchema.parse(map));
  if (json.length > CHUNK * 32) throw new Error('The map is too large for the offline cache.');
  const base = keyFor(map.courseId), generation = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const entries: [string, string][] = [];
  for (let start = 0; start < json.length; start += CHUNK) entries.push([`${base}:${generation}:${entries.length}`, json.slice(start, start + CHUNK)]);
  const previous = await AsyncStorage.getItem(base);
  await AsyncStorage.multiSet(entries);
  // Publish the index only after every chunk is safely written.
  await AsyncStorage.setItem(base, JSON.stringify({ keys: entries.map(([k]) => k) }));
  if (previous) {
    try {
      const keys: unknown = JSON.parse(previous).keys;
      if (Array.isArray(keys) && keys.every(k => typeof k === 'string' && k.startsWith(`${base}:`))) await AsyncStorage.multiRemove(keys);
    } catch { /* Newly committed cache is intact; stale chunks can be left safely. */ }
  }
}
type State = { id: string; map: DownloadedCourseMap | null; busy: boolean; error: string; cached: boolean };
export function useCourseMap(course?: GolfCourse) {
  const id = course ? canonicalCourseId(course.id) : '';
  const [state, setState] = useState<State>({ id: '', map: null, busy: false, error: '', cached: false });
  const generation = useRef(0), controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const g = ++generation.current;
    controller.current?.abort();
    setState({ id, map: null, busy: false, error: '', cached: false });
    if (id) readMap(id).then(map => {
      if (g !== generation.current) return;
      if (map) registerCourseGeometry(id, map.geometry);
      setState({ id, map, busy: false, error: '', cached: !!map });
    }).catch(() => {
      if (g === generation.current) setState({ id, map: null, busy: false, cached: false, error: 'Saved map could not be read. Download it again; your scores are unchanged.' });
    });
    return () => { generation.current++; controller.current?.abort(); };
  }, [id]);
  async function load() {
    if (!course || state.busy) return;
    const g = ++generation.current, abort = new AbortController();
    controller.current?.abort(); controller.current = abort;
    setState(prev => ({ id, map: prev.id === id ? prev.map : null, busy: true, error: '', cached: prev.id === id && prev.cached }));
    const timer = setTimeout(() => abort.abort(), 60000);
    try {
      const map = await downloadCourseMap(course, abort.signal, Platform.OS !== 'web');
      if (g !== generation.current) return;
      let error = '';
      try { await writeMap(map); } catch { error = 'Map loaded, but offline saving failed. Keep an internet connection and try downloading again.'; }
      if (g !== generation.current) return;
      registerCourseGeometry(id, map.geometry);
      setState({ id, map, busy: false, error, cached: !error });
    } catch (e) {
      if (g === generation.current) setState(prev => ({ ...prev, busy: false, error: abort.signal.aborted
        ? 'Map download timed out. Saved maps remain available; try later.'
        : e instanceof Error ? e.message : 'Map download failed. Try later.' }));
    } finally { clearTimeout(timer); }
  }
  const current = state.id === id ? state : { id, map: null, busy: false, error: '', cached: false };
  return { ...current, geometry: current.map?.geometry ?? (id ? getCourseGeometry(id) : null), load };
}
