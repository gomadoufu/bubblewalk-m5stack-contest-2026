import { describe, expect, it } from 'vitest';
import type { BleCapability, BleClient, BleDevice, BleWriteOptions } from '../../src/ble/ble-client';
import { BubbleWalkGattRepository } from '../../src/ble/bubblewalk-gatt-repository';
import { BUBBLEWALK_GATT } from '../../src/ble/bubblewalk-uuids';
import { activeTopic } from '../../src/data/fixed-topic-repository';
import { createOpinion } from '../../src/domain/user-opinion';

class FakeBleClient implements BleClient {
  readonly requestedDevice: BleDevice = { id: 'requested-device', name: 'BW-requested' };
  readonly pairedDevice: BleDevice = { id: 'paired-device', name: 'BW-node05' };
  requested = false;
  connectedDevice: BleDevice | null = null;
  disconnectCount = 0;
  readCount = 0;
  readError: Error | null = null;
  writes: Array<{ characteristicUuid: string; options?: BleWriteOptions }> = [];

  capability(): BleCapability {
    return {
      available: true,
      reason: 'available',
      message: 'ok',
      canRememberDevices: true,
    };
  }

  async listPairedBubbleWalkDevices(): Promise<BleDevice[]> {
    return [this.pairedDevice];
  }

  async requestBubbleWalkDevice(): Promise<BleDevice> {
    this.requested = true;
    return this.requestedDevice;
  }

  async connect(device: BleDevice): Promise<void> {
    this.connectedDevice = device;
  }

  async readCharacteristic(characteristicUuid: string): Promise<DataView> {
    this.readCount += 1;
    if (this.readError) throw this.readError;
    if (characteristicUuid === BUBBLEWALK_GATT.deviceStatus) {
      return deviceStatusFixture();
    }
    if (characteristicUuid === BUBBLEWALK_GATT.histogram) {
      return histogramFixture();
    }
    throw new Error(`unexpected read: ${characteristicUuid}`);
  }

  async writeCharacteristic(
    characteristicUuid: string,
    _value: Uint8Array,
    options?: BleWriteOptions,
  ): Promise<void> {
    this.writes.push({ characteristicUuid, options });
    return undefined;
  }

  async disconnect(): Promise<void> {
    this.disconnectCount += 1;
  }
}

describe('BubbleWalkGattRepository', () => {
  it('writes the topic and opinion when connecting to a newly selected device', async () => {
    const client = new FakeBleClient();
    const repo = new BubbleWalkGattRepository(client);
    const topic = activeTopic();
    const opinion = createOpinion(topic.topicId, topic.topicIdHash, topic.topicVersion, 128);

    const result = await repo.syncTopicAndOpinion(topic, opinion);

    expect(client.requested).toBe(true);
    expect(client.connectedDevice).toEqual(client.requestedDevice);
    expect(result.device).toEqual(client.requestedDevice);
    expect(result.status).toBeNull();
    expect(client.readCount).toBe(0);
    expect(client.writes).toEqual([
      { characteristicUuid: BUBBLEWALK_GATT.topicConfig, options: { response: 'without', timeoutMs: 2000 } },
      { characteristicUuid: BUBBLEWALK_GATT.opinionValue, options: { response: 'without', timeoutMs: 2000 } },
    ]);
    expect(client.disconnectCount).toBe(1);
  });

  it('uses an already paired device without opening the picker', async () => {
    const client = new FakeBleClient();
    const repo = new BubbleWalkGattRepository(client);
    const topic = activeTopic();
    const opinion = createOpinion(topic.topicId, topic.topicIdHash, topic.topicVersion, 128);

    const result = await repo.syncTopicAndOpinion(topic, opinion, client.pairedDevice);

    expect(client.requested).toBe(false);
    expect(client.connectedDevice).toEqual(client.pairedDevice);
    expect(result.device).toEqual(client.pairedDevice);
    expect(result.status).toBeNull();
    expect(result.statusConfirmed).toBe(false);
    expect(client.readCount).toBe(0);
    expect(client.disconnectCount).toBe(1);
  });

  it('does not wait for device status confirmation during sync', async () => {
    const client = new FakeBleClient();
    client.readError = new Error(`ble_read_timeout:${BUBBLEWALK_GATT.deviceStatus}`);
    const repo = new BubbleWalkGattRepository(client);
    const topic = activeTopic();
    const opinion = createOpinion(topic.topicId, topic.topicIdHash, topic.topicVersion, 128);

    const result = await repo.syncTopicAndOpinion(topic, opinion, client.pairedDevice);

    expect(result.status).toBeNull();
    expect(result.statusConfirmed).toBe(false);
    expect(client.readCount).toBe(0);
    expect(client.writes).toEqual([
      { characteristicUuid: BUBBLEWALK_GATT.topicConfig, options: { response: 'without', timeoutMs: 2000 } },
      { characteristicUuid: BUBBLEWALK_GATT.opinionValue, options: { response: 'without', timeoutMs: 2000 } },
    ]);
    expect(client.disconnectCount).toBe(1);
  });

  it('falls back to requestDevice when no paired device is supplied', async () => {
    const client = new FakeBleClient();
    const repo = new BubbleWalkGattRepository(client);
    const result = await repo.readResult();

    expect(client.requested).toBe(true);
    expect(client.connectedDevice).toEqual(client.requestedDevice);
    expect(result.device).toEqual(client.requestedDevice);
    expect(result.histogram.sampleCount).toBe(0);
  });
});

function deviceStatusFixture(): DataView {
  const topic = activeTopic();
  const bytes = new Uint8Array(32);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, 1);
  view.setUint8(1, 32);
  view.setUint8(2, 0);
  view.setUint8(3, 3);
  view.setUint8(4, 7);
  view.setUint8(5, 2);
  view.setUint8(6, 5);
  view.setUint8(7, 0b111);
  view.setUint32(8, topic.topicIdHash, true);
  view.setUint16(12, topic.topicVersion, true);
  view.setUint8(14, 128);
  view.setUint8(15, 127);
  view.setUint8(16, 0);
  view.setUint8(17, 128);
  view.setUint8(18, topic.brightness);
  view.setUint8(19, topic.histogramBins);
  view.setUint16(20, 0, true);
  view.setUint16(22, 1, true);
  view.setUint8(24, 0);
  view.setUint32(25, 1000, true);
  view.setUint8(29, 128);
  view.setUint8(30, 128);
  view.setUint8(31, 128);
  return view;
}

function histogramFixture(): DataView {
  const topic = activeTopic();
  const bytes = new Uint8Array(21 + topic.histogramBins * 2);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, 1);
  view.setUint8(1, bytes.length);
  view.setUint32(2, topic.topicIdHash, true);
  view.setUint16(6, topic.topicVersion, true);
  view.setUint8(8, topic.histogramBins);
  view.setUint8(9, 2);
  view.setUint16(10, 0, true);
  return view;
}
