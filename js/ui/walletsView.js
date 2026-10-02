/* ==========================================================================
   POCKETPE - WALLETS VIEW & CREATION WIZARD
   ========================================================================== */

import { stateManager } from '../state.js';
import { WalletEngine } from '../engines/walletEngine.js';
import { WALLET_PRESETS } from '../config.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';

export class WalletsView {
  static init() {
    this.container = document.getElementById('view-wallets');
    this.currentFilter = 'all';
    this.createWizardState = {
      step: 1,
      selectedPreset: WALLET_PRESETS[0],
      customName: '',
      customIcon: '💼',
      customColor: '#3b82f6',
      targetAmount: 3000,
      monthlyLimit: 3000,
      initialBalance: 0,
      allocationPercentage: 15,
      frequency: 'Every time I receive money',
    };

    if (!this.container) return;

    this.render();
    this.initCreateWalletModal();

    // Listen to changes
    stateManager.subscribe('state:changed', () => this.render());
  }

  static render() {
    if (!this.container) return;

    const summary = WalletEngine.getSummary();
    const wallets = stateManager.getWallets();

    // Filter wallets
    const filteredWallets = wallets.filter((w) => {
      if (this.currentFilter === 'all') return true;
      if (this.currentFilter === 'goals') return (w.targetAmount || 0) > 0;
      if (this.currentFilter === 'essentials') return ['wallet_food', 'wallet_transport'].includes(w.id);
      if (this.currentFilter === 'free') return w.isFreeMoney;
      return true;
    });

    this.container.innerHTML = `
      <div class="section-header">
        <h2 class="h2">Your Wallets</h2>
        <span class="badge badge-accent">${wallets.length} Active</span>
      </div>

      <!-- Overview Banner -->
      <div class="wallets-overview-banner">
        <div class="overview-stat-col">
          <span class="label">Total In Wallets</span>
          <span class="value">${WalletEngine.formatRupee(summary.total)}</span>
        </div>
        <div class="overview-divider"></div>
        <div class="overview-stat-col">
          <span class="label">Free Money Cushion</span>
          <span class="value" style="color: var(--accent-primary);">${WalletEngine.formatRupee(summary.free)}</span>
        </div>
      </div>

      <!-- Filter Scroll Row -->
      <div class="filter-scroll-row">
        <button class="filter-chip ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">All Wallets</button>
        <button class="filter-chip ${this.currentFilter === 'goals' ? 'active' : ''}" data-filter="goals">🎯 Goals & Savings</button>
        <button class="filter-chip ${this.currentFilter === 'essentials' ? 'active' : ''}" data-filter="essentials">⚡ Daily Essentials</button>
        <button class="filter-chip ${this.currentFilter === 'free' ? 'active' : ''}" data-filter="free">✨ Free Money</button>
      </div>

      <!-- Wallets List -->
      <div class="wallets-list">
        ${filteredWallets.length === 0
          ? `
            <div style="text-align: center; padding: 40px 20px; background: var(--bg-surface); border-radius: var(--radius-xl); border: 1px dashed var(--border-strong);">
              <div style="font-size: 2.5rem; margin-bottom: 8px;">📭</div>
              <h4 class="h4" style="margin-bottom: 4px;">Your money needs a home.</h4>
              <p class="subtitle" style="margin-bottom: 16px;">Separate your funds into purposeful virtual wallets.</p>
              <button class="btn btn-sm btn-primary" id="btn-empty-create-wallet">Create your first wallet</button>
            </div>
          `
          : filteredWallets
              .map((wallet) => {
                const progress = WalletEngine.getWalletProgress(wallet);
                const targetText = wallet.targetAmount > 0
                  ? `Goal: ${WalletEngine.formatRupee(wallet.targetAmount)}`
                  : wallet.monthlyLimit > 0
                  ? `Limit: ${WalletEngine.formatRupee(wallet.monthlyLimit)}`
                  : 'Flexible Purpose';

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
                        <div class="wallet-balance">${WalletEngine.formatRupee(wallet.balance)}</div>
                        <div class="wallet-target">${targetText}</div>
                      </div>
                    </div>

                    <div class="progress-container">
                      <div class="progress-bar ${progress.isDanger ? 'danger' : progress.isWarning ? 'warning' : ''}" style="width: ${progress.percent}%;"></div>
                    </div>

                    <div class="wallet-footer">
                      <span>${progress.statusText}</span>
                      <span>${wallet.allocationPercentage ? wallet.allocationPercentage + '% split' : 'Manual'}</span>
                    </div>
                  </div>
                `;
              })
              .join('')}
      </div>

      <!-- Floating Add Button -->
      <button class="floating-add-btn" id="btn-trigger-add-wallet" aria-label="Create new wallet">
        <span>➕</span>
        <span>New Wallet</span>
      </button>
    `;

    this.bindEvents();
  }

  static bindEvents() {
    // Filter chips
    const chips = this.container.querySelectorAll('.filter-chip');
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        this.currentFilter = chip.getAttribute('data-filter');
        SoundEngine.playTap();
        this.render();
      });
    });

    // Wallet card clicks
    const cards = this.container.querySelectorAll('.wallet-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const walletId = card.getAttribute('data-wallet-id');
        this.openWalletEditModal(walletId);
      });
    });

    // Create wallet triggers
    const addBtn = document.getElementById('btn-trigger-add-wallet');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.openCreateWizard();
      });
    }

    const emptyBtn = document.getElementById('btn-empty-create-wallet');
    if (emptyBtn) {
      emptyBtn.addEventListener('click', () => {
        this.openCreateWizard();
      });
    }
  }

  // --- 3-STEP CREATE WALLET WIZARD ---
  static initCreateWalletModal() {
    this.wizardModal = document.getElementById('modal-create-wallet');
  }

  static openCreateWizard() {
    this.createWizardState = {
      step: 1,
      selectedPreset: WALLET_PRESETS[0],
      customName: WALLET_PRESETS[0].name,
      customIcon: WALLET_PRESETS[0].icon,
      customColor: WALLET_PRESETS[0].color,
      targetAmount: 3000,
      monthlyLimit: 3000,
      initialBalance: 0,
      allocationPercentage: 15,
      frequency: 'Every time I receive money',
    };
    this.renderWizardStep();
    NavigationManager.openModal('modal-create-wallet');
  }

  static renderWizardStep() {
    if (!this.wizardModal) return;
    const body = this.wizardModal.querySelector('.sheet-body');
    const footer = this.wizardModal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    const s = this.createWizardState;

    if (s.step === 1) {
      body.innerHTML = `
        <div style="text-align: center; margin-bottom: 6px;">
          <span class="badge badge-accent">Step 1 of 3</span>
          <h3 class="h3" style="margin-top: 6px;">What do you want to save money for?</h3>
          <p class="subtitle">Choose a purpose or create a custom one.</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
          ${WALLET_PRESETS.map((preset) => {
            const isSelected = s.selectedPreset.name === preset.name;
            return `
              <div class="action-tile ${isSelected ? 'active' : ''}" data-preset-name="${preset.name}" style="padding: 14px 10px; border-color: ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}; background: ${isSelected ? 'var(--accent-light)' : 'var(--bg-surface)'};">
                <div style="font-size: 2rem; margin-bottom: 4px;">${preset.icon}</div>
                <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); text-align: center;">${preset.name}</div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="form-group" style="margin-top: 8px;">
          <label class="form-label">Wallet Name</label>
          <input type="text" class="input-text" id="wizard-wallet-name" value="${s.customName || s.selectedPreset.name}" placeholder="e.g. Goa Trip, New Laptop" />
        </div>
      `;

      footer.innerHTML = `
        <button class="btn btn-primary" id="wizard-btn-next-1">Next: Set Amount →</button>
      `;

      // Preset click bindings
      body.querySelectorAll('[data-preset-name]').forEach((tile) => {
        tile.addEventListener('click', () => {
          const pName = tile.getAttribute('data-preset-name');
          const preset = WALLET_PRESETS.find((p) => p.name === pName);
          if (preset) {
            s.selectedPreset = preset;
            s.customName = preset.name;
            s.customIcon = preset.icon;
            s.customColor = preset.color;
            SoundEngine.playTap();
            this.renderWizardStep();
          }
        });
      });

      const nameInput = body.querySelector('#wizard-wallet-name');
      if (nameInput) {
        nameInput.addEventListener('input', (e) => {
          s.customName = e.target.value;
        });
      }

      footer.querySelector('#wizard-btn-next-1').addEventListener('click', () => {
        const finalName = (nameInput ? nameInput.value : s.customName).trim();
        if (!finalName) {
          NavigationManager.showToast('Please enter a wallet name', 'warning');
          return;
        }
        s.customName = finalName;
        s.step = 2;
        SoundEngine.playTap();
        this.renderWizardStep();
      });

    } else if (s.step === 2) {
      body.innerHTML = `
        <div style="text-align: center; margin-bottom: 6px;">
          <span class="badge badge-accent">Step 2 of 3</span>
          <h3 class="h3" style="margin-top: 6px;">How much do you want to keep here?</h3>
          <p class="subtitle">Set a monthly target or spending limit.</p>
        </div>

        <div class="card" style="text-align: center; padding: 20px;">
          <div style="font-size: 2.2rem; margin-bottom: 6px;">${s.customIcon}</div>
          <div style="font-size: var(--text-lg); font-weight: 800; color: var(--text-primary);">${s.customName}</div>
          <div class="amount-input-hero">
            <span class="amount-currency">₹</span>
            <input type="number" class="amount-hero-field" id="wizard-target-amount" value="${s.targetAmount}" min="100" step="500" />
          </div>
          <div class="quick-amount-pills">
            <button class="pill-btn" data-preset-amt="1000">₹1,000</button>
            <button class="pill-btn" data-preset-amt="2500">₹2,500</button>
            <button class="pill-btn" data-preset-amt="5000">₹5,000</button>
            <button class="pill-btn" data-preset-amt="10000">₹10,000</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Initial Deposit from Free Money (Optional)</label>
          <input type="number" class="input-text" id="wizard-initial-balance" value="${s.initialBalance}" min="0" placeholder="0 (taken from Free Money)" />
          <span class="caption">Free Money available: ${WalletEngine.formatRupee(stateManager.getFreeMoneyBalance())}</span>
        </div>
      `;

      footer.innerHTML = `
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary" id="wizard-btn-back-1" style="flex: 1;">← Back</button>
          <button class="btn btn-primary" id="wizard-btn-next-2" style="flex: 2;">Next: Auto-Split →</button>
        </div>
      `;

      // Preset pills
      body.querySelectorAll('[data-preset-amt]').forEach((pill) => {
        pill.addEventListener('click', () => {
          const amt = Number(pill.getAttribute('data-preset-amt'));
          s.targetAmount = amt;
          const targetInput = body.querySelector('#wizard-target-amount');
          if (targetInput) targetInput.value = amt;
          SoundEngine.playTap();
        });
      });

      footer.querySelector('#wizard-btn-back-1').addEventListener('click', () => {
        s.step = 1;
        SoundEngine.playTap();
        this.renderWizardStep();
      });

      footer.querySelector('#wizard-btn-next-2').addEventListener('click', () => {
        const targetInput = body.querySelector('#wizard-target-amount');
        const initialInput = body.querySelector('#wizard-initial-balance');
        s.targetAmount = Number(targetInput.value) || 2000;
        s.initialBalance = Number(initialInput.value) || 0;

        const freeBal = stateManager.getFreeMoneyBalance();
        if (s.initialBalance > freeBal) {
          NavigationManager.showToast(`Initial deposit exceeds Free Money balance (${WalletEngine.formatRupee(freeBal)})`, 'warning');
          return;
        }

        s.step = 3;
        SoundEngine.playTap();
        this.renderWizardStep();
      });

    } else if (s.step === 3) {
      body.innerHTML = `
        <div style="text-align: center; margin-bottom: 6px;">
          <span class="badge badge-accent">Step 3 of 3</span>
          <h3 class="h3" style="margin-top: 6px;">Do you want to automatically add money?</h3>
          <p class="subtitle">Assign a percentage when you receive money.</p>
        </div>

        <div class="card" style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: var(--text-sm); font-weight: 700;">Incoming Split Share</span>
            <span class="badge badge-accent" id="wizard-split-badge" style="font-size: var(--text-sm);">${s.allocationPercentage}%</span>
          </div>
          <input type="range" class="custom-range" id="wizard-split-slider" min="0" max="50" step="5" value="${s.allocationPercentage}" />
          <p class="caption">For every ₹10,000 you receive, ₹${(s.allocationPercentage / 100) * 10000} will go into ${s.customName}.</p>
        </div>

        <div class="form-group">
          <label class="form-label">How often?</label>
          <select class="input-text" id="wizard-frequency">
            <option value="Every time I receive money" selected>Every time I receive money</option>
            <option value="Every week">Every week</option>
            <option value="Every month">Every month</option>
            <option value="No automatic additions">No automatic additions</option>
          </select>
        </div>
      `;

      footer.innerHTML = `
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary" id="wizard-btn-back-2" style="flex: 1;">← Back</button>
          <button class="btn btn-primary" id="wizard-btn-finish" style="flex: 2;">Create Wallet ✨</button>
        </div>
      `;

      const slider = body.querySelector('#wizard-split-slider');
      const badge = body.querySelector('#wizard-split-badge');
      if (slider && badge) {
        slider.addEventListener('input', (e) => {
          s.allocationPercentage = Number(e.target.value);
          badge.textContent = `${s.allocationPercentage}%`;
        });
      }

      footer.querySelector('#wizard-btn-back-2').addEventListener('click', () => {
        s.step = 2;
        SoundEngine.playTap();
        this.renderWizardStep();
      });

      footer.querySelector('#wizard-btn-finish').addEventListener('click', () => {
        const freqSelect = body.querySelector('#wizard-frequency');
        s.frequency = freqSelect ? freqSelect.value : 'Every time I receive money';

        // Add wallet to state
        stateManager.addWallet({
          name: s.customName,
          icon: s.customIcon,
          color: s.customColor,
          initialBalance: s.initialBalance,
          targetAmount: s.targetAmount,
          monthlyLimit: s.targetAmount,
          allocationPercentage: s.allocationPercentage,
          category: s.selectedPreset.category || 'General',
          frequency: s.frequency,
        });

        SoundEngine.playSuccess();
        NavigationManager.closeModal('modal-create-wallet');
        NavigationManager.showToast(`✨ Created "${s.customName}" wallet!`, 'success');
      });
    }
  }

  // --- Wallet Edit / Manage Modal ---
  static openWalletEditModal(walletId) {
    const wallet = stateManager.getWallet(walletId);
    if (!wallet) return;

    const modal = document.getElementById('modal-wallet-detail');
    if (!modal) return;

    // Use HomeView.openWalletDetail for rich details and interaction
    import('./homeView.js').then((m) => m.HomeView.openWalletDetail(walletId));
  }
}
