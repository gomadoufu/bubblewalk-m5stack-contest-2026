import { describe, expect, it } from 'vitest';
import {
  copyForLocale,
  localeFromLanguageTags,
  SUPPORTED_LOCALES,
} from '../src/localization';

describe('localization', () => {
  it('detects each supported browser language and falls back to English', () => {
    expect(localeFromLanguageTags(['ja-JP'])).toBe('ja');
    expect(localeFromLanguageTags(['zh-TW'])).toBe('zh-CN');
    expect(localeFromLanguageTags(['ko-KR'])).toBe('ko');
    expect(localeFromLanguageTags(['fr-FR', 'en-US'])).toBe('en');
    expect(localeFromLanguageTags(['fr-FR'])).toBe('en');
  });

  it('provides complete localized showcase topic labels', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const copy = copyForLocale(locale);
      const topic = copy.topics['open-campus-activities-001'];
      expect(copy.languageName).not.toBe('');
      expect(Object.keys(copy.languageOptions).sort()).toEqual([...SUPPORTED_LOCALES].sort());
      expect(copy.heroLineOne).not.toBe('');
      expect(copy.readResultsTitle).not.toBe('');
      expect(copy.readResultsDescription).not.toBe('');
      expect(copy.readResultsButton).not.toBe('');
      expect(copy.sendDescription).not.toContain('NanoH2');
      expect(topic.title).not.toBe('');
      expect(Object.keys(topic.choices).sort()).toEqual(['connect', 'create', 'learn']);
      expect(copy.remainingColors(2)).toContain('2');
    }

    const japaneseTopic = copyForLocale('ja').topics['open-campus-activities-001'];
    expect(copyForLocale('en').heroLineTwo).toBe('Meet people with different ideas.');
    expect(copyForLocale('ja').heroLineTwo).toBe('いろんな考えの人に出会おう。');
    expect(copyForLocale('zh-CN').heroLineTwo).toBe('去遇见想法各异的人吧。');
    expect(copyForLocale('ko').heroLineTwo).toBe('다양한 생각을 가진 사람들을 만나요.');
    expect(copyForLocale('en').languageOptions).toEqual({
      en: 'English', ja: 'Japanese', 'zh-CN': 'Simplified Chinese', ko: 'Korean',
    });
    expect(copyForLocale('ja').languageOptions).toEqual({
      en: '英語', ja: '日本語', 'zh-CN': '簡体字中国語', ko: '韓国語',
    });
    expect(copyForLocale('zh-CN').languageOptions).toEqual({
      en: '英语', ja: '日语', 'zh-CN': '简体中文', ko: '韩语',
    });
    expect(copyForLocale('ko').languageOptions).toEqual({
      en: '영어', ja: '일본어', 'zh-CN': '중국어', ko: '한국어',
    });
    expect(copyForLocale('ja').walkingTitle).toBe('あなたの色を持って、他のBubbleWalkと出会おう。');
    expect(japaneseTopic.title).toBe('大学で、力をいれて取りくみたいことは？');
    expect(japaneseTopic.choices).toEqual({
      learn: '教養や技術を学ぶ',
      create: 'ゲームや絵をつくる',
      connect: '友達とつながる',
    });
  });
});
