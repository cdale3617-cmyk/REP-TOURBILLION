const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Compile the production pure functions without loading Expo or a device.
const filename = path.resolve(__dirname, '../utils/courseGeometry.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(compiled, filename);
const { canonicalCourseId, mergeDiscoveredCourse, migrateMappedCourseReference, getCourseGeometry, distanceMeters, getTargetDistance, createDailyPin } = loaded.exports;
const geometry = getCourseGeometry('pacific-golf-club');
const now = 1791072000000;
const target = geometry.holes[0].target;
const fix = { ...target, timestamp: now, accuracy: 5 };

test('all 18 holes have unique sourced targets and valid coordinates', () => {
  assert.deepEqual(geometry.holes.map((h) => h.hole), Array.from({ length: 18 }, (_, i) => i + 1));
  assert.equal(new Set(geometry.holes.map((h) => h.osmWayId)).size, 18);
  assert.equal(new Set(geometry.holes.map((h) => JSON.stringify(h.target))).size, 18);
  assert.equal(geometry.holes.reduce((total, h) => total + h.par, 0), 72);
  for (const hole of geometry.holes) {
    assert.ok(hole.path.length >= 2);
    assert.deepEqual(hole.target, hole.path.at(-1));
    assert.ok(distanceMeters(hole.path[0], hole.target) > 100);
    assert.ok(distanceMeters(hole.path[0], hole.target) < 650);
    for (const point of hole.path) {
      assert.ok(point.latitude > -27.520 && point.latitude < -27.513);
      assert.ok(point.longitude > 153.099 && point.longitude < 153.114);
    }
  }
});

test('only exact course identities can use curated targets', () => {
  assert.equal(getCourseGeometry('osm-relation-1668736'), geometry);
  for (const id of [undefined, 'unknown', 'royal-queensland', 'brisbane-golf-club', 'Pacific Golf Club']) {
    assert.equal(getCourseGeometry(id), null);
  }
});

test('bundled fallback contains licensed, closed real surface polygons, not generated decoration', () => {
  const asset = require('../data/pacific-surfaces.json');
  assert.equal(asset.license, 'ODbL');
  assert.equal(asset.sourceUrl, geometry.sourceUrl);
  assert.equal(geometry.features.length, 144);
  for (const kind of ['fairway', 'green', 'tee', 'bunker', 'water', 'trees']) assert.ok(geometry.features.some(f => f.kind === kind));
  for (const feature of geometry.features) {
    assert.match(feature.id, /^(way|relation)-\d+$/);
    for (const ring of feature.rings) {
      assert.ok(ring.length >= 4);
      assert.deepEqual(ring[0], ring.at(-1));
      assert.ok(ring.every(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)));
    }
  }
});

test('reselecting the mapped course through OpenStreetMap preserves its saved identity and daily pins', () => {
  const saved = {
    id: 'pacific-golf-club', name: 'Pacific Golf Club', latitude: -27.5166, longitude: 153.1064,
  };
  const discovered = {
    id: 'osm-relation-1668736', name: 'Pacific Golf Club', latitude: -27.5165667, longitude: 153.1063719,
  };
  const merged = mergeDiscoveredCourse([saved], discovered);
  const stableId = merged.id;
  assert.equal(stableId, 'pacific-golf-club');
  assert.equal(merged.courses.length, 1);
  assert.equal(merged.courses[0].id, stableId);
  assert.deepEqual(
    { latitude: merged.courses[0].latitude, longitude: merged.courses[0].longitude },
    { latitude: geometry.latitude, longitude: geometry.longitude },
  );
  const oldPin = createDailyPin('osm-relation-1668736', 1, fix, now, now);
  const migratedPin = migrateMappedCourseReference(oldPin, stableId);
  assert.equal(migratedPin.courseId, stableId);
  assert.equal(migratedPin.latitude, oldPin.latitude);
  assert.equal(migratedPin.capturedAt, oldPin.capturedAt);
  const otherPin = { ...oldPin, courseId: 'osm-relation-999' };
  assert.equal(migrateMappedCourseReference(otherPin, stableId), otherPin, 'Leave another course’s historical records unchanged.');
  const unrelated = mergeDiscoveredCourse(merged.courses, {
    id: 'osm-relation-999', name: 'Other golf club', latitude: -27.6, longitude: 153.2,
  });
  assert.equal(unrelated.id, 'osm-relation-999', 'Do not guess identity from nearby coordinates or names.');
  assert.equal(unrelated.courses.length, 2);
  assert.equal(canonicalCourseId('osm-relation-999'), 'osm-relation-999');
  const pin = createDailyPin(stableId, 1, fix, now, now);
  assert.equal(pin.courseId, stableId);
  assert.equal(getCourseGeometry(stableId), geometry);
});

test('haversine distance measures real coordinates, not hole-number offsets', () => {
  assert.equal(distanceMeters(target, target), 0);
  assert.ok(Math.abs(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }) - 111194.93) < 0.1);
  assert.equal(getTargetDistance(fix, target, now).meters, 0);
  for (const hole of geometry.holes) {
    const actual = { ...hole.path[0], accuracy: 5, timestamp: now };
    assert.equal(getTargetDistance(actual, hole.target, now).meters, distanceMeters(actual, hole.target));
  }
});

test('missing geometry and GPS never produce distances', () => {
  assert.equal(getTargetDistance(fix, undefined, now).meters, null);
  assert.equal(getTargetDistance(null, target, now).meters, null);
});

test('stale, invalid, inaccurate and off-course fixes are rejected', () => {
  for (const patch of [
    { timestamp: now - 30001 }, { timestamp: now + 5001 }, { accuracy: 31 },
    { accuracy: null }, { accuracy: -1 }, { accuracy: NaN },
    { latitude: NaN }, { latitude: 91 }, { longitude: 181 },
    { latitude: 0, longitude: 0 },
  ]) {
    assert.equal(getTargetDistance({ ...fix, ...patch }, target, now).meters, null);
  }
  assert.notEqual(getTargetDistance({ ...fix, accuracy: 30, timestamp: now - 30000 }, target, now).meters, null);
});

test('changing hole changes target; moving device changes distance', () => {
  const first = getTargetDistance(fix, target, now).meters;
  const next = getTargetDistance(fix, geometry.holes[1].target, now).meters;
  assert.notEqual(first, next);
  assert.ok(getTargetDistance({ ...fix, latitude: fix.latitude + 0.0001 }, target, now).meters > 10);
});