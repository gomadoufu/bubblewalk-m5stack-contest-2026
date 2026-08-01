import type { Histogram } from './histogram';

export type EncounterSample = {
  nodeId: number;
  opinionValue: number;
  binIndex: number;
  rssi: number;
  seq: number;
  seenAgeSeconds: number;
  triangleX?: number;
  triangleY?: number;
};

export type EncounterSampleLog = {
  topicIdHash: number;
  topicVersion: number;
  capacity: number;
  storedCount: number;
  totalSampleCount: number;
  flags: number;
  samples: EncounterSample[];
};

export function emptyEncounterSampleLog(histogram: Histogram): EncounterSampleLog {
  return {
    topicIdHash: histogram.topicIdHash,
    topicVersion: histogram.topicVersion,
    capacity: 0,
    storedCount: 0,
    totalSampleCount: 0,
    flags: 0,
    samples: [],
  };
}
