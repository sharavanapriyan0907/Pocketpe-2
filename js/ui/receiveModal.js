/* ==========================================================================
   POCKETPE - RECEIVE MONEY & MY UPI QR CONTROLLER
   Authentic UPI Receive screen:
   1. "My UPI QR" with scannable QR code, UPI ID, copy button, and linked bank
   2. "Deposit / Auto-Split" funds into purpose wallets with cascade animation
   ========================================================================== */

import { stateManager } from '../state.js';
import { WalletEngine } from '../engines/walletEngine.js';
import { devModeService } from '../services/devModeService.js';
import { QrGenerator } from '../services/qrGenerator.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';

export class ReceiveModal {
  static init() {
    this.modal = document.getElementById('modal-receive-money');
    this.activeTab = 'qr'; // 'qr' or 'deposit'
    this.amount = 10000;
    this.source = 'Monthly Salary / Allowance';
    this.isCascading = false;

    if (!this.modal) return;

    this.render();
  }

  static open(tab = 'qr') {
    this.activeTab = tab;
    this.isCascading = false;
    this.render();
    NavigationManager.openModal('modal-receive-money');
  }

  static render() {
    if (!this.modal) return;
    const body = this.modal.querySelector('.sheet-body');
    const footer = this.modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    const state = stateManager.getState();
    const user = state.user || { name: 'Alex Kumar' };
    const upiHandle = (user.name || 'alex.kumar').toLowerCase().replace(/[^a-z0-9]/g, '.');
    const upiId = `${upiHandle}@pocketpe`;
    const isDev = devModeService.isDevMode();

    if (this.isCascading) {
      return; // Handled in executeCascadeFlow
    }

    body.innerHTML = `
      <!-- Tab Navigation -->
      <div style="display: flex; background: var(--bg-surface); padding: 4px; border-radius: 12px; margin-bottom: 16px; border: 1px solid var(--border-subtle);">
        <button class="btn btn-sm ${this.activeTab === 'qr' ? 'btn-primary' : 'btn-ghost'}" id="tab-receive-qr" style="flex: 1; padding: 8px 12px; font-size: 0.8rem; font-weight: 700;">
          📱 My UPI QR
        </button>
        <button class="btn btn-sm ${this.activeTab === 'deposit' ? 'btn-primary' : 'btn-ghost'}" id="tab-receive-deposit" style="flex: 1; padding: 8px 12px; font-size: 0.8rem; font-weight: 700;">
          📥 Deposit / Add Funds
        </button>
      </div>

      ${this.activeTab === 'qr' ? this.renderQrTabHtml(user, upiId, isDev) : this.renderDepositTabHtml(isDev)}
    `;

    this.renderFooterHtml(footer, isDev);
    this.bindEvents(body, footer, upiId);
  }

  static renderQrTabHtml(user, upiId, isDev) {
    const rawBank = user.simulatedBank || 'HDFC Bank';
    const cleanBank = rawBank
      .replace('Simulated Account', 'Bank')
      .replace('Simulated Bank', 'HDFC Bank')
      .replace('Simulated', '')
      .trim() || 'HDFC Bank';

    const qrPayload = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(user.name || 'PocketPe User')}&cu=INR`;
    const qrSvg = QrGenerator.generateSvg(qrPayload, { size: 200 });

    const initials = (user.name || 'PocketPe')
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0].toUpperCase())
      .slice(0, 2)
      .join('') || 'PP';

    return `
      <div class="receive-qr-card" style="text-align: center; padding: 18px 14px; background: var(--bg-surface); border-radius: 20px; border: 1px solid var(--border-subtle); box-shadow: var(--shadow-sm);">
        <!-- User Identity Header -->
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 14px;">
          <div class="avatar" style="width: 44px; height: 44px; font-size: 1.1rem; background: var(--accent-gradient); color: #fff; font-weight: 800; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
            ${initials}
          </div>
          <div style="text-align: left;">
            <div style="font-size: var(--text-base); font-weight: 800; color: var(--text-primary); line-height: 1.2;">${user.name || 'PocketPe User'}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;">Intelligent Purpose-Led UPI</div>
          </div>
        </div>

        <!-- Authentic QR Container -->
        <div style="padding: 12px; background: #ffffff; border-radius: 16px; display: inline-block; margin-bottom: 14px; border: 1.5px solid #e2e8f0;">
          ${qrSvg}
        </div>

        <!-- UPI ID Pill with Copy Button -->
        <div style="margin-bottom: 12px;">
          <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.05em;">YOUR UPI ID</div>
          <div style="display: inline-flex; align-items: center; gap: 8px; background: var(--bg-subtle); padding: 8px 14px; border-radius: 999px; border: 1px solid var(--border-subtle);">
            <span class="mono" style="font-size: var(--text-sm); font-weight: 700; color: var(--accent-primary);">${upiId}</span>
            <button class="btn btn-ghost btn-sm" id="btn-copy-upi-id-receive" style="padding: 2px 8px; font-size: 0.75rem; height: auto;" title="Copy UPI ID">
              📋 Copy
            </button>
          </div>
        </div>

        <!-- Linked Bank Account Badge -->
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 12px; background: rgba(255, 255, 255, 0.04); border-radius: 10px; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 6px;">
          <span>🏦</span>
          <span>${cleanBank} •• 4821</span>
          <span style="color: var(--success); font-weight: 700;">● Active</span>
        </div>

        <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 8px;">
          Scan with any UPI App • Google Pay, PhonePe, Paytm, BHIM
        </div>
      </div>
    `;
  }

  static renderDepositTabHtml(isDev) {
    return `
      <div style="text-align: center; margin-bottom: 12px;">
        <h3 class="h3" style="color: var(--text-primary); margin-bottom: 2px;">Deposit & Auto-Split</h3>
        <p class="subtitle">Incoming funds automatically allocate into your purpose wallets.</p>
      </div>

      <div class="card" style="text-align: center; padding: 20px;">
        <div style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 600;">AMOUNT TO DEPOSIT</div>
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

      <div class="form-group" style="margin-top: 14px;">
        <label class="form-label">Deposit Source</label>
        <select class="input-text" id="receive-source-select">
          <option value="Inward UPI Transfer" ${this.source.includes('UPI') ? 'selected' : ''}>Inward UPI Transfer</option>
          <option value="Bank Transfer (NEFT / IMPS)" ${this.source.includes('Bank') ? 'selected' : ''}>Bank Transfer (NEFT / IMPS)</option>
          <option value="Savings Allocation" ${this.source.includes('Savings') ? 'selected' : ''}>Savings Allocation</option>
          <option value="General Inflow" ${this.source.includes('Inflow') ? 'selected' : ''}>General Inflow</option>
        </select>
        <span class="caption">Funds will be divided based on your active Purpose Allocation rules.</span>
      </div>
    `;
  }

  static renderFooterHtml(footer, isDev) {
    if (this.activeTab === 'qr') {
      footer.innerHTML = `
        <div style="display: flex; gap: 10px; width: 100%;">
          <button class="btn btn-secondary btn-sm" id="btn-share-qr-receive" style="flex: 1;">
            📤 Share QR
          </button>
          <button class="btn btn-primary btn-sm" id="btn-go-deposit" style="flex: 1;">
            📥 Deposit Funds →
          </button>
        </div>
        <button class="btn btn-ghost btn-sm" data-close-modal="modal-receive-money" style="margin-top: 6px;">Close</button>
      `;
    } else {
      footer.innerHTML = `
        <button class="btn btn-primary" id="btn-trigger-cascade">
          Deposit & Split ${WalletEngine.formatRupee(this.amount)} ✨
        </button>
        <button class="btn btn-ghost btn-sm" data-close-modal="modal-receive-money">Cancel</button>
      `;
    }
  }

  static bindEvents(body, footer, upiId) {
    // Tab switching
    const tabQr = body.querySelector('#tab-receive-qr');
    const tabDeposit = body.querySelector('#tab-receive-deposit');

    if (tabQr) {
      tabQr.addEventListener('click', () => {
        this.activeTab = 'qr';
        SoundEngine.playTap();
        this.render();
      });
    }

    if (tabDeposit) {
      tabDeposit.addEventListener('click', () => {
        this.activeTab = 'deposit';
        SoundEngine.playTap();
        this.render();
      });
    }

    // Copy UPI ID button
    const copyBtn = body.querySelector('#btn-copy-upi-id-receive');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(upiId).then(() => {
          copyBtn.textContent = '✓ Copied!';
          SoundEngine.playTap();
          NavigationManager.showToast(`UPI ID copied: ${upiId}`, 'success');
          setTimeout(() => {
            if (copyBtn) copyBtn.textContent = '📋 Copy';
          }, 2000);
        }).catch(() => {
          NavigationManager.showToast(`UPI ID: ${upiId}`, 'info');
        });
      });
    }

    // Share QR button
    const shareBtn = footer.querySelector('#btn-share-qr-receive');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        SoundEngine.playTap();
        if (navigator.share) {
          navigator.share({
            title: 'Pay via PocketPe UPI',
            text: `Pay me via UPI: ${upiId}`,
            url: window.location.href,
          }).catch(() => {});
        } else {
          navigator.clipboard.writeText(upiId);
          NavigationManager.showToast(`UPI ID copied for sharing: ${upiId}`, 'success');
        }
      });
    }

    // Go to deposit button from QR tab
    const goDepositBtn = footer.querySelector('#btn-go-deposit');
    if (goDepositBtn) {
      goDepositBtn.addEventListener('click', () => {
        this.activeTab = 'deposit';
        SoundEngine.playTap();
        this.render();
      });
    }

    // Deposit tab amount input
    const input = body.querySelector('#receive-amount-input');
    const triggerBtn = footer.querySelector('#btn-trigger-cascade');

    if (input) {
      input.addEventListener('input', (e) => {
        this.amount = Number(e.target.value) || 0;
        if (triggerBtn) triggerBtn.textContent = `Deposit & Split ${WalletEngine.formatRupee(this.amount)} ✨`;
      });
    }

    // Quick amount pills
    body.querySelectorAll('[data-amt]').forEach((pill) => {
      pill.addEventListener('click', () => {
        this.amount = Number(pill.getAttribute('data-amt'));
        if (input) input.value = this.amount;
        if (triggerBtn) triggerBtn.textContent = `Deposit & Split ${WalletEngine.formatRupee(this.amount)} ✨`;
        body.querySelectorAll('[data-amt]').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        SoundEngine.playTap();
      });
    });

    // Cascade action trigger
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => {
        const sourceSelect = body.querySelector('#receive-source-select');
        this.source = sourceSelect ? sourceSelect.value : 'Monthly Salary / Allowance';
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
          <div style="font-size: var(--text-xs); opacity: 0.85; text-transform: uppercase; font-weight: 700;">Deposit Received & Verified</div>
          <div style="font-size: var(--text-3xl); font-weight: 800; letter-spacing: -0.02em;">
            ${WalletEngine.formatRupee(this.amount)}
          </div>
          <div style="font-size: var(--text-xs); opacity: 0.9; margin-top: 2px;">
            ${this.source}
          </div>
        </div>

        <div class="cascade-arrow-flow">
          <span>↓</span>
          <span style="font-size: var(--text-xs); font-weight: 700; text-transform: uppercase;">Auto-allocating to purposes</span>
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
                  <div style="font-size: var(--text-xs); color: var(--text-muted);">${d.percentage}% share • Balance: ${WalletEngine.formatRupee(d.newBalance)}</div>
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
      this.isCascading = false;
      NavigationManager.closeModal('modal-receive-money');
      NavigationManager.showToast(`✨ Successfully deposited ${WalletEngine.formatRupee(this.amount)} across wallets!`, 'success');
      this.render();
    });
  }
}
