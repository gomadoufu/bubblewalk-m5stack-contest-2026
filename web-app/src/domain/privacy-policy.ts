import type { Histogram } from './histogram';
import type { Topic } from './topic';

export type PrivacyDecision = {
  canShowBins: boolean;
  privacyApplied: boolean;
  binsRedacted: boolean;
};

export function decideHistogramPrivacy(topic: Topic, histogram: Histogram | null): PrivacyDecision {
  if (!histogram) {
    return { canShowBins: false, privacyApplied: true, binsRedacted: true };
  }
  if (histogram.topicIdHash !== topic.topicIdHash || histogram.topicVersion !== topic.topicVersion) {
    return { canShowBins: false, privacyApplied: true, binsRedacted: true };
  }
  const canShowBins = histogram.sampleCount >= topic.minDisplaySampleCount;
  return {
    canShowBins,
    privacyApplied: !canShowBins,
    binsRedacted: !canShowBins,
  };
}
