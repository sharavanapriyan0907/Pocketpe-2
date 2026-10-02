/* ==========================================================================
   POCKETPE - TRANSACTION & PAYMENT PROTECTION ENGINE
   Simulates payments, prevents accidental overspending, and shields reserved money
   ========================================================================== */

import { stateManager } from '../state.js';
import { WalletEngine } from './walletEngine.js';

export class TransactionEngine {
  /**
   * Process a payment from a specified wallet
   */
  static processPayment({ merchantName, amount, category, walletId, note = '' }) {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return {
        status: 'error',
        message: 'Please enter a valid payment amount.',
      };
    }

    const wallet = stateManager.getWallet(walletId);
    if (!wallet) {
      return {
        status: 'error',
        message: 'Selected wallet does not exist.',
      };
    }

    // Check if wallet has sufficient balance
    if (wallet.balance < numAmount) {
      const deficit = numAmount - wallet.balance;
      const freeWallet = stateManager.getFreeMoneyWallet();
      const freeBalance = freeWallet ? freeWallet.balance : 0;

      // Find other wallets that have enough balance
      const alternativeWallets = stateManager
        .getWallets()
        .filter((w) => w.id !== wallet.id && w.balance >= numAmount);

      return {
        status: 'insufficient_balance',
        wallet,
        paymentAmount: numAmount,
        walletBalance: wallet.balance,
        deficit,
        canCoverWithFreeMoney: freeBalance >= deficit,
        freeMoneyBalance: freeBalance,
        alternativeWallets,
        message: `Your ${wallet.name} wallet has ${WalletEngine.formatRupee(wallet.balance)}. You need ${WalletEngine.formatRupee(deficit)} more.`,
      };
    }

    // Execute Payment
    wallet.balance -= numAmount;

    const tx = stateManager.addTransaction({
      merchantName,
      amount: numAmount,
      type: 'debit',
      category: category || wallet.category || 'General',
      walletId: wallet.id,
      note,
    });

    stateManager.notify('payment:completed', {
      transaction: tx,
      wallet,
      remainingBalance: wallet.balance,
    });

    return {
      status: 'success',
      transaction: tx,
      wallet,
      amount: numAmount,
      remainingBalance: wallet.balance,
      message: `Paid ${WalletEngine.formatRupee(numAmount)} from ${wallet.name} wallet.`,
    };
  }

  /**
   * Payment Protection Shield: Auto-top-up from Free Money and Pay
   * Solves: "Move ₹400 from Free Money and complete payment"
   */
  static shieldAndPay({ merchantName, amount, category, walletId, note = '' }) {
    const wallet = stateManager.getWallet(walletId);
    const freeWallet = stateManager.getFreeMoneyWallet();

    if (!wallet || !freeWallet) {
      return { status: 'error', message: 'Unable to locate wallets.' };
    }

    const numAmount = Number(amount);
    const deficit = numAmount - wallet.balance;

    if (freeWallet.balance < deficit) {
      return {
        status: 'error',
        message: `Free Money only has ${WalletEngine.formatRupee(freeWallet.balance)}, which is not enough to cover ${WalletEngine.formatRupee(deficit)}.`,
      };
    }

    // 1. Move deficit from Free Money to Target Wallet
    freeWallet.balance -= deficit;
    wallet.balance += deficit;

    // 2. Execute Payment
    wallet.balance -= numAmount;

    // Record both the top-up rebalance and the transaction
    stateManager.addTransaction({
      merchantName: `Protection Cushion (Free Money → ${wallet.name})`,
      amount: deficit,
      type: 'rebalance',
      category: 'Transfer',
      walletId: wallet.id,
      note: `Shielded ${WalletEngine.formatRupee(deficit)} to cover ${merchantName}`,
    });

    const tx = stateManager.addTransaction({
      merchantName,
      amount: numAmount,
      type: 'debit',
      category: category || wallet.category || 'General',
      walletId: wallet.id,
      note: note || `Covered with ${WalletEngine.formatRupee(deficit)} from Free Money`,
    });

    stateManager.notify('payment:shielded', {
      transaction: tx,
      wallet,
      deficit,
      freeWallet,
    });

    return {
      status: 'success',
      transaction: tx,
      wallet,
      deficit,
      amount: numAmount,
      remainingBalance: wallet.balance,
      message: `Shielded & Paid! Moved ${WalletEngine.formatRupee(deficit)} from Free Money and paid ${WalletEngine.formatRupee(numAmount)}.`,
    };
  }
}
