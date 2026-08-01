import { describe, expect, it } from 'vitest';
import { emptyHistogram } from '../../src/domain/histogram';
import { decideHistogramPrivacy } from '../../src/domain/privacy-policy';
import { activeTopic } from '../../src/data/fixed-topic-repository';

describe('privacy policy', () => {
  it('redacts participant histogram below threshold', () => {
    const topic = activeTopic();
    const histogram = emptyHistogram(topic.topicIdHash, topic.topicVersion, topic.histogramBins);

    expect(decideHistogramPrivacy(topic, histogram)).toEqual({
      canShowBins: false,
      privacyApplied: true,
      binsRedacted: true,
    });
  });
});
