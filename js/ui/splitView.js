/* ==========================================================================
   POCKETPE - AUTOMATIC MONEY SPLITTING CONTROLLER
   "How should we split your money?"
   Enforces 100% total, live Rupee calculation, and slider adjustments
   ========================================================================== */

import { stateManager } from '../state.js';
import { WalletEngine } from '../engines/walletEngine.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';

export class SplitView {
  static init() {
    this.modal = document.getElementById('modal-split-rules');
    this.sampleAmount = 10000;
    this.splits = {};

    if (!this.modal) return;

    this.setupListeners();
  }

  static open() {
    this.loadCurrentSplits();
    this.render();
    NavigationManager.openModal('modal-split-rules');
  }

  static setupListeners() {
    // When modal opens, sync current wallet percentages
    const splitActionBtn = document.getElementById('action-split-rules');
    if (splitActionBtn) {
      splitActionBtn.addEventListener('click', () => {
        this.open();
      });
    }
  }

  static loadCurrentSplits() {
    const wallets = stateManager.getWallets();
    this.splits = {};
    wallets.forEach((w) => {
      this.splits[w.id] = Number(w.allocationPercentage) || 0;
    });
  }

  static render() {
    if (!this.modal) return;
    const body = this.modal.querySelector('.sheet-body');
    const footer = this.modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    const wallets = stateManager.getWallets();
    const totalPercentage = Object.values(this.splits).reduce((a, b) => a + b, 0);
    const isValid = totalPercentage === 100;
    const diff = 100 - totalPercentage;

    body.innerHTML = `
      <div style="text-align: center; margin-bottom: 6px;">
        <h3 class="h3" style="color: var(--text-primary);">How should we split your money?</h3>
        <p class="subtitle">Set rules for incoming funds. Every rupee has a purpose.</p>
      </div>

      <!-- Sample Incoming Amount Preview Pill -->
      <div class="card" style="padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <span style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 600;">SIMULATED INCOMING</span>
          <div style="font-size: var(--text-lg); font-weight: 800; color: var(--text-primary);">${WalletEngine.formatRupee(this.sampleAmount)}</div>
        </div>
        <div style="display: flex; gap: 4px;">
          <button class="pill-btn ${this.sampleAmount === 5000 ? 'active' : ''}" data-sample="5000">₹5k</button>
          <button class="pill-btn ${this.sampleAmount === 10000 ? 'active' : ''}" data-sample="10000">₹10k</button>
          <button class="pill-btn ${this.sampleAmount === 25000 ? 'active' : ''}" data-sample="25000">₹25k</button>
        </div>
      </div>

      <!-- 100% Status Bar -->
      <div class="split-status-bar ${isValid ? 'valid' : 'invalid'}">
        <span>
          ${isValid
            ? '✨ Split total is 100% (Balanced)'
            : diff > 0
            ? `⚠️ Your split is ${totalPercentage}%. Add ${diff}%.`
            : `⚠️ Your split is ${totalPercentage}%. Reduce ${Math.abs(diff)}%.`}
        </span>
        ${!isValid
          ? `<button class="btn btn-sm btn-secondary" id="btn-auto-balance" style="padding: 4px 10px; font-size: var(--text-xs); width: auto;">Auto-balance</button>`
          : '<span>👍 Ready</span>'}
      </div>

      <!-- Sliders List -->
      <div class="split-rules-card">
        ${wallets.map((wallet) => {
          const pct = this.splits[wallet.id] !== undefined ? this.splits[wallet.id] : 0;
          const calculatedRupees = Math.round((pct / 100) * this.sampleAmount);

          return `
            <div class="split-rule-row">
              <div class="split-row-top">
                <div class="split-wallet-info">
                  <span style="font-size: 1.25rem;">${wallet.icon || '💼'}</span>
                  <span style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">${wallet.name}</span>
                  ${wallet.isFreeMoney ? '<span class="badge badge-accent" style="font-size: 0.65rem;">Cushion</span>' : ''}
                </div>
                <div class="split-calculated-rupee">
                  ${WalletEngine.formatRupee(calculatedRupees)}
                </div>
              </div>

              <div class="split-slider-wrap">
                <input
                  type="range"
                  class="custom-range"
                  data-wallet-slider="${wallet.id}"
                  min="0"
                  max="100"
                  step="5"
                  value="${pct}"
                />
                <span class="split-pct-badge">${pct}%</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    footer.innerHTML = `
      <button class="btn btn-primary" id="btn-save-split-rules" ${!isValid ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}>
        Save Split Rules
      </button>
      <button class="btn btn-ghost btn-sm" data-close-modal="modal-split-rules">Cancel</button>
    `;

    // Bind slider inputs
    body.querySelectorAll('[data-wallet-slider]').forEach((slider) => {
      slider.addEventListener('input', (e) => {
        const walletId = slider.getAttribute('data-wallet-slider');
        this.splits[walletId] = Number(e.target.value);
        this.render();
      });
    });

    // Sample amount toggle
    body.querySelectorAll('[data-sample]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sampleAmount = Number(btn.getAttribute('data-sample'));
        SoundEngine.playTap();
        this.render();
      });
    });

    // Auto-balance button
    const autoBalanceBtn = body.querySelector('#btn-auto-balance');
    if (autoBalanceBtn) {
      autoBalanceBtn.addEventListener('click', () => {
        this.autoBalanceSplits();
        SoundEngine.playTap();
        this.render();
      });
    }

    // Save rules
    const saveBtn = footer.querySelector('#btn-save-split-rules');
    if (saveBtn && isValid) {
      saveBtn.addEventListener('click', () => {
        wallets.forEach((w) => {
          if (this.splits[w.id] !== undefined) {
            w.allocationPercentage = this.splits[w.id];
          }
        });
        stateManager.notify('splits:updated', this.splits);
        SoundEngine.playSuccess();
        NavigationManager.closeModal('modal-split-rules');
        NavigationManager.showToast('✅ Money split rules updated successfully!', 'success');
      });
    }
  }

  static autoBalanceSplits() {
    const wallets = stateManager.getWallets();
    const currentSum = Object.values(this.splits).reduce((a, b) => a + b, 0);
    const difference = 100 - currentSum;

    // Direct difference into Free Money if exists
    const freeWallet = stateManager.getFreeMoneyWallet();
    if (freeWallet) {
      const freeCurrent = this.splits[freeWallet.id] || 0;
      const newFree = freeCurrent + difference;
      if (newFree >= 0) {
        this.splits[freeWallet.id] = newFree;
        return;
      }
    }

    // Otherwise distribute evenly
    const count = wallets.length;
    const baseShare = Math.floor(100 / count);
    let remainder = 100 % count;

    wallets.forEach((w, idx) => {
      this.splits[w.id] = baseShare + (idx < remainder ? 1 : 0);
    });
  }
}
