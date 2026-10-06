const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function compile(relative, mocks) {
  const file = path.resolve(__dirname, '..', relative);
  const loaded = new Module(file, module);
  loaded.require = name => {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`);
    return mocks[name];
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, file);
  return loaded.exports;
}

function harness({ permission = true, services = true } = {}) {
  const slots = [], effects = [], cleanups = [];
  let cursor = 0, appChange, receive, removed = 0, requested = 0, initial;
  const react = {
    useState(value) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = value;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }];
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((value, n) => value !== slots[i][n])) {
        slots[i] = deps;
        effects.push(() => { cleanups[i]?.(); cleanups[i] = fn(); });
      }
    },
  };
  const Location = {
    Accuracy: { Highest: 6 },
    requestForegroundPermissionsAsync: async () => {
      requested++;
      return { granted: permission, canAskAgain: false };
    },
    hasServicesEnabledAsync: async () => services,
    watchPositionAsync: async (options, callback) => {
      assert.equal(options.timeInterval, 1000);
      receive = callback;
      return { remove: () => { removed++; } };
    },
    getCurrentPositionAsync: () => new Promise(resolve => { initial = resolve; }),
  };
  const { useDevicePosition } = compile('hooks/useDevicePosition.ts', {
    react, 'react-native': {
      Platform: { OS: 'android' },
      AppState: { currentState: 'active', addEventListener: (name, fn) => {
        appChange = fn; return { remove() {} };
      } },
    }, 'expo-location': Location,
  });
  return {
    render(active) { cursor = 0; const state = useDevicePosition(active); effects.splice(0).forEach(fn => fn()); return state; },
    fix: (latitude, timestamp) => receive({ coords: { latitude, longitude: 153, accuracy: 5 }, timestamp }),
    initial: (...args) => initial(...args),
    background: () => appChange('background'),
    stop: () => cleanups.forEach(fn => fn?.()),
    get requested() { return requested; },
    get removed() { return removed; },
  };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('native GPS streams fixes without course data; late initial fix cannot replace a newer live fix', async () => {
  const h = harness();
  try {
    h.render(true); await flush();
    assert.equal(h.requested, 1);
    h.fix(-27.5, 2000);
    h.initial({ coords: { latitude: -28, longitude: 153, accuracy: 5 }, timestamp: 1000 });
    await flush();
    assert.equal(h.render(true).gps.latitude, -27.5);
    h.fix(-27.6, 3000);
    assert.equal(h.render(true).gps.latitude, -27.6);
    h.render(false);
    assert.equal(h.removed, 1);
    assert.equal(h.render(false).gps, null);
  } finally { h.stop(); }
});

test('denied permission and disabled device location expose actionable errors, not a made-up position', async () => {
  for (const options of [{ permission: false }, { services: false }]) {
    const h = harness(options);
    try {
      h.render(true); await flush();
      const state = h.render(true);
      assert.equal(state.gps, null);
      assert.match(state.error, /settings/i);
    } finally { h.stop(); }
  }
});

test('backgrounding stops the foreground GPS subscription and clears its fix', async () => {
  const h = harness();
  try {
    h.render(true); await flush(); h.fix(-27.5, 2000);
    h.background(); h.render(true);
    assert.equal(h.removed, 1);
    assert.equal(h.render(true).gps, null);
  } finally { h.stop(); }
});

test('map budget adapts to short phones, safe areas and text scale without overflowing its allocated space', () => {
  const { getRoundMapHeight } = compile('utils/roundViewport.ts', {});
  const { getHoleMapLayout } = compile('utils/holeMapLayout.ts', {});
  for (const [width, height] of [[320, 568], [360, 780], [412, 915], [780, 360], [800, 1280]]) {
    for (const scale of [1, 1.3, 2]) {
      const budget = getRoundMapHeight(height, scale, 24, 24, false, width >= 520 && height < 600);
      const map = getHoleMapLayout(width, height, budget);
      assert.ok(map.frameHeight <= budget);
      assert.ok(map.frameHeight > 0);
    }
  }
  assert.ok(getRoundMapHeight(640) < getRoundMapHeight(915));
  assert.ok(getRoundMapHeight(780, 1.3) < getRoundMapHeight(780, 1));
  assert.ok(getRoundMapHeight(1280) <= 360, 'Tablet map must not become an excessively tall panel');
});
