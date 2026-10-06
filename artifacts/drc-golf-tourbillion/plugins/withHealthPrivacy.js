const { withAndroidManifest, withDangerousMod, withGradleProperties, AndroidConfig } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// Health Connect's privacy-policy intent must show the rationale, not the golf home screen.
module.exports = function withHealthPrivacy(config) {
  // Health Connect's SDK requires API 26; Expo/RN currently defaults to 24.
  config = withGradleProperties(config, mod => {
    mod.modResults = mod.modResults.filter(item => item.key !== 'android.minSdkVersion');
    mod.modResults.push({ type: 'property', key: 'android.minSdkVersion', value: '26' });
    return mod;
  });
  config = withAndroidManifest(config, mod => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    const main = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    main['intent-filter'] = (main['intent-filter'] ?? []).filter(filter =>
      !(filter.action ?? []).some(action => action.$['android:name'] === 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE'));
    application.activity ??= [];
    if (!application.activity.some(item => item.$['android:name'] === '.HealthPrivacyActivity')) {
      application.activity.push({
        $: { 'android:name': '.HealthPrivacyActivity', 'android:exported': 'true' },
        'intent-filter': [{
          action: [{ $: { 'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE' } }],
        }],
      });
    }
    const alias = application['activity-alias']?.find(item => item.$['android:name'] === 'ViewPermissionUsageActivity');
    if (alias) alias.$['android:targetActivity'] = '.HealthPrivacyActivity';
    return mod;
  });
  return withDangerousMod(config, ['android', async mod => {
    const packageName = mod.android.package;
    if (!packageName) throw new Error('Health privacy requires android.package in app.json.');
    const directory = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/java', ...packageName.split('.'));
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'HealthPrivacyActivity.java'), `package ${packageName};

import android.app.Activity;
import android.os.Bundle;
import android.widget.ScrollView;
import android.widget.TextView;

public class HealthPrivacyActivity extends Activity {
  @Override public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    TextView text = new TextView(this);
    text.setTextSize(18);
    int padding = (int) (24 * getResources().getDisplayMetrics().density);
    text.setPadding(padding, padding, padding, padding);
    text.setText("DRC Golf Tempo — Health privacy\\n\\n"
      + "We request read-only access to heart rate and oxygen saturation to let you review your own recent measured readings alongside your golf activities.\\n\\n"
      + "We read only the last seven days after you tap Allow access / refresh readings. We do not write data to Health Connect. These readings stay in app memory and are not stored in saved history, uploaded, shared, sold, or used for advertising.\\n\\n"
      + "Bluetooth heart-rate readings also stay in memory. Bluetooth collection stops when the app enters the background.\\n\\n"
      + "Manually entered readings are a separate alternative stored on this device in the app's private local storage. Clearing app data or uninstalling removes that local log.\\n\\n"
      + "You can deny permission, revoke access in Health Connect settings, or use manual logging instead. Android app settings control Bluetooth permissions.\\n\\n"
      + "This app is not a medical monitor or a diagnostic tool. Historical and last-received readings are labelled with timestamps and must not be treated as continuous monitoring.");
    ScrollView scroll = new ScrollView(this);
    scroll.addView(text);
    setContentView(scroll);
  }
}
`);
    return mod;
  }]);
};