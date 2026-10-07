/* ==========================================================================
   POCKETPE - PROFILE & SETTINGS CONTROLLER
   Integrated with Supabase Auth (Sign Up, Login, Logout, Profile edit, and User ID exposure)
   ========================================================================== */

import { stateManager } from '../state.js';
import { supabaseService } from '../services/supabaseService.js';
import { ThemeManager } from './theme.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';
import { OnboardingManager } from './onboarding.js';
import { SplitView } from './splitView.js';
import { AuthModal } from './authModal.js';
import { SupabaseConfigModal } from './supabaseConfigModal.js';
import { EditProfileModal } from './editProfileModal.js';

export class ProfileView {
  static init() {
    this.container = document.getElementById('view-profile');
    if (!this.container) return;

    this.render();

    // Listen to updates
    stateManager.subscribe('theme:changed', () => this.render());
    stateManager.subscribe('learned:updated', () => this.render());
    stateManager.subscribe('auth:changed', () => this.render());
  }

  static render() {
    if (!this.container) return;

    const state = stateManager.getState();
    const learnedEntries = Object.entries(state.learnedMerchants || {});
    const isAuth = state.user?.isAuthenticated;
    const user = state.user;
    const config = supabaseService.getConfig();

    // Generate Initials
    const initials = (user.name || 'User')
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0].toUpperCase())
      .slice(0, 2)
      .join('') || 'SK';

    this.container.innerHTML = `
      <div class="section-header">
        <h2 class="h2">Profile & Settings</h2>
      </div>

      <div class="profile-responsive-grid">
        <div class="profile-col-left">
          <!-- Supabase Auth / User Account Card -->
          ${isAuth ? `
            <div class="card" style="padding: 16px; margin-bottom: 16px; border: 1.5px solid var(--accent-primary); background: linear-gradient(135deg, var(--bg-surface) 0%, rgba(59, 130, 246, 0.05) 100%);">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div class="avatar" style="width: 52px; height: 52px; font-size: 1.3rem; background: var(--accent-gradient); color: #fff;">
                    ${initials}
                  </div>
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <h3 class="h3" style="font-size: var(--text-md); margin-bottom: 0;">${user.name}</h3>
                      <button class="btn btn-ghost" id="btn-open-edit-profile" title="Edit Profile Name" style="padding: 2px 6px; font-size: 0.75rem; width: auto;">
                        ✏️
                      </button>
                    </div>
                    <p class="subtitle" style="font-size: 0.78rem; margin: 2px 0;">${user.email || 'No email'}</p>
                    <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px;">
                      <span class="badge badge-success" style="font-size: 0.65rem;">● Supabase Auth (Active)</span>
                    </div>
                  </div>
                </div>

                <button class="btn btn-sm btn-ghost" id="btn-profile-logout" style="width: auto; font-size: 0.74rem; color: var(--danger); padding: 6px 10px;">
                  Log Out
                </button>
              </div>

              <!-- Exposed Supabase User ID container -->
              <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--border-subtle); display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div style="display: flex; flex-direction: column;">
                  <span style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">AUTHENTICATED SUPABASE USER.ID:</span>
                  <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-primary); word-break: break-all;">
                    ${user.id}
                  </span>
                </div>
                <button class="btn btn-ghost" id="btn-copy-user-id" title="Copy Supabase user.id" style="padding: 4px 8px; font-size: 0.75rem; width: auto; white-space: nowrap;">
                  📋 Copy
                </button>
              </div>
            </div>
          ` : `
            <div class="card" style="padding: 16px; margin-bottom: 16px; border: 1.5px solid var(--border-subtle); background: var(--bg-surface-secondary);">
              <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 12px;">
                <div class="avatar" style="width: 48px; height: 48px; font-size: 1.2rem; background: var(--bg-surface); border: 1.5px solid var(--border-subtle);">
                  🔐
                </div>
                <div>
                  <h3 class="h3" style="font-size: var(--text-sm); margin-bottom: 2px;">PocketPe Account</h3>
                  <p class="subtitle" style="font-size: 0.75rem;">Sign in with Supabase to sync your personal wallets & merchant preferences</p>
                </div>
              </div>

              <div style="display: flex; gap: 8px;">
                <button class="btn btn-primary" id="btn-profile-login" style="flex: 1; padding: 10px; font-size: var(--text-xs);">
                  Log In
                </button>
                <button class="btn btn-secondary" id="btn-profile-signup" style="flex: 1; padding: 10px; font-size: var(--text-xs);">
                  Sign Up
                </button>
              </div>
            </div>
          `}

          <!-- Simulated Bank Details -->
          <div class="card" style="display: flex; align-items: center; gap: 14px; padding: 14px 18px; margin-bottom: 16px;">
            <div style="font-size: 1.6rem;">🏦</div>
            <div style="flex: 1;">
              <h4 style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); margin-bottom: 2px;">
                ${user.simulatedBank}
              </h4>
              <p class="subtitle" style="font-size: 0.75rem;">Account: ${user.accountNumber} • Virtual Intent Layer Active</p>
            </div>
            <span class="badge badge-success" style="font-size: 0.65rem;">● Linked</span>
          </div>

          <!-- Supabase Connection & Credentials Settings -->
          <div class="settings-section-card">
            <h4 style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">Supabase Connection</h4>

            <div class="settings-row">
              <div class="settings-meta">
                <h4>Backend Project</h4>
                <p style="font-family: var(--font-mono); font-size: 0.72rem; word-break: break-all;">
                  ${config.url || 'Not set'}
                </p>
              </div>
              <span class="badge ${config.isConfigured ? 'badge-success' : 'badge-caution'}" style="font-size: 0.65rem;">
                ${config.isConfigured ? '● Connected' : '● Needs Setup'}
              </span>
            </div>

            <div class="settings-row" id="row-open-supabase-config" style="cursor: pointer;">
              <div class="settings-meta">
                <h4>Configure Supabase Credentials</h4>
                <p>Update Project URL and Anon Public Key</p>
              </div>
              <span style="color: var(--accent-primary); font-size: 1.1rem;">⚙️</span>
            </div>
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
            <h4 style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">Rules & Management</h4>

            <div class="settings-row" id="row-open-splits" style="cursor: pointer;">
              <div class="settings-meta">
                <h4>Automatic Money Splitting</h4>
                <p>Configure percentage rules for incoming funds</p>
              </div>
              <span style="color: var(--accent-primary); font-size: 1.1rem;">→</span>
            </div>

            <div class="settings-row">
              <div class="settings-meta">
                <h4>Learned Merchant Overrides (${learnedEntries.length})</h4>
                <p>Merchants you taught PocketPe to remember</p>
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

          <!-- Quick Tour & Reset -->
          <div class="settings-section-card">
            <h4 style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">Tour & Testing</h4>

            <div class="settings-row" id="row-replay-tour" style="cursor: pointer;">
              <div class="settings-meta">
                <h4>Replay App Onboarding Tour</h4>
                <p>Review the core 5 principles of PocketPe</p>
              </div>
              <span style="color: var(--accent-primary); font-size: 1.1rem;">✨</span>
            </div>

            <div class="settings-row">
              <div class="settings-meta">
                <h4>Reset Demo Data</h4>
                <p>Restore original wallets, balances, and history</p>
              </div>
              <button class="btn btn-sm btn-danger" id="btn-reset-state" style="width: auto;">Reset</button>
            </div>
          </div>

          <!-- FinTech Prototype Disclaimer -->
          <div class="disclaimer-card">
            <h5>🛡️ FinTech Prototype Notice</h5>
            <p>
              PocketPe is a conceptual product prototype. All bank accounts, UPI payments, and balances are simulated. Real email/password authentication is powered by Supabase.
            </p>
          </div>
        </div>
      </div>

      <div style="text-align: center; padding: 12px 0 24px; font-size: 0.72rem; color: var(--text-subtle);">
        PocketPe MVP v2.5.0 • Supabase Auth Integrated • «Every rupee has a purpose»
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
    const copyUidBtn = this.container.querySelector('#btn-copy-user-id');
    const supabaseConfigRow = this.container.querySelector('#row-open-supabase-config');

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

    if (copyUidBtn) {
      copyUidBtn.addEventListener('click', () => {
        const uid = stateManager.getUserId();
        navigator.clipboard?.writeText(uid);
        copyUidBtn.textContent = '✅ Copied!';
        setTimeout(() => {
          copyUidBtn.textContent = '📋 Copy';
        }, 2000);
        NavigationManager.showToast('Copied Supabase user.id', 'info');
      });
    }

    if (supabaseConfigRow) {
      supabaseConfigRow.addEventListener('click', () => {
        SupabaseConfigModal.open();
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to log out of PocketPe?')) {
          try {
            await supabaseService.signOut();
            stateManager.clearAuthUser();
            SoundEngine.playSuccess();
            NavigationManager.showToast('Logged out successfully', 'info');
            this.render();
          } catch (e) {
            console.error('Logout error:', e);
            stateManager.clearAuthUser();
            this.render();
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

    // Reset Demo Data
    const resetBtn = this.container.querySelector('#btn-reset-state');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset PocketPe to initial prototype demo state?')) {
          stateManager.resetToDemoData();
          SoundEngine.playSuccess();
          NavigationManager.showToast('✨ Reset to initial demo data', 'success');
          this.render();
        }
      });
    }
  }
}
