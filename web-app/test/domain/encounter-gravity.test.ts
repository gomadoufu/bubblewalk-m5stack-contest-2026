import { describe, expect, it } from 'vitest';
import type { EncounterSample } from '../../src/domain/encounter-samples';
import {
  distanceBandForRssi,
  gravityPointsForSamples,
  latestSamplesByDevice,
  rssiStrength,
} from '../../src/domain/encounter-gravity';

const sample = (nodeId: number, rssi: number, seq: number): EncounterSample => ({
  nodeId,
  opinionValue: 128,
  binIndex: 8,
  rssi,
  seq,
  seenAgeSeconds: 12,
});

describe('encounter gravity layout', () => {
  it('keeps only the latest sample for each device', () => {
    expect(latestSamplesByDevice([
      sample(1, -80, 1),
      sample(2, -60, 2),
      sample(1, -45, 3),
    ])).toEqual([sample(1, -45, 3), sample(2, -60, 2)]);
  });

  it('places a stronger encounter closer to the center and renders it larger', () => {
    const [far, near] = gravityPointsForSamples([
      sample(1, -85, 1),
      sample(2, -45, 2),
    ]);
    const radius = (point: typeof far) => Math.hypot(point.xPercent - 50, (point.yPercent - 50) / 0.72);

    expect(radius(near)).toBeLessThan(radius(far));
    expect(near.sizePx).toBeGreaterThan(far.sizePx);
    expect(near.strength).toBeGreaterThan(far.strength);
  });

  it('clamps RSSI strength and uses the firmware distance thresholds', () => {
    expect(rssiStrength(-120)).toBe(0);
    expect(rssiStrength(-20)).toBe(1);
    expect(distanceBandForRssi(-54)).toBe('near');
    expect(distanceBandForRssi(-55)).toBe('near');
    expect(distanceBandForRssi(-56)).toBe('middle');
    expect(distanceBandForRssi(-71)).toBe('far');
  });
});
