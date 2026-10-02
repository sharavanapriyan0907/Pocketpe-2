/* ==========================================================================
   POCKETPE - RECEIVE MONEY & CASCADE ANIMATION CONTROLLER
   "Your money is ready." Animates incoming money flowing into purpose wallets.
   ========================================================================== */

import { stateManager } from '../state.js';
import { WalletEngine } from '../engines/walletEngine.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';

export class ReceiveModal {
  static init() {
    this.modal = document.getElementById('modal-receive-money');
    this.amount = 10000;
    this.source = 'Monthly Salary / Allowance';
    this.isCascading = false;

    if (!this.modal) return;

    this.renderForm();
  }

  static open() {
    this.isCascading = false;
    this.renderForm();
    NavigationManager.openModal('modal-receive-money');
  }

  static renderForm() {
    const body = this.modal.querySelector('.sheet-body');
    const footer = this.modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    this.isCascading = false;

    body.innerHTML = `
      <div style="text-align: center;">
        <span class="badge badge-accent">Demo Incoming Money</span>
        <h3 class="h3" style="margin-top: 4px; color: var(--text-primary);">Receive Money</h3>
        <p class="subtitle">Simulate incoming funds and watch them auto-split into your wallets.</p>
      </div>

      <div class="card" style="text-align: center; padding: 20px;">
        <div style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 600;">AMOUNT TO RECEIVE</div>
        <div class="amount-input-hero">
          <span class="amount-currency">₹</span>
          <input type="number" class="amount-hero-field" id="receive-amount-input" value="${this.amount}" min="500" step="500" />
        </div>
        <div class="quick-amount-pills">
          <button class="pill-btn ${this.amount === 2000 ? 'active' : ''}" data-amt="2000">₹2,000</button>
          <button class="pill-btn ${this.amount === 5000 ? 'active' : ''}" data-amt="5000">₹5,000</button>
          <button class="pill-btn ${this.amount === 10000 ? 'active' : ''}" data-amt="10000">₹10,000</button>
          <button class="pill-btn ${this.amount === 25000 ? 'active' : ''}" data-amt="25000">₹25,000</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Incoming Source</label>
        <select class="input-text" id="receive-source-select">
          <option value="Monthly Salary / Allowance" selected>Monthly Salary / Allowance</option>
          <option value="Freelance / Client Payment">Freelance / Client Payment</option>
          <option value="Gift from Family / Friends">Gift from Family / Friends</option>
          <option value="Refund / Cashback">Refund / Cashback</option>
        </select>
      </div>
    `;

    footer.innerHTML = `
      <button class="btn btn-primary" id="btn-trigger-cascade">
        Receive & Split ${WalletEngine.formatRupee(this.amount)} ✨
      </button>
      <button class="btn btn-ghost btn-sm" data-close-modal="modal-receive-money">Cancel</button>
    `;

    // Bind amount input
    const input = body.querySelector('#receive-amount-input');
    const triggerBtn = footer.querySelector('#btn-trigger-cascade');

    if (input) {
      input.addEventListener('input', (e) => {
        this.amount = Number(e.target.value) || 0;
        if (triggerBtn) triggerBtn.textContent = `Receive & Split ${WalletEngine.formatRupee(this.amount)} ✨`;
      });
    }

    // Amount pills
    body.querySelectorAll('[data-amt]').forEach((pill) => {
      pill.addEventListener('click', () => {
        this.amount = Number(pill.getAttribute('data-amt'));
        if (input) input.value = this.amount;
        if (triggerBtn) triggerBtn.textContent = `Receive & Split ${WalletEngine.formatRupee(this.amount)} ✨`;
        body.querySelectorAll('[data-amt]').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        SoundEngine.playTap();
      });
    });

    // Cascade action
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => {
        const sourceSelect = body.querySelector('#receive-source-select');
        this.source = sourceSelect ? sourceSelect.value : 'Monthly Salary';
        this.executeCascadeFlow();
      });
    }
  }

  static executeCascadeFlow() {
    if (this.amount <= 0) {
      NavigationManager.showToast('Please enter an amount greater than 0', 'warning');
      return;
    }

    this.isCascading = true;
    SoundEngine.playCascade();

    const body = this.modal.querySelector('.sheet-body');
    const footer = this.modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    // Run engine distribution
    const result = WalletEngine.distributeIncoming(this.amount);

    body.innerHTML = `
      <div class="cascade-container">
        <!-- Top Incoming Source Card -->
        <div class="incoming-source-card">
          <div style="font-size: var(--text-xs); opacity: 0.85; text-transform: uppercase; font-weight: 700;">Incoming Funds Ready</div>
          <div style="font-size: var(--text-3xl); font-weight: 800; letter-spacing: -0.02em;">
            ${WalletEngine.formatRupee(this.amount)}
          </div>
          <div style="font-size: var(--text-xs); opacity: 0.9; margin-top: 2px;">
            ${this.source}
          </div>
        </div>

        <div class="cascade-arrow-flow">
          <span>↓</span>
          <span style="font-size: var(--text-xs); font-weight: 700; text-transform: uppercase;">Auto-splitting to purposes</span>
          <span>↓</span>
        </div>

        <!-- Wallets Grid with Staggered Cascading Animation -->
        <div class="cascade-wallet-cards-grid">
          ${result.distributions.map((d, index) => `
            <div class="cascade-item-row" style="animation-delay: ${index * 0.08}s; border-left: 4px solid ${d.color || 'var(--accent-primary)'};">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.35rem;">${d.icon || '💼'}</span>
                <div>
                  <div style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">${d.walletName}</div>
                  <div style="font-size: var(--text-xs); color: var(--text-muted);">${d.percentage}% share • New balance: ${WalletEngine.formatRupee(d.newBalance)}</div>
                </div>
              </div>
              <div class="cascade-item-plus">
                +${WalletEngine.formatRupee(d.amount)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    footer.innerHTML = `
      <button class="btn btn-primary" id="btn-finish-cascade">
        Done, Everything Allocated! 👍
      </button>
    `;

    footer.querySelector('#btn-finish-cascade').addEventListener('click', () => {
      NavigationManager.closeModal('modal-receive-money');
      NavigationManager.showToast(`✨ Received & distributed ${WalletEngine.formatRupee(this.amount)} across wallets!`, 'success');
      this.renderForm();
    });
  }
}
