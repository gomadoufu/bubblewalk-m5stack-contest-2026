import type { TriangleWeights } from './triangle-picker';

export type UserOpinion = {
  topicId: string;
  topicIdHash: number;
  topicVersion: number;
  opinionValue: number;
  triangleWeights?: TriangleWeights;
  triangleX?: number;
  triangleY?: number;
  updatedAt: string;
};

export function createOpinion(
  topicId: string,
  topicIdHash: number,
  topicVersion: number,
  opinionValue: number,
  now = new Date(),
  triangleWeights?: TriangleWeights,
  triangleX?: number,
  triangleY?: number,
): UserOpinion {
  return {
    topicId,
    topicIdHash,
    topicVersion,
    opinionValue: Math.max(0, Math.min(255, Math.round(opinionValue))),
    triangleWeights,
    triangleX,
    triangleY,
    updatedAt: now.toISOString(),
  };
}
