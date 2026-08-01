import type { RgbColor } from './rgb-color';
import { clampByte } from './rgb-color';

export function mixChannel(left: number, right: number, value: number): number {
  const v = clampByte(value);
  return Math.floor((clampByte(left) * (255 - v) + clampByte(right) * v + 127) / 255);
}

export function mixColor(left: RgbColor, right: RgbColor, value: number): RgbColor {
  return {
    r: mixChannel(left.r, right.r, value),
    g: mixChannel(left.g, right.g, value),
    b: mixChannel(left.b, right.b, value),
  };
}
