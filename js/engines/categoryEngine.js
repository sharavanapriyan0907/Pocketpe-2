/* ==========================================================================
   POCKETPE - SMART CATEGORY & USER LEARNING ENGINE
   ========================================================================== */

import { stateManager } from '../state.js';
import { KNOWN_MERCHANT_DIRECTORY } from '../config.js';
import { getCategoryFromMcc, getWalletForCategory } from './upiQrEngine.js';

export class CategoryEngine {
  /**
   * Rule-based keyword dictionary for categorizing unknown merchants
   */
  static KEYWORD_RULES = [
    {
      keywords: ['restaurant', 'canteen', 'cafe', 'coffee', 'dining', 'food', 'swiggy', 'zomato', 'pizza', 'burger', 'kitchen', 'dhaba', 'tea', 'bakery'],
      category: 'Food & Dining',
      targetWalletType: 'wallet_food',
      icon: '🍔',
    },
    {
      keywords: ['fuel', 'petrol', 'diesel', 'cng', 'taxi', 'uber', 'ola', 'metro', 'bus', 'auto', 'rail', 'irctc', 'toll', 'parking', 'fastag'],
      category: 'Transport & Fuel',
      targetWalletType: 'wallet_transport',
      icon: '🚗',
    },
    {
      keywords: ['pharmacy', 'hospital', 'clinic', 'medicine', 'apollo', 'medplus', 'doctor', 'lab', 'dentist', 'health', 'wellness', 'cure'],
      category: 'Health & Wellness',
      targetWalletType: null,
      icon: '🩺',
    },
    {
      keywords: ['college', 'course', 'book', 'books', 'stationery', 'udemy', 'coursera', 'tuition', 'campus', 'exam', 'library', 'university'],
      category: 'College & Education',
      targetWalletType: 'wallet_college',
      icon: '🎓',
    },
    {
      keywords: ['friend', 'rohan', 'priya', 'amit', 'rahul', 'sneha', 'vikram', 'split', 'borrow', 'payback'],
      category: 'Friends & Social',
      targetWalletType: 'wallet_friends',
      icon: '🤝',
    },
    {
      keywords: ['zara', 'h&m', 'amazon', 'flipkart', 'myntra', 'trends', 'mall', 'fashion', 'clothing', 'apparel', 'shoes', 'store'],
      category: 'Shopping & Apparel',
      targetWalletType: null,
      icon: '🛍️',
    },
    {
      keywords: ['barber', 'salon', 'spa', 'grooming', 'hair', 'parlour', 'cut'],
      category: 'Personal Care',
      targetWalletType: null,
      icon: '💈',
    },
    {
      keywords: ['cinema', 'movie', 'netflix', 'hotstar', 'spotify', 'pvr', 'inox', 'theatre', 'game', 'gaming'],
      category: 'Entertainment',
      targetWalletType: null,
      icon: '🎬',
    },
  ];

  /**
   * Intelligently classify a merchant and recommend the best wallet
   */
  static classifyMerchant(merchantName, amount = 0, explicitCategory = null, explicitMcc = null) {
    if (!merchantName && !explicitCategory) {
      return this.fallbackClassification();
    }

    const cleanName = (merchantName || 'Merchant').trim();
    const lowerName = cleanName.toLowerCase();
    const wallets = stateManager.getWallets();

    // 1. Check User Learned Overrides first!
    const learned = stateManager.getLearnedCategory(cleanName);
    if (learned) {
      const targetWallet = stateManager.getWallet(learned.walletId) || this.findWalletByCategory(learned.category) || stateManager.getFreeMoneyWallet();
      return {
        merchantName: cleanName,
        category: learned.category,
        recommendedWallet: targetWallet,
        isLearned: true,
        source: 'user_learned',
        icon: targetWallet?.icon || '🏷️',
        reason: `Based on your past choice for "${cleanName}".`,
      };
    }

    // 2. Check Explicit MCC or Category
    const mccCat = explicitMcc ? getCategoryFromMcc(explicitMcc) : null;
    const catToUse = mccCat || explicitCategory;

    if (catToUse) {
      const walletMatch = getWalletForCategory(catToUse, wallets);
      const targetWallet = walletMatch.wallet || this.findWalletByCategory(catToUse) || stateManager.getFreeMoneyWallet();
      const isFriend = catToUse === 'Friends & Social' || catToUse.toLowerCase().includes('friend');
      return {
        merchantName: cleanName,
        category: catToUse,
        recommendedWallet: targetWallet,
        isLearned: false,
        source: explicitMcc ? 'upi_mcc_code' : (isFriend ? 'p2p_friend_detection' : 'explicit_hint'),
        icon: isFriend ? '🤝' : (targetWallet?.icon || '🏷️'),
        mcc: explicitMcc,
        reason: isFriend
          ? `Auto-detected as Personal / Friend transfer (P2P). PocketPe selected ${targetWallet.name} wallet.`
          : (explicitMcc ? `Auto-detected from UPI MCC #${explicitMcc} (${catToUse}).` : `Categorized as ${catToUse}.`),
      };
    }

    // 2b. Check if merchantName is a personal UPI ID or mobile number (P2P Friend)
    const isPersonalUpi = (cleanName.includes('@') || /^[6-9]\d{9}$/.test(cleanName.replace(/[\s\-+]/g, ''))) &&
      !['swiggy', 'zomato', 'uber', 'ola', 'paytmwb', 'merchant', 'store', 'shop'].some((w) => lowerName.includes(w));
    if (isPersonalUpi) {
      const friendWallet = this.findWalletByCategory('Friends & Social') || stateManager.getFreeMoneyWallet();
      return {
        merchantName: cleanName,
        category: 'Friends & Social',
        recommendedWallet: friendWallet,
        isLearned: false,
        source: 'p2p_heuristic',
        icon: '🤝',
        reason: `Auto-detected as Personal / Friend transfer (${cleanName}). Recommended ${friendWallet.name} wallet.`,
      };
    }

    // 3. Check Known Merchant Directory database
    const seeded = KNOWN_MERCHANT_DIRECTORY.find(
      (m) => m.name.toLowerCase() === lowerName || lowerName.includes(m.name.toLowerCase())
    );
    if (seeded) {
      const targetWallet = stateManager.getWallet(seeded.matchingWallet) || this.findWalletByCategory(seeded.category) || stateManager.getFreeMoneyWallet();
      return {
        merchantName: cleanName,
        category: seeded.category,
        recommendedWallet: targetWallet,
        isLearned: false,
        source: 'merchant_directory',
        icon: seeded.icon,
        mcc: seeded.mcc,
        reason: `Matched "${cleanName}" with ${seeded.category}.`,
      };
    }

    // 3. Keyword / MCC heuristics
    for (const rule of this.KEYWORD_RULES) {
      const match = rule.keywords.some((kw) => lowerName.includes(kw));
      if (match) {
        let targetWallet = null;
        if (rule.targetWalletType) {
          targetWallet = wallets.find((w) => w.id === rule.targetWalletType);
        }
        if (!targetWallet) {
          targetWallet = this.findWalletByCategory(rule.category);
        }
        if (!targetWallet) {
          targetWallet = stateManager.getFreeMoneyWallet();
        }

        return {
          merchantName: cleanName,
          category: rule.category,
          recommendedWallet: targetWallet,
          isLearned: false,
          source: 'keyword_engine',
          icon: rule.icon,
          reason: `Auto-categorized as ${rule.category}.`,
        };
      }
    }

    // 4. Default Fallback -> Free Money
    return this.fallbackClassification(cleanName);
  }

  /**
   * Helper to match existing wallet by category string
   */
  static findWalletByCategory(categoryName) {
    if (!categoryName) return null;
    const wallets = stateManager.getWallets();
    const match = getWalletForCategory(categoryName, wallets);
    if (match && match.wallet) return match.wallet;

    const lower = categoryName.toLowerCase();
    return wallets.find((w) => {
      const cat = (w.category || '').toLowerCase();
      const name = (w.name || '').toLowerCase();
      return cat.includes(lower) || lower.includes(cat) || lower.includes(name) || name.includes(lower);
    });
  }

  /**
   * Safe Fallback classification
   */
  static fallbackClassification(merchantName = 'Unknown Merchant') {
    const freeWallet = stateManager.getFreeMoneyWallet();
    return {
      merchantName,
      category: 'General Expense',
      recommendedWallet: freeWallet,
      isLearned: false,
      source: 'fallback',
      icon: '🛍️',
      reason: 'No dedicated wallet found; recommended paying from Free Money.',
    };
  }

  /**
   * Save a user learning preference for future payments
   */
  static teachMerchantCategory(merchantName, category, walletId) {
    stateManager.setLearnedCategory(merchantName, category, walletId);
    return {
      success: true,
      message: `Remembered! Future payments to "${merchantName}" will be set to ${category}.`,
    };
  }
}
