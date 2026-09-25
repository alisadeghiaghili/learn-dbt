import { describe, expect, it } from 'vitest';
import { LOCALES, getCatalog, getDir, setLocale, ui } from '../src/i18n';

describe('i18n shell (learn-dvc parity)', () => {
  it('has en/de/fa catalogs', () => {
    expect(LOCALES).toEqual(['en', 'de', 'fa']);
    for (const loc of LOCALES) {
      setLocale(loc);
      expect(getCatalog().locale).toBe(loc);
      expect(ui().levels.length).toBeGreaterThan(0);
    }
  });

  it('fa is rtl', () => {
    setLocale('fa');
    expect(getDir()).toBe('rtl');
    setLocale('en');
  });
});
