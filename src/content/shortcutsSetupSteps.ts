export type ShortcutsSetupStep = {
  title: string;
  body: string;
};

export const SHORTCUTS_SETUP_STEPS: ShortcutsSetupStep[] = [
  {
    title: "1. Set your alarm in Ethan's Alarm",
    body:
      "Pick a time and a track, album, or playlist. Keep the alarm enabled. Ethan's Alarm runs silent audio overnight and saves the Spotify link for Shortcuts.",
  },
  {
    title: "2. Create a Focus for Ethan's Alarm",
    body:
      "Settings → Focus → + (or edit a Focus) → add Ethan's Alarm under Apps so the Focus turns on while you use Ethan's Alarm and off when you leave it. Name it something you will recognize (e.g. Ethan's Alarm).",
  },
  {
    title: '3. Create a Shortcuts automation',
    body:
      "Shortcuts → Automation → + → Focus → choose your Ethan's Alarm Focus → turns Off → Add Action → search Ethan's Alarm → Get Active Alarm Music Link → Add Open URLs and use that link → turn off Ask Before Running.",
  },
  {
    title: '4. Do not force-quit before the alarm',
    body:
      "Leave Ethan's Alarm running in the background (silent audio). If you force-quit before the alarm, Focus may already be off and the automation will not run when the alarm fires.",
  },
  {
    title: '5. Test once',
    body:
      "With an alarm enabled, close Ethan's Alarm (home swipe, do not force-quit from the app switcher if you can avoid it). Your Focus should turn off and the automation should open Spotify with the right music.",
  },
];

export const SHORTCUTS_SETUP_FOOTNOTE =
  "At alarm time Ethan's Alarm also tries the Spotify Web API while stopping silent audio (Focus turns off and your automation can open Spotify). Either path may start playback.";
