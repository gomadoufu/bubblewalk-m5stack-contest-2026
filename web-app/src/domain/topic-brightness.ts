export const MIN_TOPIC_BRIGHTNESS_PERCENT = 0;
export const MAX_TOPIC_BRIGHTNESS_PERCENT = 100;
export const MIN_TOPIC_BRIGHTNESS_BYTE = 0;
export const MAX_TOPIC_BRIGHTNESS_BYTE = 255;

export function brightnessByteFromPercent(percent: number): number {
  const clamped = clampTopicBrightnessPercent(percent);
  return Math.round((clamped / MAX_TOPIC_BRIGHTNESS_PERCENT) * MAX_TOPIC_BRIGHTNESS_BYTE);
}

export function brightnessPercentFromByte(byteValue: number): number {
  const clamped = clampTopicBrightnessByte(byteValue);
  return Math.round((clamped / MAX_TOPIC_BRIGHTNESS_BYTE) * MAX_TOPIC_BRIGHTNESS_PERCENT);
}

export function clampTopicBrightnessPercent(percent: number): number {
  if (!Number.isFinite(percent)) return MIN_TOPIC_BRIGHTNESS_PERCENT;
  return Math.max(MIN_TOPIC_BRIGHTNESS_PERCENT, Math.min(MAX_TOPIC_BRIGHTNESS_PERCENT, Math.round(percent)));
}

export function clampTopicBrightnessByte(byteValue: number): number {
  if (!Number.isFinite(byteValue)) return MIN_TOPIC_BRIGHTNESS_BYTE;
  return Math.max(MIN_TOPIC_BRIGHTNESS_BYTE, Math.min(MAX_TOPIC_BRIGHTNESS_BYTE, Math.round(byteValue)));
}
