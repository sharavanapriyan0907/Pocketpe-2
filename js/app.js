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
import { supabaseService } from './services/supabaseService.js';
import { AuthModal } from './ui/authModal.js';
import { SupabaseConfigModal } from './ui/supabaseConfigModal.js';
import { EditProfileModal } from './ui/editProfileModal.js';
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
    AuthModal.init();
    SupabaseConfigModal.init();
    EditProfileModal.init();

    // 5. Initialize Supabase Auth Session
    this.initSupabaseAuth();

    // 6. Initialize Desktop Stage Controls
    this.setupDesktopControls();

    // 7. Run Automated Unit Tests on Startup
    UnitTests.runAll();

    console.log('✨ PocketPe is ready. Every rupee has a purpose.');
  }

  static async initSupabaseAuth() {
    try {
      await supabaseService.init();

      // Check current session
      const user = await supabaseService.getUser();
      if (user) {
        stateManager.setAuthUser(user);
      }

      this.updateDesktopAuthUI();

      // Subscribe to Supabase auth events
      supabaseService.onAuthStateChange(async (event, session) => {
        console.log('🔄 Supabase Auth Event:', event);
        if (session?.user) {
          stateManager.setAuthUser(session.user);
          await this.syncUserDataWithSupabase(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          stateManager.clearAuthUser();
        }
        this.updateDesktopAuthUI();
      });

      stateManager.subscribe('auth:changed', async () => {
        this.updateDesktopAuthUI();
        const user = stateManager.getState().user;
        if (user?.isAuthenticated && user?.id) {
          await this.syncUserDataWithSupabase(user.id);
        }
      });

      // Hook transactions and wallet updates to Supabase cloud sync
      stateManager.subscribe('transaction:added', (tx) => {
        const user = stateManager.getState().user;
        if (user?.isAuthenticated && user?.id) {
          supabaseService.syncTransactionToCloud(user.id, tx);
          supabaseService.syncWalletsToCloud(user.id, stateManager.getWallets());
        }
      });

      stateManager.subscribe('wallet:updated', () => {
        const user = stateManager.getState().user;
        if (user?.isAuthenticated && user?.id) {
          supabaseService.syncWalletsToCloud(user.id, stateManager.getWallets());
        }
      });

      stateManager.subscribe('wallet:created', () => {
        const user = stateManager.getState().user;
        if (user?.isAuthenticated && user?.id) {
          supabaseService.syncWalletsToCloud(user.id, stateManager.getWallets());
        }
      });
    } catch (e) {
      console.warn('Supabase auth initialization check completed with notice:', e);
    }
  }

  static async syncUserDataWithSupabase(userId) {
    if (!supabaseService.isConfigured() || !userId) return;
    try {
      const cloudWallets = await supabaseService.fetchWalletsFromCloud(userId);
      if (cloudWallets && cloudWallets.length > 0) {
        stateManager.state.wallets = cloudWallets;
        stateManager.notify('state:changed');
      } else {
        await supabaseService.syncWalletsToCloud(userId, stateManager.getWallets());
      }
    } catch (e) {
      console.warn('Supabase sync notice:', e);
    }
  }

  static updateDesktopAuthUI() {
    const authBtn = document.getElementById('btn-desktop-auth');
    const authLabel = document.getElementById('label-desktop-auth');
    if (!authBtn || !authLabel) return;

    const state = stateManager.getState();
    if (state.user?.isAuthenticated) {
      const shortName = (state.user.name || 'Account').split(' ')[0];
      authBtn.classList.add('active');
      authBtn.innerHTML = `<span>👤</span> <span id="label-desktop-auth">${shortName}</span>`;
      authBtn.title = `Signed in as ${state.user.email} (ID: ${state.user.id})`;
    } else {
      authBtn.classList.remove('active');
      authBtn.innerHTML = `<span>🔐</span> <span id="label-desktop-auth">Sign In</span>`;
      authBtn.title = 'Sign in or create Supabase account';
    }
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

    // Desktop Supabase Auth / Account Button
    const desktopAuthBtn = document.getElementById('btn-desktop-auth');
    if (desktopAuthBtn) {
      desktopAuthBtn.addEventListener('click', () => {
        if (stateManager.isUserAuthenticated()) {
          NavigationManager.switchTab('profile');
        } else {
          AuthModal.open('login');
        }
        SoundEngine.playTap();
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
