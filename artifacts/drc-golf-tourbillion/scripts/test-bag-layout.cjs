const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function harness(initialBag, initialUnit = 'm') {
  let bag = initialBag.map(c => ({ ...c })), unit = initialUnit, cursor = 0;
  const slots = [], effects = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useEffect: (fn, deps) => {
      const i = cursor++, old = slots[i];
      if (!old || deps.some((d, n) => d !== old[n])) { slots[i] = deps; effects.push(fn); }
    },
  };
  const state = () => ({
    bag, unit, setUnit: value => { unit = value; },
    updateClub: (id, patch) => { bag = bag.map(c => c.id === id ? { ...c, ...patch } : c); },
    removeClub: id => { bag = bag.filter(c => c.id !== id); },
    addClub: () => { bag = [...bag, { id: 'new', name: 'New club', loft: 30, carryMeters: 100 }]; },
  });
  const filename = path.resolve(__dirname, '../app/(tabs)/bag.tsx');
  const loaded = new Module(filename, module);
  const primitives = Object.fromEntries(['ActionButton', 'Card', 'Page', 'PageHeading'].map(n => [n, n]));
  const deps = {
    react: React,
    'react-native': { Keyboard: { dismiss() {} }, StyleSheet: { create: s => s }, ...Object.fromEntries(['Pressable', 'Text', 'TextInput', 'View'].map(n => [n, n])) },
    '@/components/AppText': { AppText: 'Text', AppTextInput: 'TextInput' },
    '@expo/vector-icons': { Feather: 'Feather' },
    '@/components/Primitives': primitives,
    '@/components/ClubIllustration': { ClubIllustration: 'ClubIllustration' },
    '@/context/GolfContext': { useGolf: state },
    '@/hooks/useColors': { useColors: () => ({}) },
  };
  loaded.require = name => { if (!(name in deps)) throw new Error(`Unexpected dependency ${name}`); return deps[name]; };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8') + '\nexport { NumberField };', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.React },
  }).outputText, filename);
  const render = (component = loaded.exports.default, props) => {
    cursor = 0;
    let tree = component(props);
    if (effects.length) { effects.splice(0).forEach(fn => fn()); cursor = 0; tree = component(props); }
    return tree;
  };
  return { render, state, NumberField: loaded.exports.NumberField };
}
function all(tree, match) {
  if (Array.isArray(tree)) return tree.flatMap(t => all(t, match));
  if (!tree || typeof tree !== 'object') return [];
  return [...(match(tree) ? [tree] : []), ...all(tree.props?.children, match)];
}
const byId = (tree, id) => all(tree, t => t.props?.testID === id)[0];
const tiles = tree => all(tree, t => t.type?.name === 'Tile');
const bag = Array.from({ length: 14 }, (_, i) => ({ id: `c${i}`, name: `Club ${i}`, carryMeters: 230 - i * 10, loft: 10 + i }));

test('two columns retain all clubs in original order; stepping selects and edits only its club', () => {
  const h = harness(bag);
  let tree = h.render();
  const columns = all(tree, t => t.type === 'View' && Array.isArray(t.props.children[0]) && t.props.children[0][0]?.type?.name === 'Tile');
  assert.deepEqual(columns.map(c => c.props.children[0].map(t => t.props.club.id)), [bag.slice(0, 7).map(c => c.id), bag.slice(7).map(c => c.id)]);
  const tile = tiles(tree)[9];
  const renderedTile = tile.type(tile.props);
  let stopped = false;
  byId(renderedTile, 'bag-plus-c9').props.onPress({ stopPropagation() { stopped = true; } });
  assert.ok(stopped);
  assert.equal(h.state().bag[9].carryMeters, 141);
  assert.equal(h.state().bag[0].carryMeters, 230);
  tree = h.render();
  assert.ok(byId(tree, 'club-name-c9'));
});

test('yards change by one displayed yard, metres stay stored, and minus clamps without deleting', () => {
  const h = harness([{ id: 'd', name: 'Driver', carryMeters: 230, loft: 10.5 }]);
  byId(h.render(), 'unit-yd').props.onPress();
  let tile = tiles(h.render())[0];
  tile.props.onStep(1);
  assert.ok(Math.abs(h.state().bag[0].carryMeters * 1.09361 - 253) < 1e-9);
  h.state().updateClub('d', { carryMeters: 0 });
  tile = tiles(h.render())[0];
  tile.props.onStep(-1);
  assert.equal(h.state().bag.length, 1);
  assert.equal(h.state().bag[0].carryMeters, 0);
});

test('name, make and model changes survive selection; add, removal and empty bag remain usable', () => {
  const h = harness(bag.slice(0, 2));
  let tree = h.render();
  byId(tree, 'club-name-c0').props.onChangeText('Custom driver');
  byId(tree, 'club-make-c0').props.onChangeText('PING');
  byId(tree, 'club-model-c0').props.onChangeText('G430');
  tiles(h.render())[1].props.onSelect();
  tree = h.render();
  assert.ok(byId(tree, 'club-name-c1'));
  assert.equal(h.state().bag[0].model, 'G430');
  byId(tree, 'remove-club-c1').props.onPress();
  byId(h.render(), 'remove-club-c0').props.onPress();
  assert.equal(tiles(h.render()).length, 0);
  byId(h.render(), 'add-club').props.onPress();
  assert.ok(byId(h.render(), 'club-name-new'));
});

test('numeric editing preserves decimals, rejects invalid input, and follows external changes', () => {
  const h = harness([]);
  const writes = [];
  let shown = '10.5';
  const props = () => ({ testID: 'number', label: 'LOFT', shown, validate: n => n >= 0 && n <= 90, error: '0 to 90', onValid: n => { writes.push(n); shown = String(n); } });
  const render = () => h.render(h.NumberField, props());
  byId(render(), 'number').props.onChangeText('12,5');
  assert.deepEqual(writes, [12.5]);
  assert.equal(byId(render(), 'number').props.value, '12,5');
  byId(render(), 'number').props.onChangeText('invalid');
  assert.deepEqual(writes, [12.5]);
  byId(render(), 'number').props.onBlur();
  assert.equal(byId(render(), 'number').props.value, '12.5');
  shown = '20';
  assert.equal(byId(render(), 'number').props.value, '20');
});
