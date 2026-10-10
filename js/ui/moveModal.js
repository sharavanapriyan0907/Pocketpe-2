/* ==========================================================================
   POCKETPE - MOVE MONEY (TRANSFER BETWEEN WALLETS) CONTROLLER
   Transfers money between virtual purpose wallets without altering the single underlying balance
   ========================================================================== */

import { stateManager } from '../state.js';
import { WalletEngine } from '../engines/walletEngine.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';

export class MoveModal {
  static init() {
    this.modal = document.getElementById('modal-move-money');
    this.amount = 300;
    this.fromWalletId = null;
    this.toWalletId = null;

    if (!this.modal) return;

    this.setupListeners();
  }

  static setupListeners() {
    const triggerBtn = document.getElementById('action-move-money');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => {
        this.open();
      });
    }
  }

  static open(defaultFromId = null, defaultToId = null) {
    const wallets = stateManager.getWallets();
    this.fromWalletId = defaultFromId || (wallets[2] ? wallets[2].id : wallets[0]?.id); // Default from Savings
    this.toWalletId = defaultToId || (wallets[0] ? wallets[0].id : wallets[1]?.id);     // Default to Food
    this.amount = 300;

    this.render();
    NavigationManager.openModal('modal-move-money');
  }

  static render() {
    if (!this.modal) return;
    const body = this.modal.querySelector('.sheet-body');
    const footer = this.modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    const wallets = stateManager.getWallets();
    const fromWallet = stateManager.getWallet(this.fromWalletId) || wallets[0];
    const toWallet = stateManager.getWallet(this.toWalletId) || wallets[1];

    const canMove = fromWallet.balance >= this.amount && this.amount > 0 && fromWallet.id !== toWallet.id;
    const fromRemaining = Math.max(fromWallet.balance - this.amount, 0);
    const toNewBalance = toWallet.balance + (canMove ? this.amount : 0);

    body.innerHTML = `
      <div style="text-align: center; margin-bottom: 4px;">
        <span class="badge badge-accent">Wallet Transfer</span>
        <h3 class="h3" style="color: var(--text-primary); margin-top: 4px;">Transfer Between Wallets</h3>
        <p class="subtitle">Move allocated money between purposes. Total account balance remains unaffected.</p>
      </div>

      <!-- Amount Input -->
      <div class="card" style="text-align: center; padding: 18px;">
        <div style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 600;">AMOUNT TO TRANSFER</div>
        <div class="amount-input-hero" style="padding: 10px 0;">
          <span class="amount-currency">₹</span>
          <input type="number" class="amount-hero-field" id="move-amount-input" value="${this.amount}" min="50" step="100" />
        </div>
        <div class="quick-amount-pills">
          <button class="pill-btn" data-move-add="100">+₹100</button>
          <button class="pill-btn" data-move-add="300">+₹300</button>
          <button class="pill-btn" data-move-add="500">+₹500</button>
          <button class="pill-btn" id="btn-move-max">Max</button>
        </div>
      </div>

      <!-- Visual Transfer Diagram -->
      <div class="move-money-diagram">
        <!-- From Wallet Picker -->
        <div class="wallet-select-box">
          <label>From (Source Purpose)</label>
          <select class="wallet-dropdown" id="select-from-wallet">
            ${wallets.map((w) => `
              <option value="${w.id}" ${w.id === fromWallet.id ? 'selected' : ''}>
                ${w.icon} ${w.name} (${WalletEngine.formatRupee(w.balance)})
              </option>
            `).join('')}
          </select>
          <div style="font-size: var(--text-xs); color: var(--text-muted); display: flex; justify-content: space-between;">
            <span>Current: ${WalletEngine.formatRupee(fromWallet.balance)}</span>
            <span style="color: ${fromRemaining < 0 ? 'var(--danger)' : 'var(--text-primary)'}; font-weight: 700;">
              After: ${WalletEngine.formatRupee(fromRemaining)}
            </span>
          </div>
        </div>

        <div class="transfer-middle-indicator">
          <span>↓</span>
          <span class="transfer-pill">Transferring ${WalletEngine.formatRupee(this.amount)}</span>
          <span>↓</span>
        </div>

        <!-- To Wallet Picker -->
        <div class="wallet-select-box">
          <label>To (Destination Purpose)</label>
          <select class="wallet-dropdown" id="select-to-wallet">
            ${wallets.map((w) => `
              <option value="${w.id}" ${w.id === toWallet.id ? 'selected' : ''}>
                ${w.icon} ${w.name} (${WalletEngine.formatRupee(w.balance)})
              </option>
            `).join('')}
          </select>
          <div style="font-size: var(--text-xs); color: var(--text-muted); display: flex; justify-content: space-between;">
            <span>Current: ${WalletEngine.formatRupee(toWallet.balance)}</span>
            <span style="color: var(--success); font-weight: 700;">
              After: ${WalletEngine.formatRupee(toNewBalance)}
            </span>
          </div>
        </div>
      </div>
    `;

    footer.innerHTML = `
      <button class="btn btn-primary" id="btn-confirm-move-money" ${!canMove ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}>
        Transfer ${WalletEngine.formatRupee(this.amount)} from ${fromWallet.name} to ${toWallet.name}
      </button>
      <button class="btn btn-ghost btn-sm" data-close-modal="modal-move-money">Cancel</button>
    `;

    // Bind amount input
    const input = body.querySelector('#move-amount-input');
    if (input) {
      input.addEventListener('input', (e) => {
        this.amount = Number(e.target.value) || 0;
        this.render();
      });
    }

    // Quick pills
    body.querySelectorAll('[data-move-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const add = Number(btn.getAttribute('data-move-add'));
        this.amount = add;
        SoundEngine.playTap();
        this.render();
      });
    });

    const maxBtn = body.querySelector('#btn-move-max');
    if (maxBtn) {
      maxBtn.addEventListener('click', () => {
        this.amount = fromWallet.balance;
        SoundEngine.playTap();
        this.render();
      });
    }

    // From Wallet dropdown
    const fromSelect = body.querySelector('#select-from-wallet');
    if (fromSelect) {
      fromSelect.addEventListener('change', (e) => {
        this.fromWalletId = e.target.value;
        this.render();
      });
    }

    // To Wallet dropdown
    const toSelect = body.querySelector('#select-to-wallet');
    if (toSelect) {
      toSelect.addEventListener('change', (e) => {
        this.toWalletId = e.target.value;
        this.render();
      });
    }

    // Execute Transfer
    const confirmBtn = footer.querySelector('#btn-confirm-move-money');
    if (confirmBtn && canMove) {
      confirmBtn.addEventListener('click', () => {
        const result = WalletEngine.moveMoney(this.fromWalletId, this.toWalletId, this.amount);
        if (result.success) {
          SoundEngine.playSuccess();
          NavigationManager.closeModal('modal-move-money');
          NavigationManager.showToast(`✨ ${result.message}`, 'success');
        } else {
          NavigationManager.showToast(result.message, 'danger');
        }
      });
    }
  }
}
