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
      expect(copy.heroLineOne).not.toBe('');
      expect(copy.readResultsTitle).not.toBe('');
      expect(copy.readResultsDescription).not.toBe('');
      expect(copy.readResultsButton).not.toBe('');
      expect(topic.title).not.toBe('');
      expect(Object.keys(topic.choices).sort()).toEqual(['connect', 'create', 'learn']);
      expect(copy.remainingColors(2)).toContain('2');
    }
  });
});
