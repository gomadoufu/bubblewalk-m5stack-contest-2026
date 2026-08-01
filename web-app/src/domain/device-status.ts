import type { RgbColor } from './rgb-color';
import type { HistogramBinCount } from './histogram';

export type DeviceStatus = {
  layoutVersion: number;
  payloadLength: number;
  firmwareMajor: number;
  firmwareMinor: number;
  firmwarePatch: number;
  protocolVersion: number;
  nodeId: number;
  roleFlags: number;
  topicIdHash: number;
  topicVersion: number;
  opinionValue: number;
  ledRgb: RgbColor;
  brightness: number;
  histogramBins: HistogramBinCount;
  sampleCount: number;
  advertisingSeq: number;
  lastError: number;
  uptimeMs: number;
  triangleX?: number;
  triangleY?: number;
  displayOpinionValue?: number;
};

export function firmwareVersionText(status: DeviceStatus): string {
  return `${status.firmwareMajor}.${status.firmwareMinor}.${status.firmwarePatch}`;
}

export type DisplayOpinionShift = {
  delta: number;
  absoluteDelta: number;
  percent: number;
  stepCount: number;
  direction: 'left' | 'right' | 'none';
};

export function displayOpinionShift(status: DeviceStatus): DisplayOpinionShift | null {
  if (status.displayOpinionValue === undefined) return null;
  const delta = status.displayOpinionValue - status.opinionValue;
  const absoluteDelta = Math.abs(delta);
  return {
    delta,
    absoluteDelta,
    percent: (absoluteDelta / 255) * 100,
    stepCount: absoluteDelta / 2.56,
    direction: delta < 0 ? 'left' : delta > 0 ? 'right' : 'none',
  };
}
