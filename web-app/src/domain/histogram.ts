export type HistogramBinCount = 8 | 16;

export type Histogram = {
  topicIdHash: number;
  topicVersion: number;
  binCount: HistogramBinCount;
  counterWidth: number;
  sampleCount: number;
  firstSeenMillis: number;
  lastSeenMillis: number;
  flags: number;
  bins: number[];
};

export function emptyHistogram(topicIdHash: number, topicVersion: number, binCount: HistogramBinCount): Histogram {
  return {
    topicIdHash,
    topicVersion,
    binCount,
    counterWidth: 2,
    sampleCount: 0,
    firstSeenMillis: 0,
    lastSeenMillis: 0,
    flags: 0,
    bins: Array.from({ length: binCount }, () => 0),
  };
}

export function sampleHistogram(topicIdHash: number, topicVersion: number, binCount: HistogramBinCount = 16): Histogram {
  const bins =
    binCount === 16
      ? [0, 1, 2, 0, 3, 1, 4, 0, 2, 5, 2, 1, 0, 1, 0, 0]
      : [1, 2, 4, 3, 5, 2, 1, 0];
  return {
    topicIdHash,
    topicVersion,
    binCount,
    counterWidth: 2,
    sampleCount: bins.reduce((sum, value) => sum + value, 0),
    firstSeenMillis: 12_000,
    lastSeenMillis: 290_000,
    flags: 0,
    bins,
  };
}
