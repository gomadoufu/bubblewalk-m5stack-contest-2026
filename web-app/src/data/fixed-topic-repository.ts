import type { Topic } from '../domain/topic';
import { hexToRgb } from '../domain/rgb-color';

const FIXED_TOPICS: Topic[] = [
  {
    topicId: 'open-campus-activities-001',
    topicIdHash: 0x20260801,
    topicVersion: 2,
    shortTitle: 'Campus experience',
    title: 'What would you like to do at university?',
    selectionMode: 'triangle',
    choices: [
      { id: 'learn', label: 'Learn', value: 0, rgb: hexToRgb('#12cfee') },
      { id: 'create', label: 'Create', value: 128, rgb: hexToRgb('#b7f34b') },
      { id: 'connect', label: 'Connect', value: 255, rgb: hexToRgb('#ff4fa7') },
    ],
    leftLabel: 'Learn',
    rightLabel: 'Connect',
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
