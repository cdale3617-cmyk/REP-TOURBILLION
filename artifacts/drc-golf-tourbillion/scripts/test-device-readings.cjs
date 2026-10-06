// Contract tests use test-only packets and native mocks; they do not verify physical hardware.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => {
    if (!(name in dependencies)) throw new Error(`Unexpected test dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
const { decodeHeartRate } = load('utils/heartRate.ts');
const packet = bytes => Buffer.from(bytes).toString('base64');

test('SIG packet decoding: 8-bit, 16-bit, contact failure, malformed and zero', () => {
  assert.equal(decodeHeartRate(packet([0, 72])), 72);
  assert.equal(decodeHeartRate(packet([1, 44, 1])), 300);
  assert.equal(decodeHeartRate(packet([6, 80])), 80);
  assert.throws(() => decodeHeartRate(packet([4, 80])), /skin contact/);
  assert.throws(() => decodeHeartRate(packet([1, 44])), /Incomplete/);
  assert.throws(() => decodeHeartRate('?!'), /Invalid/);
  assert.throws(() => decodeHeartRate(packet([0, 0])), /not measured/);
});

function harness({ platform = 'android', allowed = true, grants, adapter = 'PoweredOn', pages, permissionWait, adapterWait, onAdapterCheck, stopWait } = {}) {
  const states = [], cleanups = [];
  let scanCallback, notifyCallback, disconnectedCallback, appCallback;
  let cancelCount = 0, permissionRequests = 0, readCount = 0, initialized = false;
  const health = {
    SdkAvailabilityStatus: { SDK_AVAILABLE: 3, SDK_UNAVAILABLE: 1, SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2 },
    getSdkStatus: async () => 3,
    initialize: async () => { initialized = true; return true; },
    requestPermission: async () => grants ?? [{ accessType: 'read', recordType: 'HeartRate' }, { accessType: 'read', recordType: 'OxygenSaturation' }],
    readRecords: async (type, options) => {
      assert.equal(initialized, true);
      readCount++;
      return pages?.(type, options) ?? { records: [] };
    },
    openHealthConnectSettings: () => {},
  };
  const subscription = () => ({ remove() {} });
  const device = {
    discoverAllServicesAndCharacteristics: async () => device,
    characteristicsForService: async () => [{ uuid: '00002a37-0000-1000-8000-00805f9b34fb', isNotifiable: true }],
    monitorCharacteristicForService: (service, characteristic, callback) => { notifyCallback = callback; return subscription(); },
  };
  class Manager {
    state = async () => { onAdapterCheck?.(); if (adapterWait) await adapterWait; return adapter; };
    startDeviceScan = async (services, options, callback) => { scanCallback = callback; };
    stopDeviceScan = async () => { if (stopWait) await stopWait(); };
    connectToDevice = async () => device;
    cancelDeviceConnection = async () => { cancelCount++; };
    onDeviceDisconnected = (id, callback) => { disconnectedCallback = callback; return subscription(); };
    destroy = async () => {};
  }
  const hook = load('context/useDeviceReadings.ts', {
    react: {
      useState: initial => { const index = states.length; states.push(initial); return [initial, update => { states[index] = typeof update === 'function' ? update(states[index]) : update; }]; },
      useRef: initial => ({ current: initial }),
      useEffect: callback => cleanups.push(callback()),
    },
    'react-native': {
      Platform: { OS: platform, Version: 34 },
      AppState: { addEventListener: (event, callback) => { appCallback = callback; return subscription(); } },
      PermissionsAndroid: {
        PERMISSIONS: { BLUETOOTH_SCAN: 'scan', BLUETOOTH_CONNECT: 'connect', ACCESS_FINE_LOCATION: 'location' },
        RESULTS: { GRANTED: 'granted' },
        requestMultiple: async permissions => { permissionRequests++; if (permissionWait) await permissionWait; return Object.fromEntries(permissions.map(p => [p, allowed ? 'granted' : 'denied'])); },
      },
    },
    'expo-constants': { executionEnvironment: 'standalone' },
    '@/utils/heartRate': { decodeHeartRate },
    'react-native-health-connect': health,
    'react-native-ble-plx': { BleManager: Manager, State: { PoweredOn: 'PoweredOn' } },
  }).useDeviceReadings();
  return {
    hook, states, health, cleanup: () => cleanups.forEach(fn => fn?.()),
    scan: (...args) => scanCallback(...args),
    notify: (...args) => notifyCallback(...args),
    lost: () => disconnectedCallback(),
    background: () => appCallback('background'),
    scanStarted: () => Boolean(scanCallback),
    counters: () => ({ cancelCount, permissionRequests, readCount }),
  };
}

test('web explicitly unavailable without asking for native permissions or reading data', async () => {
  const h = harness({ platform: 'web' });
  await h.hook.readHealth();
  await h.hook.scanSensors();
  assert.equal(h.states[0].status, 'unavailable');
  assert.equal(h.states[1].status, 'unavailable');
  assert.deepEqual(h.counters(), { cancelCount: 0, permissionRequests: 0, readCount: 0 });
  h.cleanup();
});

test('health denial and empty data never invent readings', async () => {
  for (const grants of [[], undefined]) {
    const h = harness({ grants });
    await h.hook.readHealth();
    assert.equal(h.states[0].status, grants ? 'denied' : 'ready');
    assert.equal(h.states[0].heartRate, undefined);
    assert.equal(h.states[0].oxygen, undefined);
    h.cleanup();
  }
});

test('partial health permission reads only approved type and newest sample across pages', async () => {
  const h = harness({
    grants: [{ accessType: 'read', recordType: 'HeartRate' }],
    pages: (type, options) => {
      assert.equal(type, 'HeartRate');
      return options.pageToken
        ? { records: [{ metadata: { dataOrigin: 'test.source' }, samples: [{ time: '2026-10-05T02:00:00Z', beatsPerMinute: 75 }] }] }
        : { pageToken: 'second', records: [{ samples: [{ time: '2026-10-05T01:00:00Z', beatsPerMinute: 70 }] }] };
    },
  });
  await h.hook.readHealth();
  assert.equal(h.states[0].heartRate.value, 75);
  assert.equal(h.states[0].heartRate.source, 'test.source');
  assert.equal(h.states[0].oxygen, undefined);
  assert.match(h.states[0].message, /Partial/);
  assert.equal(h.counters().readCount, 2);
  h.cleanup();
});

test('Bluetooth denial and powered-off failures leave no connection', async () => {
  for (const options of [{ allowed: false }, { adapter: 'PoweredOff' }]) {
    const h = harness(options);
    await h.hook.scanSensors();
    assert.equal(h.states[1].status, options.allowed === false ? 'denied' : 'error');
    assert.equal(h.states[1].connected, undefined);
    assert.equal(h.states[1].scanning, false);
    h.cleanup();
  }
});

test('BLE discovers, deduplicates, connects, receives a packet and clears on disconnect', async () => {
  const h = harness();
  await h.hook.scanSensors();
  h.scan(null, { id: 'test-sensor', name: 'Test monitor' });
  h.scan(null, { id: 'test-sensor', name: 'Test monitor' });
  assert.equal(h.states[1].devices.length, 1);
  await h.hook.connectSensor(h.states[1].devices[0]);
  assert.equal(h.states[1].status, 'ready');
  assert.equal(h.states[1].heartRate, undefined);
  h.notify(null, { value: packet([0, 82]) });
  assert.equal(h.states[1].heartRate.value, 82);
  await h.hook.disconnect();
  assert.equal(h.states[1].connected, undefined);
  assert.equal(h.states[1].heartRate, undefined);
  assert.equal(h.counters().cancelCount, 1);
  // Late notifications from the old connection must not repopulate state.
  h.notify(null, { value: packet([0, 84]) });
  assert.equal(h.states[1].heartRate, undefined);
  h.cleanup();
});

test('unexpected sensor loss and backgrounding remove last live reading', async () => {
  for (const action of ['lost', 'background']) {
    const h = harness();
    await h.hook.scanSensors();
    await h.hook.connectSensor({ id: 'test-sensor', name: 'Test monitor' });
    h.notify(null, { value: packet([0, 82]) });
    h[action]();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.states[1].heartRate, undefined);
    assert.equal(h.states[1].connected, undefined);
    h.cleanup();
  }
});

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('backgrounding during a Bluetooth permission request prevents a later scan', async () => {
  const permission = deferred();
  const h = harness({ permissionWait: permission.promise });
  const scanning = h.hook.scanSensors();
  h.background();
  permission.resolve();
  await scanning;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.scanStarted(), false);
  assert.equal(h.states[1].status, 'idle');
  assert.equal(h.states[1].scanning, false);
  h.cleanup();
});

test('backgrounding while checking the adapter prevents a later scan', async () => {
  const adapter = deferred(), entered = deferred();
  const h = harness({ adapterWait: adapter.promise, onAdapterCheck: entered.resolve });
  const scanning = h.hook.scanSensors();
  await entered.promise;
  h.background();
  adapter.resolve();
  await scanning;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.scanStarted(), false);
  assert.equal(h.states[1].status, 'idle');
  assert.equal(h.states[1].scanning, false);
  h.cleanup();
});

test('backgrounding during connection preparation prevents a new connection', async () => {
  const stopping = deferred(), entered = deferred();
  let stops = 0;
  const h = harness({ stopWait: () => {
    if (++stops === 2) { entered.resolve(); return stopping.promise; }
  } });
  await h.hook.scanSensors();
  const connecting = h.hook.connectSensor({ id: 'test-sensor', name: 'Test monitor' });
  await entered.promise;
  h.background();
  stopping.resolve();
  await connecting;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.states[1].status, 'idle');
  assert.equal(h.states[1].connected, undefined);
  assert.equal(h.states[1].heartRate, undefined);
  assert.equal(h.counters().cancelCount, 0);
  h.cleanup();
});