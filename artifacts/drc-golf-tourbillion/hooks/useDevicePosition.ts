import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import type { DeviceFix } from '@/utils/courseGeometry';

export function useDevicePosition(active?: boolean) {
  const [requested, setEnabled] = useState(false);
  const enabled = active ?? requested;
  const [gps, setGps] = useState<DeviceFix | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      setNow(Date.now());
    });
    // Keep date-dependent targets current even when live GPS is disabled.
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { listener.remove(); clearInterval(clock); };
  }, []);

  useEffect(() => {
    if (!enabled || !foreground) {
      setGps(null);
      return;
    }
    let cancelled = false;
    let browserWatch: number | undefined;
    let nativeWatch: Location.LocationSubscription | undefined;
    let latestTimestamp = -Infinity;
    setGps(null);
    setError('');
    const firstFixTimeout = setTimeout(() => {
      if (!cancelled) setError('Still waiting for GPS. Move outdoors or retry.');
    }, 15000);
    const receive = (fix: DeviceFix) => {
      if (!cancelled && fix.timestamp >= latestTimestamp) {
        latestTimestamp = fix.timestamp;
        clearTimeout(firstFixTimeout); setGps(fix); setNow(Date.now()); setError('');
      }
    };
    const fail = (message: string) => {
      if (!cancelled) { clearTimeout(firstFixTimeout); setGps(null); setError(message); }
    };

    async function watch() {
      try {
        if (Platform.OS === 'web') {
          if (!navigator.geolocation) { fail('GPS is unavailable in this browser.'); return; }
          browserWatch = navigator.geolocation.watchPosition(
            ({ coords, timestamp }) => receive({
              latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, timestamp,
            }),
            (problem) => fail(problem.code === 1
              ? 'Location access is off. Allow location in browser settings and try again.'
              : 'Could not get a GPS fix. Move outdoors and try again.'),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
          );
          return;
        }
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (!permission.granted) {
          fail(permission.canAskAgain ? 'Location access is needed for GPS distance.' : 'Location access is off in device settings.');
          return;
        }
        if (!await Location.hasServicesEnabledAsync()) {
          fail('Turn on Location in device settings, then retry GPS.');
          return;
        }
        if (cancelled) return;
        const subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Highest, timeInterval: 1000, distanceInterval: 0 },
          ({ coords, timestamp, mocked }) => receive({
            latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, timestamp, mocked,
          }),
          () => fail('Could not get a GPS fix. Move outdoors and try again.'),
        );
        if (cancelled) subscription.remove();
        else {
          nativeWatch = subscription;
          // Request an initial fix as well as watching for subsequent movement.
          void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest })
            .then(({ coords, timestamp, mocked }) => receive({
              latitude: coords.latitude, longitude: coords.longitude,
              accuracy: coords.accuracy, timestamp, mocked,
            }))
            .catch(() => { /* The live watcher and timeout still report status. */ });
        }
      } catch { fail('Could not start GPS. Check location settings and try again.'); }
    }
    void watch();
    return () => {
      cancelled = true;
      clearTimeout(firstFixTimeout);
      if (browserWatch !== undefined) navigator.geolocation.clearWatch(browserWatch);
      nativeWatch?.remove();
    };
  }, [enabled, foreground, attempt]);

  return { gps, error, now, enabled, setEnabled, retry: () => setAttempt((value) => value + 1), locating: enabled && foreground && !gps && !error };
}