/* ==========================================================================
   POCKETPE - PROFILE & SETTINGS CONTROLLER
   ========================================================================== */

import { stateManager } from '../state.js';
import { ThemeManager } from './theme.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';
import { OnboardingManager } from './onboarding.js';
import { SplitView } from './splitView.js';

export class ProfileView {
  static init() {
    this.container = document.getElementById('view-profile');
    if (!this.container) return;

    this.render();

    // Listen to updates
    stateManager.subscribe('theme:changed', () => this.render());
    stateManager.subscribe('learned:updated', () => this.render());
  }

  static render() {
    if (!this.container) return;

    const state = stateManager.getState();
    const learnedEntries = Object.entries(state.learnedMerchants || {});

    this.container.innerHTML = `
      <div class="section-header">
        <h2 class="h2">Profile & Settings</h2>
      </div>

      <!-- User Card -->
      <div class="card" style="display: flex; align-items: center; gap: 14px; padding: 18px;">
        <div class="avatar" style="width: 52px; height: 52px; font-size: 1.3rem;">SK</div>
        <div>
          <h3 class="h3" style="font-size: var(--text-md);">${state.user.name}</h3>
          <p class="subtitle">${state.user.simulatedBank} (${state.user.accountNumber})</p>
          <span class="badge badge-success" style="margin-top: 4px;">● Simulated Bank Linked</span>
        </div>
      </div>

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
          PocketPe is a conceptual product prototype. All bank accounts, UPI payments, and balances are simulated. No real money or financial credentials are ever used or transmitted.
        </p>
      </div>

      <div style="text-align: center; padding: 12px 0 24px; font-size: 0.72rem; color: var(--text-subtle);">
        PocketPe MVP v2.4.0 • Built with «Every rupee has a purpose»
      </div>
    `;

    this.bindEvents();
    ThemeManager.updateThemeControlsUI();
    ThemeManager.updateAccentControlsUI();
  }

  static bindEvents() {
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
