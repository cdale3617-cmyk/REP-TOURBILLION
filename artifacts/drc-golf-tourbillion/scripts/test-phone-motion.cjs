const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../utils/phoneMotion.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(compiled, filename);
const { summarizePhoneMotion } = loaded.exports;

test('summarizes real accelerometer and gyroscope vectors without labeling them as golf metrics', () => {
  const acceleration = [
    ...Array.from({ length: 8 }, () => ({ x: 0, y: 0, z: 1 })),
    { x: 0, y: 0, z: 2 },
  ];
  const rotation = [
    ...Array.from({ length: 8 }, () => ({ x: 0, y: 0, z: 0 })),
    { x: 0, y: 0, z: Math.PI },
  ];
  const summary = summarizePhoneMotion(acceleration, rotation, 1000, 2800);
  assert.equal(summary.source, 'phone-motion-sensors');
  assert.equal(summary.capturedAt, '1970-01-01T00:00:01.000Z');
  assert.equal(summary.durationMs, 1800);
  assert.equal(summary.accelerometerSampleCount, 9);
  assert.equal(summary.gyroscopeSampleCount, 9);
  assert.equal(summary.peakDynamicAccelerationG, 1);
  assert.equal(summary.peakRotationDegPerSecond, 180);
});

test('rejects short captures and insufficient sensor samples instead of producing a blank reading', () => {
  const still = Array.from({ length: 5 }, () => ({ x: 0, y: 0, z: 1 }));
  assert.throws(() => summarizePhoneMotion(still, still, 1000, 1200), /0.5 to 30 seconds/);
  assert.throws(() => summarizePhoneMotion(still.slice(0, 4), still, 1000, 1800), /Not enough/);
});

test('ignores malformed samples but rejects captures without enough valid data', () => {
  const mixed = [
    ...Array.from({ length: 5 }, () => ({ x: 0, y: 0, z: 1 })),
    { x: Number.NaN, y: 0, z: 1 },
  ];
  const summary = summarizePhoneMotion(mixed, mixed, 1000, 1800);
  assert.equal(summary.accelerometerSampleCount, 5);
  assert.equal(summary.gyroscopeSampleCount, 5);
  assert.throws(() => summarizePhoneMotion([{ x: Number.NaN, y: 0, z: 1 }], mixed, 1000, 1800), /Not enough/);
});
