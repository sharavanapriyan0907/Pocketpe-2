/* ==========================================================================
   POCKETPE - COMMITMENT & PAYMENT SCHEDULES ENGINE
   Manages user-created financial commitments, due dates, shortfall
   calculations, intelligent home alerts, and execution state transitions.
   ========================================================================== */

export const COMMITMENT_CATEGORIES = [
  { id: 'housing', label: 'Housing & Rent', icon: '🏠', defaultWalletCategory: 'Housing' },
  { id: 'utilities', label: 'Electricity & Utilities', icon: '⚡', defaultWalletCategory: 'Housing' },
  { id: 'education', label: 'College & Education', icon: '🎓', defaultWalletCategory: 'College & Education' },
  { id: 'loan', label: 'Loan & Financial', icon: '💳', defaultWalletCategory: 'Savings & Investment' },
  { id: 'insurance', label: 'Insurance Premium', icon: '🛡️', defaultWalletCategory: 'Savings & Investment' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '📱', defaultWalletCategory: 'Entertainment' },
  { id: 'health', label: 'Health & Medical', icon: '💊', defaultWalletCategory: 'Medical' },
  { id: 'personal', label: 'Personal & Family', icon: '🤝', defaultWalletCategory: 'Friends & Social' },
  { id: 'other', label: 'Other', icon: '📋', defaultWalletCategory: 'Unallocated Cushion' },
];

export const RECURRENCE_FREQUENCIES = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'one-time', label: 'One-time' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
];

export const EXECUTION_STATUSES = {
  PLANNED: 'Planned payment',
  FUNDS_AVAILABLE: 'Funds available',
  AWAITING_ACTION: 'Payment awaiting user action',
  MANDATE_AUTHORIZED: 'Authorized recurring mandate',
  PROCESSING: 'Payment processing',
  SUCCESS: 'Confirmed payment success',
  FAILED: 'Confirmed payment failure',
};

export class CommitmentEngine {
  /**
   * Calculates funding status and shortfall for a commitment against wallets.
   */
  static calculateFunding(commitment, wallets = []) {
    const amount = Number(commitment.amount) || 0;
    const wallet = wallets.find((w) => w.id === commitment.walletId) || wallets[0] || null;
    const availableBalance = wallet ? Number(wallet.balance) || 0 : 0;
    const shortfall = Math.max(0, amount - availableBalance);
    const hasSufficientFunds = availableBalance >= amount;

    return {
      wallet,
      amount,
      availableBalance,
      shortfall,
      hasSufficientFunds,
    };
  }

  /**
   * Calculates days remaining until the due date.
   * Returns negative if overdue, 0 if due today, positive if upcoming.
   */
  static getDaysUntilDue(dueDateString) {
    if (!dueDateString) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(dueDateString);
    due.setHours(0, 0, 0, 0);

    const diffTime = due.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Human-friendly due date string & urgency description.
   */
  static getDueDateDisplay(dueDateString) {
    if (!dueDateString) return { formattedDate: '', relativeLabel: 'No date', isOverdue: false, isDueSoon: false };

    const due = new Date(dueDateString);
    const formattedDate = due.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const days = this.getDaysUntilDue(dueDateString);
    let relativeLabel = '';
    let isOverdue = false;
    let isDueSoon = false;

    if (days < 0) {
      isOverdue = true;
      const absDays = Math.abs(days);
      relativeLabel = `Overdue by ${absDays} day${absDays > 1 ? 's' : ''}`;
    } else if (days === 0) {
      isDueSoon = true;
      relativeLabel = 'Due today';
    } else if (days === 1) {
      isDueSoon = true;
      relativeLabel = 'Due tomorrow';
    } else if (days <= 7) {
      isDueSoon = true;
      relativeLabel = `Due in ${days} days`;
    } else {
      relativeLabel = `Due in ${days} days`;
    }

    return {
      formattedDate,
      relativeLabel,
      daysUntil: days,
      isOverdue,
      isDueSoon,
    };
  }

  /**
   * Formats a raw YYYY-MM-DD date into Indian human-friendly date string (e.g. 15 Oct 2026).
   */
  static formatDueDate(dueDateString) {
    if (!dueDateString) return '';
    const due = new Date(dueDateString);
    if (isNaN(due.getTime())) return dueDateString;
    return due.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  /**
   * Returns human-readable label for recurrence frequency (e.g. 'Monthly').
   */
  static getFrequencyLabel(frequencyId) {
    const item = RECURRENCE_FREQUENCIES.find((f) => f.id === frequencyId);
    return item ? item.label : (frequencyId ? String(frequencyId).charAt(0).toUpperCase() + String(frequencyId).slice(1) : 'Monthly');
  }

  /**
   * Returns comprehensive status and presentation model for a commitment card.
   */
  static getCommitmentStatus(commitment, wallets = []) {
    const funding = this.calculateFunding(commitment, wallets);
    const dueInfo = this.getDueDateDisplay(commitment.dueDate);
    const categoryItem = COMMITMENT_CATEGORIES.find((c) => c.id === commitment.category) || {
      id: 'other',
      label: 'Other',
      icon: '📋',
    };

    return {
      wallet: funding.wallet || { id: commitment.walletId, name: 'Wallet', balance: 0 },
      isFunded: funding.hasSufficientFunds,
      shortfall: funding.shortfall,
      availableBalance: funding.availableBalance,
      daysUntil: dueInfo.daysUntil,
      formattedDate: dueInfo.formattedDate,
      relativeLabel: dueInfo.relativeLabel,
      isOverdue: dueInfo.isOverdue,
      isDueSoon: dueInfo.isDueSoon,
      category: categoryItem,
    };
  }

  /**
   * Generates intelligent alerts for home page based on real schedules and wallet balances.
   * Only generates an alert when a real upcoming payment has insufficient funds.
   */
  static generateHomeAlerts(commitments = [], wallets = []) {
    if (!Array.isArray(commitments) || commitments.length === 0) {
      return [];
    }

    const alerts = [];

    // Filter active commitments that haven't been completed for current cycle
    const activeCommitments = commitments.filter((c) => c.status !== 'SUCCESS');

    for (const commitment of activeCommitments) {
      const funding = this.calculateFunding(commitment, wallets);

      // Only trigger an insufficient-funds warning if conditions are met:
      // Required payment exceeds available balance in the assigned wallet!
      if (!funding.hasSufficientFunds && funding.shortfall > 0) {
        const dueInfo = this.getDueDateDisplay(commitment.dueDate);
        const walletName = funding.wallet ? funding.wallet.name : 'Wallet';
        const walletId = funding.wallet ? funding.wallet.id : commitment.walletId;

        alerts.push({
          id: `alert_shortfall_${commitment.id}`,
          commitmentId: commitment.id,
          commitmentName: commitment.name,
          paymentName: commitment.name,
          payeeName: commitment.payee || '',
          category: commitment.category || 'Commitment',
          amountRequired: funding.amount,
          availableBalance: funding.availableBalance,
          shortfall: funding.shortfall,
          wallet: funding.wallet,
          walletId,
          walletName,
          dueDate: commitment.dueDate,
          dueInfo,
          title: 'Insufficient funds for your upcoming payment.',
          explanation: `Your available balance in ${walletName} is ₹${funding.availableBalance.toLocaleString('en-IN')}. You need another ₹${funding.shortfall.toLocaleString('en-IN')} to cover this payment.`,
        });
      }
    }

    // Sort alerts: most urgent due date first, then highest shortfall
    alerts.sort((a, b) => {
      if (a.dueInfo.daysUntil !== b.dueInfo.daysUntil) {
        return a.dueInfo.daysUntil - b.dueInfo.daysUntil;
      }
      return b.shortfall - a.shortfall;
    });

    return alerts;
  }

  /**
   * Advances the due date to next recurring cycle after successful execution.
   */
  static getNextDueDate(currentDueDateString, frequency = 'monthly') {
    const date = new Date(currentDueDateString || Date.now());
    switch (frequency) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      case 'monthly':
      default:
        date.setMonth(date.getMonth() + 1);
        break;
    }
    return date.toISOString().split('T')[0];
  }
}
