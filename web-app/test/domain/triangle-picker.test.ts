import { describe, expect, it } from 'vitest';
import { activeTopic } from '../../src/data/fixed-topic-repository';
import {
  wheelPointFromWeights,
  wheelSelectionFromPoint,
  type TriangleWeights,
} from '../../src/domain/triangle-picker';

describe('color wheel triangle mapping', () => {
  const topic = activeTopic();

  it('maps the center to an even blend', () => {
    const selection = wheelSelectionFromPoint(topic, 0.5, 0.5);
    expect(selection.weights[0]).toBeCloseTo(1 / 3, 6);
    expect(selection.weights[1]).toBeCloseTo(1 / 3, 6);
    expect(selection.weights[2]).toBeCloseTo(1 / 3, 6);
  });

  it('maps the three labeled points to their choices', () => {
    expect(wheelSelectionFromPoint(topic, 0.5, 0.04).weights[1]).toBeCloseTo(1, 6);
    expect(wheelSelectionFromPoint(topic, 0.102, 0.73).weights[0]).toBeCloseTo(1, 2);
    expect(wheelSelectionFromPoint(topic, 0.898, 0.73).weights[2]).toBeCloseTo(1, 2);
  });

  it('round-trips mixed weights through a wheel point', () => {
    const weights: TriangleWeights = [0.2, 0.3, 0.5];
    const point = wheelPointFromWeights(weights);
    const selection = wheelSelectionFromPoint(topic, point.xPercent / 100, point.yPercent / 100);
    selection.weights.forEach((weight, index) => expect(weight).toBeCloseTo(weights[index], 6));
  });
});
