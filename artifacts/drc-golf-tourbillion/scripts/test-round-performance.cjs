const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = name => name in dependencies ? dependencies[name] : original(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.React },
  }).outputText, filename);
  return loaded.exports;
}
const backup = load('utils/backup.ts', { './greenPhotoReference': load('utils/greenPhotoReference.ts') });
const { summarizeRoundPerformance: summarize, comparePerformanceRounds: compare } = load('utils/roundPerformance.ts');
function round(id = 'round-a', stats = [], overrides = {}) {
  return {
    id, courseId: 'course-a', startedAt: '2026-09-01T00:00:00.000Z', finishedAt: '2026-09-01T04:00:00.000Z', currentHole: 3,
    holes: Array.from({ length: 18 }, (_, index) => ({ hole: index + 1, par: index === 1 ? 3 : 4, score: index < 3 ? 4 : null, ...stats[index] })),
    ...overrides,
  };
}
const base = () => ({
  playerName: 'Test golfer', unit: 'm', lastCourseId: 'course-a',
  courses: [{ id: 'course-a', name: 'Test course', area: 'Local', par: 72, latitude: -27, longitude: 153 }],
  bag: [], activeRound: null, rounds: [], activities: [], biometrics: [], checklist: [], wedgeMatrix: {},
});

test('legacy rounds remain unchanged and missing statistics stay unknown, not zero', () => {
  const saved = round();
  assert.deepEqual(backup.parseBackup(backup.createBackup({ ...base(), rounds: [saved] })).rounds, [saved]);
  const summary = summarize([saved]);
  assert.equal(summary.scoredHoles, 3);
  assert.equal(summary.totalScore, 12);
  assert.equal(summary.toPar, 1);
  assert.equal(summary.puttsRecorded, 0);
  assert.equal(summary.averagePutts, null);
  assert.equal(summary.penaltiesRecorded, 0);
  assert.equal(summary.greensRecorded, 0);
  assert.equal(summary.fairwaysRecorded, 0);
  assert.equal(summary.focus.tool, null);
});

test('zero counts, missed greens and missed fairways are explicit records with separate coverage denominators', () => {
  const saved = round('recorded', [
    { putts: 2, penalties: 0, fairway: 'miss', greenInRegulation: false },
    { putts: 3, penalties: 0, greenInRegulation: true },
    { putts: null, penalties: null, fairway: null, greenInRegulation: null },
  ]);
  const summary = summarize([saved]);
  assert.equal(summary.puttsRecorded, 2);
  assert.equal(summary.totalPutts, 5);
  assert.equal(summary.averagePutts, 2.5);
  assert.equal(summary.threePuttHoles, 1);
  assert.equal(summary.penaltiesRecorded, 2);
  assert.equal(summary.totalPenalties, 0);
  assert.equal(summary.fairwaysRecorded, 1);
  assert.equal(summary.fairwayEligible, 2);
  assert.equal(summary.fairwaysHit, 0);
  assert.equal(summary.greensRecorded, 2);
  assert.equal(summary.greenEligible, 3);
  assert.equal(summary.greensHit, 1);
  assert.equal(summary.focus.tool, null);
});

test('statistics on unscored holes never inflate saved performance or coverage', () => {
  const saved = round('partial', [{ score: null, putts: 2, penalties: 1, fairway: 'hit', greenInRegulation: true }]);
  const summary = summarize([saved]);
  assert.equal(summary.scoredHoles, 2);
  assert.equal(summary.puttsRecorded, 0);
  assert.equal(summary.penaltiesRecorded, 0);
  assert.equal(summary.fairwaysRecorded, 0);
  assert.equal(summary.greensRecorded, 0);
});

test('new metadata round-trips through backup, and invalid/inconsistent statistics reject the complete restore', () => {
  const saved = round('metadata', [
    { putts: 2, penalties: 1, fairway: 'miss', greenInRegulation: false },
    { putts: 1, penalties: 0, greenInRegulation: true },
  ]);
  assert.deepEqual(backup.parseBackup(backup.createBackup({ ...base(), rounds: [saved] })).rounds, [saved]);
  for (const stats of [
    { putts: -1 }, { putts: 1.5 }, { penalties: NaN }, { penalties: 100 },
    { putts: 3, penalties: 2 }, { fairway: 'unknown-string' }, { greenInRegulation: 'yes' },
  ]) {
    assert.throws(() => backup.validateGolfState({ ...base(), rounds: [round('invalid', [stats])] }));
  }
  assert.throws(() => backup.validateGolfState({ ...base(), rounds: [round('invalid-par3', [{}, { fairway: 'hit' }])] }));
});

test('hole edits preserve other fields, can clear a recorded statistic to unknown and refuse unscored holes', () => {
  const original = { hole: 1, par: 4, score: 5, putts: 2, penalties: 1, fairway: 'hit', greenInRegulation: true };
  const changed = backup.validateHolePerformance(original, { putts: null, fairway: 'miss' });
  assert.equal(changed.score, 5);
  assert.equal(changed.putts, null);
  assert.equal(changed.penalties, 1);
  assert.equal(changed.greenInRegulation, true);
  assert.equal(original.fairway, 'hit');
  assert.throws(() => backup.validateHolePerformance({ hole: 1, par: 4, score: null }, { putts: 2 }));
  assert.throws(() => backup.validateHolePerformance(original, { putts: 5, penalties: 1 }));
});

test('focus uses recorded opportunities and sufficient coverage, not fabricated strokes gained', () => {
  const putts = round('putting', [{ putts: 3 }, { putts: 2 }, { putts: 2 }]);
  assert.equal(summarize([putts]).focus.tool, 'putting-practice');
  const penalty = round('penalty', [{ penalties: 1 }, { penalties: 0 }, { penalties: 0 }]);
  assert.equal(summarize([penalty]).focus.title, 'Reduce penalty strokes');
  assert.equal(summarize([round('small', [{ penalties: 1 }])]).focus.tool, null);
  const greens = round('approach', [{ greenInRegulation: false }, { greenInRegulation: false }, { greenInRegulation: true }]);
  assert.equal(summarize([greens]).focus.tool, 'wedge-matrix');
  assert.match(summarize([greens]).focus.reason, /does not identify/);
  const fairways = round('tee', [{ fairway: 'miss' }, {}, { fairway: 'miss' }, { score: 4, fairway: 'hit' }]);
  assert.equal(summarize([fairways]).focus.title, 'Practise tee-shot direction');
  assert.match(summarize([fairways]).focus.reason, /not a count of strokes lost/);
  assert.equal(summarize([round('steady', [{ putts: 2 }, { putts: 2 }, { putts: 2 }])]).focus.title, 'Keep strengths consistent');
});

test('scoring trends compare the latest card only to the same course, scored holes and pars', () => {
  const earlier = round('earlier');
  const latest = round('latest', [{ score: 5 }], { finishedAt: '2026-09-04T04:00:00.000Z' });
  const differentHoles = round('different-holes', [{ score: null }, {}, {}, { score: 4 }], { finishedAt: '2026-09-03T04:00:00.000Z' });
  const differentCourse = { ...earlier, id: 'different-course', courseId: 'other', finishedAt: '2026-09-02T04:00:00.000Z' };
  const result = compare([earlier, differentCourse, latest, differentHoles]);
  assert.equal(result.latest.id, 'latest');
  assert.equal(result.previous.id, 'earlier');
  assert.equal(result.holes, 3);
  assert.equal(result.scoreChange, 1);
  assert.equal(compare([latest, differentHoles]), null);
  assert.equal(compare([latest, differentCourse]), null);
  assert.equal(compare([latest, round('changed-par', [{ par: 5 }])]), null);
  assert.equal(compare([]), null);
});

test('context edits only the selected active/saved hole, blocks inconsistent totals and unavailable storage', () => {
  let slots = [], cursor = 0;
  const React = {
    createContext: () => ({ Provider: 'provider' }), createElement: (_type, props) => props,
    useState: initial => { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], update => { slots[index] = typeof update === 'function' ? update(slots[index]) : update; }]; },
    useRef: value => ({ current: value }), useMemo: fn => fn(), useEffect: () => {},
  };
  const context = load('context/GolfContext.tsx', {
    react: React, '@react-native-async-storage/async-storage': {}, '@/utils/courseGeometry': {},
    '@/utils/backup': backup, './useDeviceReadings': { useDeviceReadings: () => ({}) },
  });
  slots = [{ ...base(), activeRound: round('active'), rounds: [round('saved'), round('untouched')] }, true, '', true];
  const provider = () => { cursor = 0; return context.GolfProvider({ children: null }).value; };
  provider().setHolePerformance('saved', 1, { putts: 2, penalties: 1, fairway: 'miss', greenInRegulation: false });
  assert.equal(slots[0].rounds[0].holes[0].putts, 2);
  assert.deepEqual(slots[0].rounds[1], round('untouched'));
  assert.equal(slots[0].activeRound.holes[0].putts, undefined);
  assert.equal(slots[0].rounds[0].holes[1].putts, undefined);
  provider().setHolePerformance('active', 1, { putts: 2, penalties: 1 });
  provider().setHoleScore(1, 1);
  assert.equal(slots[0].activeRound.holes[0].score, 3);
  assert.throws(() => provider().setHolePerformance('saved', 1, { putts: 4, penalties: 2 }));
  assert.throws(() => provider().setHolePerformance('missing', 1, { putts: 2 }));
  assert.deepEqual(backup.parseBackup(backup.createBackup(slots[0])).rounds, slots[0].rounds);
  slots[3] = false;
  assert.throws(() => provider().setHolePerformance('saved', 1, { putts: null }), /storage warning/);
});
