// Test fixtures are synthetic; these checks do not certify physical GPS accuracy.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = name => name in dependencies ? dependencies[name] : name === './training' || name === '@/utils/training' ? require('./load-training.cjs') : original(name);
  loaded._compile(compiled, filename);
  return loaded.exports;
}

const geometry = load('utils/courseGeometry.ts');
const backup = load('utils/backup.ts', { './greenPhotoReference': load('utils/greenPhotoReference.ts') });
const { createDailyPin, getPinCaptureProblem, isDailyPinCurrent, localDate, getCourseGeometry } = geometry;
const courseId = 'pacific-golf-club';
const now = new Date(2026, 9, 4, 12).getTime();
const target = getCourseGeometry(courseId).holes[0].target;
const requestedAt = now - 2000;
const fix = { ...target, accuracy: 5, timestamp: now - 1000 };
const capture = (patch = {}) => createDailyPin(courseId, 1, { ...fix, ...patch }, requestedAt, now);

test('records date, hole, reported accuracy, fresh fix time and user provenance without mutating sourced geometry', () => {
  const original = JSON.stringify(getCourseGeometry(courseId));
  const pin = capture({ latitude: target.latitude + 0.00005 });
  assert.equal(pin.courseId, courseId);
  assert.equal(pin.hole, 1);
  assert.equal(pin.date, localDate(now));
  assert.equal(pin.accuracy, 5);
  assert.equal(pin.fixTimestamp, fix.timestamp);
  assert.equal(pin.capturedAt, new Date(now).toISOString());
  assert.equal(pin.provenance, 'user-device-gps');
  assert.equal(pin.onGreenConfirmed, true);
  assert.notDeepEqual({ latitude: pin.latitude, longitude: pin.longitude }, target);
  assert.equal(JSON.stringify(getCourseGeometry(courseId)), original);
});

test('rejects cached, stale, future, invalid, inaccurate, simulated and wrong-green fixes', () => {
  for (const patch of [
    { timestamp: requestedAt - 1 }, { timestamp: now - 10001 }, { timestamp: now + 1 },
    { latitude: NaN }, { latitude: 91 }, { longitude: 181 }, { timestamp: NaN },
    { accuracy: null }, { accuracy: 0 }, { accuracy: -1 }, { accuracy: 10.01 }, { accuracy: Infinity },
    { mocked: true }, { latitude: target.latitude + 0.001 },
  ]) assert.throws(() => capture(patch), undefined, JSON.stringify(patch));
  assert.equal(getPinCaptureProblem(null, target, requestedAt, now).includes('Waiting'), true);
  assert.throws(() => createDailyPin('unknown', 1, fix, requestedAt, now), /no source-checked/);
  assert.throws(() => createDailyPin(courseId, 19, fix, requestedAt, now), /no source-checked/);
  assert.equal(capture({ accuracy: 10, timestamp: requestedAt }).accuracy, 10);
  assert.equal(getPinCaptureProblem({ ...fix, timestamp: now - 10000 }, target, now - 10000, now), null);
});

test('pins stop being current at local midnight, after expiry or when clock moves before capture', () => {
  const pin = capture();
  const midnight = new Date(2026, 9, 5).getTime();
  assert.equal(Date.parse(pin.expiresAt), midnight);
  assert.equal(isDailyPinCurrent(pin, now), true);
  assert.equal(isDailyPinCurrent(pin, midnight - 1), true);
  assert.equal(isDailyPinCurrent(pin, midnight), false);
  assert.equal(isDailyPinCurrent(pin, now - 1), false);
  assert.equal(isDailyPinCurrent({ ...pin, date: '2026-10-03' }, now), false);
  assert.equal(isDailyPinCurrent(pin, midnight + 86400000), false);
});

function snapshot(pins) {
  return {
    playerName: 'Test golfer', unit: 'm', lastCourseId: courseId,
    courses: [{ id: courseId, name: 'Test course', area: '', par: 72, ...target }],
    bag: [], activeRound: null, rounds: [], activities: [], biometrics: [], checklist: [], wedgeMatrix: {},
    ...(pins === undefined ? {} : { dailyPins: pins }),
  };
}

test('old saved state and backups load without pins; recorded pins survive backup and restore', () => {
  assert.deepEqual(backup.validateGolfState(snapshot()).dailyPins, []);
  const oldBackup = JSON.stringify({ app: 'DRC Golf Tourbillion', version: 1, exportedAt: new Date(now).toISOString(), data: snapshot() });
  assert.deepEqual(backup.parseBackup(oldBackup).dailyPins, []);
  const pin = capture();
  assert.deepEqual(backup.parseBackup(backup.createBackup(snapshot([pin]))).dailyPins, [pin]);
  assert.equal(isDailyPinCurrent(backup.validateGolfState(snapshot([pin])).dailyPins[0], now + 86400000), false);
});

test('legacy club rows remain valid and make/model details survive backup and restore', () => {
  const legacyClub = { id: '7i', name: '7 Iron', carryMeters: 150, loft: 32 };
  assert.deepEqual(backup.validateGolfState({ ...snapshot(), bag: [legacyClub] }).bag, [legacyClub]);
  const personalizedClub = { ...legacyClub, make: 'PING', model: 'i230' };
  const restored = backup.parseBackup(backup.createBackup({ ...snapshot(), bag: [personalizedClub] }));
  assert.deepEqual(restored.bag, [personalizedClub]);
});

test('restore rejects malformed metadata, duplicates and missing-course pin records', () => {
  const pin = capture();
  for (const patch of [
    { accuracy: 11 }, { provenance: 'OpenStreetMap' }, { onGreenConfirmed: false },
    { hole: 0 }, { courseId: 'other-course' }, { date: 'not-a-date' },
    { expiresAt: pin.capturedAt }, { fixTimestamp: now + 1 }, { fixTimestamp: now - 10001 },
    { expiresAt: new Date(now + 86400001).toISOString() },
  ]) assert.throws(() => backup.validateGolfState(snapshot([{ ...pin, ...patch }])));
  assert.throws(() => backup.validateGolfState(snapshot([pin, pin])));
});

test('records each hole separately instead of reusing another hole’s pin', () => {
  const hole2 = getCourseGeometry(courseId).holes[1].target;
  const pins = [capture(), createDailyPin(courseId, 2, { ...fix, ...hole2 }, requestedAt, now)];
  assert.equal(backup.validateGolfState(snapshot(pins)).dailyPins.length, 2);
  assert.notDeepEqual(pins[0], pins[1]);
});