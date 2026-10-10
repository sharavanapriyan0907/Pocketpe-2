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
import { CommitmentModal } from './ui/commitmentModal.js';
import { FundingModal } from './ui/fundingModal.js';
import { UnitTests } from './tests/unitTests.js';
import { devModeService } from './services/devModeService.js';

class App {
  static init() {
    console.log('🚀 Initializing PocketPe: Purpose-Led Money App...');

    // Expose developer test runner in dev console for non-UI test execution
    window.UnitTests = UnitTests;

    const safeInit = (name, fn) => {
      try {
        fn();
      } catch (err) {
        console.error(`Error initializing ${name}:`, err);
      }
    };

    // 0. Initialize Developer Mode Service
    safeInit('devModeService', () => devModeService.init());

    // 1. Initialize Theme & Audio
    safeInit('ThemeManager', () => ThemeManager.init());

    // 2. Initialize Navigation
    safeInit('NavigationManager', () => NavigationManager.init());

    // 3. Initialize Tab Views
    safeInit('HomeView', () => HomeView.init());
    safeInit('WalletsView', () => WalletsView.init());
    safeInit('PayView', () => PayView.init());
    safeInit('ActivityView', () => ActivityView.init());
    safeInit('ProfileView', () => ProfileView.init());

    // 4. Initialize Modals
    safeInit('SplitView', () => SplitView.init());
    safeInit('ReceiveModal', () => ReceiveModal.init());
    safeInit('MoveModal', () => MoveModal.init());
    safeInit('OnboardingManager', () => OnboardingManager.init());
    safeInit('FraudModal', () => FraudModal.init());
    safeInit('CollectModal', () => CollectModal.init());
    safeInit('SplitBillView', () => SplitBillView.init());
    safeInit('AuthModal', () => AuthModal.init());
    safeInit('SupabaseConfigModal', () => SupabaseConfigModal.init());
    safeInit('EditProfileModal', () => EditProfileModal.init());
    safeInit('CommitmentModal', () => CommitmentModal.init());
    safeInit('FundingModal', () => FundingModal.init());

    // 5. Initialize Supabase Auth Session
    safeInit('initSupabaseAuth', () => this.initSupabaseAuth());

    // 6. Initialize Desktop Stage Controls
    safeInit('setupDesktopControls', () => this.setupDesktopControls());

    // 7. Run Automated Unit Tests on Startup if in Developer Mode
    if (devModeService.isDevMode()) {
      safeInit('UnitTests', () => UnitTests.runAll());
    }

    console.log('✨ PocketPe is ready. Every rupee has a purpose.');
  }

  static async initSupabaseAuth() {
    try {
      await supabaseService.init();

      // Check for OAuth error in URL callback parameters
      this.handleOAuthCallbackParams();

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
          const wasAuthed = stateManager.isUserAuthenticated();
          const prevId = stateManager.getUserId();

          stateManager.setAuthUser(session.user);
          await this.syncUserDataWithSupabase(session.user.id);

          // If freshly authenticated from Google OAuth or login
          if (!wasAuthed || prevId !== session.user.id) {
            const displayName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User';
            SoundEngine.playSuccess();
            NavigationManager.showToast(`✨ Welcome to PocketPe, ${displayName}!`, 'success', 3500);
          }
        } else if (event === 'SIGNED_OUT') {
          stateManager.clearAuthUser();
        }
        this.updateDesktopAuthUI();

        // Clean up hash fragments or code query params after OAuth processing
        if (window.location.search.includes('code=') || window.location.hash.includes('access_token=')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
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

  static handleOAuthCallbackParams() {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : window.location.hash;
      const hashParams = new URLSearchParams(hash);

      const errorMsg = searchParams.get('error_description') || hashParams.get('error_description') || searchParams.get('error') || hashParams.get('error');

      if (errorMsg) {
        console.warn('Google OAuth error returned:', errorMsg);
        SoundEngine.playAlert();
        NavigationManager.showToast(`Sign in notice: ${errorMsg}`, 'error', 4500);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (e) {
      console.warn('OAuth callback parameter inspection notice:', e);
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
    // Phone Simulator vs Laptop View toggle
    const toggleFrameBtn = document.getElementById('btn-toggle-device-frame');
    const phoneWrapper = document.querySelector('.phone-wrapper');
    if (toggleFrameBtn && phoneWrapper) {
      toggleFrameBtn.addEventListener('click', () => {
        phoneWrapper.classList.toggle('simulator-mode');
        const isSimulator = phoneWrapper.classList.contains('simulator-mode');
        toggleFrameBtn.classList.toggle('active', isSimulator);
        toggleFrameBtn.innerHTML = isSimulator
          ? '<span>💻</span> <span>Laptop View</span>'
          : '<span>📱</span> <span>Phone Simulator</span>';
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
  }
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    App.init();
  });
} else {
  App.init();
}
