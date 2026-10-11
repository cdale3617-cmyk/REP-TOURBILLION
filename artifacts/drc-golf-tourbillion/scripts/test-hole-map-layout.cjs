const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../utils/holeMapLayout.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(compiled, filename);
const { getHoleMapLayout, getHoleFocusClip, createHoleProjection, bearingDegrees, screenAngle } = loaded.exports;
const windFilename = path.resolve(__dirname, '../utils/wind.ts');
const compiledWind = ts.transpileModule(fs.readFileSync(windFilename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const loadedWind = new Module(windFilename, module);
loadedWind.filename = windFilename;
loadedWind.paths = module.paths;
loadedWind._compile(compiledWind, windFilename);
const { compassDirectionLabel, windAnimationDuration, windFlowDirectionDegrees } = loadedWind.exports;

function assertMapCanvasMatchesPanel(layout) {
  assert.ok(layout.frameHeight > 0);
  assert.ok(layout.mapPanelWidth > 0);
  assert.ok(layout.plot.width > 0);
  assert.ok(layout.plot.height > 0);
  const canvasRatio = layout.viewWidth / layout.viewHeight;
  const panelRatio = layout.mapPanelWidth / layout.frameHeight;
  assert.ok(Math.abs(canvasRatio - panelRatio) < 0.01, `${canvasRatio} should match ${panelRatio}`);
}

test('selected-hole display crop follows its path rather than whole-course bounds', () => {
  const path = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }];
  const original = structuredClone(path);
  const crop = getHoleFocusClip(path, 1);
  assert.equal(crop.radius, 45);
  assert.deepEqual(crop.segments[0], [{ x: 0, y: 45 }, { x: 200, y: 45 }, { x: 200, y: -45 }, { x: 0, y: -45 }]);
  assert.deepEqual(crop.segments[1], [{ x: 155, y: 0 }, { x: 155, y: 100 }, { x: 245, y: 100 }, { x: 245, y: 0 }]);
  assert.deepEqual(path, original, 'display cropping must never change sourced coordinates');
  assert.equal(getHoleFocusClip(path, 2).radius, 90, 'real-world crop width must not depend on screen size');
  const next = getHoleFocusClip([{ x: 500, y: 500 }, { x: 500, y: 700 }], 1);
  assert.equal(next.segments[0][0].x, 455, 'a different hole produces a different crop');
  assert.ok(crop.segments.flat().every(p => p.x < 500 && p.y < 500), 'distant course outlines are outside this crop');
});

test('hole focus tolerates duplicate path vertices but rejects invalid projections', () => {
  assert.equal(getHoleFocusClip([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 10 }], 1).segments.length, 1);
  assert.throws(() => getHoleFocusClip([], 1), /valid projected/);
  assert.throws(() => getHoleFocusClip([{ x: 0, y: 0 }, { x: NaN, y: 1 }], 1), /valid projected/);
  assert.throws(() => getHoleFocusClip([{ x: 0, y: 0 }, { x: 1, y: 1 }], 0), /valid projected/);
});

test('phone maps leave room for hole controls and keep their canvas matched to the panel', () => {
  for (const [width, height] of [[200, 800], [360, 780], [392, 852], [440, 800]]) {
    const layout = getHoleMapLayout(width, height);
    assert.equal(layout.sideBySide, false);
    assert.ok(layout.frameHeight <= 620);
    assert.ok(layout.frameHeight >= Math.min(220, height * 0.9));
    assert.ok(layout.frameHeight <= height * 0.9);
    assertMapCanvasMatchesPanel(layout);
  }
});

test('tablet layouts use a tall map beside the controls and fit within viewport height', () => {
  const tablet = getHoleMapLayout(800, 1280);
  assert.equal(tablet.tall, true);
  assert.equal(tablet.sideBySide, true);
  assert.equal(tablet.frameHeight, 752);
  assertMapCanvasMatchesPanel(tablet);
});

test('short, wide split-screen panes put a tall half-width hole map beside its distance controls', () => {
  const split = getHoleMapLayout(800, 480);
  assert.equal(split.sideBySide, true);
  assert.equal(split.tall, true);
  assert.equal(split.frameHeight, 432);
  assertMapCanvasMatchesPanel(split);
});

test('short, wide panes stay responsive when reported in scaled display units', () => {
  const split = getHoleMapLayout(640, 488);
  const highDensitySplit = getHoleMapLayout(1280, 976);
  assert.equal(split.sideBySide, true);
  assert.equal(highDensitySplit.sideBySide, true);
  assertMapCanvasMatchesPanel(split);
  assertMapCanvasMatchesPanel(highDensitySplit);
});

test('tablet-width panes use the reference layout while narrow landscape phones remain stacked', () => {
  const tablet = getHoleMapLayout(640, 1000);
  const phone = getHoleMapLayout(430, 1000);
  const landscapePhone = getHoleMapLayout(430, 360);
  assert.equal(tablet.sideBySide, true);
  assert.equal(tablet.tall, true);
  assert.equal(phone.sideBySide, false);
  assert.equal(landscapePhone.sideBySide, false);
  assert.ok(landscapePhone.frameHeight <= 360 * 0.9);
  assertMapCanvasMatchesPanel(landscapePhone);
});

test('very short and very wide viewports keep the canvas positive and within available height', () => {
  const short = getHoleMapLayout(360, 200);
  const fractionalHeight = getHoleMapLayout(360, 201);
  const wide = getHoleMapLayout(2400, 900);
  assert.equal(short.frameHeight, 180);
  assert.ok(fractionalHeight.frameHeight <= 201 * 0.9);
  assert.ok(short.plot.height > 0);
  assert.ok(wide.frameHeight <= 900 * 0.9);
  assert.equal(wide.tall, false);
  assertMapCanvasMatchesPanel(short);
  assertMapCanvasMatchesPanel(fractionalHeight);
  assertMapCanvasMatchesPanel(wide);
});

test('invalid window measurements fall back to a usable phone layout', () => {
  const layout = getHoleMapLayout(Number.NaN, 0);
  assert.equal(layout.sideBySide, false);
  assert.equal(layout.frameHeight, 496);
  assertMapCanvasMatchesPanel(layout);
});

test('animated arrows point downwind from the real wind bearing', () => {
  assert.equal(compassDirectionLabel(0), 'N');
  assert.equal(compassDirectionLabel(90), 'E');
  assert.equal(compassDirectionLabel(360), 'N');
  assert.equal(windFlowDirectionDegrees(0), 180);
  assert.equal(windFlowDirectionDegrees(90), 270);
  assert.equal(windFlowDirectionDegrees(180), 0);
  assert.equal(windFlowDirectionDegrees(270), 90);
  assert.equal(windFlowDirectionDegrees(Number.NaN), null);
});

test('wind animation cadence follows speed without becoming too fast or stopping', () => {
  assert.equal(windAnimationDuration(0), 5000);
  assert.equal(windAnimationDuration(8), 3960);
  assert.equal(windAnimationDuration(100), 1100);
  assert.equal(windAnimationDuration(Number.NaN), 5000);
});
test('single-hole projection puts the target up with equal scales', () => {
  const tee = { latitude: -23, longitude: 150 };
  const plot = { left: 0, top: 0, width: 200, height: 400 };
  for (const [dn, de] of [[0.002, 0], [0, 0.002], [-0.002, 0], [0.001, -0.001]]) {
    const target = { latitude: tee.latitude + dn, longitude: tee.longitude + de };
    const pr = createHoleProjection([tee, target], target, [], plot);
    const a = pr.project(tee), b = pr.project(target);
    assert.ok(Math.abs(a.x - b.x) < 1e-6, 'target directly above tee');
    assert.ok(b.y < a.y);
    const east = pr.project({ latitude: tee.latitude, longitude: tee.longitude + 0.001 });
    const north = pr.project({ latitude: tee.latitude + 0.001, longitude: tee.longitude });
    const mE = Math.hypot(east.x - a.x, east.y - a.y) / 0.001 / Math.cos(tee.latitude * Math.PI / 180);
    assert.ok(Math.abs(mE - Math.hypot(north.x - a.x, north.y - a.y) / 0.001) < 1e-6, 'equal geographic scales');
  }
});

test('wind and north use the actual map heading', () => {
  assert.equal(bearingDegrees({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }), 90);
  assert.equal(screenAngle(0, 90), 270, 'north points left when the hole plays east');
  // wind from the south (flow 0) on a hole playing north blows with the golfer: arrow up.
  assert.equal(screenAngle(windFlowDirectionDegrees(180), 0), 0);
  // same wind on a hole playing south blows toward the tee: arrow points down on screen.
  assert.equal(screenAngle(windFlowDirectionDegrees(180), 180), 180);
});
