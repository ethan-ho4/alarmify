import * as Brightness from 'expo-brightness';

/** Comfortable default when pre-bedtime level was not captured. */
export const BEDTIME_RESTORE_BRIGHTNESS = 0.55;

let savedBrightness: number | null = null;

export function getSavedBrightness(): number | null {
  return savedBrightness;
}

export async function saveAndDimForBedtime(): Promise<void> {
  try {
    const { status } = await Brightness.requestPermissionsAsync();
    if (status !== 'granted') return;
    savedBrightness = await Brightness.getBrightnessAsync();
    await Brightness.setBrightnessAsync(0);
  } catch {
    /* optional */
  }
}

export async function restoreIdealBrightness(): Promise<void> {
  try {
    const { status } = await Brightness.requestPermissionsAsync();
    if (status !== 'granted') return;
    const target = savedBrightness ?? BEDTIME_RESTORE_BRIGHTNESS;
    await Brightness.setBrightnessAsync(target);
    savedBrightness = null;
  } catch {
    /* optional */
  }
}
