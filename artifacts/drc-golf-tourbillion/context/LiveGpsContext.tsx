import React, { createContext, useContext, useState } from 'react';
import { usePathname } from 'expo-router';
import { useDevicePosition } from '@/hooks/useDevicePosition';

type LiveGpsValue = ReturnType<typeof useDevicePosition>;
const LiveGpsContext = createContext<LiveGpsValue | null>(null);

export function LiveGpsProvider({ children }: { children: React.ReactNode }) {
  const [requested, setRequested] = useState(false);
  const pathname = usePathname();
  // One foreground session shared by Home and Round. Other tools pause it.
  const onGolfScreen = pathname === '/' || pathname === '/round';
  const position = useDevicePosition(requested && onGolfScreen);
  return <LiveGpsContext.Provider value={{ ...position, enabled: requested, setEnabled: setRequested }}>{children}</LiveGpsContext.Provider>;
}

export function useLiveGps() {
  const value = useContext(LiveGpsContext);
  if (!value) throw new Error('useLiveGps requires LiveGpsProvider');
  return value;
}
