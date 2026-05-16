// ─────────────────────────────────────────────
//  Alarmify – Global State (Zustand)
// ─────────────────────────────────────────────

import { create } from 'zustand';
import { Alarm, SpotifyAuth, SpotifyTrack } from '../types';
import {
  loadAlarms as fetchAlarms,
  persistAlarms,
  scheduleAlarmNotifications,
  cancelAlarmNotifications,
} from '../services/alarms';
import { clearAuth, getUserProfile, loadAuth as fetchAuth, saveAuth } from '../services/spotify';
import {
  scheduleTimersForAlarm,
  cancelTimersForAlarm,
  scheduleAllAlarmTimers,
} from '../services/alarmTimers';

interface UserProfile {
  name: string;
  image: string | null;
}

interface AppState {
  // ── Alarms ──────────────────────────────
  alarms: Alarm[];
  alarmsLoaded: boolean;
  loadAlarms: () => Promise<void>;
  addAlarm: (alarm: Alarm) => Promise<void>;
  updateAlarm: (alarm: Alarm) => Promise<void>;
  deleteAlarm: (id: string) => Promise<void>;
  toggleAlarm: (id: string) => Promise<void>;

  // ── Spotify Auth ─────────────────────────
  auth: SpotifyAuth | null;
  profile: UserProfile | null;
  authLoaded: boolean;
  loadAuth: () => Promise<void>;
  setAuth: (auth: SpotifyAuth) => Promise<void>;
  logout: () => Promise<void>;

  // ── Song Search State ─────────────────────
  pendingTrack: SpotifyTrack | null;
  setPendingTrack: (track: SpotifyTrack | null) => void;

  // ── Preferences ─────────────────────────────
  is24Hour: boolean;
  set24Hour: (val: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // ── Alarms ────────────────────────────────────────────────────────────────

  alarms: [],
  alarmsLoaded: true,

  loadAlarms: async () => {
    const alarms = await fetchAlarms();
    set({ alarms, alarmsLoaded: true });
    // Restore JS timers after load (e.g. app restart)
    scheduleAllAlarmTimers(alarms);
  },

  addAlarm: async (alarm) => {
    const ids = await scheduleAlarmNotifications(alarm);
    const withIds = { ...alarm, notificationIds: ids };
    const alarms = [...get().alarms, withIds];
    set({ alarms });
    await persistAlarms(alarms);
    scheduleTimersForAlarm(withIds);
  },

  updateAlarm: async (alarm) => {
    const ids = await scheduleAlarmNotifications(alarm);
    const withIds = { ...alarm, notificationIds: ids };
    const alarms = get().alarms.map((a) => (a.id === alarm.id ? withIds : a));
    set({ alarms });
    await persistAlarms(alarms);
    scheduleTimersForAlarm(withIds);
  },

  deleteAlarm: async (id) => {
    const target = get().alarms.find((a) => a.id === id);
    if (target) await cancelAlarmNotifications(target);
    cancelTimersForAlarm(id);
    const alarms = get().alarms.filter((a) => a.id !== id);
    set({ alarms });
    await persistAlarms(alarms);
  },

  toggleAlarm: async (id) => {
    const alarm = get().alarms.find((a) => a.id === id);
    if (!alarm) return;
    const updated = { ...alarm, isEnabled: !alarm.isEnabled };
    await get().updateAlarm(updated);
  },

  // ── Auth ──────────────────────────────────────────────────────────────────

  auth: null,
  profile: null,
  authLoaded: false,

  loadAuth: async () => {
    const auth = await fetchAuth();
    if (auth) {
      const profile = await getUserProfile();
      set({ auth, profile, authLoaded: true });
    } else {
      set({ auth: null, profile: null, authLoaded: true });
    }
  },

  setAuth: async (auth) => {
    await saveAuth(auth);           // persist to SecureStore so it survives app restarts
    const profile = await getUserProfile();
    set({ auth, profile });
  },

  logout: async () => {
    await clearAuth();
    set({ auth: null, profile: null });
  },

  // ── Song Search State ─────────────────────────────────────────────────────

  pendingTrack: null,
  setPendingTrack: (track) => set({ pendingTrack: track }),

  // ── Preferences ───────────────────────────────────────────────────────────

  is24Hour: false,
  set24Hour: (val) => set({ is24Hour: val }),
}));
