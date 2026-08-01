import type { RgbColor } from './rgb-color';
import type { HistogramBinCount } from './histogram';

export type TopicSelectionMode = 'continuous' | 'choice3' | 'triangle';

export type TopicChoice = {
  id: string;
  label: string;
  value: number;
  rgb?: RgbColor;
};

export type Topic = {
  topicId: string;
  topicIdHash: number;
  topicVersion: number;
  title: string;
  shortTitle?: string;
  selectionMode?: TopicSelectionMode;
  choices?: TopicChoice[];
  leftLabel: string;
  rightLabel: string;
  leftRgb: RgbColor;
  rightRgb: RgbColor;
  histogramBins: HistogramBinCount;
  retentionMinutes: number;
  minDisplaySampleCount: number;
  brightness: number;
};
