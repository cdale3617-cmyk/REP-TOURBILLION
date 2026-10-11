const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const cache = new Map();
function load(relative) {
  const file = path.resolve(__dirname, '../utils', relative);
  if (cache.has(file)) return cache.get(file).exports;
  const m = new Module(file, module);
  cache.set(file, m);
  m.require = name => name.startsWith('./') ? load(name.slice(2) + '.ts') : require(name);
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, file);
  return m.exports;
}
const training = load('training.ts');
const { golfStateSchema } = load('backup.ts');
const date = new Date(2026, 9, 11, 12);
const plan = () => training.buildTrainingPlan([], [], date);
const putt = (id, made, attempts = 10, distance = '3 m') => ({
  id: `${id}`, tool: 'putting-practice', title: 'Putting set', note: `${made}/${attempts} made from ${distance}`,
  createdAt: new Date(2026, 9, id, 12).toISOString(),
});
const round = stats => ({
  id: 'r', courseId: 'c', startedAt: '2026-10-09T00:00:00Z', finishedAt: '2026-10-09T04:00:00Z', currentHole: 18,
  holes: Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, par: 4, score: 5, ...stats })),
});
test('local Monday weeks cross month/year boundaries and Sunday correctly', () => {
  assert.equal(training.getTrainingWeekKey(date), '2026-10-05');
  assert.equal(training.getTrainingWeekKey(new Date(2026, 9, 12, 0)), '2026-10-12');
  assert.equal(training.getTrainingWeekKey(new Date(2027, 0, 1, 12)), '2026-12-28');
});
test('empty/missing metrics give honest starter, recorded holes give reasoned personalised drills', () => {
  assert.equal(plan().source, 'starter');
  assert.equal(training.buildTrainingPlan([round({})], [], date).source, 'starter');
  const putting = training.buildTrainingPlan([round({ putts: 3 })], [], date);
  assert.equal(putting.source, 'personalised');
  assert.equal(putting.drillIds[0], 'putting');
  assert.match(putting.reason, /recorded|tracked/i);
  const penalties = training.buildTrainingPlan([round({ penalties: 1 })], [], date);
  assert.equal(penalties.drillIds[0], 'dispersion');
  assert.equal(new Set(penalties.drillIds).size, 3);
});
test('matching recorded putting practice personalises plan without guessing legacy/invalid notes', () => {
  assert.equal(training.buildTrainingPlan([], [putt(1, 5), putt(2, 5), putt(3, 5)], date).source, 'personalised');
  assert.equal(training.buildTrainingPlan([], [putt(1, 5), putt(2, 5, 10, '4 m'), putt(3, 5)], date).source, 'starter');
  assert.equal(training.buildTrainingPlan([], [putt(1, 11), putt(2, 11), putt(3, 11)], date).source, 'starter');
});
test('putting trend weights attempts and requires six matching-distance sets', () => {
  const activities = [putt(1, 2), putt(2, 3), putt(3, 4), putt(4, 8), putt(5, 9), putt(6, 10)];
  const trend = training.getPuttingTrend(activities);
  assert.equal(trend.previousPercent, 30);
  assert.equal(trend.latestPercent, 90);
  assert.equal(training.getPuttingTrend(activities.slice(1)), null);
  activities[5] = putt(6, 10, 10, '4 m');
  assert.equal(training.getPuttingTrend(activities), null);
  const weighted = training.getPuttingTrend([putt(1, 1, 1), putt(2, 1, 1), putt(3, 0, 8), putt(4, 1, 1), putt(5, 1, 1), putt(6, 8, 8)]);
  assert.equal(weighted.previousPercent, 20);
  assert.equal(weighted.latestPercent, 100);
});
test('goals and logs reject invalid numbers and orphan sessions; progress is scoped to saved week', () => {
  for (const weeklySessions of [0, 8, 1.5, NaN]) assert.throws(() => training.buildTrainingPlan([], [], date, weeklySessions));
  assert.equal(training.trainingPlanSchema.safeParse({ ...plan(), weekKey: '2026-02-30' }).success, false);
  const session = { id: 's', weekKey: plan().weekKey, drillId: 'putting', durationMinutes: 17, note: 'Good pace', createdAt: date.toISOString() };
  assert.deepEqual(training.getTrainingProgress(plan(), [session, { ...session, weekKey: '2026-09-28' }]), { completedSessions: 1, completedMinutes: 17, targetMinutes: 60, percent: 33 });
  assert.equal(training.trainingStateSchema.safeParse({ plans: [], sessions: [session] }).success, false);
  assert.equal(training.trainingSessionSchema.safeParse({ ...session, durationMinutes: 0 }).success, false);
  assert.equal(training.trainingStateSchema.safeParse({ plans: [plan(), plan()], sessions: [] }).success, false);
});
test('old snapshots default training empty; plans/logs survive normal backup roundtrip', () => {
  const state = { playerName: 'Player', unit: 'm', lastCourseId: 'c', courses: [{ id: 'c', name: 'Course', area: '', par: 72, latitude: 0, longitude: 0 }], bag: [], activeRound: null, rounds: [], activities: [], biometrics: [], checklist: [], wedgeMatrix: {}, dailyPins: [] };
  const old = golfStateSchema.parse(state);
  assert.deepEqual(old.training, { plans: [], sessions: [] });
  old.training = { plans: [plan()], sessions: [{ id: 's', weekKey: plan().weekKey, drillId: 'putting', durationMinutes: 20, note: 'Saved', createdAt: date.toISOString() }] };
  assert.deepEqual(golfStateSchema.parse(JSON.parse(JSON.stringify(old))).training, old.training);
});
