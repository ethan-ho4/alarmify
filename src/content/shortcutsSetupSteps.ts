export type ShortcutsSetupStep = {
  title: string;
  body: string;
};

export const SHORTCUTS_SETUP_STEPS: ShortcutsSetupStep[] = [
  {
    title: '1. Set your alarm in Alarmify',
    body:
      'Choose the time and song here. Keep the alarm enabled. Alarmify saves the Spotify link for Shortcuts — it does not ring by itself on iOS.',
  },
  {
    title: '2. Create a Personal Automation in Shortcuts',
    body:
      'Open Shortcuts → Automation → + → Personal Automation → Time of Day. Set the same time as your Alarmify alarm (and the same days if you repeat). Choose "Run Immediately".',
  },
  {
    title: '3. Add "Get Active Alarm Music Link"',
    body:
      'Search for Alarmify → tap "Get Active Alarm Music Link". This reads the song you configured without opening Alarmify.',
  },
  {
    title: '4. Add "Open URLs"',
    body:
      'Add Open URLs and pass the Music Link from the previous step. Spotify should open and start playback on this phone.',
  },
  {
    title: '5. Test before you rely on it',
    body:
      'Run the automation once manually (play button on the automation). Confirm Spotify plays the right track. iOS Shortcuts is less reliable than the Clock app — keep your automation time in sync when you change alarms.',
  },
];

export const SHORTCUTS_SETUP_FOOTNOTE =
  'If you change the alarm time in Alarmify, update the automation time in Shortcuts to match.';
