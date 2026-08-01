import type { EncounterSample } from './encounter-samples';

export type EncounterDistanceBand = 'near' | 'middle' | 'far';

export type EncounterGravityPoint = {
  sample: EncounterSample;
  xPercent: number;
  yPercent: number;
  sizePx: number;
  strength: number;
  opacity: number;
  distanceBand: EncounterDistanceBand;
};

const RSSI_FAR = -90;
const RSSI_NEAR = -40;

export function latestSamplesByDevice(samples: readonly EncounterSample[]): EncounterSample[] {
  const latest = new Map<number, EncounterSample>();
  samples.forEach((sample) => latest.set(sample.nodeId, sample));
  return [...latest.values()];
}

export function gravityPointsForSamples(samples: readonly EncounterSample[]): EncounterGravityPoint[] {
  return latestSamplesByDevice(samples).map((sample, index) => {
    const strength = rssiStrength(sample.rssi);
    const radius = 43 - strength * 27;
    const angle = ((sample.nodeId * 137.508 + index * 31 + sample.seq * 0.7) % 360) * Math.PI / 180;
    const ageFade = Math.min(0.28, sample.seenAgeSeconds / 3600 * 0.28);

    return {
      sample,
      xPercent: clamp(50 + Math.cos(angle) * radius, 7, 93),
      yPercent: clamp(50 + Math.sin(angle) * radius * 0.72, 10, 90),
      sizePx: Math.round(48 + strength * 42),
      strength,
      opacity: 1 - ageFade,
      distanceBand: distanceBandForRssi(sample.rssi),
    };
  });
}

export function rssiStrength(rssi: number): number {
  return clamp((rssi - RSSI_FAR) / (RSSI_NEAR - RSSI_FAR), 0, 1);
}

export function distanceBandForRssi(rssi: number): EncounterDistanceBand {
  if (rssi >= -55) return 'near';
  if (rssi >= -70) return 'middle';
  return 'far';
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
