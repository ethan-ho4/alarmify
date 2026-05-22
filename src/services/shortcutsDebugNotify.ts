import * as Notifications from 'expo-notifications';
import { isAlarmifyDebugEnabled } from '../utils/alarmifyDebug';

let lastMessage = '';
let lastAt = 0;

/** Local notification when App Group sync fails (debug builds or explicit debug flag). */
export async function notifyShortcutsSyncFailure(message: string): Promise<void> {
  if (!isAlarmifyDebugEnabled()) return;

  const now = Date.now();
  if (message === lastMessage && now - lastAt < 60_000) return;
  lastMessage = message;
  lastAt = now;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Ethan's Alarm Shortcuts sync",
      body: message,
      sound: false,
    },
    trigger: null,
  });
}
