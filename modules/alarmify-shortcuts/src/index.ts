import { requireNativeModule } from 'expo-modules-core';

export type ActiveAlarmPayload = {
  uri: string;
  enabled: boolean;
};

type AlarmifyShortcutsNative = {
  setActiveAlarmPayload(uri: string, enabled: boolean): void;
  getActiveAlarmPayload(): ActiveAlarmPayload;
  isAvailable(): boolean;
};

let native: AlarmifyShortcutsNative | null = null;

function getNative(): AlarmifyShortcutsNative | null {
  if (native !== null) return native;
  try {
    native = requireNativeModule<AlarmifyShortcutsNative>('AlarmifyShortcuts');
    return native;
  } catch {
    return null;
  }
}

export function isShortcutsBridgeAvailable(): boolean {
  return getNative()?.isAvailable() ?? false;
}

export function setActiveAlarmPayload(uri: string, enabled: boolean): boolean {
  const mod = getNative();
  if (!mod) return false;
  mod.setActiveAlarmPayload(uri, enabled);
  return true;
}

export function getActiveAlarmPayload(): ActiveAlarmPayload | null {
  const mod = getNative();
  if (!mod) return null;
  const raw = mod.getActiveAlarmPayload();
  return {
    uri: raw.uri ?? '',
    enabled: !!raw.enabled,
  };
}
