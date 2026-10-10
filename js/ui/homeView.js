import { stateManager } from '../state.js';
import { WalletEngine } from '../engines/walletEngine.js';
import { FraudEngine } from '../engines/fraudEngine.js';
import { CommitmentEngine } from '../engines/commitmentEngine.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';
import { MoveModal } from './moveModal.js';
import { ReceiveModal } from './receiveModal.js';
import { SplitView } from './splitView.js';
import { SplitBillView } from './splitBillView.js';
import { CollectModal } from './collectModal.js';
import { FraudModal } from './fraudModal.js';
import { CommitmentModal } from './commitmentModal.js';
import { FundingModal } from './fundingModal.js';

export class HomeView {
  static init() {
    this.container = document.getElementById('view-home');
    if (!this.container) return;

    this.render();

    // Subscribe to state changes
    stateManager.subscribe('state:changed', () => this.render());
    stateManager.subscribe('auth:changed', () => this.render());
    stateManager.subscribe('privacy:toggled', () => this.render());
    stateManager.subscribe('collect:updated', () => this.render());
    stateManager.subscribe('split:settled', () => this.render());
    stateManager.subscribe('commitments:updated', () => this.render());
  }

  static render() {
    if (!this.container) return;

    const state = stateManager.getState();
    const summary = WalletEngine.getSummary();
    const wallets = stateManager.getWallets();
    const insights = WalletEngine.generateInsights();
    const commitments = stateManager.getCommitments();
    const shortfallAlerts = CommitmentEngine.generateHomeAlerts(commitments, wallets);
    const isHidden = state.isBalanceHidden;

    const totalDisplay = isHidden ? '••••••' : WalletEngine.formatRupee(summary.total);
    const allocatedDisplay = isHidden ? '••••' : WalletEngine.formatRupee(summary.allocated);
    const freeDisplay = isHidden ? '••••' : WalletEngine.formatRupee(summary.free);

    const initials = (state.user?.name || 'User')
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0].toUpperCase())
      .slice(0, 2)
      .join('') || 'U';

    // Pick top spending insight
    const topInsight = insights.length > 0
      ? insights[0]
      : { icon: '✨', text: 'Every rupee has a purpose. Assign your money to stay in control.' };

    this.container.innerHTML = `
      <!-- Top Header -->
      <div class="home-header">
        <div class="user-profile-badge" id="btn-home-profile-badge" style="cursor: pointer;" title="Profile & Account">
          <div class="avatar" style="overflow: hidden; display: flex; align-items: center; justify-content: center;">
            ${state.user?.avatarUrl
              ? `<img src="${state.user.avatarUrl}" alt="${state.user.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.parentElement.innerText='${initials}';" />`
              : initials}
          </div>
          <div>
            <div class="greeting-text">${state.user?.greeting || 'Good day'} ${state.user?.isAuthenticated ? '●' : ''}</div>
            <div class="user-name">${state.user.name}</div>
          </div>
        </div>
        <div class="header-actions">
          <button class="icon-btn" id="btn-home-notifications" title="Notifications" aria-label="Notifications">
            🔔
            <span class="notification-dot"></span>
          </button>
        </div>
      </div>

      <!-- Hero Balance Card -->
      <div class="balance-hero-card">
        <div class="balance-top-row">
          <div class="balance-label">
            <span>TOTAL ACCOUNT BALANCE</span>
          </div>
          <button class="toggle-privacy-btn" id="btn-toggle-privacy" aria-label="Toggle balance visibility">
            ${isHidden ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>

        <div class="balance-amount-display">
          <span class="amount">${totalDisplay}</span>
        </div>

        <!-- Breakdown Bar -->
        <div class="breakdown-bar-wrapper">
          <div class="breakdown-bar">
            ${wallets
              .map((w) => {
                const pct = summary.total > 0 ? (w.balance / summary.total) * 100 : 0;
                return `<div class="breakdown-segment" style="width: ${pct}%; background: ${w.color || 'var(--accent-primary)'};" title="${w.name}: ${WalletEngine.formatRupee(w.balance)}"></div>`;
              })
              .join('')}
          </div>
          <div class="breakdown-legend">
            <div class="legend-item">
              <span class="legend-dot" style="background: var(--accent-primary)"></span>
              <span>Allocated: <strong>${allocatedDisplay}</strong> (${summary.allocatedPercentage}%)</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot" style="background: #10b981"></span>
              <span>Free: <strong>${freeDisplay}</strong> (${summary.freePercentage}%)</span>
            </div>
          </div>
        </div>

        <div class="account-link-badge" style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding: 7px 12px; background: rgba(255, 255, 255, 0.04); border-radius: 10px; font-size: 0.73rem; color: var(--text-secondary); border: 1px solid rgba(255, 255, 255, 0.05);">
          <span style="display: flex; align-items: center; gap: 7px;">
            <span>🏦</span>
            <span>HDFC Bank •• 4821 • Primary UPI</span>
          </span>
          <span style="display: flex; align-items: center; gap: 4px; color: var(--success); font-weight: 700; font-size: 0.7rem;">
            <span style="font-size: 0.55rem;">●</span> Active
          </span>
        </div>
      </div>

      <!-- Intelligent Upcoming Payment Shortfall Alerts (Strictly when funds are insufficient) -->
      ${shortfallAlerts.length > 0 ? `
        <div class="shortfall-alerts-container" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px;">
          ${shortfallAlerts.map((alert) => `
            <div class="card card-interactive shortfall-alert-card" style="padding: 14px 16px; background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.35); border-radius: var(--radius-lg);">
              <div style="display: flex; align-items: flex-start; gap: 12px;">
                <span style="font-size: 1.45rem; line-height: 1;">⚠️</span>
                <div style="flex: 1;">
                  <div style="font-size: 0.68rem; font-weight: 800; color: var(--danger); text-transform: uppercase; letter-spacing: 0.5px;">
                    Payment Shortfall Alert
                  </div>
                  <div style="font-size: var(--text-sm); font-weight: 800; color: var(--text-primary); margin-top: 2px;">
                    Insufficient funds for your upcoming payment.
                  </div>
                  <div style="font-size: var(--text-xs); color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">
                    <strong>${alert.commitmentName}</strong> (${WalletEngine.formatRupee(alert.amountRequired)}) is due on <strong>${CommitmentEngine.formatDueDate(alert.dueDate)}</strong> in <strong>${alert.walletName}</strong>.
                  </div>
                  <div style="font-size: var(--text-xs); color: var(--text-primary); margin-top: 6px; padding: 6px 10px; background: rgba(0, 0, 0, 0.25); border-radius: var(--radius-sm); border: 1px solid rgba(255, 255, 255, 0.05);">
                    Your available balance is <strong>${WalletEngine.formatRupee(alert.availableBalance)}</strong>. You need another <strong style="color: var(--danger);">${WalletEngine.formatRupee(alert.shortfall)}</strong> to cover this payment.
                  </div>
                  <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;">
                    <button class="btn btn-sm btn-primary btn-alert-add-money" data-commitment-id="${alert.commitmentId}" data-wallet-id="${alert.walletId}" style="width: auto; padding: 6px 14px; font-size: var(--text-xs);">
                      Add Money
                    </button>
                    <button class="btn btn-sm btn-secondary btn-alert-view-payment" data-commitment-id="${alert.commitmentId}" style="width: auto; padding: 6px 14px; font-size: var(--text-xs);">
                      View Payment
                    </button>
                    <button class="btn btn-sm btn-secondary btn-alert-change-wallet" data-commitment-id="${alert.commitmentId}" style="width: auto; padding: 6px 14px; font-size: var(--text-xs);">
                      Change Wallet
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Pending Collect Request Alert Banner (if any) -->
      ${(() => {
        const pendingCollects = stateManager.getCollectRequests().filter((r) => r.status === 'pending');
        if (pendingCollects.length === 0) return '';
        const first = pendingCollects[0];
        const risk = FraudEngine.evaluateUpiRisk(first.upiId);
        return `
          <div class="card card-interactive" id="banner-pending-collect" style="padding: 12px 14px; background: ${FraudModal.getRiskBgColor(risk.level)}; border: 1.5px solid ${risk.level === 'HIGH' ? 'var(--danger-border)' : 'var(--warning-border)'}; display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.35rem;">${risk.level === 'HIGH' ? '🚨' : '🔔'}</span>
              <div>
                <div style="font-size: var(--text-xs); font-weight: 700; color: ${FraudModal.getRiskColor(risk.level)};">
                  ${pendingCollects.length} INCOMING MONEY REQUEST${pendingCollects.length > 1 ? 'S' : ''}
                </div>
                <div style="font-size: 0.72rem; color: var(--text-primary); font-weight: 600;">
                  ${first.requesterName} (${WalletEngine.formatRupee(first.amount)})
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="badge ${FraudModal.getRiskBadgeClass(risk.level)}" style="font-size: 0.65rem;">
                ${risk.level} RISK
              </span>
              <span style="font-size: 0.8rem; color: var(--text-muted);">→</span>
            </div>
          </div>
        `;
      })()}

      <!-- Quick Action Tiles -->
      <div class="quick-actions-grid">
        <div class="action-tile" id="action-receive-money" role="button" tabindex="0">
          <div class="action-icon">📥</div>
          <span class="action-label">Receive QR</span>
        </div>
        <div class="action-tile" id="action-quick-pay" role="button" tabindex="0">
          <div class="action-icon">⚡</div>
          <span class="action-label">Scan & Pay</span>
        </div>
        <div class="action-tile" id="action-add-commitment" role="button" tabindex="0">
          <div class="action-icon">🗓️</div>
          <span class="action-label">+ Payment</span>
        </div>
        <div class="action-tile" id="action-split-bills" role="button" tabindex="0">
          <div class="action-icon">🍕</div>
          <span class="action-label">Split Bills</span>
        </div>
        <div class="action-tile" id="action-move-money" role="button" tabindex="0">
          <div class="action-icon">🔄</div>
          <span class="action-label">Transfer</span>
        </div>
        <div class="action-tile" id="action-split-rules" role="button" tabindex="0">
          <div class="action-icon">📊</div>
          <span class="action-label">Auto-Split</span>
        </div>
      </div>

      <!-- Human Spending Insight Card -->
      <div class="insight-card">
        <div class="insight-icon">${topInsight.icon}</div>
        <div class="insight-text">${topInsight.text}</div>
      </div>

      <!-- Upcoming Financial Commitments Section -->
      <div class="section-header" style="margin-top: 14px;">
        <h3 class="section-title">Upcoming Payments ${commitments.length > 0 ? `(${commitments.length})` : ''}</h3>
        <button class="section-link" id="btn-home-add-commitment-header" style="background: none; border: none; cursor: pointer; color: var(--accent-primary); font-size: var(--text-xs); font-weight: 700;">
          + Add Payment
        </button>
      </div>

      ${commitments.length === 0 ? `
        <!-- Clean Empty State for New Users -->
        <div class="card" style="padding: 24px 20px; text-align: center; background: rgba(255, 255, 255, 0.02); border: 1px dashed rgba(255, 255, 255, 0.12); border-radius: var(--radius-lg); margin-top: 4px;">
          <div style="font-size: 2rem; margin-bottom: 8px;">🗓️</div>
          <div style="font-size: var(--text-base); font-weight: 700; color: var(--text-primary);">Plan your upcoming payments.</div>
          <p style="font-size: var(--text-xs); color: var(--text-secondary); margin: 6px auto 16px; max-width: 320px; line-height: 1.4;">
            Add your financial commitments to track due dates and ensure you have enough money available.
          </p>
          <button class="btn btn-primary btn-sm" id="btn-home-empty-add-commitment" style="width: auto; margin: 0 auto; padding: 8px 18px; font-size: var(--text-xs); display: inline-flex; align-items: center; gap: 6px;">
            <span>+</span> Add Payment
          </button>
        </div>
      ` : `
        <div class="commitments-list" style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
          ${commitments.map((commitment) => {
            const status = CommitmentEngine.getCommitmentStatus(commitment, wallets);
            const daysText = status.daysUntil < 0
              ? `Overdue by ${Math.abs(status.daysUntil)} day${Math.abs(status.daysUntil) > 1 ? 's' : ''}`
              : status.daysUntil === 0
              ? 'Due today'
              : `Due in ${status.daysUntil} day${status.daysUntil > 1 ? 's' : ''}`;

            return `
              <div class="card card-interactive commitment-home-card" data-commitment-id="${commitment.id}" style="padding: 12px 14px; border-left: 3px solid ${status.isFunded ? 'var(--success)' : 'var(--danger)'};">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                  <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                    <div style="width: 38px; height: 38px; border-radius: var(--radius-md); background: rgba(255, 255, 255, 0.05); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
                      ${status.category.icon || '🗓️'}
                    </div>
                    <div style="min-width: 0;">
                      <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${commitment.name}
                      </div>
                      <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 1px;">
                        ${commitment.payee ? `${commitment.payee} • ` : ''}${status.wallet.name} • ${daysText}
                      </div>
                    </div>
                  </div>
                  <div style="text-align: right; flex-shrink: 0;">
                    <div style="font-size: var(--text-sm); font-weight: 800; color: var(--text-primary);">
                      ${WalletEngine.formatRupee(commitment.amount)}
                    </div>
                    <div style="margin-top: 2px;">
                      ${status.isFunded
                        ? `<span class="badge badge-success" style="font-size: 0.62rem; padding: 2px 6px;">● Funds Ready</span>`
                        : `<span class="badge badge-danger" style="font-size: 0.62rem; padding: 2px 6px;">Shortfall ${WalletEngine.formatRupee(status.shortfall)}</span>`
                      }
                    </div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.05); font-size: 0.72rem;">
                  <span style="color: var(--text-muted);">
                    ${CommitmentEngine.formatDueDate(commitment.dueDate)} • ${CommitmentEngine.getFrequencyLabel(commitment.frequency)}
                  </span>
                  <div style="display: flex; gap: 6px;">
                    ${!status.isFunded ? `
                      <button class="btn btn-sm btn-ghost btn-home-commitment-add-money" data-wallet-id="${commitment.walletId || commitment.preferredWalletId}" data-commitment-id="${commitment.id}" style="padding: 3px 8px; font-size: 0.7rem; color: var(--accent-primary); width: auto;">
                        + Add Money
                      </button>
                    ` : ''}
                    <button class="btn btn-sm btn-primary btn-home-commitment-view" data-commitment-id="${commitment.id}" style="padding: 3px 10px; font-size: 0.7rem; width: auto;">
                      View & Pay
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}

      <!-- Purpose Wallets Section -->
      <div class="section-header" style="margin-top: 16px;">
        <h3 class="section-title">Your Wallets (${wallets.length})</h3>
        <a href="#" class="section-link" id="link-view-all-wallets">Manage Wallets →</a>
      </div>

      <div class="wallets-list">
        ${wallets
          .map((wallet) => {
            const progress = WalletEngine.getWalletProgress(wallet);
            const balanceStr = isHidden ? '••••' : WalletEngine.formatRupee(wallet.balance);
            const targetStr = wallet.targetAmount > 0
              ? `/ ${WalletEngine.formatRupee(wallet.targetAmount)}`
              : wallet.monthlyLimit > 0
              ? `Limit ${WalletEngine.formatRupee(wallet.monthlyLimit)}`
              : 'Flexible';

            return `
              <div class="wallet-card" data-wallet-id="${wallet.id}" style="--wallet-color: ${wallet.color || 'var(--accent-primary)'};">
                <div class="wallet-header">
                  <div class="wallet-identity">
                    <div class="wallet-icon-box" style="background: ${wallet.color ? wallet.color + '20' : 'var(--accent-light)'};">
                      ${wallet.icon || '💼'}
                    </div>
                    <div class="wallet-name-wrap">
                      <div class="wallet-name">${wallet.name}</div>
                      <div class="wallet-badge">${wallet.category || 'Purpose'}</div>
                    </div>
                  </div>
                  <div class="wallet-balance-wrap">
                    <div class="wallet-balance">${balanceStr}</div>
                    <div class="wallet-target">${targetStr}</div>
                  </div>
                </div>

                <div class="progress-container">
                  <div class="progress-bar ${progress.isDanger ? 'danger' : progress.isWarning ? 'warning' : ''}" style="width: ${progress.percent}%;"></div>
                </div>

                <div class="wallet-footer">
                  <span>${progress.statusText}</span>
                  <span>${wallet.allocationPercentage ? wallet.allocationPercentage + '% auto-split' : 'Manual'}</span>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;

    this.bindEvents();
  }

  static bindEvents() {
    // Profile badge shortcut
    const profileBadge = document.getElementById('btn-home-profile-badge');
    if (profileBadge) {
      profileBadge.addEventListener('click', () => {
        NavigationManager.switchTab('profile');
        SoundEngine.playTap();
      });
    }

    // Privacy toggle
    const privacyBtn = document.getElementById('btn-toggle-privacy');
    if (privacyBtn) {
      privacyBtn.addEventListener('click', () => {
        stateManager.toggleBalancePrivacy();
        SoundEngine.playTap();
      });
    }

    // Quick actions
    const receiveBtn = document.getElementById('action-receive-money');
    if (receiveBtn) {
      receiveBtn.addEventListener('click', () => {
        ReceiveModal.open();
      });
    }

    const payBtn = document.getElementById('action-quick-pay');
    if (payBtn) {
      payBtn.addEventListener('click', () => {
        NavigationManager.switchTab('pay');
      });
    }

    const addCommitmentActionBtn = document.getElementById('action-add-commitment');
    if (addCommitmentActionBtn) {
      addCommitmentActionBtn.addEventListener('click', () => {
        CommitmentModal.openAdd();
      });
    }

    const splitBillsBtn = document.getElementById('action-split-bills');
    if (splitBillsBtn) {
      splitBillsBtn.addEventListener('click', () => {
        SplitBillView.open();
      });
    }

    const pendingBanner = document.getElementById('banner-pending-collect');
    if (pendingBanner) {
      pendingBanner.addEventListener('click', () => {
        CollectModal.open();
      });
    }

    const moveBtn = document.getElementById('action-move-money');
    if (moveBtn) {
      moveBtn.addEventListener('click', () => {
        MoveModal.open();
      });
    }

    const splitBtn = document.getElementById('action-split-rules');
    if (splitBtn) {
      splitBtn.addEventListener('click', () => {
        SplitView.open();
      });
    }

    const manageLink = document.getElementById('link-view-all-wallets');
    if (manageLink) {
      manageLink.addEventListener('click', (e) => {
        e.preventDefault();
        NavigationManager.switchTab('wallets');
      });
    }

    // Add commitment buttons (header and empty state)
    const headerAddCommitmentBtn = document.getElementById('btn-home-add-commitment-header');
    if (headerAddCommitmentBtn) {
      headerAddCommitmentBtn.addEventListener('click', () => {
        CommitmentModal.openAdd();
      });
    }

    const emptyAddCommitmentBtn = document.getElementById('btn-home-empty-add-commitment');
    if (emptyAddCommitmentBtn) {
      emptyAddCommitmentBtn.addEventListener('click', () => {
        CommitmentModal.openAdd();
      });
    }

    // Shortfall alert actions
    this.container.querySelectorAll('.btn-alert-add-money').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const walletId = btn.getAttribute('data-wallet-id');
        const commitmentId = btn.getAttribute('data-commitment-id');
        const commitment = stateManager.getCommitment(commitmentId);
        const funding = commitment ? CommitmentEngine.calculateFunding(commitment, stateManager.getWallets()) : null;
        FundingModal.open(walletId, funding ? funding.shortfall : null, commitment ? commitment.name : '');
      });
    });

    this.container.querySelectorAll('.btn-alert-view-payment').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-commitment-id');
        CommitmentModal.openView(id);
      });
    });

    this.container.querySelectorAll('.btn-alert-change-wallet').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-commitment-id');
        CommitmentModal.openChangeWallet(id);
      });
    });

    // Commitment card item view / actions
    this.container.querySelectorAll('.btn-home-commitment-view').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-commitment-id');
        CommitmentModal.openView(id);
      });
    });

    this.container.querySelectorAll('.btn-home-commitment-add-money').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const walletId = btn.getAttribute('data-wallet-id');
        const commitmentId = btn.getAttribute('data-commitment-id');
        const commitment = stateManager.getCommitment(commitmentId);
        const funding = commitment ? CommitmentEngine.calculateFunding(commitment, stateManager.getWallets()) : null;
        FundingModal.open(walletId, funding ? funding.shortfall : null, commitment ? commitment.name : '');
      });
    });

    this.container.querySelectorAll('.commitment-home-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-commitment-id');
        CommitmentModal.openView(id);
      });
    });

    // Wallet card clicks -> open Wallet Detail
    const walletCards = this.container.querySelectorAll('.wallet-card');
    walletCards.forEach((card) => {
      card.addEventListener('click', () => {
        const walletId = card.getAttribute('data-wallet-id');
        this.openWalletDetail(walletId);
      });
    });

    // Notification bell -> opens collect requests modal
    const notifBtn = document.getElementById('btn-home-notifications');
    if (notifBtn) {
      notifBtn.addEventListener('click', () => {
        CollectModal.open();
      });
    }
  }

  static openWalletDetail(walletId) {
    const wallet = stateManager.getWallet(walletId);
    if (!wallet) return;

    const modal = document.getElementById('modal-wallet-detail');
    if (!modal) return;

    const transactions = stateManager.getTransactions().filter((t) => t.walletId === wallet.id);
    const progress = WalletEngine.getWalletProgress(wallet);

    const bodyEl = modal.querySelector('.sheet-body');
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 14px; padding-bottom: 8px;">
          <div class="wallet-icon-box" style="width: 52px; height: 52px; font-size: 1.8rem; background: ${wallet.color ? wallet.color + '22' : 'var(--accent-light)'};">
            ${wallet.icon || '💼'}
          </div>
          <div>
            <h3 style="font-size: var(--text-xl); font-weight: 800; color: var(--text-primary);">${wallet.name}</h3>
            <span class="badge badge-accent">${wallet.category || 'Purpose'}</span>
          </div>
        </div>

        <div class="card" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 600;">AVAILABLE IN WALLET</div>
            <div style="font-size: var(--text-3xl); font-weight: 800; color: var(--text-primary);">${WalletEngine.formatRupee(wallet.balance)}</div>
          </div>
          <button class="btn btn-sm btn-primary" id="btn-detail-move-here" style="width: auto;">+ Add Money</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between; font-size: var(--text-xs); font-weight: 600;">
            <span>Target / Progress</span>
            <span>${progress.statusText}</span>
          </div>
          <div class="progress-container" style="height: 10px;">
            <div class="progress-bar ${progress.isDanger ? 'danger' : progress.isWarning ? 'warning' : ''}" style="width: ${progress.percent}%; background: ${wallet.color};"></div>
          </div>
          <div style="font-size: var(--text-xs); color: var(--text-muted); display: flex; justify-content: space-between;">
            <span>Target: ${wallet.targetAmount > 0 ? WalletEngine.formatRupee(wallet.targetAmount) : 'Not set'}</span>
            <span>Auto-split: ${wallet.allocationPercentage || 0}%</span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
          <h4 style="font-size: var(--text-sm); font-weight: 700;">Recent Transactions from this wallet</h4>
          ${transactions.length === 0
            ? `<div style="text-align: center; padding: 20px; font-size: var(--text-xs); color: var(--text-muted);">No spending recorded from this wallet yet.</div>`
            : transactions
                .slice(0, 4)
                .map(
                  (t) => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--bg-subtle); border-radius: var(--radius-md);">
                <div>
                  <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary);">${t.merchantName}</div>
                  <div style="font-size: 0.7rem; color: var(--text-muted);">${new Date(t.date).toLocaleDateString()}</div>
                </div>
                <div style="font-size: var(--text-xs); font-weight: 800; color: ${t.type === 'debit' ? 'var(--text-primary)' : 'var(--success)'};">
                  ${t.type === 'debit' ? '-' : '+'}${WalletEngine.formatRupee(t.amount)}
                </div>
              </div>
            `
                )
                .join('')}
        ${wallet.id === 'wallet_friends' ? `
          <button class="btn btn-secondary btn-sm" id="btn-detail-open-split" style="margin-top: 8px; width: 100%; font-size: var(--text-xs);">
            🍕 Open Split-Bill Groups (Hostel & Trips)
          </button>
        ` : ''}
        </div>
      `;

      // Add money button -> opens actual supported funding options
      const moveHereBtn = bodyEl.querySelector('#btn-detail-move-here');
      if (moveHereBtn) {
        moveHereBtn.addEventListener('click', () => {
          NavigationManager.closeModal('modal-wallet-detail');
          FundingModal.open(wallet.id);
        });
      }

      // Quick split button
      const splitBtn = bodyEl.querySelector('#btn-detail-open-split');
      if (splitBtn) {
        splitBtn.addEventListener('click', () => {
          NavigationManager.closeModal('modal-wallet-detail');
          SplitBillView.open();
        });
      }
    }

    NavigationManager.openModal('modal-wallet-detail');
  }
}
