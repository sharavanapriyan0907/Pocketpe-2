/* ==========================================================================
   POCKETPE - DEVELOPER MODE SERVICE
   Provides strict separation between Normal User Mode (authentic UPI payment experience)
   and Developer / Debug Mode (unit tests, demo reset, Supabase DB config, etc.)
   ========================================================================== */

import { stateManager } from '../state.js';
import { NavigationManager } from '../ui/navigation.js';
import { SoundEngine } from '../ui/sound.js';

class DevModeService {
  constructor() {
    this.storageKey = 'pocketpe_dev_mode';
    this.active = false;
  }

  init() {
    // 1. Check URL parameters (?dev=true, ?dev=1, ?debug=true)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('dev') || urlParams.has('debug')) {
      const devVal = urlParams.get('dev') || urlParams.get('debug');
      this.active = devVal === 'true' || devVal === '1';
      localStorage.setItem(this.storageKey, this.active ? 'true' : 'false');
    } else {
      // 2. Check localStorage (default to false = Normal User Mode)
      const stored = localStorage.getItem(this.storageKey);
      this.active = stored === 'true';
    }

    this.applyModeToDOM();
    this.setupShortcuts();
    this.exposeGlobalApi();

    console.log(
      `🛡️ PocketPe Mode: ${this.active ? '🛠️ DEVELOPER MODE' : '📱 NORMAL USER MODE (Production UPI)'}`
    );
  }

  isDevMode() {
    return this.active;
  }

  setDevMode(enabled, showToast = true) {
    this.active = !!enabled;
    localStorage.setItem(this.storageKey, this.active ? 'true' : 'false');
    this.applyModeToDOM();

    stateManager.notify('devmode:changed', this.active);

    if (showToast) {
      if (this.active) {
        SoundEngine.playSuccess();
        NavigationManager.showToast('🛠️ Developer Mode Enabled (Test Controls Visible)', 'info');
      } else {
        SoundEngine.playTap();
        NavigationManager.showToast('🛡️ Normal User Mode Active (Real UPI Interface)', 'success');
      }
    }
  }

  toggle(showToast = true) {
    this.setDevMode(!this.active, showToast);
    return this.active;
  }

  applyModeToDOM() {
    if (this.active) {
      document.documentElement.setAttribute('data-dev-mode', 'true');
      document.body.classList.add('dev-mode-active');
    } else {
      document.documentElement.setAttribute('data-dev-mode', 'false');
      document.body.classList.remove('dev-mode-active');
    }

    // Toggle desktop header developer controls
    const devBadge = document.getElementById('badge-dev-mode');
    const testsBtn = document.getElementById('btn-desktop-tests');
    const resetBtn = document.getElementById('btn-desktop-reset');
    const tourBtn = document.getElementById('btn-desktop-tour');

    if (devBadge) {
      devBadge.style.display = this.active ? 'inline-flex' : 'none';
    }
    if (testsBtn) {
      testsBtn.style.display = this.active ? 'inline-flex' : 'none';
    }
    if (resetBtn) {
      resetBtn.style.display = this.active ? 'inline-flex' : 'none';
    }
    if (tourBtn) {
      tourBtn.style.display = this.active ? 'inline-flex' : 'none';
    }
  }

  setupShortcuts() {
    // Keyboard shortcut: Ctrl + Shift + D to toggle Developer Mode
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        this.toggle(true);
      }
    });
  }

  exposeGlobalApi() {
    // Expose convenient developer commands in browser console
    window.pocketpe = {
      isDevMode: () => this.isDevMode(),
      enableDevMode: () => this.setDevMode(true),
      disableDevMode: () => this.setDevMode(false),
      toggleDevMode: () => this.toggle(),
      runTests: () => {
        import('../tests/unitTests.js').then((m) => m.UnitTests.showTestResultsModal());
      },
      resetData: () => {
        stateManager.resetToCleanState();
        NavigationManager.showToast('Account data reset to fresh state', 'info');
      },
      getState: () => stateManager.getState(),
    };
  }
}

export const devModeService = new DevModeService();
