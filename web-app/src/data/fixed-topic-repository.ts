import type { Topic } from '../domain/topic';
import { hexToRgb } from '../domain/rgb-color';

const FIXED_TOPICS: Topic[] = [
  {
    topicId: 'open-campus-activities-001',
    topicIdHash: 0x20260801,
    topicVersion: 3,
    shortTitle: 'University focus',
    title: 'What would you like to focus on at university?',
    selectionMode: 'triangle',
    choices: [
      { id: 'learn', label: 'Learn knowledge or skills', value: 0, rgb: hexToRgb('#12cfee') },
      { id: 'create', label: 'Make games or art', value: 128, rgb: hexToRgb('#b7f34b') },
      { id: 'connect', label: 'Connect with friends', value: 255, rgb: hexToRgb('#ff4fa7') },
    ],
    leftLabel: 'Learn knowledge or skills',
    rightLabel: 'Connect with friends',
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
