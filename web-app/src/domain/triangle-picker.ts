import type { RgbColor } from './rgb-color';
import type { Topic, TopicChoice } from './topic';
import { mixColor } from './color-mixer';
import { clampByte } from './rgb-color';

export type TriangleWeights = [number, number, number];

export type TrianglePoint = {
  xPercent: number;
  yPercent: number;
};

export type TriangleBytePoint = {
  x: number;
  y: number;
};

export type TriangleSelection = {
  opinionValue: number;
  weights: TriangleWeights;
  point: TrianglePoint;
};

const TRIANGLE_VERTICES = [
  { x: 0.12, y: 0.88 },
  { x: 0.5, y: 0.08 },
  { x: 0.88, y: 0.88 },
] as const;

export function trianglePointFromWeights(weights: TriangleWeights): TrianglePoint {
  const normalized = normalizeTriangleWeights(weights);
  const x = TRIANGLE_VERTICES.reduce((sum, vertex, index) => sum + vertex.x * normalized[index], 0);
  const y = TRIANGLE_VERTICES.reduce((sum, vertex, index) => sum + vertex.y * normalized[index], 0);
  return {
    xPercent: x * 100,
    yPercent: y * 100,
  };
}

export function triangleBytePointFromWeights(weights: TriangleWeights): TriangleBytePoint {
  const point = trianglePointFromWeights(weights);
  return {
    x: clampByte((point.xPercent / 100) * 255),
    y: clampByte((point.yPercent / 100) * 255),
  };
}

export function trianglePointFromBytes(x: number, y: number): TrianglePoint {
  return {
    xPercent: (clampByte(x) / 255) * 100,
    yPercent: (clampByte(y) / 255) * 100,
  };
}

export function trianglePointForChoiceIndex(index: number): TrianglePoint {
  const vertex = TRIANGLE_VERTICES[Math.max(0, Math.min(2, index))];
  return {
    xPercent: vertex.x * 100,
    yPercent: vertex.y * 100,
  };
}

export function triangleSelectionFromPoint(topic: Topic, xRatio: number, yRatio: number): TriangleSelection {
  const choices = topic.choices ?? [];
  const weights = barycentricWeights(clampRatio(xRatio), clampRatio(yRatio));
  return triangleSelectionFromWeights(topic, weights, choices);
}

export function triangleWeightsForOpinion(topic: Topic, value: number): TriangleWeights {
  const choices = topic.choices ?? [];
  if (choices.length < 3) return [0, 1, 0];

  const clampedValue = clampByte(value);
  const left = choices[0].value;
  const middle = choices[1].value;
  const right = choices[2].value;

  if (clampedValue <= middle) {
    const span = Math.max(1, middle - left);
    const t = Math.max(0, Math.min(1, (clampedValue - left) / span));
    return [1 - t, t, 0];
  }

  const span = Math.max(1, right - middle);
  const t = Math.max(0, Math.min(1, (clampedValue - middle) / span));
  return [0, 1 - t, t];
}

export function triangleColorForWeights(topic: Topic, weights: TriangleWeights): RgbColor {
  const choices = topic.choices ?? [];
  if (choices.length < 3) return mixColor(topic.leftRgb, topic.rightRgb, opinionValueForWeights(topic, weights));

  const colors = choices.slice(0, 3).map((choice) => colorForChoice(topic, choice));
  const normalized = normalizeTriangleWeights(weights);
  return {
    r: clampByte(colors.reduce((sum, color, index) => sum + color.r * normalized[index], 0)),
    g: clampByte(colors.reduce((sum, color, index) => sum + color.g * normalized[index], 0)),
    b: clampByte(colors.reduce((sum, color, index) => sum + color.b * normalized[index], 0)),
  };
}

export function colorForChoice(topic: Topic, choice: TopicChoice): RgbColor {
  return choice.rgb ?? mixColor(topic.leftRgb, topic.rightRgb, choice.value);
}

export function normalizeTriangleWeights(weights: TriangleWeights): TriangleWeights {
  const positive = weights.map((weight) => Math.max(0, Number.isFinite(weight) ? weight : 0)) as TriangleWeights;
  const total = positive[0] + positive[1] + positive[2];
  if (total <= 0) return [0, 1, 0];
  return [positive[0] / total, positive[1] / total, positive[2] / total];
}

function triangleSelectionFromWeights(
  topic: Topic,
  weights: TriangleWeights,
  choices: TopicChoice[],
): TriangleSelection {
  const normalized = normalizeTriangleWeights(weights);
  return {
    opinionValue: choices.length >= 3 ? opinionValueForWeights(topic, normalized) : 128,
    weights: normalized,
    point: trianglePointFromWeights(normalized),
  };
}

function opinionValueForWeights(topic: Topic, weights: TriangleWeights): number {
  const choices = topic.choices ?? [];
  if (choices.length < 3) return 128;
  const value = choices.slice(0, 3).reduce((sum, choice, index) => sum + choice.value * weights[index], 0);
  return clampByte(value);
}

function barycentricWeights(x: number, y: number): TriangleWeights {
  const [a, b, c] = TRIANGLE_VERTICES;
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  const wa = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator;
  const wb = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator;
  const wc = 1 - wa - wb;
  return normalizeTriangleWeights([wa, wb, wc]);
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}
