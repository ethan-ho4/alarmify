// ─────────────────────────────────────────────
//  Ethan's Alarm – Global State (Zustand)
// ─────────────────────────────────────────────

import { create } from 'zustand';
import { Alarm, BedtimePhase, SpotifyAuth, SpotifyMedia } from '../types';
import {
  loadAlarms as fetchAlarms,
  persistAlarms,
  scheduleAlarmNotifications,
  cancelAlarmNotifications,
} from '../services/alarms';
import { clearAuth, getUserProfile, saveAuth, verifySpotifySession } from '../services/spotify';
import {
  scheduleTimersForAlarm,
  cancelTimersForAlarm,
  scheduleAllAlarmTimers,
} from '../services/alarmTimers';
import {
  usesAlarmTimersAndKeepalive,
  usesLegacyAlarmPlayback,
} from '../utils/alarmPlaybackMode';
import { findDuplicateTimeAlarm } from '../utils/alarmConflicts';
import { syncBedtimeWarningIfNeeded } from '../utils/bedtimeGate';
import { restoreIdealBrightness } from '../services/bedtimeBrightness';

interface UserProfile {
  name: string;
  image: string | null;
}

interface AppState {
  alarms: Alarm[];
  alarmsLoaded: boolean;
  loadAlarms: () => Promise<void>;
  addAlarm: (alarm: Alarm) => Promise<void>;
  updateAlarm: (alarm: Alarm) => Promise<void>;
  deleteAlarm: (id: string) => Promise<void>;
  toggleAlarm: (id: string) => Promise<void>;
  disableAllAlarms: () => Promise<void>;

  auth: SpotifyAuth | null;
  profile: UserProfile | null;
  authLoaded: boolean;
  loadAuth: () => Promise<void>;
  setAuth: (auth: SpotifyAuth) => Promise<void>;
  logout: () => Promise<void>;

  pendingMedia: SpotifyMedia | null;
  setPendingMedia: (media: SpotifyMedia | null) => void;

  bedtimePhase: BedtimePhase;
  enterWarning: () => void;
  enterBlack: () => void;
  exitBedtime: () => void;
  onAlarmFireExitBedtime: () => void;

  is24Hour: boolean;
  set24Hour: (val: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  alarms: [],
  alarmsLoaded: false,

  loadAlarms: async () => {
    const alarms = await fetchAlarms();
    set({ alarms, alarmsLoaded: true });
    if (usesAlarmTimersAndKeepalive()) {
      scheduleAllAlarmTimers(alarms);
    }
    syncBedtimeWarningIfNeeded();
  },

  addAlarm: async (alarm) => {
    const current = get().alarms;
    const duplicate = findDuplicateTimeAlarm(current, alarm);
    const base = duplicate
      ? {
          ...alarm,
          id: duplicate.id,
          createdAt: duplicate.createdAt,
          notificationIds: duplicate.notificationIds,
        }
      : alarm;

    if (duplicate) {
      await cancelAlarmNotifications(duplicate);
      cancelTimersForAlarm(duplicate.id);
    }

    const ids = usesLegacyAlarmPlayback() ? await scheduleAlarmNotifications(base) : [];
    const withIds = { ...base, notificationIds: ids };
    const alarms = duplicate
      ? current.map((a) => (a.id === duplicate.id ? withIds : a))
      : [...current, withIds];

    set({ alarms });
    await persistAlarms(alarms);
    if (usesAlarmTimersAndKeepalive()) scheduleTimersForAlarm(withIds);
    if (withIds.isEnabled && withIds.media?.uri) syncBedtimeWarningIfNeeded();
  },

  updateAlarm: async (alarm) => {
    const current = get().alarms;
    const existing = current.find((a) => a.id === alarm.id);
    const duplicate = findDuplicateTimeAlarm(current, alarm);
    const base = duplicate
      ? {
          ...alarm,
          id: duplicate.id,
          createdAt: duplicate.createdAt,
          notificationIds: duplicate.notificationIds,
        }
      : alarm;

    if (existing) {
      await cancelAlarmNotifications(existing);
      cancelTimersForAlarm(existing.id);
    }
    if (duplicate) {
      await cancelAlarmNotifications(duplicate);
      cancelTimersForAlarm(duplicate.id);
    }

    const ids = usesLegacyAlarmPlayback() ? await scheduleAlarmNotifications(base) : [];
    const withIds = { ...base, notificationIds: ids };
    const alarms = duplicate
      ? current
          .filter((a) => a.id !== alarm.id)
          .map((a) => (a.id === duplicate.id ? withIds : a))
      : current.map((a) => (a.id === alarm.id ? withIds : a));

    set({ alarms });
    await persistAlarms(alarms);
    if (usesAlarmTimersAndKeepalive()) scheduleTimersForAlarm(withIds);
    if (withIds.isEnabled && withIds.media?.uri) syncBedtimeWarningIfNeeded();
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
    await get().updateAlarm({ ...alarm, isEnabled: !alarm.isEnabled });
  },

  disableAllAlarms: async () => {
    await restoreIdealBrightness();
    const alarms = get().alarms.map((a) => ({ ...a, isEnabled: false }));
    set({ alarms, bedtimePhase: 'idle' });
    await persistAlarms(alarms);
    for (const alarm of alarms) {
      if (usesLegacyAlarmPlayback()) await scheduleAlarmNotifications(alarm);
    }
    if (usesAlarmTimersAndKeepalive()) scheduleAllAlarmTimers(alarms);
  },

  auth: null,
  profile: null,
  authLoaded: false,

  loadAuth: async () => {
    const previousProfile = get().profile;
    const session = await verifySpotifySession();
    if (session) {
      set({
        auth: session.auth,
        profile: session.profile ?? previousProfile,
        authLoaded: true,
      });
    } else {
      set({ auth: null, profile: null, authLoaded: true });
    }
  },

  setAuth: async (auth) => {
    await saveAuth(auth);
    const profile = await getUserProfile();
    set({ auth, profile });
  },

  logout: async () => {
    await clearAuth();
    set({ auth: null, profile: null });
  },

  pendingMedia: null,
  setPendingMedia: (media) => set({ pendingMedia: media }),

  bedtimePhase: 'idle',
  enterWarning: () => set({ bedtimePhase: 'warning' }),
  enterBlack: () => set({ bedtimePhase: 'black' }),
  exitBedtime: () => set({ bedtimePhase: 'idle' }),
  onAlarmFireExitBedtime: () => {
    const phase = get().bedtimePhase;
    if (phase === 'black') set({ bedtimePhase: 'idle' });
  },

  is24Hour: false,
  set24Hour: (val) => set({ is24Hour: val }),
}));
