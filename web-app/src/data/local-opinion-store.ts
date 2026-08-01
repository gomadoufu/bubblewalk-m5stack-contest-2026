import type { UserOpinion } from '../domain/user-opinion';

const STORAGE_PREFIX = 'bubblewalk/opinions/';

export type OpinionStore = {
  load(topicId: string): UserOpinion | null;
  save(opinion: UserOpinion): void;
};

export class LocalOpinionStore implements OpinionStore {
  load(topicId: string): UserOpinion | null {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${topicId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserOpinion;
    } catch {
      return null;
    }
  }

  save(opinion: UserOpinion): void {
    window.localStorage.setItem(`${STORAGE_PREFIX}${opinion.topicId}`, JSON.stringify(opinion));
  }
}
