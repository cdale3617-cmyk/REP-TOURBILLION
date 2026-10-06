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
const reference = load('utils/greenPhotoReference.ts');
const backup = load('utils/backup.ts', { './greenPhotoReference': reference });
const timestamp = '2026-01-02T03:04:05.000Z';
const state = {
  playerName: 'Test golfer', unit: 'm', lastCourseId: 'course',
  courses: [{ id: 'course', name: 'Test course', area: 'Local', par: 72, latitude: -27, longitude: 153 }],
  bag: [], activeRound: null, rounds: [], checklist: [], wedgeMatrix: {},
  biometrics: [{ id: 'manual-a', heartRate: 72, spo2: 98, createdAt: timestamp }],
  activities: [{ id: 'green-a', tool: 'green-reading', title: 'Green read', note: 'Left to right', greenPhotoFile: 'green-test.png', createdAt: timestamp }],
};

test('green-photo references and notes survive a JSON round trip without embedding image bytes', () => {
  const contents = backup.createBackup(state);
  assert.deepEqual(backup.parseBackup(contents).activities, state.activities);
  assert(!contents.includes('data:image'));
});

test('legacy green notes without photos still load', () => {
  const legacy = structuredClone(state);
  delete legacy.activities[0].greenPhotoFile;
  assert.equal(backup.parseBackup(backup.createBackup(legacy)).activities[0].greenPhotoFile, undefined);
});

test('invalid file references are rejected before restoring local state', () => {
  for (const name of ['../photo.png', 'file:///private/photo.jpg', 'https://host/photo.png', 'green-a.mp4', 'green-a.png/../other']) {
    assert.throws(() => reference.checkGreenPhotoName(name));
    const invalid = structuredClone(state);
    invalid.activities[0].greenPhotoFile = name;
    assert.throws(() => backup.validateGolfState(invalid));
  }
});

test('photo names retain known image formats and never expose the picker URI', () => {
  assert.match(reference.createGreenPhotoName('file:///cache/capture?private=value', 'image/png'), /^green-[a-z0-9-]+\.png$/);
  assert.match(reference.createGreenPhotoName('file:///cache/image.webp'), /\.webp$/);
});

test('native photo copying survives loss of the picker file and fails clearly for missing archives', async () => {
  const files = new Map([['file:///temporary.png', { size: 80 }]]);
  class Directory {
    constructor(base, name) { this.uri = `${base}/${name}`; }
    create() {}
  }
  class File {
    constructor(base, name) { this.uri = name ? `${base.uri}/${name}` : base; }
    get exists() { return files.has(this.uri); }
    get size() { return files.get(this.uri)?.size ?? 0; }
    copy(target) { files.set(target.uri, { ...files.get(this.uri) }); }
    delete() { files.delete(this.uri); }
  }
  const photos = load('utils/greenPhotoFiles.ts', {
    'expo-file-system': { Directory, File, Paths: { document: 'file:///documents' } },
    'expo-sharing': { isAvailableAsync: async () => false },
    './greenPhotoReference': reference,
  });
  await photos.storeGreenPhoto('file:///temporary.png', 'green-test.png');
  files.delete('file:///temporary.png');
  assert.equal(await photos.getGreenPhotoUri('green-test.png'), 'file:///documents/drc-golf-green-photos/green-test.png');
  await assert.rejects(photos.shareGreenPhoto('green-test.png'), /unavailable/);
  await photos.deleteGreenPhoto('green-test.png');
  await assert.rejects(photos.getGreenPhotoUri('green-test.png'), /not on this device/);
  await assert.rejects(photos.storeGreenPhoto('file:///missing.png', 'green-missing.png'), /no longer available/);
});

test('manual health deletion targets one entry and preserves all other golf and device data', () => {
  let slots = [];
  let cursor = 0;
  const React = {
    createContext: () => ({ Provider: 'provider' }),
    createElement: (_type, props) => props,
    useState: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], update => { slots[index] = typeof update === 'function' ? update(slots[index]) : update; }];
    },
    useRef: value => ({ current: value }),
    useMemo: fn => fn(),
    useEffect: () => {},
  };
  const deviceReadings = { health: { status: 'ready' }, ble: { status: 'ready' } };
  const context = load('context/GolfContext.tsx', {
    react: React,
    '@react-native-async-storage/async-storage': {},
    '@/utils/courseGeometry': {},
    '@/utils/backup': backup,
    './useDeviceReadings': { useDeviceReadings: () => deviceReadings },
  });
  slots = [{ ...structuredClone(state), biometrics: [...state.biometrics, { id: 'manual-b', heartRate: 85, spo2: 97, createdAt: timestamp }] }, true, '', true];
  cursor = 0;
  const rendered = context.GolfProvider({ children: null });
  rendered.value.removeBiometric('manual-a');
  assert.deepEqual(slots[0].biometrics.map(entry => entry.id), ['manual-b']);
  assert.deepEqual(slots[0].activities, state.activities);
  assert.equal(rendered.value.deviceReadings, deviceReadings);
  assert.deepEqual(backup.parseBackup(backup.createBackup(slots[0])).biometrics.map(entry => entry.id), ['manual-b']);
  slots[3] = false; cursor = 0;
  assert.throws(() => context.GolfProvider({ children: null }).value.removeBiometric('manual-b'), /unavailable/);
  assert.equal(slots[0].biometrics.length, 1);
});
