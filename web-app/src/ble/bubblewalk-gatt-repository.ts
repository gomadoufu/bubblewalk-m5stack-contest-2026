import type { BleClient, BleDevice } from './ble-client';
import type { DeviceStatus } from '../domain/device-status';
import type { EncounterSampleLog } from '../domain/encounter-samples';
import type { Histogram } from '../domain/histogram';
import type { Topic } from '../domain/topic';
import type { UserOpinion } from '../domain/user-opinion';
import { BUBBLEWALK_GATT } from './bubblewalk-uuids';
import {
  decodeEncounterSamples,
  decodeDeviceStatus,
  decodeHistogram,
  encodeCommand,
  encodeOpinionValue,
  encodeTopicConfig,
} from './gatt-codec';

export type SyncStage =
  | 'device_ready'
  | 'connect'
  | 'connected'
  | 'topic_written'
  | 'opinion_written'
  | 'settled'
  | 'disconnected';

export type SyncProgress = (stage: SyncStage, elapsedMs: number) => void;

const SYNC_WRITE_SETTLE_MS = 350;

export type SyncResult = {
  device: BleDevice;
  status: DeviceStatus | null;
  statusConfirmed: boolean;
};

export type ResultRead = {
  device: BleDevice;
  status: DeviceStatus;
  histogram: Histogram;
  encounterSamples: EncounterSampleLog | null;
};

export type ResetResult = {
  device: BleDevice;
};

export class BubbleWalkGattRepository {
  constructor(private readonly bleClient: BleClient) {}

  capability() {
    return this.bleClient.capability();
  }

  async listPairedDevices(): Promise<BleDevice[]> {
    return this.bleClient.listPairedBubbleWalkDevices(BUBBLEWALK_GATT.service);
  }

  async pairDevice(): Promise<BleDevice> {
    return this.bleClient.requestBubbleWalkDevice(BUBBLEWALK_GATT.service);
  }

  async syncTopicAndOpinion(
    topic: Topic,
    opinion: UserOpinion,
    device?: BleDevice,
    onProgress?: SyncProgress,
  ): Promise<SyncResult> {
    const startedAt = performance.now();
    const mark = (stage: SyncStage) => onProgress?.(stage, Math.round(performance.now() - startedAt));
    const targetDevice = device ?? (await this.bleClient.requestBubbleWalkDevice(BUBBLEWALK_GATT.service));
    mark('device_ready');
    try {
      mark('connect');
      await this.bleClient.connect(targetDevice, BUBBLEWALK_GATT.service);
      mark('connected');
      await this.bleClient.writeCharacteristic(BUBBLEWALK_GATT.topicConfig, encodeTopicConfig(topic), {
        response: 'without',
        timeoutMs: 2000,
      });
      mark('topic_written');
      await this.bleClient.writeCharacteristic(BUBBLEWALK_GATT.opinionValue, encodeOpinionValue(opinion), {
        response: 'without',
        timeoutMs: 2000,
      });
      mark('opinion_written');
      await delay(SYNC_WRITE_SETTLE_MS);
      mark('settled');
      return { device: targetDevice, status: null, statusConfirmed: false };
    } finally {
      await this.bleClient.disconnect().catch(() => undefined);
      mark('disconnected');
    }
  }

  async readResult(device?: BleDevice): Promise<ResultRead> {
    const targetDevice = device ?? (await this.bleClient.requestBubbleWalkDevice(BUBBLEWALK_GATT.service));
    try {
      await this.bleClient.connect(targetDevice, BUBBLEWALK_GATT.service);
      const status = decodeDeviceStatus(await this.bleClient.readCharacteristic(BUBBLEWALK_GATT.deviceStatus));
      const histogram = decodeHistogram(await this.bleClient.readCharacteristic(BUBBLEWALK_GATT.histogram));
      let encounterSamples: EncounterSampleLog | null = null;
      try {
        encounterSamples = decodeEncounterSamples(
          await this.bleClient.readCharacteristic(BUBBLEWALK_GATT.encounterSamples),
        );
      } catch {
        encounterSamples = null;
      }
      return { device: targetDevice, status, histogram, encounterSamples };
    } finally {
      await this.bleClient.disconnect().catch(() => undefined);
    }
  }

  async readHistogram(): Promise<Histogram> {
    return (await this.readResult()).histogram;
  }

  async resetHistogram(device?: BleDevice): Promise<ResetResult> {
    const targetDevice = device ?? (await this.bleClient.requestBubbleWalkDevice(BUBBLEWALK_GATT.service));
    try {
      await this.bleClient.connect(targetDevice, BUBBLEWALK_GATT.service);
      await this.bleClient.writeCharacteristic(BUBBLEWALK_GATT.command, encodeCommand('reset_histogram'));
      return { device: targetDevice };
    } finally {
      await this.bleClient.disconnect().catch(() => undefined);
    }
  }

}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}
