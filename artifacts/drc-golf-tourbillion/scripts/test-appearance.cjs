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
const { resolveColors, default: colors } = load('constants/colors.ts');

function luminance(hex) {
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}
async function harness(saved, writeFails = false) {
  const slots = [], effects = [], writes = [];
  let cursor = 0;
  const React = {
    createContext: () => ({ Provider: 'provider' }), createElement: (_type, props) => props,
    useState: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect: fn => {
      const index = cursor++;
      if (!(index in slots)) { slots[index] = true; effects.push(fn); }
    },
  };
  const { AppearanceProvider, APPEARANCE_STORAGE_KEY } = load('context/AppearanceContext.tsx', {
    react: React,
    '@react-native-async-storage/async-storage': {
      getItem: async key => { assert.equal(key, APPEARANCE_STORAGE_KEY); return saved; },
      setItem: async (key, value) => { writes.push([key, value]); if (writeFails) throw new Error('Storage unavailable'); },
    },
  });
  const render = () => { cursor = 0; return AppearanceProvider({ children: null }).value; };
  const initial = render();
  await initial.toggleAntiGlare();
  assert.equal(writes.length, 0, 'no early write before reading preferences');
  effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  return { render, writes, key: APPEARANCE_STORAGE_KEY };
}

test('anti-glare gives white text on dark surfaces and readable dark buttons; off preserves the approved theme', () => {
  for (const scheme of ['light', 'dark', null]) {
    const on = resolveColors(scheme, true);
    for (const name of ['foreground', 'mutedForeground', 'primary', 'primaryForeground', 'secondaryForeground', 'cardForeground']) assert.equal(on[name], '#FFFFFF');
    for (const name of ['background', 'card', 'muted', 'secondary', 'primaryFill']) assert.ok((1.05 / (luminance(on[name]) + 0.05)) >= 12, `${name} contrast`);
    const off = resolveColors(scheme, false);
    const original = scheme === 'dark' ? colors.dark : colors.light;
    for (const key of Object.keys(original)) assert.equal(off[key], original[key]);
    assert.equal(off.primaryFill, original.primary);
  }
});

test('stored display choice loads and toggles both directions without writing golf records', async () => {
  const session = await harness('true');
  assert.equal(session.render().antiGlare, true);
  assert.equal(session.render().ready, true);
  await session.render().toggleAntiGlare();
  assert.equal(session.render().antiGlare, false);
  await session.render().toggleAntiGlare();
  assert.equal(session.render().antiGlare, true);
  assert.deepEqual(session.writes, [[session.key, 'false'], [session.key, 'true']]);
  const reopened = await harness(session.writes.at(-1)[1]);
  assert.equal(reopened.render().antiGlare, true);
});

test('failed persistence changes the current display but warns that it was not saved', async () => {
  const session = await harness(null, true);
  await session.render().toggleAntiGlare();
  assert.equal(session.render().antiGlare, true);
  assert.match(session.render().error, /could not be saved/);
  assert.equal(session.render().saving, false);
});

test('invalid stored appearance is not silently overwritten and can be explicitly selected again', async () => {
  const session = await harness('invalid');
  assert.equal(session.writes.length, 0);
  assert.match(session.render().error, /could not be read/);
  await session.render().toggleAntiGlare();
  assert.equal(session.render().antiGlare, true);
  assert.equal(session.render().error, '');
});
