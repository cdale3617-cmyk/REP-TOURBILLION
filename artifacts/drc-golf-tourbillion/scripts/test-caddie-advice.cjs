const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const windFilename = path.resolve(__dirname, '../utils/wind.ts');
const compiledWind = ts.transpileModule(fs.readFileSync(windFilename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const loadedWind = new Module(windFilename, module);
loadedWind.filename = windFilename;
loadedWind.paths = module.paths;
loadedWind._compile(compiledWind, windFilename);
const conditionsFilename = path.resolve(__dirname, '../utils/shotConditions.ts');
const conditionsModule = new Module(conditionsFilename, module);
conditionsModule._compile(ts.transpileModule(fs.readFileSync(conditionsFilename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, conditionsFilename);
const { resolveShotConditions, inferShotLie } = conditionsModule.exports;

const filename = path.resolve(__dirname, '../utils/caddieAdvice.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === './wind' && parent?.filename === filename) return loadedWind.exports;
  if (request === './shotConditions' && parent?.filename === filename) return conditionsModule.exports;
  return originalLoad.call(this, request, parent, isMain);
};
try {
  loaded._compile(compiled, filename);
} finally {
  Module._load = originalLoad;
}
const { buildCaddieReply } = loaded.exports;
const profileFilename = path.resolve(__dirname, '../utils/shotProfiles.ts');
const profileModule = new Module(profileFilename, module);
const profileRequire = profileModule.require.bind(profileModule);
profileModule.require = name => name === './shotConditions' ? conditionsModule.exports : profileRequire(name);
profileModule._compile(ts.transpileModule(fs.readFileSync(profileFilename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, profileFilename);
const { buildShotProfiles, clubSetupKey } = profileModule.exports;

const clubs = [
  { name: '6 Iron', carryMeters: 160 },
  { name: '7 Iron', carryMeters: 150 },
  { name: 'Pitching Wedge', carryMeters: 115 },
];

test('condition matching isolates lie, surface and relative wind; unknown tags do not prove a match', () => {
  const bag = [{ id: '7', name: '7 Iron', make: 'Test', model: 'Iron', loft: 32, carryMeters: 150 }];
  const rows = [];
  for (const conditions of [
    { lie: 'fairway', surface: 'grass', wind: 'calm' },
    { lie: 'fairway', surface: 'mat', wind: 'calm' },
    { lie: 'rough', surface: 'grass', wind: 'calm' },
    { lie: 'fairway', surface: 'grass', wind: 'headwind' },
    undefined,
  ]) for (let i = 0; i < 6; i++) rows.push({
    id: String(rows.length), tool: 'shot-pattern', title: '7 Iron', clubId: '7', clubSetupKey: clubSetupKey(bag[0]),
    value: conditions?.lie === 'rough' ? 100 : 150, lateral: i, createdAt: '2026-01-02T03:04:05.000Z', shotConditions: conditions,
  });
  const conditions = { lie: 'fairway', surface: 'grass', wind: 'calm' };
  const matching = buildShotProfiles(bag, rows, conditions);
  assert.equal(matching[0].count, 6);
  assert.equal(matching[0].medianCarry, 150);
  assert.deepEqual(matching[0].conditions, conditions);
  assert.equal(buildShotProfiles(bag, rows)[0].count, 24, 'known rough excluded from an unspecified normal-carry comparison');
  assert.equal(buildShotProfiles(bag, rows, { lie: 'bunker' }).length, 0);
  const rough = buildShotProfiles(bag, rows, { lie: 'rough', surface: 'grass', wind: 'calm' });
  const answer = buildCaddieReply('rough 100m calm', { clubs: bag, unit: 'm', shotProfiles: rough, shotConditions: { lie: 'rough', surface: 'grass', wind: 'calm' } });
  assert.match(answer, /Condition-matched practice reference, not a club recommendation/);
  assert.match(answer, /100 m from 6 recorded shots/);
  assert.doesNotMatch(answer, /Personal carry comparison|Closest saved carry/);
});

test('a requested condition cannot reuse unfiltered or legacy profiles', () => {
  const bag = [{ id: '7', name: '7 Iron', carryMeters: 150 }];
  const profile = { clubId: '7', count: 8, minCarry: 140, lowCarry: 145, medianCarry: 150, highCarry: 155, maxCarry: 160, lowSide: -5, medianSide: 0, highSide: 5, lastRecordedAt: '2026-01-02T03:04:05.000Z' };
  const reply = buildCaddieReply('fairway 150m', { clubs: bag, unit: 'm', shotProfiles: [profile], shotConditions: { surface: 'grass' } });
  assert.doesNotMatch(reply, /Personal carry comparison/);
  assert.match(reply, /Limited personal data/);
  const matched = buildCaddieReply('fairway 150m', { clubs: bag, unit: 'm', shotProfiles: [{ ...profile, conditions: { lie: 'fairway', surface: 'grass' } }], shotConditions: { surface: 'grass' } });
  assert.match(matched, /Personal carry comparison/);
});

test('explicit current lie takes precedence over a mentioned hazard and contradictory selections block advice', () => {
  assert.equal(inferShotLie('from the fairway 150m with a bunker ahead'), 'fairway');
  assert.equal(inferShotLie('in the bunker 150m to the fairway'), 'bunker');
  assert.equal(inferShotLie('150m bunker ahead'), null);
  assert.equal(inferShotLie('fairway rough 150m'), null);
  assert.match(resolveShotConditions('rough 150m', { lie: 'fairway' }).error, /Conflicting lie/);
  assert.match(resolveShotConditions('into the wind 150m', { wind: 'tailwind' }).error, /Conflicting wind/);
  assert.match(buildCaddieReply('rough 150m', { clubs, unit: 'm', shotConditions: { lie: 'fairway' } }), /no club has been selected/);
});

test('putting and recovery plans do not use a GPS green reference or invent wind carry multipliers', () => {
  const putting = buildCaddieReply('on the green', { clubs, unit: 'm', liveDistanceMeters: 170, shotConditions: {} });
  assert.match(putting, /Putting plan|Putting Practice/);
  assert.doesNotMatch(putting, /170 m|Closest saved carry|Personal carry comparison/);
  for (const lie of ['rough', 'bunker', 'trees']) {
    const answer = buildCaddieReply(`${lie} 150m headwind`, { clubs, unit: 'm', shotConditions: {} });
    assert.match(answer, /Practice focus/);
    assert.match(answer, /No normal-carry/);
    assert.match(answer, /No fixed lie or wind carry multiplier/);
  }
});

test('rough, green-side position, distance and crosswind produce a recovery plan without treating bag carry as reliable', () => {
  const answer = buildCaddieReply('Ball in the rough right of the green, 156m out, wind is left to right', {
    clubs,
    unit: 'm',
    currentHole: 7,
    par: 4,
  });
  assert.match(answer, /rough, right of the green/i);
  assert.match(answer, /156 m/i);
  assert.match(answer, /No normal-carry club recommendation/i);
  assert.doesNotMatch(answer, /Closest saved carry/i);
  assert.match(answer, /left-to-right crosswind/i);
  assert.match(answer, /cannot assess exact lie/i);
});

test('yard questions match saved metric carries and speak in the selected app unit', () => {
  const answer = buildCaddieReply('Fairway, 170 yards to go', { clubs, unit: 'yd' });
  assert.match(answer, /170 yd/i);
  assert.match(answer, /6 Iron, 175 yd/i);
  assert.match(answer, /fairway/i);
});

test('nearest saved club advice includes the golfer’s make, model and loft when available', () => {
  const answer = buildCaddieReply('Fairway, 148 m to go', {
    clubs: [{ name: '7 Iron', make: 'PING', model: 'i230', loft: 32, carryMeters: 150 }],
    unit: 'm',
  });
  assert.match(answer, /7 Iron \(PING i230 · 32° loft\), 150 m/i);
});

test('live GPS distance and course-area forecast are used without inventing shotline wind', () => {
  const answer = buildCaddieReply('I am in the bunker, which club?', {
    clubs,
    unit: 'm',
    liveDistanceMeters: 82,
    wind: { windKph: 14, windDirection: 45 },
  });
  assert.match(answer, /live GPS distance: 82 m/i);
  assert.match(answer, /bunker/i);
  assert.match(answer, /14 km\/h from NE/i);
  assert.match(answer, /not the wind angle along your shot line/i);
});

test('without distance or saved carries, the answer asks for useful details instead of guessing a club', () => {
  const answer = buildCaddieReply('What should I do?', { clubs: [], unit: 'm' });
  assert.match(answer, /include your lie, distance and wind direction/i);
  assert.doesNotMatch(answer, /closest saved carry/i);
});

test('latest saved Flight and Impact readings are included for Caddie reference', () => {
  const answer = buildCaddieReply('What should I focus on?', {
    clubs,
    unit: 'm',
    recentFlight: {
      source: 'manual-launch-monitor-or-coach',
      distanceUnit: 'yd',
      ballSpeedMph: 142.5,
      clubSpeedMph: 96,
      apex: 31,
      carry: 238,
      createdAt: '2026-09-03T04:05:06.000Z',
    },
    recentImpact: {
      source: 'manual-launch-monitor-or-coach',
      clubPathDeg: -2.4,
      faceAngleDeg: 1.2,
      tempoRatio: 3.1,
      createdAt: '2026-09-04T04:05:06.000Z',
    },
  });
  assert.match(answer, /Latest saved Flight reference \(manual entry, 2026-09-03\): ball speed 142.5 mph, club speed 96 mph, apex 31 yd, carry 238 yd/i);
  assert.match(answer, /Latest saved Impact reference \(manual entry, 2026-09-04\): club path -2.4 °, face angle 1.2 °, tempo 3.1 :1/i);
});

test('phone-sensor motion is sent to Caddie as device motion, not golf measurement', () => {
  const answer = buildCaddieReply('What did the motion sensor capture?', {
    clubs,
    unit: 'm',
    recentPhoneMotion: {
      source: 'phone-motion-sensors',
      capturedAt: '2026-09-05T04:05:06.000Z',
      durationMs: 1800,
      accelerometerSampleCount: 88,
      gyroscopeSampleCount: 90,
      peakDynamicAccelerationG: 1.3,
      peakRotationDegPerSecond: 180.5,
    },
  });
  assert.match(answer, /peak phone rotation 180.5 °\/s/i);
  assert.match(answer, /peak dynamic acceleration 1.3 g over 1.8 s/i);
  assert.match(answer, /not club, impact or ball-flight measurements/i);
});

const personalBag = [
  { id: '7i', name: '7 Iron', carryMeters: 150, loft: 32, make: 'Test', model: 'A' },
  { id: '6i', name: '6 Iron', carryMeters: 160, loft: 28, make: 'Test', model: 'A' },
];
function shot(club, carry, lateral, index, extra = {}) {
  return {
    id: `shot-${club.id}-${index}`, tool: 'shot-pattern', title: club.name, note: 'Measured test fixture',
    value: carry, lateral, clubId: club.id, clubSetupKey: clubSetupKey(club),
    createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(), ...extra,
  };
}
const sampleShots = [
  ...[148, 149, 150, 151, 152].map((value, index) => shot(personalBag[0], value, 12 + index, index)),
  ...[156, 157, 158, 159, 160].map((value, index) => shot(personalBag[1], value, -2 + index, index)),
];
const personalContext = (extra = {}) => ({ clubs: personalBag, unit: 'm', shotProfiles: buildShotProfiles(personalBag, sampleShots), ...extra });

test('profiles calculate descriptive percentiles, lateral direction and sample size from recorded shots only', () => {
  const profiles = buildShotProfiles(personalBag, sampleShots);
  assert.equal(profiles[0].count, 5);
  assert.equal(profiles[0].medianCarry, 150);
  assert.equal(profiles[0].lowCarry, 148.4);
  assert.equal(profiles[0].highCarry, 151.6);
  assert.equal(profiles[0].medianSide, 14);
  assert.equal(profiles[1].medianSide, 0);
  assert.deepEqual(buildShotProfiles(personalBag, []), []);
});

test('stable club identity survives rename; changed equipment and similarly named replacements do not inherit linked shots', () => {
  const renamed = [{ ...personalBag[0], name: 'My favourite iron' }, personalBag[1]];
  assert.equal(buildShotProfiles(renamed, sampleShots)[0].count, 5);
  for (const patch of [{ model: 'B' }, { make: 'Other' }, { loft: 34 }]) {
    assert(!buildShotProfiles([{ ...personalBag[0], ...patch }], sampleShots).length);
  }
  assert.deepEqual(buildShotProfiles([{ ...personalBag[0], id: 'replacement' }], sampleShots), []);
  assert.equal(buildShotProfiles([{ ...personalBag[0], carryMeters: 147 }], sampleShots)[0].medianCarry, 150);
});

test('legacy name-only shots require a unique matching club', () => {
  const legacy = sampleShots.filter(entry => entry.clubId === '7i').map(({ clubId, clubSetupKey, ...entry }) => entry);
  assert.equal(buildShotProfiles(personalBag, legacy)[0].count, 5);
  assert.deepEqual(buildShotProfiles([...personalBag, { ...personalBag[0], id: 'duplicate' }], legacy), []);
  assert.deepEqual(buildShotProfiles([{ ...personalBag[0], name: 'Renamed' }], legacy), []);
});

test('profiles use the latest 40 complete finite entries, regardless of storage order, and do not invent zero lateral values', () => {
  const many = Array.from({ length: 45 }, (_, index) => shot(personalBag[0], 100 + index, 0, index));
  const invalid = [
    shot(personalBag[0], 999, undefined, 50), shot(personalBag[0], NaN, 0, 51),
    shot(personalBag[0], 0, 0, 52), shot(personalBag[0], 2000, 0, 53),
    shot(personalBag[0], 140, 0, 54, { tool: 'other' }),
  ];
  const profile = buildShotProfiles(personalBag, [...many.reverse(), ...invalid])[0];
  assert.equal(profile.count, 40);
  assert.equal(profile.minCarry, 105);
  assert.equal(profile.maxCarry, 144);
  assert.equal(profile.medianCarry, 124.5);
});

test('personal ranking prefers tighter recorded dispersion over the nearest bag number and explains why', () => {
  const answer = buildCaddieReply('Fairway, 150 m to the target', personalContext());
  assert.match(answer, /Personal carry comparison: 6 Iron Test A/);
  assert.match(answer, /Median 158 m/);
  assert.match(answer, /balances distance match, carry spread and lateral spread/);
  assert.match(answer, /Alternative recorded option: 7 Iron/);
  assert.match(answer, /developing/);
  assert.match(answer, /not a predicted success percentage/);
});

test('side trouble affects the ranking but never claims a hazard-safe aim offset', () => {
  const wideLeft = sampleShots.map(entry => entry.clubId === '6i' ? { ...entry, lateral: -12 } : entry);
  const base = personalContext({ shotProfiles: buildShotProfiles(personalBag, wideLeft) });
  const right = buildCaddieReply('Fairway, 150 m', { ...base, shotLimits: { troubleSide: 'right' } });
  const left = buildCaddieReply('Fairway, 150 m', { ...base, shotLimits: { troubleSide: 'left' } });
  assert.match(right, /Personal carry comparison: 6 Iron/);
  assert.match(left, /Personal carry comparison: 7 Iron/);
  assert.match(right, /cannot locate the hazard or calculate a safe aim offset/);
});

test('carry limits test every considered carry, not merely the central range, and never fall back to unmeasured hazard advice', () => {
  const answer = buildCaddieReply('Fairway, 158 m', personalContext({ shotLimits: { minimumCarryMeters: 155, maximumCarryMeters: 161 } }));
  assert.match(answer, /Personal carry comparison: 6 Iron/);
  assert.match(answer, /All 5 considered carries fit/);
  const none = buildCaddieReply('Fairway, 158 m', personalContext({ shotLimits: { minimumCarryMeters: 158, maximumCarryMeters: 161 } }));
  assert.match(none, /No club with at least 5 recorded shots fits/);
  assert.doesNotMatch(none, /Closest saved carry|Personal carry comparison/);
  const insufficient = buildCaddieReply('Fairway, 158 m', personalContext({ shotProfiles: [], shotLimits: { minimumCarryMeters: 155 } }));
  assert.match(insufficient, /will not guess a hazard-clearing club/);
});

test('small samples remain explicitly limited; larger samples are not guarantees; metres and yards stay consistent', () => {
  const small = buildCaddieReply('Fairway, 150 m', personalContext({ shotProfiles: buildShotProfiles(personalBag, sampleShots.slice(0, 4)) }));
  assert.match(small, /Limited personal data/);
  assert.doesNotMatch(small, /Personal carry comparison/);
  const yards = buildCaddieReply('Fairway, 173 yards', personalContext({ unit: 'yd' }));
  assert.match(yards, /Median 173 yd/);
  const large = Array.from({ length: 16 }, (_, index) => shot(personalBag[0], 149 + index % 3, 0, index));
  const answer = buildCaddieReply('Fairway, 150 m', personalContext({ shotProfiles: buildShotProfiles(personalBag, large) }));
  assert.match(answer, /larger recorded sample/);
  assert.match(answer, /not a predicted success percentage/);
});

test('bad carry limits and rough/sand/trees/green do not produce normal carry recommendations', () => {
  for (const limits of [{ minimumCarryMeters: NaN }, { maximumCarryMeters: 0 }, { minimumCarryMeters: 160, maximumCarryMeters: 150 }]) {
    const answer = buildCaddieReply('Fairway, 150 m', personalContext({ shotLimits: limits }));
    assert.match(answer, /Invalid carry limits/);
    assert.doesNotMatch(answer, /Personal carry comparison|Closest saved carry/);
  }
  const conflict = buildCaddieReply('Fairway, 150 m', personalContext({ shotLimits: { minimumCarryMeters: 155, maximumCarryMeters: 161 } }));
  assert.match(conflict, /target distance falls outside/);
  assert.doesNotMatch(conflict, /Personal carry comparison|Closest saved carry/);
  for (const lie of ['rough', 'bunker', 'trees', 'on the green']) {
    const answer = buildCaddieReply(`${lie}, 150 m`, personalContext());
    assert.match(answer, /No normal-carry club recommendation/);
    assert.doesNotMatch(answer, /Personal carry comparison|Closest saved carry/);
  }
});
