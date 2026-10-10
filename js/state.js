/* ==========================================================================
   POCKETPE - STATE MANAGER & PERSISTENCE
   ========================================================================== */

import {
  APP_CONFIG,
  INITIAL_WALLETS,
  INITIAL_TRANSACTIONS,
  INITIAL_FRAUD_DATA,
  INITIAL_COLLECT_REQUESTS,
  INITIAL_SPLIT_DATA,
} from './config.js';

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
        if (parsed) {
          // Ensure new feature namespaces exist on legacy state
          if (!parsed.fraudDetection) {
            parsed.fraudDetection = JSON.parse(JSON.stringify(INITIAL_FRAUD_DATA));
          }
          if (!parsed.collectRequests) {
            parsed.collectRequests = [];
          }
          if (!parsed.splitBill) {
            parsed.splitBill = JSON.parse(JSON.stringify(INITIAL_SPLIT_DATA));
          }
          if (!parsed.commitments || !Array.isArray(parsed.commitments)) {
            parsed.commitments = [];
          }
          if (Array.isArray(parsed.transactions)) {
            parsed.transactions = parsed.transactions.filter(
              (t) => !['tx_101', 'tx_102', 'tx_103', 'tx_104', 'tx_105'].includes(t.id)
            );
          } else {
            parsed.transactions = [];
          }

          // If stored state is unauthenticated or has legacy demo user id, ensure private data is cleared
          if (!parsed.user || !parsed.user.isAuthenticated || parsed.user.id === 'usr_001' || parsed.user.id === 'usr_guest') {
            parsed.user = {
              id: null,
              name: '',
              email: null,
              isAuthenticated: false,
              greeting: 'Welcome',
              bankName: '',
              accountNumber: '',
              supabaseUser: null,
            };
            parsed.wallets = [];
            parsed.transactions = [];
            parsed.commitments = [];
            parsed.activeTab = 'auth';
          }

          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load state from localStorage, initializing fresh state', e);
    }

    return {
      user: {
        id: null,
        name: '',
        email: null,
        isAuthenticated: false,
        greeting: 'Welcome',
        bankName: '',
        accountNumber: '',
        supabaseUser: null,
      },
      wallets: [],
      transactions: [],
      commitments: [],
      learnedMerchants: {},
      isBalanceHidden: false,
      activeTab: 'auth',
      fraudDetection: JSON.parse(JSON.stringify(INITIAL_FRAUD_DATA)),
      collectRequests: [],
      splitBill: JSON.parse(JSON.stringify(INITIAL_SPLIT_DATA)),
    };
  }

  saveState() {
    try {
      localStorage.setItem(APP_CONFIG.STORAGE_KEYS.APP_STATE, JSON.stringify(this.state));
      if (this.state.user?.isAuthenticated && this.state.user?.id) {
        this.saveUserScopedData(this.state.user.id);
      }
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }

  // --- Supabase Authentication & User-Scoped Data Helpers ---
  getUserId() {
    return this.state.user?.id || null;
  }

  isUserAuthenticated() {
    return !!this.state.user?.isAuthenticated;
  }

  setAuthUser(supabaseUser) {
    if (!supabaseUser) {
      return this.clearAuthUser();
    }

    const prevUserId = this.state.user?.id;
    const newUserId = supabaseUser.id;
    const fullName = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'PocketPe User';
    const avatarUrl = supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture || null;
    const provider = supabaseUser.app_metadata?.provider || (supabaseUser.app_metadata?.providers?.[0]) || 'email';

    // Persist previous user state if transitioning
    if (this.state.user?.isAuthenticated && prevUserId && prevUserId !== newUserId) {
      this.saveUserScopedData(prevUserId);
    }

    this.state.user = {
      ...this.state.user,
      id: newUserId,
      email: supabaseUser.email,
      name: fullName,
      avatarUrl: avatarUrl,
      provider: provider,
      isAuthenticated: true,
      bankName: this.state.user?.bankName || 'HDFC Bank',
      accountNumber: this.state.user?.accountNumber || '••• 4821',
      supabaseUser: {
        id: supabaseUser.id,
        email: supabaseUser.email,
        createdAt: supabaseUser.created_at,
        lastSignInAt: supabaseUser.last_sign_in_at,
        metadata: supabaseUser.user_metadata || {},
        appMetadata: supabaseUser.app_metadata || {},
      },
    };

    // Load or initialize user-specific wallets and merchant preferences
    this.loadUserScopedData(newUserId);

    console.log(`👤 Exposing authenticated Supabase user.id: ${newUserId} (${provider})`);
    this.notify('auth:changed', this.state.user);
    this.notify('state:changed');
    return this.state.user;
  }

  clearAuthUser() {
    if (this.state.user?.isAuthenticated && this.state.user?.id) {
      this.saveUserScopedData(this.state.user.id);
    }

    this.state.user = {
      id: null,
      name: '',
      email: null,
      avatarUrl: null,
      provider: null,
      isAuthenticated: false,
      greeting: 'Welcome',
      bankName: '',
      accountNumber: '',
      supabaseUser: null,
    };

    // Wipe in-memory private data completely
    this.state.wallets = [];
    this.state.transactions = [];
    this.state.commitments = [];
    this.state.learnedMerchants = {};
    this.state.collectRequests = [];
    if (this.state.splitBill) {
      this.state.splitBill.groups = [];
      this.state.splitBill.expenses = [];
      this.state.splitBill.activityLog = [];
    }
    this.state.activeTab = 'auth';

    console.log('👤 Cleared authenticated user, wiped in-memory private data');
    this.saveState();
    this.notify('auth:changed', this.state.user);
    this.notify('state:changed');
    return this.state.user;
  }

  loadUserScopedData(userId) {
    if (!userId || userId === 'usr_guest' || userId === 'usr_001') return false;
    const storageKey = `${APP_CONFIG.STORAGE_KEYS.USER_SCOPED_PREFIX || 'pocketpe_user_'}${userId}_data`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.wallets) && parsed.wallets.length > 0) {
          this.state.wallets = parsed.wallets;
        } else {
          this.state.wallets = JSON.parse(JSON.stringify(INITIAL_WALLETS));
        }
        if (parsed.learnedMerchants && typeof parsed.learnedMerchants === 'object') {
          this.state.learnedMerchants = parsed.learnedMerchants;
        }
        if (Array.isArray(parsed.transactions)) {
          this.state.transactions = parsed.transactions;
        }
        if (Array.isArray(parsed.commitments)) {
          this.state.commitments = parsed.commitments;
        }
        return true;
      }
    } catch (e) {
      console.warn('Could not load user-scoped data:', e);
    }

    // Initialize fresh demonstration balance wallets for new authenticated user
    this.state.wallets = JSON.parse(JSON.stringify(INITIAL_WALLETS));
    this.state.transactions = [];
    this.state.commitments = [];
    this.state.learnedMerchants = {};
    this.saveUserScopedData(userId);
    return false;
  }

  saveUserScopedData(userId) {
    if (!userId) return;
    const storageKey = `${APP_CONFIG.STORAGE_KEYS.USER_SCOPED_PREFIX || 'pocketpe_user_'}${userId}_data`;
    try {
      const userData = {
        wallets: this.state.wallets,
        learnedMerchants: this.state.learnedMerchants,
        transactions: this.state.transactions,
        commitments: this.state.commitments || [],
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(userData));
    } catch (e) {
      console.error('Failed to save user-scoped data:', e);
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
  isBalanceHidden() {
    return !!this.state.isBalanceHidden;
  }

  toggleBalancePrivacy() {
    this.state.isBalanceHidden = !this.state.isBalanceHidden;
    this.notify('privacy:toggled', this.state.isBalanceHidden);
    return this.state.isBalanceHidden;
  }

  // --- Fraud Detection & Community Spam Helpers ---
  getFraudData() {
    if (!this.state.fraudDetection) {
      this.state.fraudDetection = JSON.parse(JSON.stringify(INITIAL_FRAUD_DATA));
    }
    return this.state.fraudDetection;
  }

  getReportsForUpi(upiId) {
    if (!upiId) return [];
    const normalized = upiId.trim().toLowerCase();
    const fraud = this.getFraudData();
    return (fraud.reports || []).filter((r) => r.reportedUpiId.toLowerCase() === normalized);
  }

  addFraudReport(reportData) {
    const fraud = this.getFraudData();
    const normalizedUpi = reportData.reportedUpiId.trim().toLowerCase();

    const newReport = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      reporterId: reportData.reporterId || this.state.user.id,
      reporterTrust: reportData.reporterTrust !== undefined ? reportData.reporterTrust : 1.0,
      reportedUpiId: normalizedUpi,
      reason: reportData.reason,
      details: reportData.details || '',
      createdAt: new Date().toISOString(),
      deviceId: reportData.deviceId || 'dev_current_user',
    };

    fraud.reports.unshift(newReport);

    // Also register user as interacted
    if (!fraud.interactions[normalizedUpi]) {
      fraud.interactions[normalizedUpi] = [];
    }
    if (!fraud.interactions[normalizedUpi].includes(newReport.reporterId)) {
      fraud.interactions[normalizedUpi].push(newReport.reporterId);
    }

    this.notify('fraud:reported', newReport);
    return newReport;
  }

  submitAppeal(upiId, appealReason) {
    const fraud = this.getFraudData();
    const normalizedUpi = upiId.trim().toLowerCase();

    const newAppeal = {
      id: `app_${Date.now()}`,
      upiId: normalizedUpi,
      appealReason,
      status: 'under_review',
      createdAt: new Date().toISOString(),
    };

    if (!fraud.appeals) fraud.appeals = [];
    fraud.appeals.unshift(newAppeal);

    this.notify('fraud:appealed', newAppeal);
    return newAppeal;
  }

  getAppealForUpi(upiId) {
    if (!upiId) return null;
    const normalizedUpi = upiId.trim().toLowerCase();
    const fraud = this.getFraudData();
    return (fraud.appeals || []).find((a) => a.upiId === normalizedUpi) || null;
  }

  recordInteraction(upiId, userId = null) {
    if (!upiId) return;
    const normalizedUpi = upiId.trim().toLowerCase();
    const fraud = this.getFraudData();
    const uid = userId || this.state.user.id;

    if (!fraud.interactions[normalizedUpi]) {
      fraud.interactions[normalizedUpi] = [];
    }
    if (!fraud.interactions[normalizedUpi].includes(uid)) {
      fraud.interactions[normalizedUpi].push(uid);
      this.notify('fraud:interaction_recorded', { upiId: normalizedUpi, userId: uid });
    }
  }

  // --- Collect Requests Helpers ---
  getCollectRequests() {
    if (!this.state.collectRequests) {
      this.state.collectRequests = JSON.parse(JSON.stringify(INITIAL_COLLECT_REQUESTS));
    }
    return this.state.collectRequests;
  }

  updateCollectRequestStatus(requestId, status) {
    const requests = this.getCollectRequests();
    const req = requests.find((r) => r.id === requestId);
    if (req) {
      req.status = status;
      this.notify('collect:updated', req);
      return true;
    }
    return false;
  }

  // --- Split-Bill Wallet Helpers ---
  getSplitData() {
    if (!this.state.splitBill) {
      this.state.splitBill = JSON.parse(JSON.stringify(INITIAL_SPLIT_DATA));
    }
    return this.state.splitBill;
  }

  getSplitGroups() {
    return this.getSplitData().groups || [];
  }

  getSplitGroup(groupId) {
    return this.getSplitGroups().find((g) => g.id === groupId) || null;
  }

  getGroupMembers(groupId) {
    const split = this.getSplitData();
    return (split.groupMembers || []).filter((m) => m.groupId === groupId);
  }

  getGroupExpenses(groupId) {
    const split = this.getSplitData();
    return (split.expenses || []).filter((e) => e.groupId === groupId);
  }

  getGroupSettlements(groupId) {
    const split = this.getSplitData();
    return (split.settlements || []).filter((s) => s.groupId === groupId);
  }

  addSplitGroup(groupData) {
    const split = this.getSplitData();
    const groupId = `grp_${Date.now()}`;

    const newGroup = {
      id: groupId,
      name: groupData.name,
      category: groupData.category || 'General',
      icon: groupData.icon || '👥',
      createdBy: this.state.user.id,
      createdAt: new Date().toISOString(),
      phase2Pool: {
        enabled: false,
        targetPoolAmount: 0,
        poolBalance: 0,
        refundPolicy: 'equal',
      },
    };

    split.groups.unshift(newGroup);

    // Add current user as member
    const currentMember = {
      id: `mem_${Date.now()}_0`,
      groupId,
      userId: this.state.user.id,
      name: `You (${this.state.user.name.split(' ')[0]})`,
      upiId: 'sharath@okhdfcbank',
      phone: '9876543210',
      isCurrentUser: true,
    };
    split.groupMembers.push(currentMember);

    // Add other members
    if (Array.isArray(groupData.members)) {
      groupData.members.forEach((m, idx) => {
        split.groupMembers.push({
          id: `mem_${Date.now()}_${idx + 1}`,
          groupId,
          userId: `usr_ext_${Date.now()}_${idx}`,
          name: m.name || `Friend ${idx + 1}`,
          upiId: m.upiId || `friend${idx + 1}@upi`,
          phone: m.phone || '',
          isCurrentUser: false,
        });
      });
    }

    this.notify('split:group_created', newGroup);
    return newGroup;
  }

  addSplitExpense(expenseData) {
    const split = this.getSplitData();
    const newExpense = {
      id: `exp_${Date.now()}`,
      groupId: expenseData.groupId,
      description: expenseData.description,
      amount: Number(expenseData.amount),
      paidBy: expenseData.paidBy,
      splitType: expenseData.splitType || 'equal',
      createdAt: new Date().toISOString(),
      shares: expenseData.shares || [],
    };

    split.expenses.unshift(newExpense);
    this.notify('split:expense_added', newExpense);
    return newExpense;
  }

  recordSettlement(settlementData) {
    const split = this.getSplitData();
    const newSettlement = {
      id: `stl_${Date.now()}`,
      groupId: settlementData.groupId,
      fromMemberId: settlementData.fromMemberId,
      toMemberId: settlementData.toMemberId,
      amount: Number(settlementData.amount),
      status: 'completed',
      createdAt: new Date().toISOString(),
      txId: settlementData.txId || null,
    };

    if (!split.settlements) split.settlements = [];
    split.settlements.unshift(newSettlement);
    this.notify('split:settled', newSettlement);
    return newSettlement;
  }

  // --- Financial Commitments & Schedules ---
  getCommitments() {
    return this.state.commitments || [];
  }

  getCommitment(commitmentId) {
    return (this.state.commitments || []).find((c) => c.id === commitmentId) || null;
  }

  addCommitment(data) {
    const newCommitment = {
      id: `pmt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: (data.name || '').trim(),
      payee: (data.payee || '').trim(),
      amount: Number(data.amount) || 0,
      dueDate: data.dueDate || new Date().toISOString().split('T')[0],
      frequency: data.frequency || 'monthly',
      walletId: data.walletId || data.preferredWalletId || (this.state.wallets[0]?.id || 'wallet_housing'),
      preferredWalletId: data.walletId || data.preferredWalletId || (this.state.wallets[0]?.id || 'wallet_housing'),
      notes: (data.notes || '').trim(),
      category: data.category || 'Other',
      status: data.status || 'PLANNED',
      createdAt: new Date().toISOString(),
      lastPaidAt: null,
      lastTxId: null,
      isMandateAuthorized: !!data.isMandateAuthorized,
    };

    if (!this.state.commitments) {
      this.state.commitments = [];
    }
    this.state.commitments.unshift(newCommitment);
    this.notify('commitment:added', newCommitment);
    this.notify('state:changed');
    return newCommitment;
  }

  updateCommitment(commitmentId, updates) {
    const commitment = this.getCommitment(commitmentId);
    if (!commitment) return null;
    Object.assign(commitment, updates);
    this.notify('commitment:updated', commitment);
    this.notify('state:changed');
    return commitment;
  }

  deleteCommitment(commitmentId) {
    if (!this.state.commitments) return false;
    const idx = this.state.commitments.findIndex((c) => c.id === commitmentId);
    if (idx === -1) return false;
    const removed = this.state.commitments.splice(idx, 1)[0];
    this.notify('commitment:deleted', removed);
    this.notify('state:changed');
    return true;
  }

  executeCommitmentPayment(commitmentId, paymentDetails = {}) {
    const commitment = this.getCommitment(commitmentId);
    if (!commitment) return null;

    const wallet = this.getWallet(commitment.walletId);
    const amount = Number(commitment.amount);

    // Deduct from wallet if available
    if (wallet) {
      wallet.balance = Math.max(0, (Number(wallet.balance) || 0) - amount);
    }

    // Record verified transaction
    const tx = this.addTransaction({
      merchantName: commitment.payee || commitment.name,
      amount: amount,
      type: 'debit',
      category: commitment.category || 'General',
      walletId: commitment.walletId,
      note: paymentDetails.note || `Payment for ${commitment.name}`,
    });

    commitment.lastPaidAt = new Date().toISOString();
    commitment.lastTxId = tx.id;

    if (commitment.frequency === 'one-time') {
      commitment.status = 'SUCCESS';
    } else {
      // Calculate next recurring cycle
      const nextDate = new Date(commitment.dueDate);
      if (commitment.frequency === 'weekly') {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (commitment.frequency === 'quarterly') {
        nextDate.setMonth(nextDate.getMonth() + 3);
      } else if (commitment.frequency === 'yearly') {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      } else {
        // default monthly
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
      commitment.dueDate = nextDate.toISOString().split('T')[0];
      commitment.status = 'PLANNED';
    }

    this.notify('commitment:paid', { commitment, tx });
    this.notify('state:changed');
    return { commitment, tx };
  }

  // --- Real Funding Flow (Add Money to Wallet) ---
  depositMoney(walletId, amount, method = 'HDFC Bank •• 4821', note = '') {
    const wallet = this.getWallet(walletId);
    if (!wallet) return null;
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) return null;

    wallet.balance = (Number(wallet.balance) || 0) + numAmount;

    const tx = this.addTransaction({
      merchantName: method || 'Bank Deposit (HDFC Bank •• 4821)',
      amount: numAmount,
      type: 'credit',
      category: 'Deposit',
      walletId: wallet.id,
      note: note || `Funded ${wallet.name} wallet via ${method}`,
    });

    this.notify('wallet:funded', { wallet, amount: numAmount, tx });
    this.notify('state:changed');
    return { wallet, tx };
  }

  // --- Reset All Data to Clean Production Zero State ---
  resetToCleanState() {
    this.state.user = {
      id: 'usr_001',
      name: 'Sharath Kumar',
      email: null,
      isAuthenticated: false,
      greeting: 'Good morning',
      bankName: 'HDFC Bank',
      accountNumber: '••• 4821',
      supabaseUser: null,
    };
    this.state.wallets = JSON.parse(JSON.stringify(INITIAL_WALLETS));
    this.state.transactions = [];
    this.state.commitments = [];
    this.state.learnedMerchants = {};
    this.state.isBalanceHidden = false;
    this.state.fraudDetection = JSON.parse(JSON.stringify(INITIAL_FRAUD_DATA));
    this.state.collectRequests = [];
    this.state.splitBill = JSON.parse(JSON.stringify(INITIAL_SPLIT_DATA));
    this.saveState();
    this.notify('auth:changed', this.state.user);
    this.notify('state:reset', this.state);
  }

  resetData() {
    this.resetToCleanState();
  }

  // Backward compatibility alias for test suites
  resetToDemoData() {
    this.resetToCleanState();
  }
}

export const stateManager = new StateManager();
