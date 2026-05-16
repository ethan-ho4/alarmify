# iOS Shortcuts alarm setup

Alarmify on iPhone does **not** ring by itself. You configure the time and song in Alarmify; a **Personal Automation** in the Shortcuts app fires at that time and plays your track in Spotify.

## Steps

1. **Set your alarm in Alarmify** — time, song, and leave it enabled.
2. **Shortcuts → Automation → + → Personal Automation → Time of Day** — use the **same time** (and repeat days) as in Alarmify. Turn on **Run Immediately**.
3. **Add action: Get Active Alarm Music Link** (under Alarmify).
4. **Add action: Open URLs** — pass the Music Link from step 3.
5. **Test** — run the automation manually and confirm Spotify plays the correct track.

## When you change alarms

If you change the **time** in Alarmify, update the automation time in Shortcuts to match. Changing the **song** only requires saving in Alarmify (App Group syncs automatically).

## Limits

- Shortcuts is less reliable than the built-in Clock app.
- Requires a **development or production build** with the Alarmify Shortcuts module (not Expo Go).
- Playback usually opens the Spotify app on this phone.

## Legacy Web API path (developers)

Set `EXPO_PUBLIC_ALARMIFY_LEGACY_IOS_PLAYBACK=1` to restore the old keepalive + Spotify Web API alarm path on iOS.
