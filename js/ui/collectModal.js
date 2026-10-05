/* ==========================================================================
   POCKETPE - INCOMING COLLECT REQUESTS CONTROLLER
   Simulates UPI collect requests with Community Spam Risk badges and 1-tap Report
   ========================================================================== */

import { stateManager } from '../state.js';
import { WalletEngine } from '../engines/walletEngine.js';
import { FraudEngine, RISK_LEVELS } from '../engines/fraudEngine.js';
import { FraudModal } from './fraudModal.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';
import { PayView } from './payView.js';

export class CollectModal {
  static init() {
    this.modal = document.getElementById('modal-collect-requests');
    this.setupListeners();
  }

  static open() {
    this.render();
    NavigationManager.openModal('modal-collect-requests');
  }

  static setupListeners() {
    stateManager.subscribe('collect:updated', () => {
      this.render();
      this.updateHeaderBadge();
    });
    stateManager.subscribe('fraud:reported', () => this.render());
  }

  static updateHeaderBadge() {
    const requests = stateManager.getCollectRequests().filter((r) => r.status === 'pending');
    const badge = document.getElementById('pending-collect-badge');
    if (badge) {
      if (requests.length > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = requests.length;
      } else {
        badge.style.display = 'none';
      }
    }
  }

  static render() {
    const modal = document.getElementById('modal-collect-requests');
    if (!modal) return;

    const body = modal.querySelector('.sheet-body');
    const footer = modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    const requests = stateManager.getCollectRequests();
    const pending = requests.filter((r) => r.status === 'pending');

    body.innerHTML = `
      <div style="text-align: center; margin-bottom: 12px;">
        <span class="badge badge-accent">UPI Collect</span>
        <h3 class="h3" style="color: var(--text-primary); margin-top: 4px;">Incoming Money Requests</h3>
        <p class="subtitle">Protected by Truecaller-style Community Spam Verification</p>
      </div>

      ${
        pending.length === 0
          ? `
        <div style="text-align: center; padding: 30px 16px; background: var(--bg-subtle); border-radius: var(--radius-lg);">
          <div style="font-size: 2.25rem; margin-bottom: 6px;">🎉</div>
          <h4 class="h4">No Pending Collect Requests</h4>
          <p class="subtitle">You have no outstanding payment requests from friends or merchants.</p>
        </div>
      `
          : `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${pending
            .map((req) => {
              const risk = FraudEngine.evaluateUpiRisk(req.upiId);
              const badgeClass = FraudModal.getRiskBadgeClass(risk.level);
              const isHighRisk = risk.level === RISK_LEVELS.HIGH;

              return `
              <div class="card ${isHighRisk ? 'card-risk-alert' : ''}" style="padding: 14px; border: 1.5px solid ${isHighRisk ? 'var(--danger-border)' : 'var(--border-subtle)'}; background: ${isHighRisk ? 'rgba(239, 68, 68, 0.04)' : 'var(--bg-surface)'};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                  <div>
                    <div style="font-size: var(--text-md); font-weight: 700; color: var(--text-primary);">${req.requesterName}</div>
                    <div class="mono" style="font-size: 0.72rem; color: var(--text-muted);">${req.upiId}</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: var(--text-lg); font-weight: 800; color: var(--text-primary);">${WalletEngine.formatRupee(req.amount)}</div>
                    <div style="font-size: 0.65rem; color: var(--text-muted);">${new Date(req.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>

                <!-- Community Risk Banner -->
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: ${FraudModal.getRiskBgColor(risk.level)}; border-radius: var(--radius-xs); margin-bottom: 8px;">
                  <div style="display: flex; align-items: center; gap: 6px; font-size: 0.72rem; font-weight: 600; color: ${FraudModal.getRiskColor(risk.level)};">
                    <span>${isHighRisk ? '🚨' : risk.level === RISK_LEVELS.CAUTION ? '⚠️' : '🛡️'}</span>
                    <span>${risk.reasonSummary}</span>
                  </div>
                  <button class="btn btn-ghost btn-sm" data-view-risk="${req.upiId}" style="padding: 2px 6px; font-size: 0.65rem; height: auto;">
                    Details
                  </button>
                </div>

                <div style="font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: 12px; font-style: italic;">
                  "${req.note}"
                </div>

                <!-- Action Buttons: Decline & Report vs Pay -->
                <div style="display: flex; gap: 8px;">
                  <button class="btn btn-secondary btn-sm" data-decline-req="${req.id}" data-upi="${req.upiId}" data-name="${req.requesterName}" style="flex: 1; font-size: var(--text-xs); color: var(--danger);">
                    <span>🛑</span> <span>Decline & Report</span>
                  </button>
                  <button class="btn btn-primary btn-sm" data-pay-req="${req.id}" data-upi="${req.upiId}" data-name="${req.requesterName}" data-amt="${req.amount}" style="flex: 1; font-size: var(--text-xs);">
                    <span>Pay ${WalletEngine.formatRupee(req.amount)}</span>
                  </button>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      `
      }
    `;

    footer.innerHTML = `
      <button class="btn btn-secondary" data-close-modal="modal-collect-requests">Close</button>
    `;

    // View risk detail
    body.querySelectorAll('[data-view-risk]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const upi = btn.getAttribute('data-view-risk');
        FraudModal.openRiskDetailModal(upi);
      });
    });

    // Decline and report button
    body.querySelectorAll('[data-decline-req]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const reqId = btn.getAttribute('data-decline-req');
        const upi = btn.getAttribute('data-upi');
        const name = btn.getAttribute('data-name');

        stateManager.updateCollectRequestStatus(reqId, 'declined');
        SoundEngine.playTap();
        NavigationManager.showToast(`Declined collect request from ${name}`, 'info');
        NavigationManager.closeModal('modal-collect-requests');

        // Open community report modal
        FraudModal.openReportModal(upi, name);
      });
    });

    // Pay button click
    body.querySelectorAll('[data-pay-req]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const reqId = btn.getAttribute('data-pay-req');
        const upi = btn.getAttribute('data-upi');
        const name = btn.getAttribute('data-name');
        const amt = Number(btn.getAttribute('data-amt'));

        const risk = FraudEngine.evaluateUpiRisk(upi);

        if (risk.level === RISK_LEVELS.HIGH) {
          // Trigger High-Risk Interstitial Warning!
          FraudModal.showHighRiskWarning({
            upiId: upi,
            displayName: name,
            amount: amt,
            onProceed: () => {
              NavigationManager.closeModal('modal-collect-requests');
              stateManager.updateCollectRequestStatus(reqId, 'paid');
              PayView.initiatePaymentFlow({
                merchantName: name,
                amount: amt,
                category: 'General Expense',
                icon: '⚡',
                upiId: upi,
              });
            },
            onDeclineAndReport: () => {
              stateManager.updateCollectRequestStatus(reqId, 'declined');
              NavigationManager.closeModal('modal-collect-requests');
            },
          });
        } else {
          NavigationManager.closeModal('modal-collect-requests');
          stateManager.updateCollectRequestStatus(reqId, 'paid');
          PayView.initiatePaymentFlow({
            merchantName: name,
            amount: amt,
            category: 'General Expense',
            icon: '⚡',
            upiId: upi,
          });
        }
      });
    });
  }
}
