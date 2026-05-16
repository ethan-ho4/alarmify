# iOS alarm setup (Focus + Shortcuts)

Alarmify on iPhone does **not** play music by itself. It keeps **silent audio** running while an alarm is enabled, fires at the scheduled time, **stops silent audio** (so the app session ends), and saves a **Spotify link** (track, album, or playlist) for Shortcuts.

You configure **Focus** and **Shortcuts** outside Alarmify (one time).

## 1. Set your alarm in Alarmify

Choose time and music. Leave the alarm **enabled**.

## 2. Create a Focus for Alarmify

**Settings → Focus** → create or edit a Focus → add **Alarmify** under apps so Focus is on while you use Alarmify and off when you leave.

## 3. Shortcuts automation

**Shortcuts → Automation → + → Focus** → your Alarmify Focus → **Turns Off** → Add Action:

1. **Get Active Alarm Music Link** (Alarmify)
2. **Open URLs** (use the music link from step 1)

Turn off **Ask Before Running**.

## 4. Overnight

Do **not** force-quit Alarmify before the alarm. Silent audio keeps the app scheduled; when the alarm fires, audio stops, Focus turns off, and your automation should open Spotify.

## Test

Close Alarmify from the home screen (avoid force-quit in the app switcher). Confirm Focus turns off and Spotify opens with the correct music.

## Legacy Web API path (developers)

Set `EXPO_PUBLIC_ALARMIFY_LEGACY_IOS_PLAYBACK=1` to use in-app Spotify Web API playback instead of Focus + Shortcuts.
