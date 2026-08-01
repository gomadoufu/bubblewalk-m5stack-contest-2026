import { describe, expect, it } from 'vitest';
import { listTopics } from '../../src/data/fixed-topic-repository';
import { createOpinion } from '../../src/domain/user-opinion';
import { brightnessByteFromPercent } from '../../src/domain/topic-brightness';
import {
  crc16CcittFalse,
  decodeDeviceStatus,
  decodeEncounterSamples,
  decodeHistogram,
  encodeCommand,
  encodeOpinionValue,
  encodeTopicConfig,
} from '../../src/ble/gatt-codec';

describe('GattCodec', () => {
  it('uses CRC-16/CCITT-FALSE', () => {
    expect(crc16CcittFalse(new TextEncoder().encode('123456789'))).toBe(0x29b1);
  });

  it('encodes topic_config and opinion_value payloads', () => {
    const topic = listTopics()[0];
    const opinion = createOpinion(topic.topicId, topic.topicIdHash, topic.topicVersion, 128);

    expect(encodeTopicConfig(topic)).toHaveLength(32);
    expect(Array.from(encodeTopicConfig(topic).slice(8, 14))).toEqual([0x12, 0xcf, 0xee, 0xff, 0x4f, 0xa7]);
    expect(encodeTopicConfig({ ...topic, brightness: brightnessByteFromPercent(50) })[14]).toBe(128);
    expect(encodeTopicConfig(topic)[15]).toBe(16);
    expect(new DataView(encodeTopicConfig(topic).buffer).getUint16(16, true)).toBe(15);
    expect(encodeOpinionValue(opinion)).toHaveLength(12);
    expect(encodeCommand('reset_histogram')).toEqual(new Uint8Array([1, 1, 0, 0]));
  });

  it('encodes triangle topic_config with three choice colors', () => {
    const topic = listTopics().find((item) => item.selectionMode === 'triangle');
    expect(topic).toBeDefined();

    const payload = encodeTopicConfig(topic!);
    const view = new DataView(payload.buffer);

    expect(payload).toHaveLength(32);
    expect(payload[0]).toBe(1);
    expect(payload[1]).toBe(32);
    expect(payload[18]).toBe(2);
    expect(Array.from(payload.slice(20, 29))).toEqual([0x12, 0xcf, 0xee, 0xb7, 0xf3, 0x4b, 0xff, 0x4f, 0xa7]);
    expect(view.getUint16(30, true)).toBe(crc16CcittFalse(payload, 30));
  });

  it('decodes device_status without a hardware address', () => {
    const bytes = new Uint8Array(32);
    const view = new DataView(bytes.buffer);
    view.setUint8(0, 1);
    view.setUint8(1, 32);
    view.setUint8(2, 1);
    view.setUint8(3, 2);
    view.setUint8(4, 3);
    view.setUint8(5, 1);
    view.setUint8(6, 7);
    view.setUint8(7, 0b111);
    view.setUint32(8, 0x20260801, true);
    view.setUint16(12, 1, true);
    view.setUint8(14, 128);
    view.setUint8(15, 127);
    view.setUint8(16, 0);
    view.setUint8(17, 128);
    view.setUint8(18, 32);
    view.setUint8(19, 8);
    view.setUint16(20, 12, true);
    view.setUint16(22, 3, true);
    view.setUint8(24, 0);
    view.setUint32(25, 1200, true);
    view.setUint8(29, 92);
    view.setUint8(30, 144);
    view.setUint8(31, 133);
    expect(decodeDeviceStatus(view)).toMatchObject({
      payloadLength: 32,
      firmwareMajor: 1,
      firmwareMinor: 2,
      firmwarePatch: 3,
      nodeId: 7,
      opinionValue: 128,
      triangleX: 92,
      triangleY: 144,
      displayOpinionValue: 133,
      histogramBins: 8,
      sampleCount: 12,
    });
  });

  it('decodes legacy 31-byte device_status without display opinion value', () => {
    const bytes = new Uint8Array(31);
    const view = new DataView(bytes.buffer);
    view.setUint8(0, 1);
    view.setUint8(1, 31);
    view.setUint8(19, 16);

    expect(decodeDeviceStatus(view)).toMatchObject({
      payloadLength: 31,
      histogramBins: 16,
      displayOpinionValue: undefined,
    });
  });

  it('decodes histogram with 8 bins', () => {
    const bytes = new Uint8Array(37);
    const view = new DataView(bytes.buffer);
    view.setUint8(0, 1);
    view.setUint8(1, 37);
    view.setUint32(2, 0x20260801, true);
    view.setUint16(6, 1, true);
    view.setUint8(8, 8);
    view.setUint8(9, 2);
    view.setUint16(10, 3, true);
    view.setUint32(12, 100, true);
    view.setUint32(16, 200, true);
    view.setUint8(20, 0);
    [0, 1, 2, 0, 0, 0, 0, 0].forEach((value, index) => {
      view.setUint16(21 + index * 2, value, true);
    });

    expect(decodeHistogram(view)).toMatchObject({
      binCount: 8,
      sampleCount: 3,
      bins: [0, 1, 2, 0, 0, 0, 0, 0],
    });
  });

  it('decodes histogram with 16 bins', () => {
    const bytes = new Uint8Array(53);
    const view = new DataView(bytes.buffer);
    const bins = [0, 1, 2, 0, 3, 1, 4, 0, 2, 5, 2, 1, 0, 1, 0, 0];
    view.setUint8(0, 1);
    view.setUint8(1, 53);
    view.setUint32(2, 0x20260801, true);
    view.setUint16(6, 1, true);
    view.setUint8(8, 16);
    view.setUint8(9, 2);
    view.setUint16(10, 22, true);
    view.setUint32(12, 100, true);
    view.setUint32(16, 200, true);
    view.setUint8(20, 0);
    bins.forEach((value, index) => {
      view.setUint16(21 + index * 2, value, true);
    });

    expect(decodeHistogram(view)).toMatchObject({
      binCount: 16,
      sampleCount: 22,
      bins,
    });
  });

  it('decodes encounter samples', () => {
    const bytes = new Uint8Array(34);
    const view = new DataView(bytes.buffer);
    view.setUint8(0, 1);
    view.setUint8(1, 34);
    view.setUint32(2, 0x20260801, true);
    view.setUint16(6, 1, true);
    view.setUint8(8, 16);
    view.setUint8(9, 2);
    view.setUint16(10, 12, true);
    view.setUint8(12, 0);
    view.setUint8(13, 10);
    view.setUint8(14, 2);
    view.setUint8(15, 64);
    view.setUint8(16, 2);
    view.setInt8(17, -52);
    view.setUint16(18, 100, true);
    view.setUint16(20, 5, true);
    view.setUint8(22, 92);
    view.setUint8(23, 144);
    view.setUint8(24, 3);
    view.setUint8(25, 96);
    view.setUint8(26, 3);
    view.setInt8(27, -61);
    view.setUint16(28, 101, true);
    view.setUint16(30, 8, true);
    view.setUint8(32, 128);
    view.setUint8(33, 200);

    expect(decodeEncounterSamples(view)).toMatchObject({
      capacity: 16,
      storedCount: 2,
      totalSampleCount: 12,
      samples: [
        { nodeId: 2, opinionValue: 64, binIndex: 2, rssi: -52, seq: 100, seenAgeSeconds: 5, triangleX: 92, triangleY: 144 },
        { nodeId: 3, opinionValue: 96, binIndex: 3, rssi: -61, seq: 101, seenAgeSeconds: 8, triangleX: 128, triangleY: 200 },
      ],
    });
  });
});
