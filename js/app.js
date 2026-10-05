/* ==========================================================================
   POCKETPE - MAIN APPLICATION BOOTSTRAP
   ========================================================================== */

import { stateManager } from './state.js';
import { ThemeManager } from './ui/theme.js';
import { SoundEngine } from './ui/sound.js';
import { NavigationManager } from './ui/navigation.js';
import { HomeView } from './ui/homeView.js';
import { WalletsView } from './ui/walletsView.js';
import { PayView } from './ui/payView.js';
import { ActivityView } from './ui/activityView.js';
import { ProfileView } from './ui/profileView.js';
import { SplitView } from './ui/splitView.js';
import { ReceiveModal } from './ui/receiveModal.js';
import { MoveModal } from './ui/moveModal.js';
import { OnboardingManager } from './ui/onboarding.js';
import { FraudModal } from './ui/fraudModal.js';
import { CollectModal } from './ui/collectModal.js';
import { SplitBillView } from './ui/splitBillView.js';
import { UnitTests } from './tests/unitTests.js';

class App {
  static init() {
    console.log('🚀 Initializing PocketPe: Purpose-Led Money App...');

    // 1. Initialize Theme & Audio
    ThemeManager.init();

    // 2. Initialize Navigation
    NavigationManager.init();

    // 3. Initialize Tab Views
    HomeView.init();
    WalletsView.init();
    PayView.init();
    ActivityView.init();
    ProfileView.init();

    // 4. Initialize Modals
    SplitView.init();
    ReceiveModal.init();
    MoveModal.init();
    OnboardingManager.init();
    FraudModal.init();
    CollectModal.init();
    SplitBillView.init();

    // 5. Initialize Desktop Stage Controls
    this.setupDesktopControls();

    // 6. Run Automated Unit Tests on Startup
    UnitTests.runAll();

    console.log('✨ PocketPe is ready. Every rupee has a purpose.');
  }

  static setupDesktopControls() {
    // Phone Frame / Fullscreen toggle
    const toggleFrameBtn = document.getElementById('btn-toggle-device-frame');
    const phoneWrapper = document.querySelector('.phone-wrapper');
    if (toggleFrameBtn && phoneWrapper) {
      toggleFrameBtn.addEventListener('click', () => {
        phoneWrapper.classList.toggle('fullscreen-mode');
        const isFull = phoneWrapper.classList.contains('fullscreen-mode');
        toggleFrameBtn.classList.toggle('active', isFull);
        toggleFrameBtn.innerHTML = isFull
          ? '<span>📱</span> <span>Phone Mode</span>'
          : '<span>🖥️</span> <span>Expand View</span>';
        SoundEngine.playTap();
      });
    }

    // Desktop Theme Switcher
    const desktopThemeBtn = document.getElementById('btn-desktop-theme-toggle');
    if (desktopThemeBtn) {
      desktopThemeBtn.addEventListener('click', () => {
        const nextTheme = ThemeManager.currentTheme === 'dark' ? 'light' : 'dark';
        ThemeManager.setTheme(nextTheme);
        desktopThemeBtn.innerHTML = nextTheme === 'dark' ? '<span>☀️</span>' : '<span>🌙</span>';
        SoundEngine.playTap();
      });
    }

    // Desktop Accents Dots
    document.querySelectorAll('.accent-dot').forEach((dot) => {
      dot.addEventListener('click', () => {
        const color = dot.getAttribute('data-color');
        ThemeManager.setAccent(color);
        SoundEngine.playTap();
      });
    });

    // Desktop Replay Tour
    const desktopTourBtn = document.getElementById('btn-desktop-tour');
    if (desktopTourBtn) {
      desktopTourBtn.addEventListener('click', () => {
        OnboardingManager.open();
      });
    }

    // Desktop Run Tests
    const desktopTestsBtn = document.getElementById('btn-desktop-tests');
    if (desktopTestsBtn) {
      desktopTestsBtn.addEventListener('click', () => {
        UnitTests.showTestResultsModal();
      });
    }

    // Desktop Reset Demo Data
    const desktopResetBtn = document.getElementById('btn-desktop-reset');
    if (desktopResetBtn) {
      desktopResetBtn.addEventListener('click', () => {
        if (confirm('Reset PocketPe prototype demo data back to default?')) {
          stateManager.resetToDemoData();
          SoundEngine.playSuccess();
          NavigationManager.showToast('Demo data reset to fresh state', 'success');
        }
      });
    }
  }
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
