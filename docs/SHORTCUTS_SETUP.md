# iOS alarm setup (Focus + Shortcuts)

Ethan's Alarm on iPhone does **not** play music by itself. It keeps **silent audio** running while an alarm is enabled, fires at the scheduled time, **stops silent audio** (so the app session ends), and saves a **Spotify link** (track, album, or playlist) for Shortcuts.

You configure **Focus** and **Shortcuts** outside Ethan's Alarm (one time).

## 1. Set your alarm in Ethan's Alarm

Choose time and music. Leave the alarm **enabled**.

## 2. Create a Focus for Ethan's Alarm

**Settings → Focus** → create or edit a Focus → add **Ethan's Alarm** under apps so Focus is on while you use Ethan's Alarm and off when you leave.

## 3. Shortcuts automation

**Shortcuts → Automation → + → Focus** → your Ethan's Alarm Focus → **Turns Off** → Add Action:

1. **Get Active Alarm Music Link** (Ethan's Alarm)
2. **Open URLs** (use the music link from step 1)

Turn off **Ask Before Running**.

## 4. Overnight

Do **not** force-quit Ethan's Alarm before the alarm. Silent audio keeps the app scheduled; when the alarm fires, Ethan's Alarm stops silent audio, tries the Spotify Web API, and Focus turns off so your automation can open Spotify. Either path may start playback.

## Test

Close Ethan's Alarm from the home screen (avoid force-quit in the app switcher). Confirm Focus turns off and Spotify opens with the correct music.

## Legacy Web API path (developers)

Set `EXPO_PUBLIC_ALARMIFY_LEGACY_IOS_PLAYBACK=1` to use in-app Spotify Web API playback instead of Focus + Shortcuts.
