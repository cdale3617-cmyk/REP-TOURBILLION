const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const project = path.resolve(__dirname, '..');
// Execute the JS CLI directly so Windows builders do not need a pnpm.cmd shell.
const expoCli = require.resolve('expo/bin/cli');
const options = { cwd: project, env: { ...process.env, CI: '1' } };
const args = process.argv.slice(2);
assert(args.every((arg) => arg === '--bundle'), 'Supported option: --bundle');

const config = JSON.parse(execFileSync(process.execPath, [
  expoCli, 'config', '--type', 'introspect', '--json',
], { ...options, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }));
assert.match(config.android.package, /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
assert(Number.isInteger(config.android.versionCode) && config.android.versionCode > 0);
assert.match(config.version, /^\d+\.\d+\.\d+$/);

const manifest = config._internal?.modResults?.android?.manifest?.manifest;
assert(manifest, 'Expo did not produce an Android manifest');
assert.equal(String(manifest.application[0].$['android:allowBackup']), 'false',
  'Automatic backup must stay disabled for device-only data');
const permissions = new Map((manifest['uses-permission'] ?? []).map((row) => [
  row.$['android:name'], row.$['tools:node'] ?? 'grant',
]));
for (const name of ['INTERNET', 'CAMERA', 'ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION']) {
  assert.equal(permissions.get(`android.permission.${name}`), 'grant', `${name} is required`);
}
for (const name of [
  'SYSTEM_ALERT_WINDOW', 'RECORD_AUDIO', 'ACCESS_BACKGROUND_LOCATION',
  'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE',
  'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO', 'READ_MEDIA_VISUAL_USER_SELECTED',
]) {
  assert.equal(permissions.get(`android.permission.${name}`), 'remove', `${name} must be blocked`);
}
for (const name of ['BLUETOOTH_SCAN', 'BLUETOOTH_CONNECT', 'health.READ_HEART_RATE', 'health.READ_OXYGEN_SATURATION']) {
  assert.equal(permissions.get(`android.permission.${name}`), 'grant', `${name} is required for device readings`);
}
const scan = manifest['uses-permission'].find(row => row.$['android:name'] === 'android.permission.BLUETOOTH_SCAN');
assert.equal(scan.$['android:usesPermissionFlags'], 'neverForLocation', 'Bluetooth scans must not request location inference');
const healthPermissions = [...permissions].filter(([name, mode]) => name.startsWith('android.permission.health.') && mode !== 'remove');
assert.deepEqual(healthPermissions.map(([name]) => name).sort(), [
  'android.permission.health.READ_HEART_RATE',
  'android.permission.health.READ_OXYGEN_SATURATION',
], 'Health access must remain read-only and limited to the approved measurements');
const application = manifest.application[0];
const privacy = application.activity?.find(row => row.$['android:name'] === '.HealthPrivacyActivity');
assert(privacy && privacy.$['android:exported'] === 'true', 'Health Connect needs an accessible privacy explanation');
const hasAction = (activity, action) => (activity['intent-filter'] ?? []).some(filter =>
  (filter.action ?? []).some(row => row.$['android:name'] === action));
assert(hasAction(privacy, 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE'), 'Android health rationale must open the privacy screen');
assert(!application.activity.some(row => row !== privacy && hasAction(row, 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE')),
  'The health rationale must not open the golf home screen');
const alias = application['activity-alias']?.find(row => row.$['android:name'] === 'ViewPermissionUsageActivity');
assert.equal(alias?.$['android:targetActivity'], '.HealthPrivacyActivity', 'Android 14 health access must open the privacy screen');
assert.equal(alias?.$['android:permission'], 'android.permission.START_VIEW_PERMISSION_USAGE');
assert(hasAction(alias, 'android.intent.action.VIEW_PERMISSION_USAGE'));
assert((alias['intent-filter'] ?? []).some(filter => (filter.category ?? []).some(row =>
  row.$['android:name'] === 'android.intent.category.HEALTH_PERMISSIONS')));
console.log(`Android configuration verified: ${config.android.package} ${config.version} (${config.android.versionCode})`);
console.log('Camera/foreground GPS enabled; microphone, overlays and broad media access blocked; automatic backup disabled.');
console.log('Read-only health permissions, Bluetooth scan privacy and Android health rationale routing verified.');

if (args.includes('--bundle')) {
  const destination = mkdtempSync(path.join(tmpdir(), 'drc-android-bundle-'));
  execFileSync(process.execPath, [
    expoCli, 'export', '--platform', 'android',
    '--output-dir', destination, '--max-workers', '2',
  ], { ...options, stdio: 'inherit' });
  console.log(`Android JavaScript and assets exported to ${destination}`);
}
console.log('These checks do not build/sign an APK or verify physical-device behavior.');