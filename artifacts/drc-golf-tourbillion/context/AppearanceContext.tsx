import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const APPEARANCE_STORAGE_KEY = 'drc-golf-anti-glare-v1';
type Appearance = {
  antiGlare: boolean;
  ready: boolean;
  saving: boolean;
  error: string;
  toggleAntiGlare: () => Promise<void>;
};
const AppearanceContext = createContext<Appearance | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [antiGlare, setAntiGlare] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(APPEARANCE_STORAGE_KEY).then(value => {
      if (!mounted) return;
      if (value !== null && value !== 'true' && value !== 'false') throw new Error('Invalid appearance setting');
      setAntiGlare(value === 'true');
    }).catch(() => {
      if (mounted) setError('Your display preference could not be read. You can choose it again below.');
    }).finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);

  async function toggleAntiGlare() {
    if (!ready || busy.current) return;
    busy.current = true;
    const next = !antiGlare;
    setAntiGlare(next);
    setSaving(true);
    setError('');
    try {
      await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, String(next));
    } catch {
      setError('The display has changed, but this preference could not be saved for next time.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return <AppearanceContext.Provider value={{ antiGlare, ready, saving, error, toggleAntiGlare }}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('useAppearance must be used inside AppearanceProvider');
  return value;
}
