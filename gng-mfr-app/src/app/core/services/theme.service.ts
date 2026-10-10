import { Injectable, signal } from '@angular/core';

export type GngThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'gng-theme-mode';
const PRIMENG_THEME_LINK_ID = 'pn-theme-link';
const PRIMENG_THEME_PATH: Record<GngThemeMode, string> = {
  light: 'assets/themes/lara-light-indigo/theme.css',
  dark: 'assets/themes/lara-dark-indigo/theme.css',
};

/**
 * ThemeService — مد رنگی روشن/تاریک کل برنامه.
 *
 * دو کار هم‌زمان انجام می‌دهد:
 *  ۱) href استایل تم PrimeNG را بین نسخه‌ی روشن/تاریک سوییچ می‌کند
 *     (کامپوننت‌های PrimeNG کلاسیک رنگشان را از فایل CSS کامپایل‌شده می‌گیرند).
 *  ۲) اتریبیوت data-theme را روی <html> ست می‌کند تا متغیرهای رنگی خودمان
 *     در src/styles.scss (پالت GNG) هم بر همان اساس عوض شوند.
 *
 * انتخاب کاربر در localStorage ذخیره می‌شود؛ در نبود انتخاب قبلی، از
 * prefers-color-scheme سیستم پیروی می‌کند.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<GngThemeMode>(this.resolveInitialMode());

  constructor() {
    this.apply(this.mode());
  }

  toggle(): void {
    this.setMode(this.mode() === 'dark' ? 'light' : 'dark');
  }

  setMode(mode: GngThemeMode): void {
    this.mode.set(mode);
    this.apply(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage در دسترس نیست (مثلاً حالت خصوصی) — بی‌خیال ذخیره‌سازی می‌شویم
    }
  }

  private apply(mode: GngThemeMode): void {
    document.documentElement.setAttribute('data-theme', mode);

    const link = document.getElementById(PRIMENG_THEME_LINK_ID) as HTMLLinkElement | null;
    if (link) {
      link.href = PRIMENG_THEME_PATH[mode];
    }
  }

  private resolveInitialMode(): GngThemeMode {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch {
      // ادامه با تشخیص سیستم
    }

    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }
}
