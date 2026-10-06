import { useEffect, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import Constants from 'expo-constants';
import type { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { decodeHeartRate } from '@/utils/heartRate';

type Status = 'idle' | 'busy' | 'ready' | 'denied' | 'unavailable' | 'error';
type Reading = { value: number; measuredAt: string; source: string };
type NearbySensor = { id: string; name: string };
const HEART_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HEART_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';
const nativeAvailable = Platform.OS === 'android' && Constants.executionEnvironment !== 'storeClient';
export const deviceBuildNote = nativeAvailable
  ? 'Android native build. Device compatibility has not yet been verified.'
  : 'Health Connect and BLE require an installed native Android build, not Expo Go or the browser preview.';
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export function useDeviceReadings() {
  const [health, setHealth] = useState<{ status: Status; message: string; heartRate?: Reading; oxygen?: Reading }>({
    status: 'idle', message: 'Not connected. Read-only access to heart rate and oxygen saturation from the last 7 days.',
  });
  const [ble, setBle] = useState<{
    status: Status; message: string; scanning: boolean; devices: NearbySensor[];
    connected?: NearbySensor; heartRate?: Reading;
  }>({ status: 'idle', message: 'Not connected. Supports standard BLE Heart Rate Service monitors only.', scanning: false, devices: [] });
  const manager = useRef<BleManager | null>(null);
  const subscriptions = useRef<Subscription[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const session = useRef(0);
  const healthBusy = useRef(false);
  const bleBusy = useRef(false);
  const connectedId = useRef<string | null>(null);
  const mounted = useRef(true);

  function clearTimer() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  async function stopScan() {
    clearTimer();
    await manager.current?.stopDeviceScan();
    if (mounted.current) setBle(current => ({
      ...current, scanning: false, status: current.connected ? 'ready' : 'idle',
      message: current.connected ? current.message : current.devices.length
        ? 'Scan finished. Choose a monitor to connect.'
        : 'No supported monitors found. Wake your sensor, wear it, and disconnect it from other apps before retrying.',
    }));
  }
  async function disconnect() {
    session.current++;
    bleBusy.current = false;
    clearTimer();
    subscriptions.current.forEach(item => item.remove());
    subscriptions.current = [];
    const id = connectedId.current;
    connectedId.current = null;
    try {
      await manager.current?.stopDeviceScan();
      if (id) await manager.current?.cancelDeviceConnection(id);
      if (mounted.current) setBle(current => ({ ...current, status: 'idle', scanning: false, connected: undefined, heartRate: undefined, message: 'Disconnected. No live readings are being received.' }));
    } catch (error) {
      if (mounted.current) setBle(current => ({ ...current, status: 'error', scanning: false, connected: undefined, heartRate: undefined, message: `Disconnect failed: ${errorMessage(error)}` }));
    }
  }
  useEffect(() => {
    mounted.current = true;
    const appSubscription = AppState.addEventListener('change', state => {
      // Foreground-only collection. Never persist or claim a previous live reading.
      if (state === 'background' && (connectedId.current || timer.current || bleBusy.current)) void disconnect();
    });
    return () => {
      mounted.current = false;
      session.current++;
      clearTimer();
      appSubscription.remove();
      subscriptions.current.forEach(item => item.remove());
      void manager.current?.destroy().catch(() => {});
      manager.current = null;
    };
  }, []);

  async function readHealth() {
    if (healthBusy.current) return;
    if (!nativeAvailable) { setHealth({ status: 'unavailable', message: deviceBuildNote }); return; }
    healthBusy.current = true;
    setHealth({ status: 'busy', message: 'Checking Health Connect and requesting read permission…' });
    try {
      const hc = await import('react-native-health-connect');
      const availability = await hc.getSdkStatus();
      if (availability !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) {
        setHealth({ status: 'unavailable', message: availability === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
          ? 'Install or update Health Connect, then retry.' : 'Health Connect is unavailable on this Android device.' });
        return;
      }
      if (!await hc.initialize()) throw new Error('Health Connect could not initialize.');
      const granted = await hc.requestPermission([
        { accessType: 'read', recordType: 'HeartRate' },
        { accessType: 'read', recordType: 'OxygenSaturation' },
      ]);
      const canRead = (type: string) => granted.some(p => p.accessType === 'read' && p.recordType === type);
      if (!canRead('HeartRate') && !canRead('OxygenSaturation')) {
        setHealth({ status: 'denied', message: 'No read permissions granted. Retry or change access in Health Connect settings. Manual logging remains available.' });
        return;
      }
      const options = {
        timeRangeFilter: { operator: 'between' as const, startTime: new Date(Date.now() - 7 * 86400000).toISOString(), endTime: new Date().toISOString() },
        ascendingOrder: false, pageSize: 1000,
      };
      // Page through the full permitted range; display newest sample, not an average or a made-up value.
      let heartRate: Reading | undefined, oxygen: Reading | undefined;
      if (canRead('HeartRate')) {
        let pageToken: string | undefined;
        do {
          const page = await hc.readRecords('HeartRate', { ...options, pageToken });
          for (const record of page.records) for (const sample of record.samples) {
            if (Number.isFinite(sample.beatsPerMinute) && sample.beatsPerMinute > 0 &&
              (!heartRate || Date.parse(sample.time) > Date.parse(heartRate.measuredAt))) {
              heartRate = { value: sample.beatsPerMinute, measuredAt: sample.time, source: record.metadata?.dataOrigin ?? 'Health Connect' };
            }
          }
          pageToken = page.pageToken || undefined;
        } while (pageToken && mounted.current);
      }
      if (canRead('OxygenSaturation')) {
        let pageToken: string | undefined;
        do {
          const page = await hc.readRecords('OxygenSaturation', { ...options, pageToken });
          for (const record of page.records) {
            if (Number.isFinite(record.percentage) && record.percentage >= 0 && record.percentage <= 100 &&
              (!oxygen || Date.parse(record.time) > Date.parse(oxygen.measuredAt))) {
              oxygen = { value: record.percentage, measuredAt: record.time, source: record.metadata?.dataOrigin ?? 'Health Connect' };
            }
          }
          pageToken = page.pageToken || undefined;
        } while (pageToken && mounted.current);
      }
      if (mounted.current) setHealth({
        status: 'ready', heartRate, oxygen,
        message: `${canRead('HeartRate') && canRead('OxygenSaturation') ? 'Read access granted.' : 'Partial read access granted.'} ${heartRate || oxygen ? 'Latest available readings below are historical, not live.' : 'No readings found in the last 7 days. Enable sharing in Samsung Health or your sensor app, then refresh.'}`,
      });
    } catch (error) {
      if (mounted.current) setHealth({ status: 'error', message: `Health Connect failed: ${errorMessage(error)}` });
    } finally { healthBusy.current = false; }
  }

  async function openHealthSettings() {
    try {
      if (!nativeAvailable) throw new Error(deviceBuildNote);
      const hc = await import('react-native-health-connect');
      hc.openHealthConnectSettings();
      setHealth({ status: 'idle', message: 'Access may have changed. Refresh to recheck permissions and readings.' });
    } catch (error) { setHealth({ status: 'error', message: errorMessage(error) }); }
  }

  async function scanSensors() {
    if (bleBusy.current || connectedId.current || timer.current) return;
    if (!nativeAvailable) { setBle(current => ({ ...current, status: 'unavailable', message: deviceBuildNote })); return; }
    bleBusy.current = true;
    const token = ++session.current;
    setBle({ status: 'busy', message: 'Checking Bluetooth permissions…', scanning: false, devices: [] });
    try {
      const permissions = Number(Platform.Version) >= 31
        ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const granted = await PermissionsAndroid.requestMultiple(permissions);
      if (token !== session.current || !mounted.current) return;
      if (permissions.some(p => granted[p] !== PermissionsAndroid.RESULTS.GRANTED)) {
        setBle({ status: 'denied', message: 'Bluetooth permission denied. Allow Nearby devices (or Location on older Android) in app settings, then retry.', scanning: false, devices: [] });
        return;
      }
      const module = await import('react-native-ble-plx');
      if (token !== session.current || !mounted.current) return;
      const client = manager.current ?? (manager.current = new module.BleManager());
      const adapter = await client.state();
      if (token !== session.current || !mounted.current) return;
      if (adapter !== module.State.PoweredOn) throw new Error(`Bluetooth is ${adapter}. Turn Bluetooth on and retry. Older Android also requires Location services enabled.`);
      await client.stopDeviceScan();
      if (token !== session.current || !mounted.current) return;
      setBle({ status: 'busy', scanning: true, devices: [], message: 'Scanning for standard heart-rate monitors for 15 seconds…' });
      await client.startDeviceScan([HEART_SERVICE], null, (error, device) => {
        if (token !== session.current || !mounted.current) return;
        if (error) {
          clearTimer();
          void client.stopDeviceScan().catch(() => {});
          setBle(current => ({ ...current, status: 'error', scanning: false, message: error.message }));
          return;
        }
        if (device) setBle(current => ({ ...current, devices: [
          ...current.devices.filter(item => item.id !== device.id),
          { id: device.id, name: device.name ?? device.localName ?? 'Unnamed heart-rate monitor' },
        ] }));
      });
      if (token === session.current) timer.current = setTimeout(() => {
        void stopScan().catch(error => setBle(current => ({ ...current, status: 'error', scanning: false, message: errorMessage(error) })));
      }, 15000);
    } catch (error) {
      if (token === session.current && mounted.current) setBle(current => ({ ...current, status: 'error', scanning: false, message: errorMessage(error) }));
    } finally { if (token === session.current) bleBusy.current = false; }
  }

  async function connectSensor(sensor: NearbySensor) {
    if (bleBusy.current || !manager.current) return;
    bleBusy.current = true;
    const token = ++session.current;
    const client = manager.current;
    clearTimer();
    setBle(current => ({ ...current, status: 'busy', scanning: false, heartRate: undefined, message: `Connecting to ${sensor.name}…` }));
    let device: Device | undefined;
    try {
      await client.stopDeviceScan();
      if (token !== session.current || !mounted.current) return;
      connectedId.current = sensor.id; // Allows cancellation even while connecting.
      device = await client.connectToDevice(sensor.id, { timeout: 15000 });
      if (token !== session.current || !mounted.current) { await client.cancelDeviceConnection(sensor.id); return; }
      await device.discoverAllServicesAndCharacteristics();
      const characteristics = await device.characteristicsForService(HEART_SERVICE);
      if (!characteristics.some(c => c.uuid.toLowerCase() === HEART_MEASUREMENT && (c.isNotifiable || c.isIndicatable))) {
        throw new Error('This sensor does not provide standard heart-rate notifications.');
      }
      if (token !== session.current || !mounted.current) { await client.cancelDeviceConnection(sensor.id); return; }
      subscriptions.current.push(client.onDeviceDisconnected(sensor.id, () => {
        if (token !== session.current || !mounted.current) return;
        session.current++;
        connectedId.current = null;
        subscriptions.current.forEach(item => item.remove());
        subscriptions.current = [];
        setBle(current => ({ ...current, status: 'error', connected: undefined, heartRate: undefined, message: 'Sensor disconnected. Wake it and scan again to reconnect.' }));
      }));
      setBle(current => ({ ...current, status: 'ready', connected: sensor, message: 'Connected. Waiting for a measured heart rate…' }));
      subscriptions.current.push(device.monitorCharacteristicForService(HEART_SERVICE, HEART_MEASUREMENT, (error, characteristic) => {
        if (token !== session.current || !mounted.current) return;
        if (error) {
          setBle(current => ({ ...current, status: 'error', heartRate: undefined, message: `Sensor notifications failed: ${error.message}. Disconnect and retry.` }));
          return;
        }
        try {
          if (!characteristic?.value) throw new Error('Sensor sent an empty packet.');
          const bpm = decodeHeartRate(characteristic.value);
          setBle(current => ({ ...current, status: 'ready', message: 'Receiving measured heart rate. Check the timestamp; an old reading is not live.', heartRate: { value: bpm, measuredAt: new Date().toISOString(), source: sensor.name } }));
        } catch (error) {
          setBle(current => ({ ...current, heartRate: undefined, message: errorMessage(error) }));
        }
      }));
    } catch (error) {
      await client.cancelDeviceConnection(sensor.id).catch(() => {});
      if (token === session.current && mounted.current) {
        connectedId.current = null;
        setBle(current => ({ ...current, status: 'error', connected: undefined, heartRate: undefined, message: `Connection failed: ${errorMessage(error)}` }));
      }
    } finally { if (token === session.current) bleBusy.current = false; }
  }

  return { health, ble, readHealth, openHealthSettings, scanSensors, stopScan, connectSensor, disconnect, deviceBuildNote };
}