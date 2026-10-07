/* ==========================================================================
   POCKETPE - ACTIVITY & SPENDING TIMELINE CONTROLLER
   ========================================================================== */

import { stateManager } from '../state.js';
import { DEMO_MERCHANTS } from '../config.js';
import { WalletEngine } from '../engines/walletEngine.js';
import { CategoryEngine } from '../engines/categoryEngine.js';
import { FraudEngine } from '../engines/fraudEngine.js';
import { FraudModal } from './fraudModal.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';

export class ActivityView {
  static init() {
    this.container = document.getElementById('view-activity');
    this.filterType = 'all';
    this.searchQuery = '';

    if (!this.container) return;

    this.render();

    // Listen to transaction updates
    stateManager.subscribe('transaction:added', () => this.render());
    stateManager.subscribe('state:changed', () => this.render());
  }

  static render() {
    if (!this.container) return;

    const allTransactions = stateManager.getTransactions();

    // Apply filters
    const filtered = allTransactions.filter((tx) => {
      // Type filter
      if (this.filterType === 'debit' && tx.type !== 'debit') return false;
      if (this.filterType === 'credit' && tx.type !== 'credit') return false;
      if (this.filterType === 'rebalance' && tx.type !== 'rebalance') return false;

      // Search query
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const m = (tx.merchantName || '').toLowerCase();
        const c = (tx.category || '').toLowerCase();
        if (!m.includes(q) && !c.includes(q)) return false;
      }
      return true;
    });

    // Group by Date: Today, Yesterday, Earlier
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now.getTime() - 24 * 3600 * 1000).toDateString();

    const groups = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    filtered.forEach((tx) => {
      const txDate = new Date(tx.date).toDateString();
      if (txDate === todayStr) {
        groups.Today.push(tx);
      } else if (txDate === yesterday) {
        groups.Yesterday.push(tx);
      } else {
        groups.Earlier.push(tx);
      }
    });

    this.container.innerHTML = `
      <div class="section-header">
        <h2 class="h2">Activity</h2>
        <span class="badge badge-accent">${filtered.length} Records</span>
      </div>

      <!-- Search & Filter Controls Bar -->
      <div class="activity-filter-bar">
        <div class="form-group" style="margin-bottom: 0; flex: 1;">
          <input
            type="text"
            class="input-text"
            id="activity-search-input"
            placeholder="🔍 Search merchant, category, or note..."
            value="${this.searchQuery}"
          />
        </div>

        <div class="filter-scroll-row" style="margin-bottom: 0;">
          <button class="filter-chip ${this.filterType === 'all' ? 'active' : ''}" data-act-filter="all">All</button>
          <button class="filter-chip ${this.filterType === 'debit' ? 'active' : ''}" data-act-filter="debit">Payments</button>
          <button class="filter-chip ${this.filterType === 'credit' ? 'active' : ''}" data-act-filter="credit">Money Received</button>
          <button class="filter-chip ${this.filterType === 'rebalance' ? 'active' : ''}" data-act-filter="rebalance">Rebalanced</button>
        </div>
      </div>

      <!-- Timeline List -->
      ${filtered.length === 0
        ? `
          <div style="text-align: center; padding: 40px 20px; background: var(--bg-surface); border-radius: var(--radius-xl); border: 1px dashed var(--border-strong);">
            <div style="font-size: 2.5rem; margin-bottom: 8px;">📜</div>
            <h4 class="h4" style="margin-bottom: 4px;">Your spending history will appear here.</h4>
            <p class="subtitle">Scan a demo QR to make your first purposeful payment.</p>
          </div>
        `
        : `
          <div style="display: flex; flex-direction: column; gap: 16px;">
            ${Object.entries(groups)
              .filter(([_, list]) => list.length > 0)
              .map(
                ([groupTitle, list]) => `
              <div class="timeline-group">
                <div class="timeline-date-label">${groupTitle}</div>
                ${list.map((tx) => this.renderTransactionRow(tx)).join('')}
              </div>
            `
              )
              .join('')}
          </div>
        `}
    `;

    this.bindEvents();
  }

  static renderTransactionRow(tx) {
    const wallet = stateManager.getWallet(tx.walletId);
    const isDebit = tx.type === 'debit';
    const isCredit = tx.type === 'credit';
    const isRebalance = tx.type === 'rebalance';

    let icon = '🛍️';
    if (isCredit) icon = '📥';
    else if (isRebalance) icon = '🔄';
    else if (wallet) icon = wallet.icon || '🛍️';

    let amountClass = 'debit';
    let prefix = '-';
    if (isCredit) {
      amountClass = 'credit';
      prefix = '+';
    } else if (isRebalance) {
      amountClass = 'rebalance';
      prefix = '↔ ';
    }

    const timeStr = new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="tx-item-card" data-tx-id="${tx.id}">
        <div class="tx-left">
          <div class="tx-icon-box" style="background: ${wallet?.color ? wallet.color + '15' : 'var(--bg-subtle)'};">
            ${icon}
          </div>
          <div class="tx-details">
            <div class="tx-merchant">${tx.merchantName}</div>
            <div class="tx-wallet-tag">
              ${tx.category} • ${wallet ? wallet.name + ' Wallet' : 'Multiple Wallets'} • ${timeStr}
            </div>
          </div>
        </div>
        <div class="tx-amount ${amountClass}">
          ${prefix}${WalletEngine.formatRupee(tx.amount)}
        </div>
      </div>
    `;
  }

  static bindEvents() {
    // Search input
    const searchInput = this.container.querySelector('#activity-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.render();
      });
    }

    // Filter pills
    this.container.querySelectorAll('[data-act-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.filterType = btn.getAttribute('data-act-filter');
        SoundEngine.playTap();
        this.render();
      });
    });

    // Transaction click -> Receipt modal
    this.container.querySelectorAll('.tx-item-card').forEach((card) => {
      card.addEventListener('click', () => {
        const txId = card.getAttribute('data-tx-id');
        this.openReceiptModal(txId);
      });
    });
  }

  static openReceiptModal(txId) {
    const tx = stateManager.getTransactions().find((t) => t.id === txId);
    if (!tx) return;

    const modal = document.getElementById('modal-transaction-receipt');
    if (!modal) return;

    const body = modal.querySelector('.sheet-body');
    const footer = modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    const wallet = stateManager.getWallet(tx.walletId);
    const isDebit = tx.type === 'debit';
    const dateFormatted = new Date(tx.date).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    // Resolve UPI ID for merchant
    let upiId = tx.upiId;
    if (!upiId) {
      const match = DEMO_MERCHANTS.find((m) => m.name.toLowerCase() === tx.merchantName.toLowerCase());
      upiId = match ? match.upiId : (tx.merchantName.includes('@') ? tx.merchantName : tx.merchantName.toLowerCase().replace(/[^a-z0-9]/g, '') + '@upi');
    }
    const risk = FraudEngine.evaluateUpiRisk(upiId);

    body.innerHTML = `
      <div style="text-align: center; padding: 10px 0;">
        <div style="font-size: 2.75rem; margin-bottom: 4px;">${wallet?.icon || '🧾'}</div>
        <h3 class="h3" style="color: var(--text-primary);">${tx.merchantName}</h3>
        <div class="mono" style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">${upiId}</div>
        <div style="display: flex; justify-content: center; align-items: center; gap: 6px; margin-top: 4px; flex-wrap: wrap;">
          <span class="badge badge-accent">${tx.category}</span>
          ${FraudModal.renderRiskBadgeHtml(upiId, true)}
        </div>
        <div style="font-size: var(--text-4xl); font-weight: 800; color: ${isDebit ? 'var(--text-primary)' : 'var(--success)'}; margin-top: 8px;">
          ${isDebit ? '-' : '+'}${WalletEngine.formatRupee(tx.amount)}
        </div>
      </div>

      <div class="card" style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; justify-content: space-between; font-size: var(--text-xs);">
          <span style="color: var(--text-muted);">Transaction Status</span>
          <span style="color: var(--success); font-weight: 700;">● Completed (Simulated)</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: var(--text-xs);">
          <span style="color: var(--text-muted);">Purpose Wallet</span>
          <span style="font-weight: 700;">${wallet ? wallet.name + ' Wallet' : 'Distributed'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: var(--text-xs);">
          <span style="color: var(--text-muted);">Date & Time</span>
          <span style="font-weight: 600;">${dateFormatted}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: var(--text-xs);">
          <span style="color: var(--text-muted);">Simulated Reference ID</span>
          <span class="mono" style="color: var(--text-muted);">${tx.id.toUpperCase()}-SIM</span>
        </div>
      </div>

      <!-- Category Correction / Learning Engine Section -->
      ${isDebit ? `
        <div class="card" style="padding: 14px; background: var(--bg-subtle);">
          <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
            Wrong Category? Teach PocketPe
          </div>
          <p style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 8px;">
            Correct the purpose for "${tx.merchantName}". PocketPe will remember it for all future payments.
          </p>
          <div style="display: flex; gap: 8px;">
            <select class="input-text" id="receipt-category-fix" style="padding: 6px 10px; font-size: var(--text-xs);">
              <option value="Food & Dining">🍔 Food & Dining</option>
              <option value="Transport & Fuel">🚗 Transport & Fuel</option>
              <option value="College & Education">🎓 College & Education</option>
              <option value="Savings & Investment">💰 Savings & Investment</option>
              <option value="Friends & Social">🤝 Friends & Social</option>
              <option value="Shopping & Apparel">🛍️ Shopping & Apparel</option>
              <option value="Personal Care">💈 Personal Care</option>
            </select>
            <button class="btn btn-sm btn-primary" id="btn-fix-category-submit" style="width: auto; padding: 6px 14px;">
              Teach
            </button>
          </div>
        </div>
      ` : ''}
    `;

    footer.innerHTML = `
      <div style="display: flex; gap: 10px; width: 100%;">
        <button class="btn btn-secondary btn-sm" id="btn-receipt-report-upi" style="flex: 1; font-size: var(--text-xs); color: var(--danger);">
          🚩 Report Recipient
        </button>
        <button class="btn btn-primary btn-sm" data-close-modal="modal-transaction-receipt" style="flex: 1;">
          Close
        </button>
      </div>
    `;

    // Click on risk pill to see details
    body.querySelectorAll('[data-risk-upi]').forEach((pill) => {
      pill.addEventListener('click', () => {
        FraudModal.openRiskDetailModal(upiId, tx.merchantName);
      });
    });

    // Report button
    const repBtn = footer.querySelector('#btn-receipt-report-upi');
    if (repBtn) {
      repBtn.addEventListener('click', () => {
        NavigationManager.closeModal('modal-transaction-receipt');
        FraudModal.openReportModal(upiId, tx.merchantName);
      });
    }

    // Fix Category Click
    const fixSubmitBtn = body.querySelector('#btn-fix-category-submit');
    if (fixSubmitBtn) {
      fixSubmitBtn.addEventListener('click', () => {
        const select = body.querySelector('#receipt-category-fix');
        const chosenCat = select ? select.value : 'General';
        const targetWallet = CategoryEngine.findWalletByCategory(chosenCat);

        CategoryEngine.teachMerchantCategory(tx.merchantName, chosenCat, targetWallet?.id || null);
        tx.category = chosenCat;
        if (targetWallet) tx.walletId = targetWallet.id;

        SoundEngine.playSuccess();
        NavigationManager.closeModal('modal-transaction-receipt');
        NavigationManager.showToast(`✨ Learned! Future payments to "${tx.merchantName}" will be categorized as ${chosenCat}.`, 'success');
        this.render();
      });
    }

    NavigationManager.openModal('modal-transaction-receipt');
  }
}
