/* ==========================================================================
   POCKETPE - STATE MANAGER & PERSISTENCE
   ========================================================================== */

import { APP_CONFIG, INITIAL_WALLETS, INITIAL_TRANSACTIONS } from './config.js';

class StateManager {
  constructor() {
    this.listeners = new Map();
    this.state = this.loadState();
  }

  loadState() {
    try {
      const stored = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.APP_STATE);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.wallets && parsed.transactions) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load state from localStorage, using initial mock data', e);
    }

    return {
      user: {
        id: 'usr_001',
        name: 'Sharath Kumar',
        greeting: 'Good morning',
        simulatedBank: 'HDFC Simulated Account',
        accountNumber: '••• 4892',
      },
      wallets: JSON.parse(JSON.stringify(INITIAL_WALLETS)),
      transactions: JSON.parse(JSON.stringify(INITIAL_TRANSACTIONS)),
      learnedMerchants: {},
      isBalanceHidden: false,
      activeTab: 'home',
    };
  }

  saveState() {
    try {
      localStorage.setItem(APP_CONFIG.STORAGE_KEYS.APP_STATE, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }

  getState() {
    return this.state;
  }

  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => {
      this.listeners.get(event).delete(callback);
    };
  }

  notify(event, payload = null) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => {
        try {
          cb(payload, this.state);
        } catch (err) {
          console.error(`Error in listener for event ${event}:`, err);
        }
      });
    }
    // Also notify global state change
    if (event !== 'state:changed' && this.listeners.has('state:changed')) {
      this.listeners.get('state:changed').forEach((cb) => cb(event, this.state));
    }
    this.saveState();
  }

  // --- Wallet Helpers ---
  getWallets() {
    return this.state.wallets;
  }

  getWallet(walletId) {
    return this.state.wallets.find((w) => w.id === walletId) || null;
  }

  getFreeMoneyWallet() {
    return this.state.wallets.find((w) => w.isFreeMoney) || this.state.wallets[this.state.wallets.length - 1];
  }

  getTotalBalance() {
    return this.state.wallets.reduce((acc, w) => acc + (Number(w.balance) || 0), 0);
  }

  getAllocatedBalance() {
    return this.state.wallets
      .filter((w) => !w.isFreeMoney)
      .reduce((acc, w) => acc + (Number(w.balance) || 0), 0);
  }

  getFreeMoneyBalance() {
    const freeWallet = this.getFreeMoneyWallet();
    return freeWallet ? Number(freeWallet.balance) || 0 : 0;
  }

  addWallet(walletData) {
    const newWallet = {
      id: `wallet_${Date.now()}`,
      name: walletData.name,
      icon: walletData.icon || '💼',
      color: walletData.color || '#3b82f6',
      balance: Number(walletData.initialBalance) || 0,
      targetAmount: Number(walletData.targetAmount) || 0,
      monthlyLimit: Number(walletData.monthlyLimit) || 0,
      allocationPercentage: Number(walletData.allocationPercentage) || 0,
      category: walletData.category || 'General',
      isFreeMoney: false,
      frequency: walletData.frequency || 'Every time I receive money',
    };

    // If initialBalance was provided and taken from Free Money, deduct it
    if (newWallet.balance > 0) {
      const freeWallet = this.getFreeMoneyWallet();
      if (freeWallet && freeWallet.balance >= newWallet.balance) {
        freeWallet.balance -= newWallet.balance;
      }
    }

    this.state.wallets.splice(this.state.wallets.length - 1, 0, newWallet);
    this.notify('wallet:created', newWallet);
    return newWallet;
  }

  updateWallet(walletId, updates) {
    const wallet = this.getWallet(walletId);
    if (!wallet) return false;
    Object.assign(wallet, updates);
    this.notify('wallet:updated', wallet);
    return true;
  }

  deleteWallet(walletId) {
    const index = this.state.wallets.findIndex((w) => w.id === walletId);
    if (index === -1) return false;

    const wallet = this.state.wallets[index];
    if (wallet.isFreeMoney) {
      console.warn('Cannot delete Free Money wallet');
      return false;
    }

    // Move remaining balance into Free Money
    if (wallet.balance > 0) {
      const freeWallet = this.getFreeMoneyWallet();
      if (freeWallet) {
        freeWallet.balance += wallet.balance;
      }
    }

    this.state.wallets.splice(index, 1);
    this.notify('wallet:deleted', wallet);
    return true;
  }

  // --- Transactions ---
  getTransactions() {
    return this.state.transactions;
  }

  addTransaction(txData) {
    const newTx = {
      id: `tx_${Date.now()}`,
      merchantName: txData.merchantName,
      amount: Number(txData.amount),
      type: txData.type || 'debit',
      category: txData.category || 'General',
      walletId: txData.walletId,
      date: new Date().toISOString(),
      status: 'Completed',
      note: txData.note || '',
    };

    this.state.transactions.unshift(newTx);
    this.notify('transaction:added', newTx);
    return newTx;
  }

  // --- Learned Categories Engine ---
  getLearnedCategory(merchantName) {
    if (!merchantName) return null;
    const key = merchantName.trim().toLowerCase();
    return this.state.learnedMerchants[key] || null;
  }

  setLearnedCategory(merchantName, category, walletId = null) {
    if (!merchantName) return;
    const key = merchantName.trim().toLowerCase();
    this.state.learnedMerchants[key] = {
      category,
      walletId,
      updatedAt: new Date().toISOString(),
    };
    this.notify('learned:updated', { merchantName, category, walletId });
  }

  removeLearnedCategory(merchantName) {
    const key = merchantName.trim().toLowerCase();
    if (this.state.learnedMerchants[key]) {
      delete this.state.learnedMerchants[key];
      this.notify('learned:updated', { merchantName });
    }
  }

  // --- Privacy Toggle ---
  toggleBalancePrivacy() {
    this.state.isBalanceHidden = !this.state.isBalanceHidden;
    this.notify('privacy:toggled', this.state.isBalanceHidden);
    return this.state.isBalanceHidden;
  }

  // --- Reset All Data ---
  resetToDemoData() {
    this.state.wallets = JSON.parse(JSON.stringify(INITIAL_WALLETS));
    this.state.transactions = JSON.parse(JSON.stringify(INITIAL_TRANSACTIONS));
    this.state.learnedMerchants = {};
    this.state.isBalanceHidden = false;
    this.saveState();
    this.notify('state:reset', this.state);
  }
}

export const stateManager = new StateManager();
