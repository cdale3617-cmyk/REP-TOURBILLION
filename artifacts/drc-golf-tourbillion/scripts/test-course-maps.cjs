const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const store = new Map();
let failWrite = false;
const storage = {
  getItem: async k => store.get(k) ?? null,
  setItem: async (k, v) => { if (failWrite) throw new Error('disk full'); store.set(k, v); },
  multiGet: async keys => keys.map(k => [k, store.get(k) ?? null]),
  multiSet: async entries => { if (failWrite) throw new Error('disk full'); entries.forEach(([k, v]) => store.set(k, v)); },
  multiRemove: async keys => keys.forEach(k => store.delete(k)),
};
const modules = new Map();
function load(filename) {
  filename = path.resolve(__dirname, filename);
  if (modules.has(filename)) return modules.get(filename).exports;
  const m = new Module(filename, module);
  modules.set(filename, m); m.filename = filename; m.paths = module.paths;
  m.require = name => {
    if (name === 'react') return {};
    if (name === 'react-native') return { Platform: { OS: 'web' } };
    if (name === '@react-native-async-storage/async-storage') return storage;
    if (name.startsWith('.')) {
      const resolved = path.resolve(path.dirname(filename), name);
      if (fs.existsSync(`${resolved}.ts`)) return load(`${resolved}.ts`);
      return require(resolved);
    }
    return require(name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, filename);
  return m.exports;
}
const data = load('../utils/courseMapData.ts');
const api = load('../utils/courseMapApi.ts');
const geometry = load('../utils/courseGeometry.ts');
const cache = load('../hooks/useCourseMap.ts');
const box = (x, y, d) => [{ lat: y, lon: x }, { lat: y, lon: x + d }, { lat: y + d, lon: x + d }, { lat: y + d, lon: x }, { lat: y, lon: x }];
// Synthetic parser fixtures only. These are never bundled as real course maps.
const raw = {
  elements: [
    { type: 'way', id: 10, tags: { leisure: 'golf_course', name: 'Fixture Club' }, geometry: box(153, -28, .02) },
    { type: 'way', id: 101, tags: { golf: 'hole', ref: '1', par: '4' }, geometry: [{ lat: -27.995, lon: 153.005 }, { lat: -27.99, lon: 153.01 }] },
    { type: 'way', id: 102, tags: { golf: 'hole', ref: '2' }, geometry: [{ lat: -27.986, lon: 153.015 }, { lat: -27.985, lon: 153.013 }] },
    { type: 'way', id: 201, tags: { golf: 'green' }, geometry: box(153.009, -27.991, .002) },
    { type: 'way', id: 202, tags: { golf: 'fairway' }, geometry: box(153.004, -27.996, .007) },
    { type: 'way', id: 203, tags: { golf: 'bunker' }, geometry: box(153.012, -27.988, .0005) },
    { type: 'relation', id: 204, tags: { natural: 'water' }, members: [
      { role: 'outer', geometry: box(153.002, -27.992, .003) },
      { role: 'inner', geometry: box(153.003, -27.991, .0005) },
    ] },
  ],
};
const mapped = () => data.parseCourseMap(structuredClone(raw), 'osm-way-10', 'way-10', new Date('2026-10-11T01:00:00Z'));
test('real tags produce numbered paths, source identity, polygon surfaces and water islands', () => {
  const map = mapped();
  assert.deepEqual(map.geometry.holes.map(h => h.hole), [1, 2]);
  assert.equal(map.geometry.holes[0].targetKind, 'green-reference');
  assert.equal(map.geometry.holes[1].targetKind, 'path-end');
  assert.equal(map.geometry.holes[1].par, undefined, 'never invent par');
  assert.deepEqual(map.geometry.features.map(f => f.kind), ['green', 'fairway', 'bunker', 'water']);
  assert.equal(map.geometry.features.at(-1).rings.length, 2);
  assert.equal(map.geometry.sourceUrl, 'https://www.openstreetmap.org/way/10');
});
test('duplicate loops, outside-course paths and open/malformed surfaces are omitted, not guessed', () => {
  const input = structuredClone(raw);
  input.elements.push({ ...input.elements[1], id: 105 });
  input.elements.push({ type: 'way', id: 106, tags: { golf: 'hole', ref: '3' }, geometry: [{ lat: 0, lon: 0 }, { lat: 0, lon: .01 }] });
  input.elements.push({ type: 'way', id: 207, tags: { golf: 'green' }, geometry: [{ lat: 0, lon: 0 }, { lat: 0, lon: .01 }] });
  const result = data.parseCourseMap(input, 'osm-way-10', 'way-10');
  assert.deepEqual(result.geometry.holes.map(h => h.hole), [2]);
  assert.equal(result.omitted, 4);
});
test('partial service replies, absent boundaries and identity-swapped cache data cannot become a map', () => {
  assert.throws(() => data.parseCourseMap({ ...raw, remark: 'timeout' }, 'osm-way-10', 'way-10'));
  assert.throws(() => data.parseCourseMap(raw, 'osm-way-11', 'way-11'));
  assert.equal(data.courseMapSchema.safeParse({ ...mapped(), courseId: 'osm-way-999' }).success, false);
});
test('dynamic course registration never canonicalises an unrelated course to Pacific', () => {
  const map = mapped();
  geometry.registerCourseGeometry(map.courseId, map.geometry);
  assert.equal(geometry.canonicalCourseId(map.courseId), map.courseId);
  assert.equal(geometry.getCourseGeometry(map.courseId), map.geometry);
  assert.notEqual(geometry.getCourseGeometry('pacific-golf-club'), map.geometry);
  assert.equal(geometry.getCourseGeometry('osm-way-11'), null);
  const h = map.geometry.holes[1];
  assert.throws(() => geometry.createDailyPin(map.courseId, 2, { ...h.target, accuracy: 5, timestamp: 10 }, 10, 10), /green reference/);
});
test('worldwide search safely escapes input, validates coordinates and requests geometry, not only centres', () => {
  assert.throws(() => api.courseSearchQuery('go'));
  const query = api.courseSearchQuery('St. Andrews "Old"');
  assert.ok(query.includes('golf_course') && query.includes('40;') && query.includes('St\\\\. Andrews'));
  const layout = api.courseLayoutQuery('way-10');
  assert.ok(layout.includes('out geom;'));
  assert.ok(!layout.includes('out geom center'));
  assert.throws(() => api.courseLayoutQuery('way-10);out;'));
  const directory = api.parseCourseDirectory({ elements: [
    { type: 'way', id: 10, center: { lat: 56.34, lon: -2.80 }, tags: { leisure: 'golf_course', name: 'Scottish fixture' } },
    { type: 'way', id: 11, center: { lat: 37.2, lon: -121.4 }, tags: { leisure: 'golf_course', name: 'American fixture' } },
    null, { type: 'node', id: 12, lat: 999, lon: 0, tags: { leisure: 'golf_course', name: 'Bad coordinates' } },
  ] });
  assert.equal(directory.length, 2);
});
test('downloads use selected OSM identity, propagate provider failure, and respect cancellation', async () => {
  const course = { id: 'osm-way-10', name: 'Fixture Club', latitude: -27.99, longitude: 153.01 };
  let request;
  const result = await api.downloadCourseMap(course, new AbortController().signal, true, async (url, options) => {
    request = options; return new Response(JSON.stringify(raw), { status: 200 });
  });
  assert.equal(result.osmKey, 'way-10');
  assert.ok(decodeURIComponent(request.body).includes('way(10)'));
  assert.ok(request.headers['User-Agent'].includes('DRC-Golf-Tempo'));
  await assert.rejects(api.downloadCourseMap(course, new AbortController().signal, false, async () => new Response('', { status: 504 })), /unavailable/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(api.downloadCourseMap(course, controller.signal, false, async (_, options) => {
    if (options.signal.aborted) throw new Error('cancelled');
  }), /cancelled/);
});
test('offline cache survives restart, rejects cross-course records, and retains old map if writing fails', async () => {
  store.clear();
  const map = mapped();
  await cache.writeMap(map);
  assert.deepEqual(await cache.readMap(map.courseId), map);
  const oldIndex = store.get('drc-course-map-v1:osm-way-10');
  failWrite = true;
  await assert.rejects(cache.writeMap({ ...map, downloadedAt: '2026-10-12T01:00:00Z' }));
  failWrite = false;
  assert.equal(store.get('drc-course-map-v1:osm-way-10'), oldIndex);
  assert.deepEqual(await cache.readMap(map.courseId), map);
  store.set('drc-course-map-v1:osm-way-11', oldIndex);
  await assert.rejects(cache.readMap('osm-way-11'), /index/);
});
