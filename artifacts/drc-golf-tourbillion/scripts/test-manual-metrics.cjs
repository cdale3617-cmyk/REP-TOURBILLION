const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../utils/backup.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
const referenceFilename = path.resolve(__dirname, '../utils/greenPhotoReference.ts');
const referenceModule = new Module(referenceFilename, module);
referenceModule._compile(ts.transpileModule(fs.readFileSync(referenceFilename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, referenceFilename);
const originalRequire = loaded.require.bind(loaded);
loaded.require = name => name === './greenPhotoReference' ? referenceModule.exports : originalRequire(name);
loaded._compile(compiled, filename);
const { createBackup, parseBackup, validateGolfState, golfActivityMetricsSchema } = loaded.exports;

const timestamp = '2026-01-02T03:04:05.000Z';
const baseState = (activities = []) => ({
  playerName: 'Dale',
  unit: 'm',
  lastCourseId: 'course-a',
  courses: [{ id: 'course-a', name: 'Test course', area: 'Local', par: 72, latitude: -27, longitude: 153 }],
  bag: [],
  activeRound: null,
  rounds: [],
  activities,
  biometrics: [],
  checklist: [],
  wedgeMatrix: {},
});

test('legacy activity rows without optional manual metrics remain valid', () => {
  const legacy = { id: 'old-activity', tool: 'swing-monitor', title: 'Swing', note: 'Video review', createdAt: timestamp };
  assert.deepEqual(validateGolfState(baseState([legacy])).activities, [legacy]);
});

test('club-linked shot metadata survives backup without relinking removed clubs or discarding legacy entries', () => {
  const linked = {
    id: 'linked-shot', tool: 'shot-pattern', title: '7 Iron', note: 'Measured carry and lateral',
    value: 150, lateral: -4, clubId: 'removed-club', clubSetupKey: '["test","model",32]', createdAt: timestamp,
  };
  assert.deepEqual(parseBackup(createBackup(baseState([linked]))).activities, [linked]);
});

test('optional known practice conditions survive backup and malformed or invented tags are rejected', () => {
  const entry = { id: 'tagged-shot', tool: 'shot-pattern', title: '7 Iron', note: 'Measured', value: 150, lateral: 2, createdAt: timestamp,
    shotConditions: { lie: 'fairway', surface: 'grass', wind: 'calm' } };
  assert.deepEqual(parseBackup(createBackup(baseState([entry]))).activities, [entry]);
  for (const shotConditions of [{ lie: 'perfect' }, { surface: 'concrete' }, { wind: 10 }, { lie: 'rough', automaticCarry: 150 }]) {
    assert.throws(() => validateGolfState(baseState([{ ...entry, shotConditions }])));
  }
});

test('manual Flight and Kinetics readings validate and survive local backup round trip', () => {
  const flight = {
    id: 'flight-1', tool: 'shot-tracer', title: 'Flight readings',
    note: 'Manual launch monitor entry. Camera records video only.',
    metrics: { source: 'manual-launch-monitor-or-coach', distanceUnit: 'yd', ballSpeedMph: 142.5, clubSpeedMph: 96, apex: 31, carry: 238 },
    createdAt: timestamp,
  };
  const kinetics = {
    id: 'kinetics-1', tool: 'swing-monitor', title: 'Kinetics readings', note: 'Manual coach entry.',
    metrics: {
      source: 'manual-launch-monitor-or-coach', clubPathDeg: -2.4, faceAngleDeg: 1.2,
      tempoRatio: 3.1, maxForceBodyWeightPct: 164, torqueNm: 82,
      forceTransferPct: 71, pressureLeftPct: 43, pressureRightPct: 57,
    },
    createdAt: timestamp,
  };
  const state = baseState([flight, kinetics]);
  assert.deepEqual(parseBackup(createBackup(state)).activities, [flight, kinetics]);
});

test('rejects missing values, non-finite values and out-of-range manual metrics', () => {
  assert.equal(golfActivityMetricsSchema.safeParse({ source: 'manual-launch-monitor-or-coach' }).success, false);
  for (const metrics of [
    { ballSpeedMph: 0 }, { ballSpeedMph: 251 }, { clubSpeedMph: 0 }, { clubSpeedMph: 201 }, { apex: -1 }, { apex: 2001 },
    { carry: -1 }, { carry: 1001 }, { clubPathDeg: -31 }, { clubPathDeg: 31 },
    { faceAngleDeg: 31 }, { tempoRatio: 0.49 }, { tempoRatio: 5.1 },
    { maxForceBodyWeightPct: 501 }, { torqueNm: -1 }, { torqueNm: 1001 },
    { forceTransferPct: 101 }, { pressureLeftPct: -1 }, { pressureRightPct: 101 },
    { carry: Infinity },
  ]) {
    const activity = {
      id: `invalid-${Object.keys(metrics)[0]}`, tool: 'shot-tracer', title: 'Invalid',
      note: 'Test', metrics: { source: 'manual-launch-monitor-or-coach', ...metrics },
      createdAt: timestamp,
    };
    assert.throws(() => validateGolfState(baseState([activity])));
  }
});

test('rejects unsupported source labels and unit values in backup metrics', () => {
  const baseActivity = { id: 'bad-source', tool: 'shot-tracer', title: 'Invalid', note: 'Test', createdAt: timestamp };
  for (const metrics of [
    { source: 'camera-estimate', ballSpeedMph: 130 },
    { source: 'manual-launch-monitor-or-coach', distanceUnit: 'feet', carry: 220 },
  ]) assert.throws(() => validateGolfState(baseState([{ ...baseActivity, metrics }])));
});

test('phone motion summaries survive backup round trip with explicit device provenance', () => {
  const activity = {
    id: 'motion-1',
    tool: 'swing-monitor',
    title: 'Phone motion capture',
    note: 'Phone movement only; not club or ball measurement.',
    phoneMotion: {
      source: 'phone-motion-sensors',
      capturedAt: timestamp,
      durationMs: 2400,
      accelerometerSampleCount: 112,
      gyroscopeSampleCount: 111,
      peakDynamicAccelerationG: 1.32,
      peakRotationDegPerSecond: 182.6,
    },
    createdAt: timestamp,
  };
  const state = baseState([activity]);
  assert.deepEqual(parseBackup(createBackup(state)).activities, [activity]);
  assert.throws(() => validateGolfState(baseState([{
    ...activity,
    id: 'invalid-motion',
    phoneMotion: { ...activity.phoneMotion, source: 'club-motion' },
  }])));
});
