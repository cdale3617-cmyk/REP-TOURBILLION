import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createDailyPin, getCourseGeometry, isDailyPinCurrent, mergeDiscoveredCourse, migrateMappedCourseReference, type DailyPin, type DeviceFix } from '@/utils/courseGeometry';
import { validateGolfState, validateHolePerformance } from '@/utils/backup';
import type { ShotConditions } from '@/utils/shotConditions';
import type { PhoneMotionSummary } from '@/utils/phoneMotion';
import { useDeviceReadings } from './useDeviceReadings';

export type Club = {
  id: string;
  name: string;
  make?: string;
  model?: string;
  carryMeters: number;
  loft: number;
};

export type GolfCourse = {
  id: string;
  name: string;
  area: string;
  par: number;
  latitude: number;
  longitude: number;
  address?: string;
  phone?: string;
  website?: string;
  source?: string;
};

export type HolePerformance = {
  putts?: number | null;
  penalties?: number | null;
  fairway?: 'hit' | 'miss' | null;
  greenInRegulation?: boolean | null;
};
export type HoleScore = { hole: number; par: number; score: number | null } & HolePerformance;
export type GolfRound = {
  id: string;
  courseId: string;
  startedAt: string;
  finishedAt?: string;
  currentHole: number;
  holes: HoleScore[];
};
export type PracticeActivity = {
  shotConditions?: ShotConditions;
  id: string;
  tool: string;
  title: string;
  note: string;
  value?: number;
  lateral?: number;
  clubId?: string;
  clubSetupKey?: string;
  metrics?: GolfActivityMetrics;
  phoneMotion?: PhoneMotionSummary;
  greenPhotoFile?: string;
  createdAt: string;
};
export type GolfActivityMetrics = {
  source?: 'manual-launch-monitor-or-coach';
  distanceUnit?: 'm' | 'yd';
  ballSpeedMph?: number;
  clubSpeedMph?: number;
  apex?: number;
  carry?: number;
  clubPathDeg?: number;
  faceAngleDeg?: number;
  tempoRatio?: number;
  maxForceBodyWeightPct?: number;
  torqueNm?: number;
  forceTransferPct?: number;
  pressureLeftPct?: number;
  pressureRightPct?: number;
};
export type BiometricEntry = {
  id: string;
  heartRate: number;
  spo2: number;
  createdAt: string;
};

export type GolfState = {
  playerName: string;
  unit: 'm' | 'yd';
  lastCourseId: string;
  courses: GolfCourse[];
  bag: Club[];
  activeRound: GolfRound | null;
  rounds: GolfRound[];
  activities: PracticeActivity[];
  biometrics: BiometricEntry[];
  checklist: string[];
  wedgeMatrix: Record<string, { threeQuarter: number | null; half: number | null }>;
  dailyPins: DailyPin[];
};

type GolfContextValue = GolfState & {
  deviceReadings: ReturnType<typeof useDeviceReadings>;
  isReady: boolean;
  storageError: string;
  restoreSnapshot: (snapshot: GolfState) => Promise<void>;
  setPlayerName: (name: string) => void;
  setUnit: (unit: 'm' | 'yd') => void;
  setLastCourseId: (id: string) => void;
  addCourse: (course: GolfCourse) => void;
  updateClub: (id: string, patch: Partial<Club>) => void;
  addClub: () => void;
  removeClub: (id: string) => void;
  startRound: (courseId?: string) => void;
  setCurrentHole: (hole: number) => void;
  setHoleScore: (hole: number, score: number) => void;
  setHolePerformance: (roundId: string, hole: number, performance: HolePerformance) => void;
  finishRound: () => void;
  recordDailyPin: (roundId: string, courseId: string, hole: number, fix: DeviceFix, requestedAt: number) => void;
  removeDailyPin: (courseId: string, hole: number) => void;
  addActivity: (activity: Omit<PracticeActivity, 'id' | 'createdAt'>) => void;
  addBiometric: (heartRate: number, spo2: number) => void;
  removeBiometric: (id: string) => void;
  toggleChecklistItem: (item: string) => void;
  setWedgeDistance: (clubId: string, swing: 'threeQuarter' | 'half', distance: number | null) => void;
};

const STORAGE_KEY = 'drc-golf-tourbillion-state-v1';
const courseSeed: GolfCourse[] = [
  { id: 'royal-queensland', name: 'Royal Queensland Golf Club', area: 'Brisbane, Queensland', par: 72, latitude: -27.4219, longitude: 153.0695, source: 'Saved course reference' },
  { id: 'brisbane-golf-club', name: 'Brisbane Golf Club', area: 'Brisbane, Queensland', par: 72, latitude: -27.5105, longitude: 153.0095, source: 'Saved course reference' },
  { id: 'pacific-golf-club', name: 'Pacific Golf Club', area: 'Brisbane, Queensland', par: 72, latitude: -27.5166, longitude: 153.1064, source: 'OpenStreetMap', website: 'https://www.pacificgolf.com.au/', phone: '+61 7 3343 0888' },
];

const defaultBag: Club[] = [
  { id: 'd', name: 'Driver', carryMeters: 230, loft: 10.5 },
  { id: '3w', name: '3 Wood', carryMeters: 210, loft: 15 },
  { id: '5w', name: '5 Wood', carryMeters: 195, loft: 18 },
  { id: '4h', name: '4 Hybrid', carryMeters: 180, loft: 22 },
  { id: '5i', name: '5 Iron', carryMeters: 170, loft: 25 },
  { id: '6i', name: '6 Iron', carryMeters: 160, loft: 28 },
  { id: '7i', name: '7 Iron', carryMeters: 150, loft: 32 },
  { id: '8i', name: '8 Iron', carryMeters: 140, loft: 36 },
  { id: '9i', name: '9 Iron', carryMeters: 128, loft: 41 },
  { id: 'pw', name: 'Pitching Wedge', carryMeters: 115, loft: 46 },
  { id: 'gw', name: 'Gap Wedge', carryMeters: 100, loft: 51 },
  { id: 'sw', name: 'Sand Wedge', carryMeters: 82, loft: 56 },
  { id: 'lw', name: 'Lob Wedge', carryMeters: 65, loft: 60 },
  { id: 'putter', name: 'Putter', carryMeters: 0, loft: 3 },
];

const parSequence = [4, 3, 4, 5, 4, 3, 5, 4, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4];
const initialState: GolfState = {
  playerName: 'Dale',
  unit: 'm',
  lastCourseId: courseSeed[0].id,
  courses: courseSeed,
  bag: defaultBag,
  activeRound: null,
  rounds: [],
  activities: [],
  biometrics: [],
  checklist: [],
  wedgeMatrix: {},
  dailyPins: [],
};

const GolfContext = createContext<GolfContextValue | null>(null);

export function GolfProvider({ children }: { children: ReactNode }) {
  const deviceReadings = useDeviceReadings();
  const [state, setState] = useState<GolfState>(initialState);
  const [isReady, setIsReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [storageEnabled, setStorageEnabled] = useState(true);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const writeRevision = useRef(0);

  function persist(snapshot: GolfState): Promise<void> {
    const serialized = JSON.stringify(snapshot);
    const result = writeQueue.current.then(() => AsyncStorage.setItem(STORAGE_KEY, serialized));
    writeQueue.current = result.catch(() => undefined);
    return result;
  }

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && mounted) {
          const parsed = validateGolfState({ ...initialState, ...JSON.parse(saved) });
          const courses = (parsed.courses?.length ? parsed.courses : courseSeed).map((course) => {
            const geometry = getCourseGeometry(course.id);
            return geometry ? { ...course, latitude: geometry.latitude, longitude: geometry.longitude } : course;
          });
          setState({ ...initialState, ...parsed, courses });
        }
      })
      .catch(() => {
        if (mounted) {
          setStorageError('Saved data could not be read. Existing storage has been left unchanged; new edits will not be saved.');
          setStorageEnabled(false);
        }
      })
      .finally(() => {
        if (mounted) setIsReady(true);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (isReady && storageEnabled) {
      const revision = ++writeRevision.current;
      persist(state)
        .then(() => { if (revision === writeRevision.current) setStorageError(''); })
        .catch(() => { if (revision === writeRevision.current) setStorageError('Local saving failed. Your current edits are visible, but may not survive closing the app.'); });
    }
  }, [isReady, state, storageEnabled]);

  const value = useMemo<GolfContextValue>(() => ({
    ...state,
    deviceReadings,
    isReady,
    storageError,
    restoreSnapshot: async (snapshot) => {
      const checked = validateGolfState(snapshot);
      setIsReady(false);
      ++writeRevision.current;
      try {
        await persist(checked);
        setState(checked);
        setStorageEnabled(true);
        setStorageError('');
      } finally { setIsReady(true); }
    },
    setPlayerName: (name) => setState((current) => ({ ...current, playerName: name })),
    setUnit: (unit) => setState((current) => ({ ...current, unit })),
    setLastCourseId: (id) => setState((current) => ({ ...current, lastCourseId: id })),
    addCourse: (course) => setState((current) => {
      // The same mapped course can arrive from OSM under its source ID instead
      // of the saved course ID. Preserve that stable identity for pins and rounds.
      const merged = mergeDiscoveredCourse(current.courses, course);
      const geometry = getCourseGeometry(merged.id);
      if (!geometry) return { ...current, courses: merged.courses, lastCourseId: merged.id };
      return {
        ...current,
        courses: merged.courses,
        lastCourseId: merged.id,
        activeRound: current.activeRound
          ? migrateMappedCourseReference(current.activeRound, merged.id)
          : null,
        rounds: current.rounds.map((round) => migrateMappedCourseReference(round, merged.id)),
        dailyPins: current.dailyPins.map((pin) => migrateMappedCourseReference(pin, merged.id)),
      };
    }),
    updateClub: (id, patch) => setState((current) => ({
      ...current, bag: current.bag.map((club) => club.id === id ? { ...club, ...patch } : club),
    })),
    addClub: () => setState((current) => ({
      ...current,
      bag: [...current.bag, { id: `${Date.now()}`, name: 'New club', make: '', model: '', carryMeters: 100, loft: 45 }],
    })),
    removeClub: (id) => setState((current) => ({ ...current, bag: current.bag.filter((club) => club.id !== id) })),
    startRound: (courseId) => setState((current) => {
      if (current.activeRound) return current;
      const selected = courseId ?? current.lastCourseId;
      const geometry = getCourseGeometry(selected);
      return {
        ...current,
        lastCourseId: selected,
        activeRound: {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          courseId: selected,
          startedAt: new Date().toISOString(),
          currentHole: 1,
          holes: parSequence.map((par, index) => ({ hole: index + 1, par: geometry?.holes.find((item) => item.hole === index + 1)?.par ?? par, score: null })),
        },
      };
    }),
    setCurrentHole: (hole) => setState((current) => current.activeRound ? {
      ...current,
      activeRound: { ...current.activeRound, currentHole: Math.min(18, Math.max(1, hole)) },
    } : current),
    setHoleScore: (hole, score) => setState((current) => current.activeRound ? {
      ...current,
      activeRound: {
        ...current.activeRound,
        holes: current.activeRound.holes.map((item) => item.hole === hole ? { ...item, score: Math.min(99, Math.max(1, Math.round(score), (item.putts ?? 0) + (item.penalties ?? 0))) } : item),
      },
    } : current),
    setHolePerformance: (roundId, holeNumber, performance) => {
      if (!isReady || !storageEnabled || storageError) throw new Error('Resolve the local storage warning before changing hole statistics.');
      const target = state.activeRound?.id === roundId ? state.activeRound : state.rounds.find(round => round.id === roundId);
      const existing = target?.holes.find(hole => hole.hole === holeNumber);
      if (!existing) throw new Error('This scorecard or hole is no longer available.');
      validateHolePerformance(existing, performance);
      const update = (round: GolfRound) => ({
        ...round,
        holes: round.holes.map(hole => hole.hole === holeNumber ? validateHolePerformance(hole, performance) : hole),
      });
      setState(current => ({
        ...current,
        activeRound: current.activeRound?.id === roundId ? update(current.activeRound) : current.activeRound,
        rounds: current.rounds.map(round => round.id === roundId ? update(round) : round),
      }));
    },
    finishRound: () => setState((current) => {
      if (!current.activeRound) return current;
      const saved = { ...current.activeRound, finishedAt: new Date().toISOString() };
      return { ...current, activeRound: null, rounds: [saved, ...current.rounds], lastCourseId: saved.courseId };
    }),
    recordDailyPin: (roundId, courseId, hole, fix, requestedAt) => {
      if (!isReady || !storageEnabled) throw new Error('Local saving is unavailable. Resolve the storage warning before recording a pin.');
      if (state.activeRound?.id !== roundId || state.activeRound.courseId !== courseId || state.activeRound.currentHole !== hole)
        throw new Error('The active hole changed. Start capture again for the correct hole.');
      const now = Date.now();
      const pin = createDailyPin(courseId, hole, fix, requestedAt, now);
      setState((current) => {
        if (current.activeRound?.id !== roundId || current.activeRound.courseId !== courseId || current.activeRound.currentHole !== hole) return current;
        return {
          ...current,
          dailyPins: [...current.dailyPins.filter((item) => isDailyPinCurrent(item, now) && !(item.courseId === courseId && item.hole === hole)), pin],
        };
      });
    },
    removeDailyPin: (courseId, hole) => setState((current) => ({
      ...current, dailyPins: current.dailyPins.filter((pin) => pin.courseId !== courseId || pin.hole !== hole),
    })),
    addActivity: (activity) => setState((current) => ({
      ...current,
      activities: [{ ...activity, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date().toISOString() }, ...current.activities],
    })),
    addBiometric: (heartRate, spo2) => setState((current) => ({
      ...current,
      biometrics: [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, heartRate, spo2, createdAt: new Date().toISOString() }, ...current.biometrics],
    })),
    removeBiometric: (id) => {
      if (!isReady || !storageEnabled) throw new Error('Local saving is unavailable. Resolve the storage warning before deleting a reading.');
      setState((current) => ({ ...current, biometrics: current.biometrics.filter(entry => entry.id !== id) }));
    },
    toggleChecklistItem: (item) => setState((current) => ({
      ...current,
      checklist: current.checklist.includes(item) ? current.checklist.filter((entry) => entry !== item) : [...current.checklist, item],
    })),
    setWedgeDistance: (clubId, swing, distance) => setState((current) => ({
      ...current,
      wedgeMatrix: {
        ...current.wedgeMatrix,
        [clubId]: { ...(current.wedgeMatrix[clubId] ?? { threeQuarter: null, half: null }), [swing]: distance },
      },
    })),
  }), [state, isReady, storageError, storageEnabled, deviceReadings]);

  return <GolfContext.Provider value={value}>{children}</GolfContext.Provider>;
}

export function useGolf() {
  const value = useContext(GolfContext);
  if (!value) throw new Error('useGolf must be used inside GolfProvider.');
  return value;
}
