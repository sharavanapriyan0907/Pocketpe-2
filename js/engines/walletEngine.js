/* ==========================================================================
   POCKETPE - WALLET ENGINE
   Core logic for virtual purpose wallets, balances, split math, and rebalancing
   ========================================================================== */

import { stateManager } from '../state.js';

export class WalletEngine {
  /**
   * Get formatted currency string in Indian Rupees (e.g. ₹10,000)
   */
  static formatRupee(amount, hideDecimals = true) {
    const val = Number(amount) || 0;
    if (hideDecimals) {
      return `₹${Math.round(val).toLocaleString('en-IN')}`;
    }
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Calculate summary of all balances
   */
  static getSummary() {
    const total = stateManager.getTotalBalance();
    const allocated = stateManager.getAllocatedBalance();
    const free = stateManager.getFreeMoneyBalance();
    const wallets = stateManager.getWallets();

    const allocatedPercentage = total > 0 ? Math.round((allocated / total) * 100) : 0;
    const freePercentage = 100 - allocatedPercentage;

    return {
      total,
      allocated,
      free,
      allocatedPercentage,
      freePercentage,
      walletsCount: wallets.length,
    };
  }

  /**
   * Calculate status and progress for a single wallet
   */
  static getWalletProgress(wallet) {
    const balance = Number(wallet.balance) || 0;
    const target = Number(wallet.targetAmount) || 0;
    const limit = Number(wallet.monthlyLimit) || 0;

    let percent = 0;
    let statusText = '';
    let isWarning = false;
    let isDanger = false;

    if (target > 0) {
      percent = Math.min(Math.round((balance / target) * 100), 100);
      statusText = `${percent}% of target`;
      if (percent >= 100) {
        statusText = 'Goal reached! 🎉';
      }
    } else if (limit > 0) {
      const spent = Math.max(limit - balance, 0);
      percent = Math.min(Math.round((spent / limit) * 100), 100);
      statusText = `${percent}% used`;
      if (percent > 85) isDanger = true;
      else if (percent > 65) isWarning = true;
    } else {
      percent = 100;
      statusText = 'Active purpose';
    }

    return {
      percent,
      statusText,
      isWarning,
      isDanger,
      remainingToTarget: target > 0 ? Math.max(target - balance, 0) : null,
    };
  }

  /**
   * Rebalance (Move money) from one wallet to another
   */
  static moveMoney(fromWalletId, toWalletId, amount, note = '') {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return { success: false, message: 'Please enter a valid amount to move.' };
    }

    if (fromWalletId === toWalletId) {
      return { success: false, message: 'Source and destination wallets must be different.' };
    }

    const sourceWallet = stateManager.getWallet(fromWalletId);
    const destWallet = stateManager.getWallet(toWalletId);

    if (!sourceWallet || !destWallet) {
      return { success: false, message: 'Wallet not found.' };
    }

    if (sourceWallet.balance < numAmount) {
      return {
        success: false,
        message: `Your ${sourceWallet.name} wallet only has ${this.formatRupee(sourceWallet.balance)}.`,
      };
    }

    // Perform virtual move
    sourceWallet.balance -= numAmount;
    destWallet.balance += numAmount;

    // Record rebalance transaction in activity timeline
    stateManager.addTransaction({
      merchantName: `Moved from ${sourceWallet.name} to ${destWallet.name}`,
      amount: numAmount,
      type: 'rebalance',
      category: 'Transfer',
      walletId: destWallet.id,
      note: note || `Rebalanced ${this.formatRupee(numAmount)}`,
    });

    stateManager.notify('wallet:rebalanced', {
      from: sourceWallet,
      to: destWallet,
      amount: numAmount,
    });

    return {
      success: true,
      message: `Successfully moved ${this.formatRupee(numAmount)} to ${destWallet.name}!`,
      sourceWallet,
      destWallet,
    };
  }

  /**
   * Distribute incoming money across wallets using allocation percentages
   */
  static distributeIncoming(amount, customSplits = null) {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return { success: false, message: 'Invalid incoming amount.' };
    }

    const wallets = stateManager.getWallets();
    const distributions = [];
    let allocatedTotal = 0;

    wallets.forEach((wallet) => {
      let pct = wallet.allocationPercentage || 0;
      if (customSplits && typeof customSplits[wallet.id] === 'number') {
        pct = customSplits[wallet.id];
      }

      const walletRupee = Math.round((pct / 100) * numAmount);
      wallet.balance += walletRupee;
      allocatedTotal += walletRupee;

      distributions.push({
        walletId: wallet.id,
        walletName: wallet.name,
        icon: wallet.icon,
        color: wallet.color,
        percentage: pct,
        amount: walletRupee,
        newBalance: wallet.balance,
      });
    });

    // Handle any rounding remainder by depositing into Free Money
    const difference = numAmount - allocatedTotal;
    if (difference !== 0) {
      const freeWallet = stateManager.getFreeMoneyWallet();
      if (freeWallet) {
        freeWallet.balance += difference;
        const freeDist = distributions.find((d) => d.walletId === freeWallet.id);
        if (freeDist) {
          freeDist.amount += difference;
          freeDist.newBalance = freeWallet.balance;
        }
      }
    }

    // Add activity record
    stateManager.addTransaction({
      merchantName: 'Money Received (Split Applied)',
      amount: numAmount,
      type: 'credit',
      category: 'Income',
      walletId: 'all',
      note: `Split across ${distributions.length} purposes automatically`,
    });

    stateManager.notify('money:received', {
      amount: numAmount,
      distributions,
    });

    return {
      success: true,
      totalAmount: numAmount,
      distributions,
    };
  }

  /**
   * Generate human, calm, 1-sentence spending insights
   */
  static generateInsights() {
    const wallets = stateManager.getWallets();
    const transactions = stateManager.getTransactions();
    const insights = [];

    // Food wallet insight
    const foodWallet = wallets.find((w) => w.id === 'wallet_food');
    if (foodWallet) {
      const foodTxs = transactions.filter((t) => t.walletId === 'wallet_food' && t.type === 'debit');
      const foodSpent = foodTxs.reduce((sum, t) => sum + (t.amount || 0), 0);
      if (foodSpent > 0) {
        insights.push({
          icon: '🍔',
          text: `You spent <strong>${this.formatRupee(foodSpent)}</strong> on Food recently. You still have <strong>${this.formatRupee(foodWallet.balance)}</strong> remaining.`,
          walletId: foodWallet.id,
        });
      }
    }

    // Savings goal insight
    const savingsWallet = wallets.find((w) => w.id === 'wallet_savings');
    if (savingsWallet && savingsWallet.targetAmount > 0) {
      const pct = Math.round((savingsWallet.balance / savingsWallet.targetAmount) * 100);
      if (pct >= 100) {
        insights.push({
          icon: '🎯',
          text: `Your Savings goal is <strong>100% funded</strong> (${this.formatRupee(savingsWallet.balance)}). Well done!`,
          walletId: savingsWallet.id,
        });
      } else {
        insights.push({
          icon: '💰',
          text: `You have <strong>${this.formatRupee(savingsWallet.balance)}</strong> safely reserved for Savings (${pct}% of target).`,
          walletId: savingsWallet.id,
        });
      }
    }

    // Free Money safety cushion
    const freeBalance = stateManager.getFreeMoneyBalance();
    if (freeBalance > 0) {
      insights.push({
        icon: '🛡️',
        text: `You have <strong>${this.formatRupee(freeBalance)}</strong> in Free Money ready as an unallocated cushion.`,
        walletId: 'wallet_free',
      });
    }

    // Transport insight
    const transportWallet = wallets.find((w) => w.id === 'wallet_transport');
    if (transportWallet) {
      insights.push({
        icon: '🚗',
        text: `Transport wallet is at <strong>${this.formatRupee(transportWallet.balance)}</strong>, enough for your daily commutes.`,
        walletId: transportWallet.id,
      });
    }

    return insights;
  }
}
