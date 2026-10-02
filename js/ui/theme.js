/* ==========================================================================
   POCKETPE - THEME & ACCENT MANAGER
   Instant live theme switching, design token coordination, and persistence
   ========================================================================== */

import { APP_CONFIG } from '../config.js';
import { stateManager } from '../state.js';

export class ThemeManager {
  static init() {
    this.currentTheme = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.THEME) || APP_CONFIG.DEFAULT_THEME;
    this.currentAccent = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.ACCENT) || APP_CONFIG.DEFAULT_ACCENT;

    this.applyTheme(this.currentTheme, false);
    this.applyAccent(this.currentAccent, false);

    // Listen for OS system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      if (this.currentTheme === 'system') {
        this.applyEffectiveTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  static setTheme(themeName) {
    this.currentTheme = themeName;
    localStorage.setItem(APP_CONFIG.STORAGE_KEYS.THEME, themeName);
    this.applyTheme(themeName, true);
    stateManager.notify('theme:changed', { theme: themeName, accent: this.currentAccent });
  }

  static setAccent(accentName) {
    this.currentAccent = accentName;
    localStorage.setItem(APP_CONFIG.STORAGE_KEYS.ACCENT, accentName);
    this.applyAccent(accentName, true);
    stateManager.notify('theme:changed', { theme: this.currentTheme, accent: accentName });
  }

  static applyTheme(themeName, animate = false) {
    let effectiveTheme = themeName;
    if (themeName === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = prefersDark ? 'dark' : 'light';
    }
    this.applyEffectiveTheme(effectiveTheme);
    this.updateThemeControlsUI();
  }

  static applyEffectiveTheme(effectiveTheme) {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    const phoneFrame = document.querySelector('.phone-frame');
    if (phoneFrame) {
      phoneFrame.setAttribute('data-theme', effectiveTheme);
    }
  }

  static applyAccent(accentName, animate = false) {
    document.documentElement.setAttribute('data-accent', accentName);
    const phoneFrame = document.querySelector('.phone-frame');
    if (phoneFrame) {
      phoneFrame.setAttribute('data-accent', accentName);
    }
    this.updateAccentControlsUI();
  }

  static updateThemeControlsUI() {
    // Update theme pill buttons in Profile view and desktop bar
    const buttons = document.querySelectorAll('[data-theme-btn]');
    buttons.forEach((btn) => {
      const target = btn.getAttribute('data-theme-btn');
      if (target === this.currentTheme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  static updateAccentControlsUI() {
    // Update accent swatches in Profile view and desktop bar
    const swatches = document.querySelectorAll('[data-accent-swatch], .accent-dot');
    swatches.forEach((swatch) => {
      const color = swatch.getAttribute('data-accent-swatch') || swatch.getAttribute('data-color');
      if (color === this.currentAccent) {
        swatch.classList.add('active');
      } else {
        swatch.classList.remove('active');
      }
    });
  }
}
