/* ==========================================================================
   POCKETPE - SPLIT-BILL WALLET ENGINE
   Phase 1 Ledger: Group expense splitting, net balances, simplified debt minimization
   Phase 2 Ready: Schema prepared for pooled wallet
   ========================================================================== */

import { stateManager } from '../state.js';
import { WalletEngine } from './walletEngine.js';
import { TransactionEngine } from './transactionEngine.js';

export class SplitEngine {
  /**
   * Calculate equal split shares ensuring sum exactly equals total amount
   * @param {number} totalAmount
   * @param {string[]} memberIds
   * @returns {Array<{ memberId: string, shareAmount: number }>}
   */
  static calculateEqualShares(totalAmount, memberIds) {
    const numAmount = Number(totalAmount);
    if (!memberIds || memberIds.length === 0 || isNaN(numAmount) || numAmount <= 0) {
      return [];
    }

    const count = memberIds.length;
    // Work in paisa (cents) to avoid floating point precision errors
    const totalPaisa = Math.round(numAmount * 100);
    const basePaisa = Math.floor(totalPaisa / count);
    const remainderPaisa = totalPaisa % count;

    return memberIds.map((memberId, idx) => {
      // Allocate 1-paisa remainder to the first N members
      const memberPaisa = basePaisa + (idx < remainderPaisa ? 1 : 0);
      return {
        memberId,
        shareAmount: memberPaisa / 100,
      };
    });
  }

  /**
   * Validate custom split shares against total amount
   * @param {number} totalAmount
   * @param {Array<{ memberId: string, shareAmount: number }>} shares
   */
  static validateCustomShares(totalAmount, shares) {
    const numAmount = Number(totalAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return { valid: false, error: 'Total amount must be greater than zero.' };
    }

    const sum = shares.reduce((acc, s) => acc + (Number(s.shareAmount) || 0), 0);
    const diff = Math.round((numAmount - sum) * 100) / 100;

    if (Math.abs(diff) > 0.05) {
      return {
        valid: false,
        error: `Shares sum to ${WalletEngine.formatRupee(sum)}, but expense total is ${WalletEngine.formatRupee(numAmount)}. Difference of ${WalletEngine.formatRupee(Math.abs(diff))}.`,
        diff,
      };
    }

    return { valid: true, sum };
  }

  /**
   * Calculate net balances for each member in a group
   * @param {string} groupId
   * @param {Object} [customState] - Optional custom state for unit tests
   */
  static calculateGroupBalances(groupId, customState = null) {
    const state = customState || stateManager.getState();
    const splitData = state.splitBill || {};
    const members = (splitData.groupMembers || []).filter((m) => m.groupId === groupId);
    const expenses = (splitData.expenses || []).filter((e) => e.groupId === groupId);
    const settlements = (splitData.settlements || []).filter(
      (s) => s.groupId === groupId && s.status === 'completed'
    );

    const balanceMap = {};
    members.forEach((m) => {
      balanceMap[m.id] = {
        member: m,
        totalPaid: 0,
        totalShare: 0,
        settledPaid: 0,
        settledReceived: 0,
        netBalance: 0, // positive = is owed money; negative = owes money
      };
    });

    // 1. Process Expenses
    expenses.forEach((exp) => {
      const payerId = exp.paidBy;
      if (balanceMap[payerId]) {
        balanceMap[payerId].totalPaid += Number(exp.amount) || 0;
      }

      (exp.shares || []).forEach((share) => {
        if (balanceMap[share.memberId]) {
          balanceMap[share.memberId].totalShare += Number(share.shareAmount) || 0;
        }
      });
    });

    // 2. Process Completed Settlements
    settlements.forEach((stl) => {
      const fromId = stl.fromMemberId;
      const toId = stl.toMemberId;
      const amt = Number(stl.amount) || 0;

      if (balanceMap[fromId]) {
        balanceMap[fromId].settledPaid += amt;
      }
      if (balanceMap[toId]) {
        balanceMap[toId].settledReceived += amt;
      }
    });

    // 3. Calculate final Net Balance for each member
    Object.values(balanceMap).forEach((entry) => {
      const net = entry.totalPaid - entry.totalShare + (entry.settledPaid - entry.settledReceived);
      entry.netBalance = Math.round(net * 100) / 100;
    });

    return balanceMap;
  }

  /**
   * Simplified Debt Minimization Algorithm (Min-Cash-Flow)
   * Resolves circular cross-debts into the fewest direct transactions between members
   * @param {string} groupId
   * @param {Object} [customState] - Optional custom state for unit tests
   * @returns {Array<{ fromMember: Object, toMember: Object, amount: number, isCurrentUserPayer: boolean, isCurrentUserReceiver: boolean }>}
   */
  static calculateSimplifiedSettlements(groupId, customState = null) {
    const balances = this.calculateGroupBalances(groupId, customState);
    const debtors = []; // owes money (net < 0)
    const creditors = []; // owed money (net > 0)

    Object.values(balances).forEach((b) => {
      if (b.netBalance < -0.05) {
        debtors.push({
          member: b.member,
          amount: Math.abs(b.netBalance),
        });
      } else if (b.netBalance > 0.05) {
        creditors.push({
          member: b.member,
          amount: b.netBalance,
        });
      }
    });

    // Sort descending by amount for greedy matching
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const simplified = [];
    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const settledAmt = Math.min(debtor.amount, creditor.amount);

      if (settledAmt > 0.05) {
        simplified.push({
          id: `stl_calc_${debtor.member.id}_${creditor.member.id}`,
          groupId,
          fromMember: debtor.member,
          toMember: creditor.member,
          amount: Math.round(settledAmt * 100) / 100,
          isCurrentUserPayer: !!debtor.member.isCurrentUser,
          isCurrentUserReceiver: !!creditor.member.isCurrentUser,
        });
      }

      debtor.amount -= settledAmt;
      creditor.amount -= settledAmt;

      if (debtor.amount < 0.05) i++;
      if (creditor.amount < 0.05) j++;
    }

    return simplified;
  }

  /**
   * Format a gentle, friendly reminder notification text for students
   */
  static generateGentleReminder(fromMember, toMember, amount, groupName = '') {
    const groupContext = groupName ? ` for "${groupName}"` : '';
    return `Hey ${fromMember.name}! 👋 Friendly ping for ${WalletEngine.formatRupee(amount)}${groupContext} on PocketPe. Settle up whenever you're free! 🍕🤝`;
  }

  /**
   * Execute settlement payment via PocketPe's Purpose Wallet Engine
   * Auto-recommends 'wallet_friends' (Friends & Social)
   */
  static executeSettlementPayment({ groupId, fromMemberId, toMemberId, amount }) {
    const group = stateManager.getSplitGroup(groupId);
    const members = stateManager.getGroupMembers(groupId);
    const toMember = members.find((m) => m.id === toMemberId);

    if (!toMember) {
      return { success: false, error: 'Recipient member not found.' };
    }

    // Try finding the 'Friends' wallet
    const friendsWallet = stateManager.getWallet('wallet_friends') || stateManager.getFreeMoneyWallet();

    // Process payment through TransactionEngine
    const paymentResult = TransactionEngine.processPayment({
      merchantName: `Settlement: ${toMember.name}`,
      amount: Number(amount),
      category: 'Friends & Social',
      walletId: friendsWallet ? friendsWallet.id : stateManager.getWallets()[0].id,
      note: `Split bill settlement for ${group ? group.name : 'Group'}`,
    });

    if (paymentResult.status === 'success') {
      // Record completed settlement in split engine
      const settlement = stateManager.recordSettlement({
        groupId,
        fromMemberId,
        toMemberId,
        amount: Number(amount),
        txId: paymentResult.transaction.id,
      });

      return {
        success: true,
        settlement,
        paymentResult,
        message: `Settled ${WalletEngine.formatRupee(amount)} with ${toMember.name} using ${paymentResult.wallet.name} wallet!`,
      };
    } else if (paymentResult.status === 'insufficient_balance') {
      return {
        success: false,
        status: 'insufficient_balance',
        deficitInfo: paymentResult,
        error: `Insufficient balance in ${paymentResult.wallet.name} wallet. Payment Protection Shield can help top up.`,
      };
    } else {
      return {
        success: false,
        error: paymentResult.message || 'Payment execution failed.',
      };
    }
  }
}
