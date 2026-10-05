/* ==========================================================================
   POCKETPE - FRAUD MODALS & REPORTING UI CONTROLLER
   Handles Report Flow, Risk Score Breakdown, High-Risk Interstitial Warning & Appeals
   ========================================================================== */

import { stateManager } from '../state.js';
import { FraudEngine, REPORT_REASONS, RISK_LEVELS } from '../engines/fraudEngine.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';

export class FraudModal {
  static init() {
    this.targetUpiId = '';
    this.targetDisplayName = '';
    this.onProceedCallback = null;
    this.onDeclineCallback = null;

    this.setupListeners();
  }

  static setupListeners() {
    // Listen for state changes to refresh any open views if needed
    stateManager.subscribe('fraud:reported', () => {});
    stateManager.subscribe('fraud:appealed', () => {});
  }

  /**
   * Open the Report Modal for a specific UPI ID
   */
  static openReportModal(upiId, displayName = '') {
    this.targetUpiId = (upiId || '').trim();
    this.targetDisplayName = displayName || this.targetUpiId;

    const modal = document.getElementById('modal-report-upi');
    if (!modal) return;

    const body = modal.querySelector('.sheet-body');
    const footer = modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    const currentRisk = FraudEngine.evaluateUpiRisk(this.targetUpiId);

    body.innerHTML = `
      <div style="text-align: center; margin-bottom: 12px;">
        <div style="font-size: 2.25rem; margin-bottom: 4px;">🚨</div>
        <h3 class="h3" style="color: var(--text-primary);">Report Suspicious UPI ID</h3>
        <p class="subtitle" style="margin-top: 2px;">Help protect other students from frauds, impersonators, and scam collect requests.</p>
      </div>

      <!-- Target Info Card -->
      <div class="card" style="padding: 12px 14px; background: var(--bg-subtle); display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <div>
          <div style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 600;">REPORTING TARGET</div>
          <div style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">${this.targetDisplayName}</div>
          <div class="mono" style="font-size: 0.72rem; color: var(--accent-primary);">${this.targetUpiId}</div>
        </div>
        <span class="badge ${this.getRiskBadgeClass(currentRisk.level)}">${currentRisk.level} RISK</span>
      </div>

      <!-- Required Reason Selection -->
      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label" style="font-weight: 700;">
          Reason for Report <span style="color: var(--danger);">*</span>
        </label>
        <div class="report-reasons-list" style="display: flex; flex-direction: column; gap: 8px;">
          ${REPORT_REASONS.map(
            (reason, idx) => `
            <label class="reason-radio-label card card-interactive" style="padding: 10px 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; border-radius: var(--radius-sm); margin: 0;">
              <input type="radio" name="report_reason" value="${reason}" ${idx === 0 ? 'checked' : ''} style="accent-color: var(--danger);" />
              <span style="font-size: var(--text-sm); font-weight: 600; color: var(--text-primary);">${reason}</span>
            </label>
          `
          ).join('')}
        </div>
      </div>

      <!-- Optional Details Input -->
      <div class="form-group">
        <label class="form-label">Additional Details (Optional)</label>
        <textarea
          class="input-text"
          id="report-details-input"
          rows="2"
          placeholder="e.g. Sent an unexpected ₹2,000 refund collect request claiming to be power department..."
          style="font-size: var(--text-xs); resize: none;"
        ></textarea>
      </div>

      <!-- Community Safeguard Notice -->
      <div style="display: flex; gap: 6px; font-size: 0.68rem; color: var(--text-muted); padding: 4px 6px;">
        <span>🛡️</span>
        <span>PocketPe uses unique-user ratios, time decay, and device checks to prevent false spam or revenge reporting.</span>
      </div>
    `;

    footer.innerHTML = `
      <button class="btn btn-primary" id="btn-submit-report" style="background: var(--danger); border-color: var(--danger);">
        Submit Report
      </button>
      <button class="btn btn-ghost btn-sm" data-close-modal="modal-report-upi">Cancel</button>
    `;

    // Bind submit
    const submitBtn = footer.querySelector('#btn-submit-report');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        const checkedRadio = body.querySelector('input[name="report_reason"]:checked');
        const reason = checkedRadio ? checkedRadio.value : '';
        const detailsInput = body.querySelector('#report-details-input');
        const details = detailsInput ? detailsInput.value.trim() : '';

        const result = FraudEngine.submitReport({
          reportedUpiId: this.targetUpiId,
          reason,
          details,
        });

        if (result.success) {
          SoundEngine.playSuccess();
          NavigationManager.closeModal('modal-report-upi');
          NavigationManager.showToast(`🛡️ ${result.message}`, 'success', 4000);
        } else {
          SoundEngine.playProtectionAlert();
          NavigationManager.showToast(result.error, 'danger', 4500);
        }
      });
    }

    NavigationManager.openModal('modal-report-upi');
  }

  /**
   * Open the detailed Risk Score Breakdown & Appeal modal
   */
  static openRiskDetailModal(upiId, displayName = '') {
    const targetUpi = (upiId || '').trim();
    const modal = document.getElementById('modal-upi-risk-detail');
    if (!modal) return;

    const body = modal.querySelector('.sheet-body');
    const footer = modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    const risk = FraudEngine.evaluateUpiRisk(targetUpi);
    const badgeClass = this.getRiskBadgeClass(risk.level);

    body.innerHTML = `
      <div style="text-align: center; padding: 6px 0;">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 50%; background: ${this.getRiskBgColor(risk.level)}; font-size: 1.75rem; margin-bottom: 8px;">
          ${risk.level === RISK_LEVELS.HIGH ? '🚨' : risk.level === RISK_LEVELS.CAUTION ? '⚠️' : '✅'}
        </div>
        <h3 class="h3" style="color: var(--text-primary);">${displayName || targetUpi}</h3>
        <div class="mono" style="font-size: var(--text-xs); color: var(--text-muted);">${targetUpi}</div>
        <div style="margin-top: 6px;">
          <span class="badge ${badgeClass}" style="font-size: 0.8rem; padding: 4px 12px;">${risk.level} RISK</span>
          ${risk.underReview ? '<span class="badge badge-warning" style="margin-left: 6px;">⚖️ Under Review</span>' : ''}
        </div>
      </div>

      <!-- Under Review Notice if Appeal exists -->
      ${
        risk.underReview
          ? `
        <div class="card" style="padding: 12px; border-left: 4px solid var(--warning); background: var(--warning-light); margin: 8px 0;">
          <div style="font-size: var(--text-xs); font-weight: 700; color: var(--warning);">⚖️ Appeal Under Review</div>
          <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 2px;">
            The account owner submitted an appeal on ${new Date(risk.appeal.createdAt).toLocaleDateString()}. Community reports remain visible while verified moderators review KYC documents.
          </div>
        </div>
      `
          : ''
      }

      <!-- Risk Metric Breakdown Card -->
      <div class="card" style="padding: 14px; margin-top: 10px;">
        <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-muted); letter-spacing: 0.05em; margin-bottom: 10px;">
          COMMUNITY SPAM METRICS
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
          <div style="background: var(--bg-subtle); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
            <div style="font-size: var(--text-xs); color: var(--text-muted);">Spam Score</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: ${this.getRiskColor(risk.level)};">${Math.round(risk.score * 100)}%</div>
            <div style="font-size: 0.65rem; color: var(--text-muted);">unique reports / interactions</div>
          </div>
          <div style="background: var(--bg-subtle); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
            <div style="font-size: var(--text-xs); color: var(--text-muted);">Unique Reporters</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: var(--text-primary);">${risk.uniqueReporters}</div>
            <div style="font-size: 0.65rem; color: var(--text-muted);">${risk.meetsThreshold ? 'Threshold met (≥5)' : 'Below threshold (<5)'}</div>
          </div>
        </div>

        <div style="font-size: var(--text-xs); color: var(--text-secondary); line-height: 1.5;">
          <strong>Summary:</strong> ${risk.reasonSummary}
        </div>
      </div>

      <!-- Extra Signals Box -->
      ${
        risk.extraSignals.length > 0
          ? `
        <div class="card" style="padding: 14px; margin-top: 10px;">
          <div style="font-size: var(--text-xs); font-weight: 700; color: var(--danger); margin-bottom: 8px;">
            ⚠️ EXTRA RISK SIGNALS DETECTED
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${risk.extraSignals
              .map(
                (sig) => `
              <div style="display: flex; align-items: center; gap: 8px; font-size: var(--text-xs); color: var(--text-primary);">
                <span>${sig.severity === 'high' ? '🚩' : '⚡'}</span>
                <span>${sig.label}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
          : ''
      }

      <!-- Appeal Form Section (if flagged user or testing appeal) -->
      ${
        !risk.underReview && risk.level !== RISK_LEVELS.LOW
          ? `
        <div class="card" style="padding: 14px; margin-top: 10px; background: var(--bg-subtle);">
          <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
            Is this your account or a mistake?
          </div>
          <p style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 8px;">
            Submit an appeal with legitimate context. Your flag will be marked "Under Review" pending investigation.
          </p>
          <div style="display: flex; gap: 6px;">
            <input type="text" class="input-text" id="appeal-reason-input" placeholder="e.g. I am a registered student club treasurer..." style="font-size: var(--text-xs);" />
            <button class="btn btn-sm btn-secondary" id="btn-submit-appeal" style="width: auto; padding: 6px 14px;">
              Appeal
            </button>
          </div>
        </div>
      `
          : ''
      }
    `;

    footer.innerHTML = `
      <div style="display: flex; gap: 10px; width: 100%;">
        <button class="btn btn-secondary" id="btn-open-report-from-detail" style="flex: 1;">
          🚩 Report Target
        </button>
        <button class="btn btn-primary" data-close-modal="modal-upi-risk-detail" style="flex: 1;">
          Done
        </button>
      </div>
    `;

    // Appeal button click
    const appealBtn = body.querySelector('#btn-submit-appeal');
    if (appealBtn) {
      appealBtn.addEventListener('click', () => {
        const input = body.querySelector('#appeal-reason-input');
        const reason = input ? input.value.trim() : '';
        const res = FraudEngine.submitAppeal(targetUpi, reason);
        if (res.success) {
          SoundEngine.playSuccess();
          NavigationManager.showToast('✅ Appeal submitted. Marked as Under Review.', 'success');
          this.openRiskDetailModal(targetUpi, displayName);
        } else {
          NavigationManager.showToast(res.error, 'danger');
        }
      });
    }

    // Report from detail
    const repBtn = footer.querySelector('#btn-open-report-from-detail');
    if (repBtn) {
      repBtn.addEventListener('click', () => {
        NavigationManager.closeModal('modal-upi-risk-detail');
        this.openReportModal(targetUpi, displayName);
      });
    }

    NavigationManager.openModal('modal-upi-risk-detail');
  }

  /**
   * High-Risk Interstitial Confirmation Alert
   * Shown when paying or accepting a High-Risk UPI ID
   */
  static showHighRiskWarning({ upiId, displayName, amount, onProceed, onDeclineAndReport }) {
    this.targetUpiId = upiId;
    this.targetDisplayName = displayName;
    this.onProceedCallback = onProceed;
    this.onDeclineCallback = onDeclineAndReport;

    const modal = document.getElementById('modal-high-risk-warning');
    if (!modal) {
      // Fallback to browser confirm if modal DOM missing
      if (confirm(`⚠️ HIGH RISK ALERT: ${displayName} (${upiId}) has been heavily reported for fraud by the community. Do you still want to proceed?`)) {
        if (onProceed) onProceed();
      } else {
        if (onDeclineAndReport) onDeclineAndReport();
      }
      return;
    }

    const body = modal.querySelector('.sheet-body');
    const footer = modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    const risk = FraudEngine.evaluateUpiRisk(upiId);

    body.innerHTML = `
      <div style="text-align: center; padding: 8px 0;">
        <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--danger-light); border: 2px solid var(--danger); display: inline-flex; align-items: center; justify-content: center; font-size: 2rem; margin-bottom: 8px; animation: pulse 1.5s infinite;">
          🚨
        </div>
        <h3 class="h3" style="color: var(--danger); font-size: 1.25rem;">High-Risk Payment Alert</h3>
        <p class="subtitle" style="margin-top: 4px; color: var(--text-primary); font-weight: 600;">
          This recipient has been reported for scams by multiple users.
        </p>
      </div>

      <div class="card" style="padding: 14px; background: rgba(239, 68, 68, 0.08); border: 1.5px solid var(--danger-border); margin: 10px 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: var(--text-xs); font-weight: 700; color: var(--danger);">COMMUNITY REPORT SUMMARY</span>
          <span class="badge" style="background: var(--danger); color: white;">${risk.score * 100}% Spam Score</span>
        </div>
        <div style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
          ${risk.reasonSummary}
        </div>
        <div class="mono" style="font-size: 0.75rem; color: var(--text-muted);">${upiId}</div>
      </div>

      <div style="font-size: var(--text-xs); color: var(--text-secondary); line-height: 1.5; padding: 0 4px;">
        💡 <strong>PocketPe Security Shield:</strong> Genuine companies or officials never ask you to pay fines or claim refunds via personal UPI collect requests.
      </div>
    `;

    footer.innerHTML = `
      <button class="btn btn-primary" id="btn-decline-and-report" style="background: var(--danger); border-color: var(--danger);">
        🛑 Decline & Report Recipient
      </button>
      <button class="btn btn-ghost btn-sm" id="btn-proceed-high-risk" style="color: var(--text-muted);">
        I know this sender, proceed anyway →
      </button>
    `;

    // Decline & Report
    footer.querySelector('#btn-decline-and-report').addEventListener('click', () => {
      SoundEngine.playTap();
      NavigationManager.closeModal('modal-high-risk-warning');
      if (this.onDeclineCallback) {
        this.onDeclineCallback();
      }
      this.openReportModal(upiId, displayName);
    });

    // Proceed anyway
    footer.querySelector('#btn-proceed-high-risk').addEventListener('click', () => {
      SoundEngine.playTap();
      NavigationManager.closeModal('modal-high-risk-warning');
      if (this.onProceedCallback) {
        this.onProceedCallback();
      }
    });

    SoundEngine.playProtectionAlert();
    NavigationManager.openModal('modal-high-risk-warning');
  }

  /**
   * Helper: Generate a small inline risk pill HTML
   */
  static renderRiskBadgeHtml(upiId, withClickToView = true) {
    if (!upiId) return '';
    const risk = FraudEngine.evaluateUpiRisk(upiId);
    const badgeClass = this.getRiskBadgeClass(risk.level);
    const icon = risk.level === RISK_LEVELS.HIGH ? '🚨' : risk.level === RISK_LEVELS.CAUTION ? '⚠️' : '🛡️';

    return `
      <span
        class="badge ${badgeClass} inline-risk-pill"
        data-risk-upi="${upiId}"
        style="cursor: ${withClickToView ? 'pointer' : 'default'}; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"
        title="${risk.reasonSummary}"
      >
        <span>${icon}</span>
        <span>${risk.level} RISK</span>
        ${risk.underReview ? '<span>(Under Review)</span>' : ''}
      </span>
    `;
  }

  // --- Style Helpers ---
  static getRiskBadgeClass(level) {
    if (level === RISK_LEVELS.HIGH) return 'badge-risk-high';
    if (level === RISK_LEVELS.CAUTION) return 'badge-risk-caution';
    return 'badge-risk-low';
  }

  static getRiskColor(level) {
    if (level === RISK_LEVELS.HIGH) return 'var(--danger)';
    if (level === RISK_LEVELS.CAUTION) return 'var(--warning)';
    return 'var(--success)';
  }

  static getRiskBgColor(level) {
    if (level === RISK_LEVELS.HIGH) return 'var(--danger-light)';
    if (level === RISK_LEVELS.CAUTION) return 'var(--warning-light)';
    return 'var(--success-light)';
  }
}
