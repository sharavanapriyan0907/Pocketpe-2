/* ==========================================================================
   POCKETPE - DEDICATED BALANCE & ALLOCATION VIEW
   Displays total available app balance, purpose wallet allocations,
   privacy toggle, and seamless navigation back to Home.
   Uses the EXACT same underlying data source as the desktop version.
   ========================================================================== */

import { stateManager } from '../state.js';
import { WalletEngine } from '../engines/walletEngine.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';
import { ReceiveModal } from './receiveModal.js';
import { MoveModal } from './moveModal.js';
import { SplitView } from './splitView.js';

export class BalanceView {
  static container = null;

  static init() {
    this.container = document.getElementById('view-balance');
    if (!this.container) return;

    this.render();

    // Subscribe to state changes to keep balance live and synchronized
    stateManager.subscribe('state:changed', () => this.render());
    stateManager.subscribe('wallet:updated', () => this.render());
    stateManager.subscribe('wallet:created', () => this.render());
    stateManager.subscribe('transaction:added', () => this.render());
    stateManager.subscribe('privacy:toggled', () => this.render());
    stateManager.subscribe('auth:changed', () => this.render());
  }

  static render() {
    if (!this.container) return;

    const state = stateManager.getState();
    const summary = WalletEngine.getSummary();
    const wallets = stateManager.getWallets();
    const isHidden = !!state.isBalanceHidden;

    const totalDisplay = isHidden ? '••••••' : WalletEngine.formatRupee(summary.total);
    const allocatedDisplay = isHidden ? '••••' : WalletEngine.formatRupee(summary.allocated);
    const freeDisplay = isHidden ? '••••' : WalletEngine.formatRupee(summary.free);

    const bankName = state.user?.bankName || 'HDFC Bank';
    const acctNum = state.user?.accountNumber || '••• 4821';

    this.container.innerHTML = `
      <!-- Header with In-App Back Navigation -->
      <div class="view-header-row" style="display: flex; align-items: center; justify-content: space-between; padding-top: 4px; margin-bottom: 4px;">
        <button class="btn-header-back" id="btn-balance-back-home" data-back-nav aria-label="Return to Home" style="background: none; border: none; color: var(--accent-primary); font-size: 0.88rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 6px 0;">
          <span style="font-size: 1.1rem; line-height: 1;">←</span> Home
        </button>
        <h2 class="h2" style="font-size: 1.1rem; font-weight: 800; color: var(--text-primary); margin: 0; letter-spacing: -0.01em;">
          My Balance
        </h2>
        <button class="icon-btn" id="btn-balance-privacy-toggle" title="Toggle balance visibility" aria-label="Toggle balance privacy" style="width: 36px; height: 36px;">
          ${isHidden ? '👁️' : '👁️‍🗨️'}
        </button>
      </div>

      <!-- Hero Total Balance Card -->
      <div class="balance-hero-card" style="margin-top: 6px;">
        <div class="balance-top-row">
          <div class="balance-label">
            <span>TOTAL AVAILABLE BALANCE</span>
          </div>
          <span class="badge badge-success" style="font-size: 0.65rem; padding: 2px 8px;">● Active</span>
        </div>

        <div class="balance-amount-display">
          <span class="amount" id="balance-view-total-amount">${totalDisplay}</span>
        </div>

        <!-- Allocation Breakdown Bar -->
        <div class="breakdown-bar-wrapper">
          <div class="breakdown-bar" style="height: 10px; border-radius: var(--radius-full); overflow: hidden; display: flex; background: var(--bg-surface-secondary);">
            ${wallets
              .map((w) => {
                const pct = summary.total > 0 ? (Number(w.balance || 0) / summary.total) * 100 : 0;
                return pct > 0
                  ? `<div style="width: ${pct}%; background: ${w.color || '#3b82f6'};" title="${w.name}: ₹${w.balance}"></div>`
                  : '';
              })
              .join('')}
          </div>
        </div>

        <!-- Summary Stats Grid -->
        <div class="balance-stats-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px;">
          <div class="card" style="padding: 12px; background: var(--bg-surface-secondary); border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
              Allocated Funds
            </div>
            <div style="font-size: var(--text-md); font-weight: 800; color: var(--text-primary); margin-top: 2px;">
              ${allocatedDisplay}
            </div>
            <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">
              ${summary.allocatedPercentage}% across ${summary.walletsCount} purpose wallets
            </div>
          </div>

          <div class="card" style="padding: 12px; background: var(--bg-surface-secondary); border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--accent-primary); text-transform: uppercase;">
              Free Cushion
            </div>
            <div style="font-size: var(--text-md); font-weight: 800; color: var(--text-primary); margin-top: 2px;">
              ${freeDisplay}
            </div>
            <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">
              ${summary.freePercentage}% unassigned safety buffer
            </div>
          </div>
        </div>

        <!-- Linked Primary UPI Account Badge -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; padding-top: 10px; border-top: 1px solid var(--border-light); font-size: 0.75rem; color: var(--text-secondary);">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>🏦</span>
            <span>${bankName} <strong style="color: var(--text-primary);">${acctNum}</strong></span>
          </div>
          <span style="font-size: 0.7rem; color: var(--text-muted);">Primary UPI Account</span>
        </div>
      </div>

      <!-- Quick Action Buttons -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 4px 0;">
        <button class="btn btn-secondary btn-sm" id="btn-balance-action-receive" style="flex-direction: column; gap: 4px; padding: 10px 4px; min-height: 54px; font-size: 0.72rem; font-weight: 700;">
          <span style="font-size: 1.1rem;">+</span>
          <span>Receive Money</span>
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-balance-action-move" style="flex-direction: column; gap: 4px; padding: 10px 4px; min-height: 54px; font-size: 0.72rem; font-weight: 700;">
          <span style="font-size: 1.1rem;">⇄</span>
          <span>Move Money</span>
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-balance-action-split" style="flex-direction: column; gap: 4px; padding: 10px 4px; min-height: 54px; font-size: 0.72rem; font-weight: 700;">
          <span style="font-size: 1.1rem;">⚡</span>
          <span>Split Rules</span>
        </button>
      </div>

      <!-- Wallet Allocations List -->
      <div class="section-container" style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <h3 class="h3" style="font-size: var(--text-sm); font-weight: 800; color: var(--text-primary);">
            Wallet Allocations (${wallets.length})
          </h3>
          <button class="btn btn-ghost btn-sm" id="btn-balance-view-all-wallets" style="width: auto; padding: 4px 8px; font-size: 0.75rem; color: var(--accent-primary);">
            Manage Wallets →
          </button>
        </div>

        <div class="balance-wallets-list" style="display: flex; flex-direction: column; gap: 8px;">
          ${wallets
            .map((w) => {
              const bal = isHidden ? '••••' : WalletEngine.formatRupee(w.balance || 0);
              const target = w.targetAmount > 0 ? `Target: ₹${w.targetAmount}` : (w.isFreeMoney ? 'Unallocated Reserve' : 'No target set');
              return `
                <div class="card card-interactive balance-wallet-item" data-wallet-id="${w.id}" style="padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; border-left: 4px solid ${w.color || 'var(--accent-primary)'};">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="font-size: 1.35rem; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md); background: var(--bg-surface-secondary);">
                      ${w.icon || '💼'}
                    </div>
                    <div>
                      <div style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">
                        ${w.name}
                      </div>
                      <div style="font-size: 0.7rem; color: var(--text-muted);">
                        ${target} ${w.allocationPercentage ? `• ${w.allocationPercentage}% auto-split` : ''}
                      </div>
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: var(--text-sm); font-weight: 800; color: var(--text-primary);">
                      ${bal}
                    </div>
                    <span class="badge badge-accent" style="font-size: 0.65rem; padding: 1px 6px;">
                      ${w.category || 'Purpose'}
                    </span>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>

      <!-- Navigation & Return to Home Controls -->
      <div style="margin-top: 8px; padding-bottom: 24px; display: flex; flex-direction: column; gap: 8px;">
        <button class="btn btn-primary" id="btn-balance-return-home" data-back-nav style="width: 100%; padding: 12px; font-weight: 700; font-size: var(--text-sm);">
          ← Return to Home
        </button>
        <button class="btn btn-ghost" id="btn-balance-goto-split" style="width: 100%; font-size: var(--text-xs); color: var(--text-secondary);">
          👥 Split Bills with Friends
        </button>
      </div>
    `;

    this.bindEvents();
  }

  static bindEvents() {
    if (!this.container) return;

    // Header Back to Home
    const headerBackBtn = this.container.querySelector('#btn-balance-back-home');
    if (headerBackBtn) {
      headerBackBtn.addEventListener('click', () => {
        SoundEngine.playTap();
        NavigationManager.switchTab('home');
      });
    }

    // Return to Home bottom button
    const returnHomeBtn = this.container.querySelector('#btn-balance-return-home');
    if (returnHomeBtn) {
      returnHomeBtn.addEventListener('click', () => {
        SoundEngine.playTap();
        NavigationManager.switchTab('home');
      });
    }

    // Go to Split Bills
    const gotoSplitBtn = this.container.querySelector('#btn-balance-goto-split');
    if (gotoSplitBtn) {
      gotoSplitBtn.addEventListener('click', () => {
        SoundEngine.playTap();
        NavigationManager.switchTab('split');
      });
    }

    // Privacy Toggle Button
    const privacyBtn = this.container.querySelector('#btn-balance-privacy-toggle');
    if (privacyBtn) {
      privacyBtn.addEventListener('click', () => {
        stateManager.toggleBalancePrivacy();
        SoundEngine.playTap();
      });
    }

    // Action: Receive Money
    const receiveBtn = this.container.querySelector('#btn-balance-action-receive');
    if (receiveBtn) {
      receiveBtn.addEventListener('click', () => {
        ReceiveModal.open();
      });
    }

    // Action: Move Money
    const moveBtn = this.container.querySelector('#btn-balance-action-move');
    if (moveBtn) {
      moveBtn.addEventListener('click', () => {
        MoveModal.open();
      });
    }

    // Action: Split Rules
    const splitBtn = this.container.querySelector('#btn-balance-action-split');
    if (splitBtn) {
      splitBtn.addEventListener('click', () => {
        SplitView.open();
      });
    }

    // Manage Wallets link
    const viewAllWalletsBtn = this.container.querySelector('#btn-balance-view-all-wallets');
    if (viewAllWalletsBtn) {
      viewAllWalletsBtn.addEventListener('click', () => {
        SoundEngine.playTap();
        NavigationManager.switchTab('wallets');
      });
    }

    // Tapping a wallet card opens wallet overview modal
    this.container.querySelectorAll('.balance-wallet-item').forEach((item) => {
      item.addEventListener('click', () => {
        const walletId = item.getAttribute('data-wallet-id');
        if (walletId) {
          SoundEngine.playTap();
          this.openWalletDetail(walletId);
        }
      });
    });
  }

  static openWalletDetail(walletId) {
    const wallet = stateManager.getWallet(walletId);
    if (!wallet) return;

    const modal = document.getElementById('modal-wallet-detail');
    if (!modal) return;

    const body = modal.querySelector('.sheet-body');
    const title = modal.querySelector('.sheet-title');
    if (title) title.textContent = `${wallet.name} Overview`;

    if (body) {
      const summary = WalletEngine.getSummary();
      const pctOfTotal = summary.total > 0 ? Math.round(((wallet.balance || 0) / summary.total) * 100) : 0;
      body.innerHTML = `
        <div style="text-align: center; margin-bottom: 12px;">
          <div style="font-size: 2.2rem; margin-bottom: 6px;">${wallet.icon}</div>
          <h3 class="h3" style="color: var(--text-primary); margin-bottom: 2px;">${wallet.name}</h3>
          <div style="font-size: var(--text-2xl); font-weight: 800; color: var(--text-primary); margin: 6px 0;">
            ${WalletEngine.formatRupee(wallet.balance || 0)}
          </div>
          <span class="badge badge-accent">${wallet.category || 'Purpose Wallet'}</span>
        </div>

        <div class="card" style="padding: 14px; background: var(--bg-surface-secondary);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: var(--text-xs);">
            <span style="color: var(--text-muted);">Share of Total Balance</span>
            <strong style="color: var(--text-primary);">${pctOfTotal}%</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: var(--text-xs);">
            <span style="color: var(--text-muted);">Auto-Split Percentage</span>
            <strong style="color: var(--text-primary);">${wallet.allocationPercentage || 0}%</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: var(--text-xs);">
            <span style="color: var(--text-muted);">Monthly Limit / Target</span>
            <strong style="color: var(--text-primary);">${wallet.targetAmount ? `₹${wallet.targetAmount}` : 'Flexible'}</strong>
          </div>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" id="btn-wallet-detail-deposit" style="flex: 1;">
            Deposit Funds
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-wallet-detail-transfer" style="flex: 1;">
            Transfer Out
          </button>
        </div>
      `;

      const depositBtn = body.querySelector('#btn-wallet-detail-deposit');
      if (depositBtn) {
        depositBtn.addEventListener('click', () => {
          NavigationManager.closeModal('modal-wallet-detail');
          ReceiveModal.open(wallet.id);
        });
      }

      const transferBtn = body.querySelector('#btn-wallet-detail-transfer');
      if (transferBtn) {
        transferBtn.addEventListener('click', () => {
          NavigationManager.closeModal('modal-wallet-detail');
          MoveModal.open(wallet.id);
        });
      }
    }

    NavigationManager.openModal('modal-wallet-detail');
  }
}
