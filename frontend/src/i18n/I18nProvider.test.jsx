import { useLayoutEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import I18nProvider from './I18nProvider';
import { useI18n } from './I18nContext';
import { LANGUAGE_STORAGE_KEY } from './languages';

// Latest context value, captured after each render for the assertions below.
const latest = { current: null };
function Probe() {
  const value = useI18n();
  useLayoutEffect(() => {
    latest.current = value;
  });
  return <p>{value.t('catalog.title')}</p>;
}
const renderProvider = () => render(<I18nProvider><Probe /></I18nProvider>);
const i18n = new Proxy({}, { get: (_target, key) => latest.current[key] });

describe('I18nProvider', () => {
  it('starts in Hindi by default and marks the page as Hindi', () => {
    renderProvider();
    expect(i18n.lang).toBe('hi');
    expect(screen.getByText('नवीनतम रेट')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('hi');
  });

  it('switches language instantly and remembers it for the session', () => {
    renderProvider();
    act(() => i18n.setLang('en'));
    expect(screen.getByText('Latest prices')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(window.sessionStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });

  it('uses the remembered language on the next page load in the same session', () => {
    window.sessionStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    renderProvider();
    expect(i18n.lang).toBe('en');
  });

  it('ignores unknown stored or requested languages', () => {
    window.sessionStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    renderProvider();
    expect(i18n.lang).toBe('hi');
    act(() => i18n.setLang('xx'));
    expect(i18n.lang).toBe('hi');
  });

  it('picks the bilingual field for the current language and falls back to the other one', () => {
    renderProvider();
    expect(i18n.pick({ nameEn: 'Cement', nameHi: 'सीमेंट' }, 'name')).toBe('सीमेंट');
    expect(i18n.pick({ nameEn: 'Cement', nameHi: '  ' }, 'name')).toBe('Cement');
    expect(i18n.pick(null, 'name')).toBe('');
    act(() => i18n.setLang('en'));
    expect(i18n.pick({ nameEn: '', nameHi: 'रेत' }, 'name')).toBe('रेत');
  });

  it('formats dates in the current language', () => {
    renderProvider();
    expect(i18n.formatDate('2026-11-05T10:00:00Z')).toBe('05 नवंबर 2026');
    act(() => i18n.setLang('en'));
    expect(i18n.formatDate('2026-11-05T10:00:00Z')).toBe('05 November 2026');
  });

  it('still works when session storage is blocked', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      renderProvider();
      expect(i18n.lang).toBe('hi');
      act(() => i18n.setLang('en'));
      expect(i18n.lang).toBe('en');
    } finally {
      Object.defineProperty(window, 'sessionStorage', original);
    }
  });
});
