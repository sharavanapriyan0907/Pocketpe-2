/* ==========================================================================
   POCKETPE - WALLET FUNDING & ADD MONEY MODAL
   Connects the "Add Money" action to real supported funding options:
   1. Linked Bank Account UPI Deposit (HDFC Bank •• 4821)
   2. External UPI Transfer (Dynamic QR code / VPA to transfer from any UPI app)
   3. Internal Wallet Rebalancing (Transfer surplus from another wallet)
   ========================================================================== */

import { stateManager } from '../state.js';
import { WalletEngine } from '../engines/walletEngine.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';
import { ReceiveModal } from './receiveModal.js';
import { MoveModal } from './moveModal.js';

export class FundingModal {
  static init() {
    // Initialized modal controller
  }

  static open(targetWalletId = null, suggestedAmount = null, paymentContextName = '') {
    const modal = document.getElementById('modal-funding-action');
    if (!modal) return;

    const wallets = stateManager.getWallets();
    const wallet = wallets.find((w) => w.id === targetWalletId) || wallets[0];
    if (!wallet) return;

    const user = stateManager.getState().user;
    const bankName = user?.bankName || 'HDFC Bank';
    const accountNum = user?.accountNumber || '••• 4821';
    const initialAmount = suggestedAmount && suggestedAmount > 0 ? suggestedAmount : 1000;

    const body = modal.querySelector('.sheet-body');
    if (!body) return;

    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <!-- Header Info -->
        <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border-subtle);">
          <div style="width: 44px; height: 44px; font-size: 1.5rem; background: ${wallet.color ? wallet.color + '20' : 'var(--accent-light)'}; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">
            ${wallet.icon || '💼'}
          </div>
          <div>
            <h3 class="h3" style="font-size: var(--text-md); margin-bottom: 2px; color: var(--text-primary);">
              Add Money to ${wallet.name}
            </h3>
            <div style="font-size: 0.76rem; color: var(--text-secondary);">
              Current Balance: <strong>${WalletEngine.formatRupee(wallet.balance)}</strong>
            </div>
          </div>
        </div>

        ${paymentContextName ? `
          <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: var(--radius-md); padding: 10px 12px; font-size: 0.74rem; color: var(--text-primary); line-height: 1.4;">
            💡 <strong>Funding for upcoming payment</strong>: "${paymentContextName}".<br />
            Required shortfall to cover: <strong>₹${Number(suggestedAmount).toLocaleString('en-IN')}</strong>.
          </div>
        ` : ''}

        <!-- Amount Input -->
        <div class="form-group" style="margin-bottom: 0;">
          <label class="label-text" for="input-fund-amount" style="font-size: var(--text-xs); font-weight: 700;">
            Amount to Add (₹)
          </label>
          <div style="display: flex; align-items: center; gap: 8px;">
            <input
              type="number"
              id="input-fund-amount"
              class="input-text"
              value="${initialAmount}"
              min="1"
              step="1"
              style="font-size: var(--text-lg); font-weight: 800; font-family: var(--font-mono); flex: 1;"
            />
            <div style="display: flex; gap: 4px;">
              <button type="button" class="btn btn-secondary btn-sm pill-btn" data-preset-amt="500">₹500</button>
              <button type="button" class="btn btn-secondary btn-sm pill-btn" data-preset-amt="1000">₹1k</button>
              <button type="button" class="btn btn-secondary btn-sm pill-btn" data-preset-amt="2500">₹2.5k</button>
            </div>
          </div>
        </div>

        <!-- Section: Select Funding Method -->
        <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); margin-top: 4px;">
          Choose How You Want to Fund:
        </div>

        <!-- Option 1: Receive via External UPI / Dynamic QR Code (Real Supported UPI Flow) -->
        <div class="card card-interactive" id="option-fund-upi" style="padding: 12px 14px; border: 1.5px solid var(--accent-primary); background: linear-gradient(135deg, var(--bg-surface) 0%, rgba(59, 130, 246, 0.04) 100%); cursor: pointer;">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;">
            <div style="display: flex; align-items: flex-start; gap: 10px;">
              <span style="font-size: 1.5rem;">📱</span>
              <div>
                <div style="font-size: var(--text-xs); font-weight: 800; color: var(--text-primary);">
                  Receive via UPI Transfer (Instant QR)
                </div>
                <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
                  Transfer via Google Pay, PhonePe, Paytm, or BHIM using your PocketPe QR / UPI ID
                </div>
              </div>
            </div>
            <span class="badge badge-success" style="font-size: 0.62rem;">Instant</span>
          </div>
          <button class="btn btn-sm btn-primary" id="btn-open-upi-qr" style="margin-top: 10px; width: 100%; font-size: 0.74rem;">
            Show UPI QR Code
          </button>
        </div>

        <!-- Option 2: Internal Purpose Wallet Rebalance -->
        <div class="card card-interactive" id="option-fund-rebalance" style="padding: 12px 14px; cursor: pointer;">
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <span style="font-size: 1.4rem;">🔄</span>
            <div style="flex: 1;">
              <div style="font-size: var(--text-xs); font-weight: 800; color: var(--text-primary);">
                Transfer from Another Purpose Wallet
              </div>
              <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
                Rebalance surplus from another wallet without depositing new funds
              </div>
              <button class="btn btn-sm btn-secondary" id="btn-open-rebalance" style="margin-top: 8px; width: 100%; font-size: 0.74rem;">
                Transfer Between Wallets
              </button>
            </div>
          </div>
        </div>

        <!-- Option 3: Record Completed Bank / UPI Transfer -->
        <div class="card" id="option-fund-bank-record" style="padding: 12px 14px; background: var(--bg-surface);">
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <span style="font-size: 1.4rem;">🏦</span>
            <div style="flex: 1;">
              <div style="font-size: var(--text-xs); font-weight: 800; color: var(--text-primary);">
                Record Completed Bank / UPI Transfer
              </div>
              <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px; line-height: 1.4;">
                Direct automated bank debits require payment gateway integration. If you have already transferred funds from your bank account or external UPI app, record your completed transaction below to update your wallet balance.
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                <div>
                  <label class="label-text" for="input-deposit-method" style="font-size: 0.7rem; font-weight: 700; color: var(--text-secondary);">
                    Deposit Source / Method
                  </label>
                  <input
                    type="text"
                    id="input-deposit-method"
                    class="input-text"
                    value="${bankName} •• 4821"
                    placeholder="e.g. HDFC Bank, ICICI Netbanking, UPI"
                    style="font-size: 0.75rem; padding: 6px 10px; width: 100%;"
                  />
                </div>

                <div>
                  <label class="label-text" for="input-deposit-ref" style="font-size: 0.7rem; font-weight: 700; color: var(--text-secondary);">
                    Bank / UPI Reference Number (UTR - Optional)
                  </label>
                  <input
                    type="text"
                    id="input-deposit-ref"
                    class="input-text"
                    placeholder="e.g. 428190381029"
                    style="font-size: 0.75rem; padding: 6px 10px; width: 100%; font-family: var(--font-mono);"
                  />
                </div>

                <button class="btn btn-sm btn-secondary" id="btn-confirm-record-fund" style="width: 100%; font-size: 0.74rem; margin-top: 4px;">
                  Confirm & Record Deposit
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style="font-size: 0.68rem; color: var(--text-muted); text-align: center; line-height: 1.4; padding: 4px 8px;">
          PocketPe supports inward UPI transfers (QR Code & UPI ID), internal wallet rebalancing, and recorded manual bank deposits. You decide how to fund your wallet.
        </div>
      </div>
    `;

    const amountInput = body.querySelector('#input-fund-amount');

    // Preset pills
    body.querySelectorAll('[data-preset-amt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-preset-amt');
        if (amountInput) amountInput.value = val;
      });
    });

    // 1. Open UPI QR code
    const openUpiQrBtn = body.querySelector('#btn-open-upi-qr');
    if (openUpiQrBtn) {
      openUpiQrBtn.addEventListener('click', () => {
        NavigationManager.closeModal('modal-funding-action');
        ReceiveModal.open('qr');
      });
    }

    // 2. Open Rebalance modal
    const openRebalanceBtn = body.querySelector('#btn-open-rebalance');
    if (openRebalanceBtn) {
      openRebalanceBtn.addEventListener('click', () => {
        NavigationManager.closeModal('modal-funding-action');
        MoveModal.open(null, wallet.id);
      });
    }

    // 3. Confirm & Record Deposit flow
    const confirmRecordBtn = body.querySelector('#btn-confirm-record-fund');
    if (confirmRecordBtn) {
      confirmRecordBtn.addEventListener('click', () => {
        const amt = Number(amountInput?.value);
        if (isNaN(amt) || amt <= 0) {
          NavigationManager.showToast('Please enter a valid amount to deposit.', 'warning');
          return;
        }

        const methodInput = body.querySelector('#input-deposit-method');
        const refInput = body.querySelector('#input-deposit-ref');
        const method = methodInput?.value.trim() || `${bankName} •• 4821`;
        const ref = refInput?.value.trim() || '';

        const note = paymentContextName
          ? `Funded for ${paymentContextName}${ref ? ` (Ref: ${ref})` : ''}`
          : `Deposit to ${wallet.name}${ref ? ` (Ref: ${ref})` : ''}`;

        const res = stateManager.depositMoney(wallet.id, amt, method, note);

        if (res) {
          SoundEngine.playSuccess();
          NavigationManager.closeModal('modal-funding-action');
          NavigationManager.showToast(`✨ Recorded deposit of ${WalletEngine.formatRupee(amt)} to ${wallet.name}!`, 'success');
        }
      });
    }

    NavigationManager.openModal('modal-funding-action');
  }
}
