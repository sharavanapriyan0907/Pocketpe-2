/* ==========================================================================
   POCKETPE - PROFILE & SETTINGS CONTROLLER
   Integrated with Supabase Auth, User Scoped State, and Developer Mode Separation
   ========================================================================== */

import { stateManager } from '../state.js';
import { supabaseService } from '../services/supabaseService.js';
import { devModeService } from '../services/devModeService.js';
import { ThemeManager } from './theme.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';
import { OnboardingManager } from './onboarding.js';
import { SplitView } from './splitView.js';
import { AuthModal } from './authModal.js';
import { SupabaseConfigModal } from './supabaseConfigModal.js';
import { EditProfileModal } from './editProfileModal.js';
import { FraudModal } from './fraudModal.js';
import { UnitTests } from '../tests/unitTests.js';

export class ProfileView {
  static clickVersionCount = 0;
  static clickVersionTimeout = null;

  static init() {
    this.container = document.getElementById('view-profile');
    if (!this.container) return;

    this.render();

    // Listen to updates
    stateManager.subscribe('theme:changed', () => this.render());
    stateManager.subscribe('learned:updated', () => this.render());
    stateManager.subscribe('auth:changed', () => this.render());
    stateManager.subscribe('devmode:changed', () => this.render());
  }

  static render() {
    if (!this.container) return;

    const state = stateManager.getState();
    const learnedEntries = Object.entries(state.learnedMerchants || {});
    const isAuth = state.user?.isAuthenticated;
    const user = state.user;
    const config = supabaseService.getConfig();
    const isDev = devModeService.isDevMode();

    // Generate Initials
    const initials = (user.name || 'User')
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0].toUpperCase())
      .slice(0, 2)
      .join('') || 'SK';

    // Primary UPI ID
    const upiHandle = (user.name || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'user';
    const upiId = `${upiHandle}@pocketpe`;

    // Bank display
    const rawBank = user.simulatedBank || 'HDFC Bank';
    const cleanBank = rawBank
      .replace('Simulated Account', 'Bank')
      .replace('Simulated Bank', 'HDFC Bank')
      .replace('Simulated', '')
      .trim();

    this.container.innerHTML = `
      <div class="section-header" style="display: flex; align-items: center; justify-content: flex-start; gap: 8px;">
        <button class="btn-header-back" data-back-nav aria-label="Return to Home">← Home</button>
        <h2 class="h2" style="margin: 0;">Profile & Settings</h2>
      </div>

      <div class="profile-responsive-grid">
        <div class="profile-col-left">
          <!-- User Account Card -->
          ${isAuth ? `
            <div class="card" style="padding: 16px; margin-bottom: 16px; border: 1.5px solid var(--accent-primary); background: linear-gradient(135deg, var(--bg-surface) 0%, rgba(59, 130, 246, 0.05) 100%);">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div class="avatar" style="width: 52px; height: 52px; font-size: 1.3rem; background: var(--accent-gradient); color: #fff; overflow: hidden; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-full);">
                    ${user.avatarUrl
                      ? `<img src="${user.avatarUrl}" alt="${user.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.parentElement.innerText='${initials}';" />`
                      : initials}
                  </div>
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <h3 class="h3" style="font-size: var(--text-md); margin-bottom: 0;">${user.name}</h3>
                      <button class="btn btn-ghost" id="btn-open-edit-profile" title="Edit Profile Name" style="padding: 2px 6px; font-size: 0.75rem; width: auto;">
                        ✏️
                      </button>
                    </div>
                    <p class="subtitle" style="font-size: 0.78rem; margin: 2px 0;">${user.email || 'Verified Account'}</p>
                    <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px; flex-wrap: wrap;">
                      <span class="badge badge-success" style="font-size: 0.65rem;">● PocketPe Verified</span>
                      ${user.provider === 'google' ? `
                        <span class="badge" style="background: rgba(66, 133, 244, 0.12); color: #4285F4; border: 1px solid rgba(66, 133, 244, 0.3); font-size: 0.62rem; display: inline-flex; align-items: center; gap: 4px;">
                          <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                          Google Account
                        </span>
                      ` : ''}
                    </div>
                  </div>
                </div>

                <button class="btn btn-sm btn-ghost" id="btn-profile-logout" style="width: auto; font-size: 0.74rem; color: var(--danger); padding: 6px 10px;">
                  Log Out
                </button>
              </div>

              <!-- Real UPI ID section -->
              <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--border-subtle); display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div style="display: flex; flex-direction: column;">
                  <span style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">PRIMARY UPI ID</span>
                  <span style="font-family: var(--font-mono); font-size: 0.78rem; font-weight: 700; color: var(--text-primary);">
                    ${upiId}
                  </span>
                </div>
                <button class="btn btn-ghost" id="btn-copy-upi-id" title="Copy PocketPe UPI ID" style="padding: 4px 10px; font-size: 0.75rem; width: auto; white-space: nowrap;">
                  📋 Copy UPI ID
                </button>
              </div>
            </div>
          ` : `
            <div class="card" style="padding: 16px; margin-bottom: 16px; border: 1.5px solid var(--border-subtle); background: var(--bg-surface-secondary);">
              <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 14px;">
                <div class="avatar" style="width: 48px; height: 48px; font-size: 1.2rem; background: var(--bg-surface); border: 1.5px solid var(--border-subtle);">
                  🔐
                </div>
                <div>
                  <h3 class="h3" style="font-size: var(--text-sm); margin-bottom: 2px;">PocketPe Account</h3>
                  <p class="subtitle" style="font-size: 0.75rem;">Sign in to sync your purpose wallets and spending rules securely</p>
                </div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px;">
                <!-- One-Click Google Sign-In Button -->
                <button type="button" class="btn-google" id="btn-profile-google" style="min-height: 42px; padding: 10px 14px; font-size: var(--text-xs);">
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span id="text-profile-google">Sign In with Google</span>
                </button>

                <div style="display: flex; gap: 8px;">
                  <button class="btn btn-primary" id="btn-profile-login" style="flex: 1; padding: 10px; font-size: var(--text-xs); min-height: 40px;">
                    Email Log In
                  </button>
                  <button class="btn btn-secondary" id="btn-profile-signup" style="flex: 1; padding: 10px; font-size: var(--text-xs); min-height: 40px;">
                    Sign Up
                  </button>
                </div>
              </div>
            </div>
          `}

          <!-- Linked Bank Details -->
          <div class="card" style="display: flex; align-items: center; gap: 14px; padding: 14px 18px; margin-bottom: 16px;">
            <div style="font-size: 1.6rem;">🏦</div>
            <div style="flex: 1;">
              <h4 style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); margin-bottom: 2px;">
                ${cleanBank}
              </h4>
              <p class="subtitle" style="font-size: 0.75rem;">Account: ${user.accountNumber || '•••• 4892'} • Primary UPI Account</p>
            </div>
            <span class="badge badge-success" style="font-size: 0.65rem;">● Linked</span>
          </div>
        </div>

        <div class="profile-col-right">
          <!-- Appearance Settings -->
          <div class="settings-section-card">
            <h4 style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">Appearance</h4>

            <div class="settings-row">
              <div class="settings-meta">
                <h4>Theme Mode</h4>
                <p>Select light, dark, or follow device</p>
              </div>
              <div class="theme-options-pills">
                <button class="theme-pill-btn" data-theme-btn="light">Light</button>
                <button class="theme-pill-btn" data-theme-btn="dark">Dark</button>
                <button class="theme-pill-btn" data-theme-btn="system">System</button>
              </div>
            </div>

            <div class="settings-row">
              <div class="settings-meta">
                <h4>Accent Color</h4>
                <p>Customize PocketPe brand tone</p>
              </div>
              <div class="palette-swatches">
                <span class="swatch" data-accent-swatch="blue" style="background: #3b82f6;" title="Blue"></span>
                <span class="swatch" data-accent-swatch="green" style="background: #10b981;" title="Green"></span>
                <span class="swatch" data-accent-swatch="purple" style="background: #8b5cf6;" title="Purple"></span>
                <span class="swatch" data-accent-swatch="orange" style="background: #f97316;" title="Orange"></span>
                <span class="swatch" data-accent-swatch="teal" style="background: #14b8a6;" title="Teal"></span>
              </div>
            </div>
          </div>

          <!-- Purpose & Rules Management -->
          <div class="settings-section-card">
            <h4 style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">Rules & Preferences</h4>

            <div class="settings-row" id="row-open-fraud-protection" style="cursor: pointer;">
              <div class="settings-meta">
                <h4>🛡️ Spam & Fraud Protection</h4>
                <p>Check UPI trust score, lookup handles, or report scams</p>
              </div>
              <span style="color: var(--accent-primary); font-size: 1.1rem;">→</span>
            </div>

            <div class="settings-row" id="row-open-splits" style="cursor: pointer;">
              <div class="settings-meta">
                <h4>Automatic Money Splitting</h4>
                <p>Configure percentage distribution for incoming funds</p>
              </div>
              <span style="color: var(--accent-primary); font-size: 1.1rem;">→</span>
            </div>

            <div class="settings-row">
              <div class="settings-meta">
                <h4>Learned Merchant Preferences (${learnedEntries.length})</h4>
                <p>Custom purpose assignments remembered for merchants</p>
              </div>
              ${learnedEntries.length > 0 ? `
                <button class="btn btn-sm btn-ghost" id="btn-clear-learned" style="width: auto; font-size: var(--text-xs);">
                  Clear
                </button>
              ` : '<span class="caption">None yet</span>'}
            </div>

            ${learnedEntries.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 6px; padding-left: 8px;">
                ${learnedEntries.map(([merchant, data]) => `
                  <div style="font-size: var(--text-xs); color: var(--text-secondary); display: flex; justify-content: space-between;">
                    <span>• <strong>${merchant}</strong></span>
                    <span class="badge badge-accent">${data.category}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <!-- Help & Walkthrough -->
          <div class="settings-section-card">
            <h4 style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">Help & Guide</h4>

            <div class="settings-row" id="row-replay-tour" style="cursor: pointer;">
              <div class="settings-meta">
                <h4>PocketPe Product Tour</h4>
                <p>Learn how purpose wallets and protection shields work</p>
              </div>
              <span style="color: var(--accent-primary); font-size: 1.1rem;">✨</span>
            </div>
          </div>

          <!-- Security & NPCI Compliance Badge -->
          <div class="disclaimer-card" style="background: var(--bg-surface); border: 1px solid var(--border-subtle);">
            <h5 style="color: var(--success); display: flex; align-items: center; gap: 6px;">
              <span>🛡️</span> Bank-Grade UPI Security
            </h5>
            <p style="color: var(--text-secondary); font-size: 0.75rem;">
              PocketPe adheres to NPCI UPI security standards. All payments are encrypted, authorized through device biometric/UPI PIN protocols, and monitored by the real-time community protection shield.
            </p>
          </div>
        </div>
      </div>

      <!-- Consumer Footer -->
      <div style="text-align: center; padding: 16px 0 24px; font-size: 0.74rem; color: var(--text-muted); user-select: none;">
        PocketPe • «Every rupee has a purpose»
      </div>
    `;

    this.bindEvents();
    ThemeManager.updateThemeControlsUI();
    ThemeManager.updateAccentControlsUI();
  }

  static bindEvents() {
    // Auth actions (Log In / Sign Up)
    const loginBtn = this.container.querySelector('#btn-profile-login');
    const signupBtn = this.container.querySelector('#btn-profile-signup');
    const logoutBtn = this.container.querySelector('#btn-profile-logout');
    const editProfileBtn = this.container.querySelector('#btn-open-edit-profile');
    const copyUpiBtn = this.container.querySelector('#btn-copy-upi-id');
    const copyUidBtn = this.container.querySelector('#btn-copy-user-id');
    const supabaseConfigRow = this.container.querySelector('#row-open-supabase-config');
    const devTestsBtn = this.container.querySelector('#btn-profile-run-tests');
    const disableDevBtn = this.container.querySelector('#btn-disable-dev-mode');
    const versionTrigger = this.container.querySelector('#profile-version-trigger');

    const googleBtn = this.container.querySelector('#btn-profile-google');

    if (googleBtn) {
      googleBtn.addEventListener('click', async () => {
        SoundEngine.playTap();
        if (!supabaseService.isConfigured()) {
          AuthModal.open('login');
          return;
        }
        const textSpan = this.container.querySelector('#text-profile-google');
        googleBtn.disabled = true;
        if (textSpan) textSpan.textContent = 'Redirecting to Google...';
        try {
          await supabaseService.signInWithGoogle();
        } catch (err) {
          console.error('Google Sign-in Error:', err);
          SoundEngine.playAlert();
          NavigationManager.showToast(err.message || 'Google sign-in error', 'error');
          googleBtn.disabled = false;
          if (textSpan) textSpan.textContent = 'Sign In with Google';
        }
      });
    }

    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        AuthModal.open('login');
      });
    }

    if (signupBtn) {
      signupBtn.addEventListener('click', () => {
        AuthModal.open('signup');
      });
    }

    if (editProfileBtn) {
      editProfileBtn.addEventListener('click', () => {
        EditProfileModal.open();
      });
    }

    // Copy UPI ID (normal user feature)
    if (copyUpiBtn) {
      copyUpiBtn.addEventListener('click', () => {
        const user = stateManager.getState().user;
        const upiHandle = (user.name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
        const upiId = `${upiHandle}@pocketpe`;
        navigator.clipboard?.writeText(upiId);
        copyUpiBtn.textContent = '✅ Copied!';
        setTimeout(() => {
          copyUpiBtn.textContent = '📋 Copy UPI ID';
        }, 2000);
        NavigationManager.showToast(`Copied UPI ID: ${upiId}`, 'info');
      });
    }



    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to log out of PocketPe?')) {
          try {
            await supabaseService.signOut();
            stateManager.clearAuthUser();
            NavigationManager.updateAuthStateUI(false);
            NavigationManager.switchTab('auth');
            SoundEngine.playSuccess();
            NavigationManager.showToast('Logged out successfully', 'info');
          } catch (e) {
            console.error('Logout error:', e);
            stateManager.clearAuthUser();
            NavigationManager.updateAuthStateUI(false);
            NavigationManager.switchTab('auth');
          }
        }
      });
    }

    // Theme switches
    this.container.querySelectorAll('[data-theme-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-theme-btn');
        ThemeManager.setTheme(theme);
        SoundEngine.playTap();
      });
    });

    // Accent switches
    this.container.querySelectorAll('[data-accent-swatch]').forEach((swatch) => {
      swatch.addEventListener('click', () => {
        const color = swatch.getAttribute('data-accent-swatch');
        ThemeManager.setAccent(color);
        SoundEngine.playTap();
      });
    });

    // Spam & Fraud Protection shortcut
    const fraudRow = this.container.querySelector('#row-open-fraud-protection');
    if (fraudRow) {
      fraudRow.addEventListener('click', () => {
        SoundEngine.playTap();
        FraudModal.openRiskDetailModal();
      });
    }

    // Open Splits shortcut
    const splitsRow = this.container.querySelector('#row-open-splits');
    if (splitsRow) {
      splitsRow.addEventListener('click', () => {
        SplitView.open();
      });
    }

    // Replay Tour
    const tourRow = this.container.querySelector('#row-replay-tour');
    if (tourRow) {
      tourRow.addEventListener('click', () => {
        OnboardingManager.open();
      });
    }

    // Clear Learned Merchants
    const clearLearnedBtn = this.container.querySelector('#btn-clear-learned');
    if (clearLearnedBtn) {
      clearLearnedBtn.addEventListener('click', () => {
        if (confirm('Clear all learned merchant categories?')) {
          stateManager.state.learnedMerchants = {};
          stateManager.notify('learned:updated');
          NavigationManager.showToast('Cleared learned merchant rules', 'info');
        }
      });
    }

  }
}
