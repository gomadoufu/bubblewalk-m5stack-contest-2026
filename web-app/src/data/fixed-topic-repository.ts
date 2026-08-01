import type { Topic } from '../domain/topic';
import { hexToRgb } from '../domain/rgb-color';

const FIXED_TOPICS: Topic[] = [
  {
    topicId: 'showcase-project-spark-001',
    topicIdHash: 0x20260801,
    topicVersion: 1,
    shortTitle: 'Project spark',
    title: 'What gives a project its spark?',
    selectionMode: 'triangle',
    choices: [
      { id: 'useful', label: 'Useful', value: 0, rgb: hexToRgb('#12cfee') },
      { id: 'playful', label: 'Playful', value: 128, rgb: hexToRgb('#b7f34b') },
      { id: 'surprising', label: 'Surprising', value: 255, rgb: hexToRgb('#ff4fa7') },
    ],
    leftLabel: 'Useful',
    rightLabel: 'Surprising',
    leftRgb: hexToRgb('#12cfee'),
    rightRgb: hexToRgb('#ff4fa7'),
    histogramBins: 16,
    retentionMinutes: 15,
    minDisplaySampleCount: 3,
    brightness: 32,
  },
];

export function listTopics(): Topic[] {
  return FIXED_TOPICS;
}

export function activeTopic(): Topic {
  return FIXED_TOPICS[0];
}
