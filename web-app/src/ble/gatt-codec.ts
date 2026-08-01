import type { DeviceStatus } from '../domain/device-status';
import type { EncounterSampleLog } from '../domain/encounter-samples';
import type { Histogram } from '../domain/histogram';
import type { RgbColor } from '../domain/rgb-color';
import type { Topic } from '../domain/topic';
import type { UserOpinion } from '../domain/user-opinion';
import { colorForChoice } from '../domain/triangle-picker';

export type CommandId = 'reset_histogram' | 'exit_sync_window' | 'status_refresh_request';

const COMMAND_VALUE: Record<CommandId, number> = {
  reset_histogram: 0x01,
  exit_sync_window: 0x02,
  status_refresh_request: 0x03,
};

export function crc16CcittFalse(bytes: Uint8Array, endExclusive = bytes.length): number {
  let crc = 0xffff;
  for (let index = 0; index < endExclusive; index += 1) {
    crc ^= bytes[index] << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc;
}

export function encodeTopicConfig(topic: Topic): Uint8Array {
  const choiceColors = topicChoiceColors(topic);
  const payloadLength = choiceColors ? 32 : 20;
  const crcOffset = payloadLength - 2;
  const bytes = new Uint8Array(payloadLength);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, 1);
  view.setUint8(1, payloadLength);
  view.setUint32(2, topic.topicIdHash, true);
  view.setUint16(6, topic.topicVersion, true);
  writeRgb(view, 8, topic.leftRgb);
  writeRgb(view, 11, topic.rightRgb);
  view.setUint8(14, topic.brightness);
  view.setUint8(15, topic.histogramBins);
  view.setUint16(16, topic.retentionMinutes, true);
  if (choiceColors) {
    view.setUint8(18, selectionModeCode(topic.selectionMode));
    view.setUint8(19, 0);
    writeRgb(view, 20, choiceColors[0]);
    writeRgb(view, 23, choiceColors[1]);
    writeRgb(view, 26, choiceColors[2]);
    view.setUint8(29, 0);
  }
  view.setUint16(crcOffset, crc16CcittFalse(bytes, crcOffset), true);
  return bytes;
}

export function encodeOpinionValue(opinion: UserOpinion): Uint8Array {
  const bytes = new Uint8Array(12);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, 1);
  view.setUint32(1, opinion.topicIdHash, true);
  view.setUint16(5, opinion.topicVersion, true);
  view.setUint8(7, opinion.opinionValue);
  view.setUint8(8, opinion.triangleX ?? opinion.opinionValue);
  view.setUint8(9, opinion.triangleY ?? 128);
  view.setUint16(10, crc16CcittFalse(bytes, 10), true);
  return bytes;
}

export function encodeCommand(command: CommandId, argument = 0): Uint8Array {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, 1);
  view.setUint8(1, COMMAND_VALUE[command]);
  view.setUint16(2, argument, true);
  return bytes;
}

export function decodeDeviceStatus(view: DataView): DeviceStatus {
  requireLength(view, 29, 'device_status');
  const histogramBins = view.getUint8(19);
  if (histogramBins !== 8 && histogramBins !== 16) {
    throw new Error(`Unsupported histogram bin count: ${histogramBins}`);
  }
  return {
    layoutVersion: view.getUint8(0),
    payloadLength: view.getUint8(1),
    firmwareMajor: view.getUint8(2),
    firmwareMinor: view.getUint8(3),
    firmwarePatch: view.getUint8(4),
    protocolVersion: view.getUint8(5),
    nodeId: view.getUint8(6),
    roleFlags: view.getUint8(7),
    topicIdHash: view.getUint32(8, true),
    topicVersion: view.getUint16(12, true),
    opinionValue: view.getUint8(14),
    ledRgb: {
      r: view.getUint8(15),
      g: view.getUint8(16),
      b: view.getUint8(17),
    },
    brightness: view.getUint8(18),
    histogramBins,
    sampleCount: view.getUint16(20, true),
    advertisingSeq: view.getUint16(22, true),
    lastError: view.getUint8(24),
    uptimeMs: view.getUint32(25, true),
    triangleX: view.byteLength >= 31 ? view.getUint8(29) : undefined,
    triangleY: view.byteLength >= 31 ? view.getUint8(30) : undefined,
    displayOpinionValue: view.byteLength >= 32 ? view.getUint8(31) : undefined,
  };
}

export function decodeHistogram(view: DataView): Histogram {
  requireLength(view, 21, 'histogram');
  const binCount = view.getUint8(8);
  const counterWidth = view.getUint8(9);
  if (binCount !== 8 && binCount !== 16) {
    throw new Error(`Unsupported histogram bin count: ${binCount}`);
  }
  if (counterWidth !== 2) {
    throw new Error(`Unsupported histogram counter width: ${counterWidth}`);
  }
  requireLength(view, 21 + binCount * counterWidth, 'histogram');
  const bins = Array.from({ length: binCount }, (_, index) => view.getUint16(21 + index * 2, true));
  return {
    topicIdHash: view.getUint32(2, true),
    topicVersion: view.getUint16(6, true),
    binCount,
    counterWidth,
    sampleCount: view.getUint16(10, true),
    firstSeenMillis: view.getUint32(12, true),
    lastSeenMillis: view.getUint32(16, true),
    flags: view.getUint8(20),
    bins,
  };
}

export function decodeEncounterSamples(view: DataView): EncounterSampleLog {
  requireLength(view, 14, 'encounter_samples');
  const entrySize = view.getUint8(13);
  if (entrySize !== 8 && entrySize !== 10) {
    throw new Error(`Unsupported encounter sample entry width: ${entrySize}`);
  }
  const storedCount = view.getUint8(9);
  requireLength(view, 14 + storedCount * entrySize, 'encounter_samples');

  return {
    topicIdHash: view.getUint32(2, true),
    topicVersion: view.getUint16(6, true),
    capacity: view.getUint8(8),
    storedCount,
    totalSampleCount: view.getUint16(10, true),
    flags: view.getUint8(12),
    samples: Array.from({ length: storedCount }, (_, index) => {
      const offset = 14 + index * entrySize;
      return {
        nodeId: view.getUint8(offset),
        opinionValue: view.getUint8(offset + 1),
        binIndex: view.getUint8(offset + 2),
        rssi: view.getInt8(offset + 3),
        seq: view.getUint16(offset + 4, true),
        seenAgeSeconds: view.getUint16(offset + 6, true),
        triangleX: entrySize >= 10 ? view.getUint8(offset + 8) : undefined,
        triangleY: entrySize >= 10 ? view.getUint8(offset + 9) : undefined,
      };
    }),
  };
}

function writeRgb(view: DataView, offset: number, color: RgbColor): void {
  view.setUint8(offset, color.r);
  view.setUint8(offset + 1, color.g);
  view.setUint8(offset + 2, color.b);
}

function topicChoiceColors(topic: Topic): [RgbColor, RgbColor, RgbColor] | null {
  if (topic.selectionMode !== 'triangle' && topic.selectionMode !== 'choice3') return null;
  const choices = topic.choices ?? [];
  if (choices.length < 3) return null;
  return [
    colorForChoice(topic, choices[0]),
    colorForChoice(topic, choices[1]),
    colorForChoice(topic, choices[2]),
  ];
}

function selectionModeCode(selectionMode: Topic['selectionMode']): number {
  if (selectionMode === 'choice3') return 1;
  if (selectionMode === 'triangle') return 2;
  return 0;
}

function requireLength(view: DataView, expected: number, label: string): void {
  if (view.byteLength < expected) {
    throw new Error(`${label} payload is too short: ${view.byteLength} < ${expected}`);
  }
}
