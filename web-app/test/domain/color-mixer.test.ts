import { describe, expect, it } from 'vitest';
import { mixColor } from '../../src/domain/color-mixer';
import { hexToRgb, rgbToHex } from '../../src/domain/rgb-color';

describe('mixColor', () => {
  const left = hexToRgb('#ff0000');
  const right = hexToRgb('#0000ff');

  it.each([
    [0, '#ff0000'],
    [128, '#7f0080'],
    [236, '#1300ec'],
    [255, '#0000ff'],
  ])('matches firmware fixture for opinion %i', (value, expected) => {
    expect(rgbToHex(mixColor(left, right, value))).toBe(expected);
  });
});
