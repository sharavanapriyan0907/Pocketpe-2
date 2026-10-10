/* ==========================================================================
   POCKETPE - FINANCIAL COMMITMENT & PAYMENT PLANNER MODAL
   Allows users to add custom financial commitments, inspect shortfall
   diagnostics, change assigned wallets, and initiate real payment execution.
   ========================================================================== */

import { stateManager } from '../state.js';
import { CommitmentEngine, COMMITMENT_CATEGORIES, RECURRENCE_FREQUENCIES, EXECUTION_STATUSES } from '../engines/commitmentEngine.js';
import { WalletEngine } from '../engines/walletEngine.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';
import { FundingModal } from './fundingModal.js';

export class CommitmentModal {
  static init() {
    // Initialized modal controller
  }

  static openAdd(prefilledWalletId = null) {
    const modal = document.getElementById('modal-add-commitment');
    if (!modal) return;

    const wallets = stateManager.getWallets();
    const today = new Date();
    // Default due date: 7 days from now
    const defaultDueDate = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];

    const body = modal.querySelector('.sheet-body');
    if (!body) return;

    body.innerHTML = `
      <form id="form-create-commitment" style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: rgba(59, 130, 246, 0.05); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid rgba(59, 130, 246, 0.15); font-size: 0.76rem; color: var(--text-secondary); line-height: 1.45;">
          🗓️ <strong>Plan your upcoming payments</strong><br />
          Add your commitments to track due dates, verify wallet readiness, and prevent payment shortfalls.
        </div>

        <!-- 1. Custom Payment Name (User entered) -->
        <div class="form-group" style="margin-bottom: 0;">
          <label class="label-text" for="input-commitment-name" style="font-size: var(--text-xs); font-weight: 700;">
            Payment Name <span style="color: var(--danger);">*</span>
          </label>
          <input
            type="text"
            id="input-commitment-name"
            class="input-text"
            placeholder="e.g. Monthly rent, College fees, My bike loan, Electricity bill"
            required
            autocomplete="off"
            style="width: 100%;"
          />
          <span style="font-size: 0.68rem; color: var(--text-muted); margin-top: 3px; display: block;">
            Give this payment a personalized name that makes sense to you.
          </span>
        </div>

        <!-- 2. Payee / Biller Name (Optional) -->
        <div class="form-group" style="margin-bottom: 0;">
          <label class="label-text" for="input-commitment-payee" style="font-size: var(--text-xs); font-weight: 700;">
            Payee / Biller (Optional)
          </label>
          <input
            type="text"
            id="input-commitment-payee"
            class="input-text"
            placeholder="e.g. Landlord, University, BESCOM, Bank"
            autocomplete="off"
            style="width: 100%;"
          />
        </div>

        <!-- 3. Amount & Due Date Row -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="label-text" for="input-commitment-amount" style="font-size: var(--text-xs); font-weight: 700;">
              Amount (₹) <span style="color: var(--danger);">*</span>
            </label>
            <input
              type="number"
              id="input-commitment-amount"
              class="input-text"
              placeholder="5000"
              min="1"
              step="1"
              required
              style="width: 100%;"
            />
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="label-text" for="input-commitment-due-date" style="font-size: var(--text-xs); font-weight: 700;">
              Due Date <span style="color: var(--danger);">*</span>
            </label>
            <input
              type="date"
              id="input-commitment-due-date"
              class="input-text"
              value="${defaultDueDate}"
              required
              style="width: 100%;"
            />
          </div>
        </div>

        <!-- 4. Frequency & Category Row -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="label-text" for="select-commitment-freq" style="font-size: var(--text-xs); font-weight: 700;">
              Frequency
            </label>
            <select id="select-commitment-freq" class="input-text" style="width: 100%;">
              ${RECURRENCE_FREQUENCIES.map((f) => `<option value="${f.id}">${f.label}</option>`).join('')}
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="label-text" for="select-commitment-category" style="font-size: var(--text-xs); font-weight: 700;">
              Category
            </label>
            <select id="select-commitment-category" class="input-text" style="width: 100%;">
              ${COMMITMENT_CATEGORIES.map((c) => `<option value="${c.label}">${c.icon} ${c.label}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- 5. Preferred Purpose Wallet -->
        <div class="form-group" style="margin-bottom: 0;">
          <label class="label-text" for="select-commitment-wallet" style="font-size: var(--text-xs); font-weight: 700;">
            Preferred Purpose Wallet <span style="color: var(--danger);">*</span>
          </label>
          <select id="select-commitment-wallet" class="input-text" style="width: 100%;" required>
            ${wallets
              .map(
                (w) => `
              <option value="${w.id}" ${prefilledWalletId === w.id ? 'selected' : ''}>
                ${w.icon || '💼'} ${w.name} (Available: ${WalletEngine.formatRupee(w.balance)})
              </option>
            `
              )
              .join('')}
          </select>
          <span style="font-size: 0.68rem; color: var(--text-muted); margin-top: 3px; display: block;">
            The wallet where funds should be ready before the due date.
          </span>
        </div>

        <!-- 6. Optional Notes -->
        <div class="form-group" style="margin-bottom: 0;">
          <label class="label-text" for="input-commitment-notes" style="font-size: var(--text-xs); font-weight: 700;">
            Optional Notes
          </label>
          <input
            type="text"
            id="input-commitment-notes"
            class="input-text"
            placeholder="Account / reference number or notes"
            autocomplete="off"
            style="width: 100%;"
          />
        </div>

        <!-- Planning vs Execution Disclaimer -->
        <div style="font-size: 0.69rem; color: var(--text-muted); background: var(--bg-subtle); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); line-height: 1.4;">
          ℹ️ <strong>Payment Planning Only</strong>: Adding this commitment schedules the due date and tracks wallet readiness. It does not initiate an automatic bank debit or transfer money until you review and confirm.
        </div>

        <button type="submit" class="btn btn-primary" id="btn-submit-commitment" style="margin-top: 4px; min-height: 44px;">
          + Save Payment Commitment
        </button>
      </form>
    `;

    const form = body.querySelector('#form-create-commitment');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = body.querySelector('#input-commitment-name').value.trim();
        const payee = body.querySelector('#input-commitment-payee').value.trim();
        const amount = Number(body.querySelector('#input-commitment-amount').value);
        const dueDate = body.querySelector('#input-commitment-due-date').value;
        const frequency = body.querySelector('#select-commitment-freq').value;
        const category = body.querySelector('#select-commitment-category').value;
        const walletId = body.querySelector('#select-commitment-wallet').value;
        const notes = body.querySelector('#input-commitment-notes').value.trim();

        if (!name || isNaN(amount) || amount <= 0 || !dueDate) {
          NavigationManager.showToast('Please enter a valid payment name, amount, and due date.', 'warning');
          return;
        }

        const newCommitment = stateManager.addCommitment({
          name,
          payee,
          amount,
          dueDate,
          frequency,
          category,
          walletId,
          notes,
          status: 'PLANNED',
        });

        SoundEngine.playSuccess();
        NavigationManager.closeModal('modal-add-commitment');
        NavigationManager.showToast(`✨ Added "${newCommitment.name}" to your payments schedule!`, 'success');
      });
    }

    NavigationManager.openModal('modal-add-commitment');
  }

  static openView(commitmentId) {
    const commitment = stateManager.getCommitment(commitmentId);
    if (!commitment) return;

    const modal = document.getElementById('modal-view-commitment');
    if (!modal) return;

    const wallets = stateManager.getWallets();
    const funding = CommitmentEngine.calculateFunding(commitment, wallets);
    const dueInfo = CommitmentEngine.getDueDateDisplay(commitment.dueDate);

    const body = modal.querySelector('.sheet-body');
    const footer = modal.querySelector('.sheet-footer');
    if (!body) return;

    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <!-- Header Row -->
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border-subtle);">
          <div>
            <span class="badge badge-accent" style="font-size: 0.65rem; margin-bottom: 4px; display: inline-block;">
              ${commitment.category || 'Financial Commitment'} • ${commitment.frequency.toUpperCase()}
            </span>
            <h3 class="h3" style="font-size: var(--text-lg); margin-bottom: 2px; color: var(--text-primary);">
              ${commitment.name}
            </h3>
            ${commitment.payee ? `<div style="font-size: 0.78rem; color: var(--text-secondary);">Payee: <strong>${commitment.payee}</strong></div>` : ''}
          </div>

          <div style="text-align: right;">
            <div style="font-size: var(--text-2xl); font-weight: 800; color: var(--text-primary);">
              ${WalletEngine.formatRupee(commitment.amount)}
            </div>
            <div style="font-size: 0.72rem; font-weight: 700; color: ${dueInfo.isOverdue ? 'var(--danger)' : dueInfo.isDueSoon ? 'var(--warning)' : 'var(--text-muted)'};">
              ${dueInfo.relativeLabel}
            </div>
          </div>
        </div>

        <!-- Shortfall Alert Box (Only if insufficient funds!) -->
        ${!funding.hasSufficientFunds ? `
          <div style="background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--danger); font-size: var(--text-xs);">
              <span>⚠️</span>
              <span>Insufficient funds for your upcoming payment.</span>
            </div>
            <div style="font-size: 0.76rem; color: var(--text-primary); line-height: 1.4;">
              Your available balance in <strong>${funding.wallet ? funding.wallet.name : 'wallet'}</strong> is <strong>${WalletEngine.formatRupee(funding.availableBalance)}</strong>. You need another <strong>${WalletEngine.formatRupee(funding.shortfall)}</strong> to cover this payment.
            </div>
            <div style="display: flex; gap: 8px; margin-top: 4px; flex-wrap: wrap;">
              <button class="btn btn-sm btn-primary" id="btn-view-add-money" style="width: auto; padding: 6px 14px; font-size: 0.74rem;">
                + Add Money (₹${funding.shortfall.toLocaleString('en-IN')})
              </button>
              <button class="btn btn-sm btn-secondary" id="btn-view-change-wallet" style="width: auto; padding: 6px 12px; font-size: 0.74rem;">
                Change Wallet
              </button>
            </div>
          </div>
        ` : `
          <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: var(--radius-md); padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px; font-size: var(--text-xs); color: var(--success); font-weight: 700;">
              <span>✅</span>
              <span>Funds available in ${funding.wallet ? funding.wallet.name : 'wallet'}</span>
            </div>
            <span style="font-weight: 700; font-size: 0.78rem; color: var(--text-primary);">
              ${WalletEngine.formatRupee(funding.availableBalance)} ready
            </span>
          </div>
        `}

        <!-- Details Grid -->
        <div class="card" style="display: flex; flex-direction: column; gap: 10px; padding: 12px 14px;">
          <div style="display: flex; justify-content: space-between; font-size: var(--text-xs);">
            <span style="color: var(--text-muted);">Assigned Wallet</span>
            <span style="font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 5px;">
              <span>${funding.wallet?.icon || '💼'}</span>
              <span>${funding.wallet?.name || 'Unassigned'}</span>
            </span>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: var(--text-xs);">
            <span style="color: var(--text-muted);">Due Date</span>
            <span style="font-weight: 700; color: var(--text-primary);">${dueInfo.formattedDate}</span>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: var(--text-xs);">
            <span style="color: var(--text-muted);">Execution Status</span>
            <span class="badge ${commitment.status === 'SUCCESS' ? 'badge-success' : 'badge-accent'}" style="font-size: 0.65rem;">
              ${EXECUTION_STATUSES[commitment.status] || 'Planned payment'}
            </span>
          </div>

          ${commitment.notes ? `
            <div style="display: flex; flex-direction: column; gap: 3px; font-size: var(--text-xs); padding-top: 6px; border-top: 1px dashed var(--border-subtle);">
              <span style="color: var(--text-muted);">Notes</span>
              <span style="color: var(--text-primary); font-weight: 500;">${commitment.notes}</span>
            </div>
          ` : ''}

          ${commitment.lastPaidAt ? `
            <div style="display: flex; justify-content: space-between; font-size: var(--text-xs); padding-top: 6px; border-top: 1px dashed var(--border-subtle);">
              <span style="color: var(--text-muted);">Last Paid</span>
              <span style="color: var(--success); font-weight: 600;">
                ${new Date(commitment.lastPaidAt).toLocaleDateString('en-IN')}
              </span>
            </div>
          ` : ''}
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
          <button class="btn btn-primary" id="btn-view-pay-now" style="min-height: 44px;">
            ⚡ Pay Now (${WalletEngine.formatRupee(commitment.amount)})
          </button>

          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" id="btn-view-change-wallet-alt" style="flex: 1;">
              🔄 Change Wallet
            </button>
            <button class="btn btn-ghost btn-sm" id="btn-view-delete-commitment" style="flex: 1; color: var(--danger);">
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind Add Money button inside view
    const addMoneyBtn = body.querySelector('#btn-view-add-money');
    if (addMoneyBtn) {
      addMoneyBtn.addEventListener('click', () => {
        NavigationManager.closeModal('modal-view-commitment');
        FundingModal.open(commitment.walletId, funding.shortfall, commitment.name);
      });
    }

    // Bind Change Wallet button inside view
    const changeWalletBtn = body.querySelector('#btn-view-change-wallet') || body.querySelector('#btn-view-change-wallet-alt');
    if (changeWalletBtn) {
      changeWalletBtn.addEventListener('click', () => {
        NavigationManager.closeModal('modal-view-commitment');
        this.openChangeWallet(commitment.id);
      });
    }

    // Bind Pay Now button
    const payNowBtn = body.querySelector('#btn-view-pay-now');
    if (payNowBtn) {
      payNowBtn.addEventListener('click', () => {
        NavigationManager.closeModal('modal-view-commitment');
        this.initiateCommitmentPayment(commitment);
      });
    }

    // Bind Delete button
    const deleteBtn = body.querySelector('#btn-view-delete-commitment');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (confirm(`Delete the payment commitment for "${commitment.name}"?`)) {
          stateManager.deleteCommitment(commitment.id);
          NavigationManager.closeModal('modal-view-commitment');
          NavigationManager.showToast('Payment commitment deleted.', 'info');
        }
      });
    }

    NavigationManager.openModal('modal-view-commitment');
  }

  static openChangeWallet(commitmentId) {
    const commitment = stateManager.getCommitment(commitmentId);
    if (!commitment) return;

    const modal = document.getElementById('modal-change-wallet');
    if (!modal) return;

    const wallets = stateManager.getWallets();
    const body = modal.querySelector('.sheet-body');
    if (!body) return;

    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 4px;">
          Select the purpose wallet to fund <strong>"${commitment.name}"</strong> (${WalletEngine.formatRupee(commitment.amount)}):
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${wallets
            .map((w) => {
              const isSufficient = (Number(w.balance) || 0) >= Number(commitment.amount);
              const isCurrent = w.id === commitment.walletId;

              return `
              <div class="card card-interactive" data-select-wallet="${w.id}" style="padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; border: ${isCurrent ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)'}; background: ${isCurrent ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-surface)'};">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div style="font-size: 1.4rem;">${w.icon || '💼'}</div>
                  <div>
                    <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                      <span>${w.name}</span>
                      ${isCurrent ? '<span class="badge badge-accent" style="font-size: 0.6rem;">Current</span>' : ''}
                    </div>
                    <div style="font-size: 0.72rem; color: var(--text-muted);">${w.category || 'Purpose'}</div>
                  </div>
                </div>

                <div style="text-align: right;">
                  <div style="font-size: var(--text-sm); font-weight: 800; color: var(--text-primary);">
                    ${WalletEngine.formatRupee(w.balance)}
                  </div>
                  <span class="badge ${isSufficient ? 'badge-success' : 'badge-caution'}" style="font-size: 0.62rem;">
                    ${isSufficient ? 'Sufficient' : 'Shortfall'}
                  </span>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    `;

    body.querySelectorAll('[data-select-wallet]').forEach((el) => {
      el.addEventListener('click', () => {
        const selectedId = el.getAttribute('data-select-wallet');
        stateManager.updateCommitment(commitment.id, { walletId: selectedId });
        SoundEngine.playSuccess();
        NavigationManager.closeModal('modal-change-wallet');
        NavigationManager.showToast(`Updated preferred wallet for "${commitment.name}"!`, 'success');
      });
    });

    NavigationManager.openModal('modal-change-wallet');
  }

  /**
   * Seamlessly hand off a commitment to the real UPI Payment view for verification & execution.
   */
  static initiateCommitmentPayment(commitment) {
    const wallets = stateManager.getWallets();
    const funding = CommitmentEngine.calculateFunding(commitment, wallets);

    if (!funding.hasSufficientFunds) {
      if (confirm(`Your available balance in ${funding.wallet ? funding.wallet.name : 'wallet'} has a shortfall of ₹${funding.shortfall.toLocaleString('en-IN')}. Would you like to add funds first?`)) {
        FundingModal.open(commitment.walletId, funding.shortfall, commitment.name);
        return;
      }
    }

    // Switch to Pay tab and execute verified payment
    NavigationManager.switchTab('pay');
    NavigationManager.showToast(`Proceed with payment for ${commitment.name}`, 'info');

    // Prompt user to confirm payment with standard UPI authorization
    const note = `Payment for ${commitment.name}`;
    setTimeout(() => {
      if (confirm(`Authorize UPI payment of ${WalletEngine.formatRupee(commitment.amount)} for "${commitment.name}" from ${funding.wallet ? funding.wallet.name : 'wallet'}?`)) {
        stateManager.executeCommitmentPayment(commitment.id, { note });
        SoundEngine.playCashDrop();
        NavigationManager.showToast(`✨ Payment for "${commitment.name}" completed successfully!`, 'success');
      }
    }, 300);
  }
}
