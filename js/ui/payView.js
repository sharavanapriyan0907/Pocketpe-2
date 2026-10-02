/* ==========================================================================
   POCKETPE - SMART PAYMENT & QR SCANNER CONTROLLER
   Simulates QR scanning, automatic wallet recommendations, learning engine, and protection
   ========================================================================== */

import { stateManager } from '../state.js';
import { DEMO_MERCHANTS } from '../config.js';
import { CategoryEngine } from '../engines/categoryEngine.js';
import { WalletEngine } from '../engines/walletEngine.js';
import { TransactionEngine } from '../engines/transactionEngine.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';

export class PayView {
  static init() {
    this.container = document.getElementById('view-pay');
    this.currentPaymentData = null;
    this.selectedWalletId = null;
    this.pendingCategoryChange = null;

    if (!this.container) return;

    this.render();
  }

  static render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="section-header">
        <h2 class="h2">Scan & Pay</h2>
        <span class="prototype-tag">Demo Payment</span>
      </div>

      <!-- Simulated QR Scanner Viewport -->
      <div class="scanner-viewfinder" id="scanner-box">
        <div class="scanner-grid"></div>
        <div class="scanner-box">
          <div class="scan-corner top-left"></div>
          <div class="scan-corner top-right"></div>
          <div class="scan-corner bottom-left"></div>
          <div class="scan-corner bottom-right"></div>
          <div class="laser-beam"></div>
        </div>
        <div class="scanner-hint">Align QR code inside frame</div>
      </div>

      <!-- Flashlight / Custom Controls -->
      <div style="display: flex; gap: 10px;">
        <button class="btn btn-secondary btn-sm" id="btn-toggle-scanner-flash" style="flex: 1;">
          <span>🔦</span> <span>Flashlight</span>
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-custom-qr-input" style="flex: 1;">
          <span>✏️</span> <span>Custom Merchant</span>
        </button>
      </div>

      <!-- Quick Demo QR Merchants -->
      <div class="demo-merchants-section">
        <div class="title">Or tap a simulated Merchant QR to test:</div>
        <div class="merchants-scroll-list">
          ${DEMO_MERCHANTS.map((m) => `
            <div class="merchant-item-card" data-merchant-id="${m.id}">
              <div class="merchant-info">
                <div class="merchant-avatar">${m.icon}</div>
                <div class="merchant-meta">
                  <h4>${m.name}</h4>
                  <p>${m.category} • ${m.description}</p>
                </div>
              </div>
              <div class="merchant-amount-tag">
                ${WalletEngine.formatRupee(m.defaultAmount)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Insufficient Balance Test Shortcut -->
      <div class="card" style="padding: 12px 16px; background: var(--bg-subtle); display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary);">🧪 Test Payment Protection Shield</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">Simulate paying ₹2,500 from Transport (balance is low)</div>
        </div>
        <button class="btn btn-sm btn-secondary" id="btn-test-deficit" style="width: auto;">Test Shield</button>
      </div>
    `;

    this.bindEvents();
  }

  static bindEvents() {
    // Merchant list click
    const cards = this.container.querySelectorAll('.merchant-item-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const mId = card.getAttribute('data-merchant-id');
        const merchant = DEMO_MERCHANTS.find((m) => m.id === mId);
        if (merchant) {
          SoundEngine.playTap();
          this.initiatePaymentFlow({
            merchantName: merchant.name,
            amount: merchant.defaultAmount,
            category: merchant.category,
            icon: merchant.icon,
          });
        }
      });
    });

    // Custom Merchant input trigger
    const customBtn = document.getElementById('btn-custom-qr-input');
    if (customBtn) {
      customBtn.addEventListener('click', () => {
        this.openCustomMerchantPrompt();
      });
    }

    // Flashlight toggle
    const flashBtn = document.getElementById('btn-toggle-scanner-flash');
    if (flashBtn) {
      flashBtn.addEventListener('click', () => {
        const scanner = document.getElementById('scanner-box');
        if (scanner) {
          scanner.classList.toggle('flash-active');
          if (scanner.classList.contains('flash-active')) {
            scanner.style.background = '#1e293b';
            NavigationManager.showToast('Flashlight turned on', 'info');
          } else {
            scanner.style.background = '#090d16';
            NavigationManager.showToast('Flashlight turned off', 'info');
          }
        }
      });
    }

    // Test Deficit button
    const testDeficitBtn = document.getElementById('btn-test-deficit');
    if (testDeficitBtn) {
      testDeficitBtn.addEventListener('click', () => {
        this.initiatePaymentFlow({
          merchantName: 'Shell Super Highway Petrol',
          amount: 2500, // Transport wallet typically has ₹800
          category: 'Transport & Fuel',
          icon: '⛽',
        });
      });
    }
  }

  // --- Payment Execution Flow ---
  static initiatePaymentFlow({ merchantName, amount, category, icon = '🛍️' }) {
    // 1. Run through categorization engine
    const classification = CategoryEngine.classifyMerchant(merchantName, amount);
    const recommendedWallet = classification.recommendedWallet || stateManager.getFreeMoneyWallet();

    this.currentPaymentData = {
      merchantName,
      amount: Number(amount),
      category: classification.category,
      icon,
      recommendedWallet,
      isLearned: classification.isLearned,
      reason: classification.reason,
    };
    this.selectedWalletId = recommendedWallet.id;
    this.pendingCategoryChange = null;

    this.renderPaymentConfirmationSheet();
    NavigationManager.openModal('modal-confirm-payment');
  }

  static renderPaymentConfirmationSheet() {
    const modal = document.getElementById('modal-confirm-payment');
    if (!modal) return;

    const body = modal.querySelector('.sheet-body');
    const footer = modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    const p = this.currentPaymentData;
    const selectedWallet = stateManager.getWallet(this.selectedWalletId) || p.recommendedWallet;
    const allWallets = stateManager.getWallets();

    const isSufficient = selectedWallet.balance >= p.amount;
    const remainingAfterPayment = selectedWallet.balance - p.amount;

    body.innerHTML = `
      <!-- Merchant Header -->
      <div style="text-align: center; padding: 6px 0;">
        <div style="font-size: 2.75rem; margin-bottom: 4px;">${p.icon}</div>
        <h3 class="h3" style="color: var(--text-primary);">${p.merchantName}</h3>
        <div style="display: flex; justify-content: center; gap: 6px; margin-top: 4px;">
          <span class="badge badge-accent">${p.category}</span>
          ${p.isLearned ? '<span class="badge badge-success">✨ Learned from you</span>' : ''}
        </div>
        <div class="amount-input-hero" style="padding: 10px 0;">
          <span class="amount-currency">₹</span>
          <span style="font-size: var(--text-4xl); font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums;">
            ${p.amount.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      <!-- Smart Recommendation Card -->
      <div class="payment-recommendation-card" style="border-color: ${selectedWallet.color || 'var(--accent-primary)'};">
        <div class="recommendation-header">
          <span>RECOMMENDED WALLET</span>
          <span>${p.reason || 'Auto-matched for this purpose'}</span>
        </div>
        
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="wallet-icon-box" style="background: ${selectedWallet.color ? selectedWallet.color + '22' : 'var(--accent-light)'};">
              ${selectedWallet.icon || '💼'}
            </div>
            <div>
              <div style="font-size: var(--text-md); font-weight: 700;">${selectedWallet.name} Wallet</div>
              <div style="font-size: var(--text-xs); color: var(--text-muted);">${WalletEngine.formatRupee(selectedWallet.balance)} available</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: var(--text-xs); color: var(--text-muted);">After Payment</div>
            <div style="font-size: var(--text-sm); font-weight: 700; color: ${isSufficient ? 'var(--text-primary)' : 'var(--danger)'};">
              ${isSufficient ? WalletEngine.formatRupee(remainingAfterPayment) : 'Insufficient'}
            </div>
          </div>
        </div>
      </div>

      <!-- Change Wallet Dropdown -->
      <div class="form-group">
        <label class="form-label" style="display: flex; justify-content: space-between;">
          <span>Pay from a different wallet?</span>
          <span class="caption">Change override</span>
        </label>
        <select class="input-text" id="select-payment-wallet">
          ${allWallets.map((w) => `
            <option value="${w.id}" ${w.id === selectedWallet.id ? 'selected' : ''}>
              ${w.icon} ${w.name} (${WalletEngine.formatRupee(w.balance)}) ${w.id === p.recommendedWallet.id ? '★ Recommended' : ''}
            </option>
          `).join('')}
        </select>
      </div>

      <!-- Category Learning Confirmation Prompt (if user altered category/wallet) -->
      <div id="learning-prompt-container"></div>
    `;

    footer.innerHTML = `
      <button class="btn btn-primary" id="btn-execute-payment">
        <span>Pay ${WalletEngine.formatRupee(p.amount)} (Demo)</span>
      </button>
      <button class="btn btn-ghost btn-sm" data-close-modal="modal-confirm-payment">Cancel</button>
    `;

    // Dropdown change listener
    const walletSelect = body.querySelector('#select-payment-wallet');
    if (walletSelect) {
      walletSelect.addEventListener('change', (e) => {
        this.selectedWalletId = e.target.value;
        const newWallet = stateManager.getWallet(this.selectedWalletId);

        // If changed to a different purpose, ask user if they want to teach PocketPe!
        if (newWallet && newWallet.id !== p.recommendedWallet.id) {
          this.showLearningPrompt(p.merchantName, newWallet);
        } else {
          const lContainer = body.querySelector('#learning-prompt-container');
          if (lContainer) lContainer.innerHTML = '';
        }

        this.renderPaymentConfirmationSheet();
      });
    }

    // Execute Payment Click
    footer.querySelector('#btn-execute-payment').addEventListener('click', () => {
      this.handlePaymentAttempt();
    });
  }

  static showLearningPrompt(merchantName, chosenWallet) {
    const container = document.getElementById('learning-prompt-container');
    if (!container) return;

    container.innerHTML = `
      <div class="learning-prompt-banner">
        <div class="learning-prompt-header">
          <span>🧠</span>
          <span>Teach PocketPe: Remember this choice?</span>
        </div>
        <p class="learning-prompt-text">
          Would you like PocketPe to remember <strong>"${merchantName}"</strong> as <strong>${chosenWallet.name}</strong> for future payments?
        </p>
        <div class="learning-prompt-buttons">
          <button class="btn btn-sm btn-primary" id="btn-learn-yes" style="padding: 6px 12px; font-size: var(--text-xs); width: auto;">
            Yes, Remember
          </button>
          <button class="btn btn-sm btn-secondary" id="btn-learn-no" style="padding: 6px 12px; font-size: var(--text-xs); width: auto;">
            Only This Time
          </button>
        </div>
      </div>
    `;

    const yesBtn = container.querySelector('#btn-learn-yes');
    if (yesBtn) {
      yesBtn.addEventListener('click', () => {
        CategoryEngine.teachMerchantCategory(merchantName, chosenWallet.category || chosenWallet.name, chosenWallet.id);
        SoundEngine.playTap();
        NavigationManager.showToast(`Saved! Future "${merchantName}" payments will use ${chosenWallet.name}.`, 'success');
        container.innerHTML = `<div style="font-size: var(--text-xs); color: var(--success); font-weight: 600;">✨ Learned: ${chosenWallet.name} will be recommended next time.</div>`;
      });
    }

    const noBtn = container.querySelector('#btn-learn-no');
    if (noBtn) {
      noBtn.addEventListener('click', () => {
        container.innerHTML = '';
      });
    }
  }

  // --- Payment Execution with Protection ---
  static handlePaymentAttempt() {
    const p = this.currentPaymentData;
    const walletId = this.selectedWalletId;

    const result = TransactionEngine.processPayment({
      merchantName: p.merchantName,
      amount: p.amount,
      category: p.category,
      walletId,
    });

    if (result.status === 'success') {
      SoundEngine.playSuccess();
      NavigationManager.closeModal('modal-confirm-payment');
      NavigationManager.showToast(`✅ Payment Successful: ${WalletEngine.formatRupee(p.amount)} from ${result.wallet.name}`, 'success');
      NavigationManager.switchTab('activity');
    } else if (result.status === 'insufficient_balance') {
      // INSUFFICIENT BALANCE -> Trigger PAYMENT PROTECTION SHIELD!
      SoundEngine.playProtectionAlert();
      NavigationManager.closeModal('modal-confirm-payment');
      this.openPaymentProtectionSheet(result);
    } else {
      NavigationManager.showToast(result.message || 'Payment failed', 'danger');
    }
  }

  // --- Payment Protection Shield Bottom Sheet ---
  static openPaymentProtectionSheet(deficitInfo) {
    const modal = document.getElementById('modal-payment-protection');
    if (!modal) return;

    const body = modal.querySelector('.sheet-body');
    const footer = modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    const p = this.currentPaymentData;
    const w = deficitInfo.wallet;
    const deficit = deficitInfo.deficit;
    const freeBal = deficitInfo.freeMoneyBalance;
    const canCover = deficitInfo.canCoverWithFreeMoney;

    body.innerHTML = `
      <div class="protection-shield-hero">
        <div class="shield-icon-circle">🛡️</div>
        <h3 class="shield-title">Payment Protected</h3>
        <p class="shield-subtitle">
          Your <strong>${w.name}</strong> wallet has <strong>${WalletEngine.formatRupee(w.balance)}</strong>. You need <strong>${WalletEngine.formatRupee(deficit)}</strong> more for this payment.
        </p>
      </div>

      <div class="deficit-math-box">
        <div style="text-align: center;">
          <div style="font-size: var(--text-xs); color: var(--text-muted);">Payment</div>
          <div style="font-size: var(--text-md); font-weight: 700;">${WalletEngine.formatRupee(deficitInfo.paymentAmount)}</div>
        </div>
        <div style="color: var(--text-muted); font-size: 1.1rem;">-</div>
        <div style="text-align: center;">
          <div style="font-size: var(--text-xs); color: var(--text-muted);">${w.name} Balance</div>
          <div style="font-size: var(--text-md); font-weight: 700; color: var(--warning);">${WalletEngine.formatRupee(w.balance)}</div>
        </div>
        <div style="color: var(--text-muted); font-size: 1.1rem;">=</div>
        <div style="text-align: center;">
          <div style="font-size: var(--text-xs); color: var(--text-muted);">Shortage</div>
          <div style="font-size: var(--text-md); font-weight: 800; color: var(--danger);">${WalletEngine.formatRupee(deficit)}</div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 6px;">
        <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-secondary);">HOW WOULD YOU LIKE TO PROCEED?</div>

        <!-- Option 1: Move from Free Money -->
        ${canCover ? `
          <div class="card card-interactive" id="shield-opt-freemoney" style="padding: 14px; border-left: 4px solid var(--accent-primary);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">
                  1. Move ${WalletEngine.formatRupee(deficit)} from Free Money
                </div>
                <div style="font-size: var(--text-xs); color: var(--text-muted);">
                  Free Money has ${WalletEngine.formatRupee(freeBal)}. Your reserved wallets stay untouched.
                </div>
              </div>
              <span style="font-size: 1.25rem;">✨</span>
            </div>
          </div>
        ` : `
          <div class="card" style="padding: 12px; opacity: 0.6; background: var(--bg-subtle);">
            <div style="font-size: var(--text-xs); color: var(--text-muted);">
              Free Money only has ${WalletEngine.formatRupee(freeBal)} (insufficient for ${WalletEngine.formatRupee(deficit)}).
            </div>
          </div>
        `}

        <!-- Option 2: Pay from another wallet -->
        <div class="card card-interactive" id="shield-opt-switch" style="padding: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">
                2. Choose another wallet
              </div>
              <div style="font-size: var(--text-xs); color: var(--text-muted);">
                Select from wallets that have sufficient available balance.
              </div>
            </div>
            <span style="font-size: 1.25rem;">🔄</span>
          </div>
        </div>
      </div>
    `;

    footer.innerHTML = `
      <button class="btn btn-secondary" data-close-modal="modal-payment-protection">Cancel Payment</button>
    `;

    // Bind Option 1: Cover and Pay
    const freeMoneyOpt = body.querySelector('#shield-opt-freemoney');
    if (freeMoneyOpt) {
      freeMoneyOpt.addEventListener('click', () => {
        const shieldResult = TransactionEngine.shieldAndPay({
          merchantName: p.merchantName,
          amount: p.amount,
          category: p.category,
          walletId: w.id,
        });

        if (shieldResult.status === 'success') {
          SoundEngine.playSuccess();
          NavigationManager.closeModal('modal-payment-protection');
          NavigationManager.showToast(`🛡️ ${shieldResult.message}`, 'success', 4000);
          NavigationManager.switchTab('activity');
        } else {
          NavigationManager.showToast(shieldResult.message, 'danger');
        }
      });
    }

    // Bind Option 2: Switch Wallet
    const switchOpt = body.querySelector('#shield-opt-switch');
    if (switchOpt) {
      switchOpt.addEventListener('click', () => {
        NavigationManager.closeModal('modal-payment-protection');
        NavigationManager.openModal('modal-confirm-payment');
      });
    }

    NavigationManager.openModal('modal-payment-protection');
  }

  // --- Custom Merchant & UPI Bottom Sheet ---
  static openCustomMerchantPrompt() {
    const modal = document.getElementById('modal-custom-merchant');
    if (!modal) return;

    const body = modal.querySelector('.sheet-body');
    const footer = modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    let selectedAmount = 350;

    body.innerHTML = `
      <div style="text-align: center; margin-bottom: 8px;">
        <span class="badge badge-accent">Pay Anyone</span>
        <h3 class="h3" style="color: var(--text-primary); margin-top: 4px;">Custom Merchant or UPI</h3>
        <p class="subtitle">Enter any merchant name, friend name, or UPI ID.</p>
      </div>

      <div class="form-group">
        <label class="form-label">Merchant Name / UPI ID / Phone</label>
        <input
          type="text"
          class="input-text"
          id="custom-merchant-name"
          placeholder="e.g. Chai Point, Priya Sharma, bookstore@okaxis"
          value="Blue Tokai Coffee"
        />
      </div>

      <div class="card" style="text-align: center; padding: 16px;">
        <div style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 600;">AMOUNT TO PAY</div>
        <div class="amount-input-hero" style="padding: 6px 0;">
          <span class="amount-currency">₹</span>
          <input
            type="number"
            class="amount-hero-field"
            id="custom-amount-input"
            value="${selectedAmount}"
            min="10"
            step="50"
          />
        </div>
        <div class="quick-amount-pills">
          <button class="pill-btn ${selectedAmount === 100 ? 'active' : ''}" data-custom-amt="100">₹100</button>
          <button class="pill-btn ${selectedAmount === 250 ? 'active' : ''}" data-custom-amt="250">₹250</button>
          <button class="pill-btn ${selectedAmount === 350 ? 'active' : ''}" data-custom-amt="350">₹350</button>
          <button class="pill-btn ${selectedAmount === 500 ? 'active' : ''}" data-custom-amt="500">₹500</button>
          <button class="pill-btn ${selectedAmount === 1200 ? 'active' : ''}" data-custom-amt="1200">₹1,200</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Category Hint (Optional)</label>
        <select class="input-text" id="custom-category-select">
          <option value="Food & Dining">🍔 Food & Dining</option>
          <option value="Transport & Fuel">🚗 Transport & Fuel</option>
          <option value="College & Education">🎓 College & Education</option>
          <option value="Friends & Social">🤝 Friends & Social</option>
          <option value="Shopping & Apparel">🛍️ Shopping & Apparel</option>
          <option value="Health & Wellness">🩺 Health & Wellness</option>
          <option value="Personal Care">💈 Personal Care</option>
          <option value="General Expense">💳 General Expense</option>
        </select>
      </div>
    `;

    footer.innerHTML = `
      <button class="btn btn-primary" id="btn-submit-custom-pay">
        Proceed to Smart Recommendation →
      </button>
      <button class="btn btn-ghost btn-sm" data-close-modal="modal-custom-merchant">Cancel</button>
    `;

    const amountInput = body.querySelector('#custom-amount-input');
    const nameInput = body.querySelector('#custom-merchant-name');
    const catSelect = body.querySelector('#custom-category-select');

    // Amount pills
    body.querySelectorAll('[data-custom-amt]').forEach((pill) => {
      pill.addEventListener('click', () => {
        const amt = Number(pill.getAttribute('data-custom-amt'));
        selectedAmount = amt;
        if (amountInput) amountInput.value = amt;
        body.querySelectorAll('[data-custom-amt]').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        SoundEngine.playTap();
      });
    });

    if (amountInput) {
      amountInput.addEventListener('input', (e) => {
        selectedAmount = Number(e.target.value) || 0;
      });
    }

    footer.querySelector('#btn-submit-custom-pay').addEventListener('click', () => {
      const name = nameInput ? nameInput.value.trim() : '';
      if (!name) {
        NavigationManager.showToast('Please enter merchant or person name', 'warning');
        return;
      }

      const amt = Number(amountInput ? amountInput.value : selectedAmount);
      if (!amt || amt <= 0) {
        NavigationManager.showToast('Please enter a valid amount', 'warning');
        return;
      }

      const cat = catSelect ? catSelect.value : 'General Expense';
      SoundEngine.playTap();
      NavigationManager.closeModal('modal-custom-merchant');

      this.initiatePaymentFlow({
        merchantName: name,
        amount: amt,
        category: cat,
        icon: '🏷️',
      });
    });

    NavigationManager.openModal('modal-custom-merchant');
  }
}
