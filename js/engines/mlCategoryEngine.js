/* ==========================================================================
   POCKETPE - MACHINE LEARNING TRANSACTION CATEGORIZATION FALLBACK ENGINE
   Supervised Multinomial Naive Bayes classifier with Laplace smoothing,
   VPA handle analysis, ticket-size amount modeling, and continuous online learning.
   Executes as fallback when Merchant Category Code (MCC) is unavailable/unknown.
   Flags uncertain predictions (< 0.80 confidence or narrow margin) for user confirmation.
   ========================================================================== */

import { stateManager } from '../state.js';
import { getWalletForCategory } from './upiQrEngine.js';

export class MlCategoryEngine {
  /**
   * Uncertainty threshold: predictions with confidence below this require user confirmation
   */
  static CONFIDENCE_THRESHOLD = 0.80;

  /**
   * Minimum margin between top prediction and runner-up to be considered certain
   */
  static MARGIN_THRESHOLD = 0.22;

  /**
   * Primary target categories supported by PocketPe
   */
  static CATEGORIES = [
    'Food & Dining',
    'Transport & Fuel',
    'College & Education',
    'Friends & Social',
    'Health & Wellness',
    'Shopping & Apparel',
    'Personal Care',
    'Entertainment',
    'Utilities',
    'General Expense',
  ];

  /**
   * Category metadata: icons and default purpose wallet mapping
   */
  static CATEGORY_META = {
    'Food & Dining': { icon: '🍔', walletId: 'wallet_food', defaultWalletName: 'Food & Dining' },
    'Transport & Fuel': { icon: '🚗', walletId: 'wallet_transport', defaultWalletName: 'Transport & Fuel' },
    'College & Education': { icon: '🎓', walletId: 'wallet_college', defaultWalletName: 'College & Education' },
    'Friends & Social': { icon: '🤝', walletId: 'wallet_friends', defaultWalletName: 'Friends & Social' },
    'Health & Wellness': { icon: '🩺', walletId: null, defaultWalletName: 'Free Money' },
    'Shopping & Apparel': { icon: '🛍️', walletId: null, defaultWalletName: 'Free Money' },
    'Personal Care': { icon: '💈', walletId: null, defaultWalletName: 'Free Money' },
    'Entertainment': { icon: '🎬', walletId: null, defaultWalletName: 'Free Money' },
    'Utilities': { icon: '💡', walletId: null, defaultWalletName: 'Free Money' },
    'General Expense': { icon: '🏷️', walletId: 'wallet_free', defaultWalletName: 'Free Money' },
  };

  /**
   * Category priors P(C) reflecting daily student/urban spending distribution
   */
  static CATEGORY_PRIORS = {
    'Food & Dining': 0.32,
    'Transport & Fuel': 0.18,
    'College & Education': 0.15,
    'Friends & Social': 0.16,
    'Health & Wellness': 0.05,
    'Shopping & Apparel': 0.06,
    'Personal Care': 0.03,
    'Entertainment': 0.03,
    'Utilities': 0.01,
    'General Expense': 0.01,
  };

  /**
   * Typical ticket-size distributions: log-mean (mu) and log-variance (sigma) for transaction amounts
   */
  static AMOUNT_PROFILES = {
    'Food & Dining': { min: 10, max: 2500, typical: 140 },
    'Transport & Fuel': { min: 20, max: 4000, typical: 220 },
    'College & Education': { min: 10, max: 15000, typical: 350 },
    'Friends & Social': { min: 10, max: 20000, typical: 300 },
    'Health & Wellness': { min: 30, max: 8000, typical: 450 },
    'Shopping & Apparel': { min: 100, max: 25000, typical: 850 },
    'Personal Care': { min: 50, max: 4000, typical: 250 },
    'Entertainment': { min: 80, max: 5000, typical: 320 },
    'Utilities': { min: 100, max: 15000, typical: 650 },
    'General Expense': { min: 1, max: 50000, typical: 200 },
  };

  /**
   * Base Training Corpus: Token frequencies across Indian merchants, vernacular words, and transaction notes.
   */
  static BASE_VOCABULARY = {
    'Food & Dining': [
      'canteen', 'mess', 'dhaba', 'restaurant', 'cafe', 'coffee', 'dining', 'kitchen', 'tiffin', 'bakery',
      'baker', 'bakes', 'sweets', 'mithai', 'tea', 'chai', 'snacks', 'samosa', 'dosa', 'idli', 'biryani',
      'pizza', 'burger', 'meals', 'roll', 'shawarma', 'juice', 'chat', 'chaat', 'stall', 'bhojanalaya',
      'rasoi', 'fastfood', 'eatery', 'tapri', 'swiggy', 'zomato', 'mcdonalds', 'kfc', 'dominos', 'subway',
      'starbucks', 'barista', 'haldiram', 'bikanervala', 'grocery', 'kirana', 'mart', 'supermarket',
      'provision', 'dairy', 'milk', 'eggs', 'bread', 'cake', 'fruit', 'fruits', 'vegetable', 'vegetables',
      'momos', 'waffle', 'sandwich', 'icecream', 'amul', 'mother dairy', 'blinkit', 'zepto', 'instamart',
      'lunch', 'dinner', 'breakfast', 'food', 'snack', 'paratha', 'thali', 'cook', 'treat', 'beverage',
      'chole', 'bhature', 'lassi', 'poha', 'vada', 'pav', 'bhaji', 'curry', 'roti', 'naan', 'noodles'
    ],
    'Transport & Fuel': [
      'petrol', 'diesel', 'fuel', 'cng', 'iocl', 'bpcl', 'hpcl', 'shell', 'indian oil', 'bharat petroleum',
      'auto', 'taxi', 'cab', 'uber', 'ola', 'rapido', 'metro', 'bus', 'rail', 'irctc', 'train', 'ticket',
      'toll', 'fastag', 'parking', 'driver', 'ride', 'transit', 'scooter', 'bike', 'chalo', 'station',
      'filling', 'gas', 'fare', 'trip', 'travel', 'transport', 'commute', 'petroleum', 'transportation',
      'yulu', 'bounce', 'rickshaw', 'airport', 'junction', 'expressway'
    ],
    'College & Education': [
      'college', 'university', 'institute', 'school', 'academy', 'campus', 'tuition', 'coaching', 'class',
      'classes', 'exam', 'examination', 'fee', 'fees', 'library', 'xerox', 'photocopy', 'print', 'printing',
      'stationers', 'stationery', 'pen', 'notebook', 'notebooks', 'book', 'books', 'bookstore', 'publication',
      'udemy', 'coursera', 'unacademy', 'allen', 'fiitjee', 'edutech', 'lab', 'assignment', 'notes',
      'project', 'syllabus', 'seminar', 'forms', 'bindery', 'student', 'hostel fee', 'degree', 'study',
      'education', 'textbook', 'guides', 'binders', 'lamination', 'photostat', 'iit', 'nit', 'bits'
    ],
    'Friends & Social': [
      'friend', 'split', 'pool', 'room', 'roommate', 'flat', 'flatmate', 'party', 'share', 'treat',
      'borrow', 'lend', 'payback', 'return', 'contribution', 'bhai', 'bro', 'buddy', 'trip share',
      'dinner share', 'lunch share', 'cab share', 'gift', 'outing', 'settle', 'settlement', 'repay',
      'rohan', 'priya', 'rahul', 'amit', 'sneha', 'vikram', 'ananya', 'kartik', 'arjun', 'pooja', 'neha'
    ],
    'Health & Wellness': [
      'pharmacy', 'medical', 'medplus', 'apollo', 'chemist', 'medicine', 'medicines', 'clinic', 'doctor',
      'hospital', 'dental', 'dentist', 'lab', 'diagnostic', 'blood', 'health', 'healthcare', 'care',
      'eye', 'optical', 'specs', 'cure', 'pharma', 'dr', 'tablet', 'tablets', 'syrup', 'bandage',
      'scan', 'test', 'orthopaedic', 'ayurveda', 'homeopathy', '1mg', 'netmeds', 'meds', 'physio',
      'consultation', 'prescription'
    ],
    'Shopping & Apparel': [
      'clothing', 'clothes', 'apparel', 'fashion', 'wear', 'garments', 'shoes', 'footwear', 'boutique',
      'trends', 'mall', 'store', 'retail', 'textiles', 'zudio', 'pantaloons', 'max', 'reliance', 'zara',
      'h&m', 'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'electronics', 'mobile', 'gadget',
      'eyewear', 'watch', 'watches', 'bags', 'bag', 'dress', 'shirt', 'jeans', 'tshirt', 'sneakers'
    ],
    'Personal Care': [
      'salon', 'barber', 'haircut', 'parlour', 'spa', 'grooming', 'beauty', 'hair', 'stylist', 'shaving',
      'makeover', 'manicure', 'pedicure', 'facial', 'look', 'unisex', 'massage', 'skin', 'trim', 'beard'
    ],
    'Entertainment': [
      'cinema', 'movie', 'movies', 'pvr', 'inox', 'cinepolis', 'theatre', 'theater', 'film', 'netflix',
      'prime', 'hotstar', 'spotify', 'youtube', 'concert', 'show', 'event', 'gaming', 'arcade', 'bowling',
      'games', 'play', 'amusement', 'multiplex', 'ticketnew', 'bookmyshow'
    ],
    'Utilities': [
      'electricity', 'bescom', 'tneb', 'bses', 'msedcl', 'gas', 'lpg', 'indane', 'hp gas', 'water',
      'broadband', 'wifi', 'jio', 'airtel', 'vi', 'bsnl', 'recharge', 'dth', 'tata play', 'fiber',
      'bill', 'postpaid', 'utility', 'piped'
    ],
    'Food & Dining': [
      'canteen', 'mess', 'dhaba', 'restaurant', 'cafe', 'coffee', 'dining', 'kitchen', 'tiffin', 'bakery',
      'baker', 'bakes', 'sweets', 'mithai', 'tea', 'chai', 'snacks', 'samosa', 'dosa', 'idli', 'biryani',
      'pizza', 'burger', 'meals', 'roll', 'shawarma', 'juice', 'chat', 'chaat', 'stall', 'bhojanalaya',
      'rasoi', 'fastfood', 'fast', 'food', 'eatery', 'tapri', 'swiggy', 'zomato', 'mcdonalds', 'kfc', 'dominos', 'subway',
      'starbucks', 'barista', 'haldiram', 'bikanervala', 'grocery', 'kirana', 'mart', 'supermarket',
      'provision', 'dairy', 'milk', 'eggs', 'bread', 'cake', 'fruit', 'fruits', 'vegetable', 'vegetables',
      'momos', 'waffle', 'sandwich', 'icecream', 'amul', 'mother dairy', 'blinkit', 'zepto', 'instamart',
      'lunch', 'dinner', 'breakfast', 'snack', 'paratha', 'thali', 'cook', 'treat', 'beverage',
      'chole', 'bhature', 'lassi', 'poha', 'vada', 'pav', 'bhaji', 'curry', 'roti', 'naan', 'noodles'
    ],
    'Transport & Fuel': [
      'petrol', 'diesel', 'fuel', 'cng', 'iocl', 'bpcl', 'hpcl', 'shell', 'indian oil', 'bharat petroleum',
      'auto', 'taxi', 'cab', 'uber', 'ola', 'rapido', 'metro', 'bus', 'rail', 'irctc', 'train', 'ticket',
      'toll', 'fastag', 'parking', 'driver', 'ride', 'transit', 'scooter', 'bike', 'chalo', 'station',
      'filling', 'gas', 'fare', 'trip', 'travel', 'transport', 'commute', 'petroleum', 'transportation',
      'yulu', 'bounce', 'rickshaw', 'airport', 'junction', 'expressway'
    ],
    'College & Education': [
      'college', 'university', 'institute', 'school', 'academy', 'campus', 'tuition', 'coaching', 'class',
      'classes', 'exam', 'examination', 'fee', 'fees', 'library', 'xerox', 'photocopy', 'print', 'printing',
      'stationers', 'stationery', 'pen', 'notebook', 'notebooks', 'book', 'books', 'bookstore', 'publication',
      'udemy', 'coursera', 'unacademy', 'allen', 'fiitjee', 'edutech', 'lab', 'assignment', 'notes',
      'project', 'syllabus', 'seminar', 'forms', 'bindery', 'student', 'hostel fee', 'degree', 'study',
      'education', 'textbook', 'guides', 'binders', 'lamination', 'photostat', 'iit', 'nit', 'bits'
    ],
    'Friends & Social': [
      'friend', 'friends', 'split', 'pool', 'room', 'roommate', 'flat', 'flatmate', 'party', 'share', 'treat',
      'borrow', 'lend', 'payback', 'return', 'contribution', 'bhai', 'bro', 'buddy', 'trip share',
      'dinner share', 'lunch share', 'cab share', 'gift', 'outing', 'settle', 'settlement', 'repay',
      'rohan', 'priya', 'rahul', 'amit', 'sneha', 'vikram', 'ananya', 'kartik', 'arjun', 'pooja', 'neha',
      'mobile_phone_vpa', 'consumer_vpa'
    ],
    'Health & Wellness': [
      'pharmacy', 'medical', 'medplus', 'apollo', 'chemist', 'medicine', 'medicines', 'clinic', 'doctor',
      'hospital', 'dental', 'dentist', 'lab', 'diagnostic', 'blood', 'health', 'healthcare', 'care',
      'eye', 'optical', 'specs', 'cure', 'pharma', 'dr', 'tablet', 'tablets', 'syrup', 'bandage',
      'scan', 'test', 'orthopaedic', 'ayurveda', 'homeopathy', '1mg', 'netmeds', 'meds', 'physio',
      'consultation', 'prescription'
    ],
    'Shopping & Apparel': [
      'clothing', 'clothes', 'apparel', 'fashion', 'wear', 'garments', 'shoes', 'footwear', 'boutique',
      'trends', 'mall', 'store', 'retail', 'textiles', 'zudio', 'pantaloons', 'max', 'reliance', 'zara',
      'h&m', 'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'electronics', 'mobile', 'gadget',
      'eyewear', 'watch', 'watches', 'bags', 'bag', 'dress', 'shirt', 'jeans', 'tshirt', 'sneakers'
    ],
    'Personal Care': [
      'salon', 'barber', 'haircut', 'parlour', 'spa', 'grooming', 'beauty', 'hair', 'stylist', 'shaving',
      'makeover', 'manicure', 'pedicure', 'facial', 'look', 'unisex', 'massage', 'skin', 'trim', 'beard'
    ],
    'Entertainment': [
      'cinema', 'movie', 'movies', 'pvr', 'inox', 'cinepolis', 'theatre', 'theater', 'film', 'netflix',
      'prime', 'hotstar', 'spotify', 'youtube', 'concert', 'show', 'event', 'gaming', 'arcade', 'bowling',
      'games', 'play', 'amusement', 'multiplex', 'ticketnew', 'bookmyshow'
    ],
    'Utilities': [
      'electricity', 'bescom', 'tneb', 'bses', 'msedcl', 'gas', 'lpg', 'indane', 'hp gas', 'water',
      'broadband', 'wifi', 'jio', 'airtel', 'vi', 'bsnl', 'recharge', 'dth', 'tata play', 'fiber',
      'bill', 'postpaid', 'utility', 'piped'
    ],
    'General Expense': [
      'expense', 'general', 'misc', 'miscellaneous', 'other', 'payment', 'transfer', 'service', 'deposit'
    ],
  };

  /**
   * Pre-computed token model lookup table with Laplace smoothing
   */
  static _tokenFrequencies = null;
  static _totalTokensPerCategory = null;
  static _knownVocabularySet = null;

  /**
   * Initialize or retrieve pre-compiled model token frequencies
   */
  static getModel() {
    if (this._tokenFrequencies && this._totalTokensPerCategory && this._knownVocabularySet) {
      return {
        frequencies: this._tokenFrequencies,
        totals: this._totalTokensPerCategory,
        knownVocab: this._knownVocabularySet,
      };
    }

    const frequencies = {};
    const totals = {};
    const knownVocab = new Set();

    this.CATEGORIES.forEach((cat) => {
      frequencies[cat] = {};
      totals[cat] = 0;
    });

    // Populate base dictionary counts
    for (const [category, words] of Object.entries(this.BASE_VOCABULARY)) {
      if (!frequencies[category]) {
        frequencies[category] = {};
        totals[category] = 0;
      }
      words.forEach((word) => {
        const clean = word.toLowerCase().trim();
        frequencies[category][clean] = (frequencies[category][clean] || 0) + 10;
        totals[category] += 10;
        knownVocab.add(clean);
      });
    }

    // Incorporate persistent user online training adaptation from localStorage
    try {
      const stored = localStorage.getItem('pocketpe_ml_user_weights');
      if (stored) {
        const userWeights = JSON.parse(stored);
        for (const [cat, wordMap] of Object.entries(userWeights)) {
          if (frequencies[cat]) {
            for (const [word, count] of Object.entries(wordMap)) {
              frequencies[cat][word] = (frequencies[cat][word] || 0) + count;
              totals[cat] += count;
              knownVocab.add(word);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Notice: Could not load local ML adaptation weights', e);
    }

    this._tokenFrequencies = frequencies;
    this._totalTokensPerCategory = totals;
    this._knownVocabularySet = knownVocab;

    return { frequencies, totals, knownVocab };
  }

  /**
   * Extract informative n-grams and heuristic signals from transaction data
   */
  static extractFeatures({ merchantName = '', upiId = '', amount = null, note = '' }) {
    const rawTokens = [];
    const featuresUsed = [];

    // 1. Merchant / Payee name tokenization
    if (merchantName) {
      const cleanName = merchantName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
      const words = cleanName.split(/\s+/).filter((w) => w.length >= 2);
      words.forEach((w) => rawTokens.push(w));

      // Add bigrams
      for (let i = 0; i < words.length - 1; i++) {
        rawTokens.push(`${words[i]} ${words[i + 1]}`);
      }

      // Subword stems (e.g. "canteen", "pharm", "petrol", "xerox", "bakery", "dhaba")
      const commonRoots = [
        'canteen', 'dhaba', 'baker', 'pharm', 'petrol', 'diesel', 'xerox',
        'tiffin', 'mess', 'book', 'medic', 'clinic', 'salon', 'barber',
        'auto', 'metro', 'chai', 'sweets', 'juice', 'biryani', 'kirana',
        'mart', 'supermarket', 'stationer', 'print'
      ];
      commonRoots.forEach((root) => {
        if (cleanName.includes(root)) {
          rawTokens.push(root);
          featuresUsed.push(`name contains "${root}"`);
        }
      });
    }

    // 2. UPI ID / VPA analysis
    if (upiId && upiId.includes('@')) {
      const parts = upiId.toLowerCase().split('@');
      const handle = parts[0];
      const psp = parts[1] || '';

      // Check if handle matches 10-digit mobile number -> strong P2P signal
      if (/^[6-9]\d{9}$/.test(handle)) {
        rawTokens.push('mobile_phone_vpa');
        rawTokens.push('friend');
        featuresUsed.push('personal phone number UPI');
      }

      // Check PSP domain features
      if (['paytmwb', 'bharatpe', 'razorpay', 'billdesk', 'airtelmerchant'].some((m) => psp.includes(m))) {
        rawTokens.push('merchant_gateway_vpa');
      } else if (['oksbi', 'okhdfcbank', 'okaxis', 'okicici', 'ybl', 'ibl', 'axl'].some((p) => psp.includes(p))) {
        rawTokens.push('consumer_vpa');
      }

      // Extract alphanumeric sub-tokens from VPA handle
      const vpaSubtokens = handle.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((w) => w.length >= 3);
      vpaSubtokens.forEach((st) => rawTokens.push(st));
    }

    // 3. Transaction Note (tn) tokenization
    if (note) {
      const cleanNote = note.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
      const noteWords = cleanNote.split(/\s+/).filter((w) => w.length >= 2);
      noteWords.forEach((nw) => {
        rawTokens.push(nw);
        featuresUsed.push(`note "${nw}"`);
      });
    }

    // 4. Ticket-size amount modeling
    const numAmount = parseFloat(amount);
    let amountBucket = null;
    if (!isNaN(numAmount) && numAmount > 0) {
      if (numAmount <= 60) amountBucket = 'amt_micro';
      else if (numAmount <= 250) amountBucket = 'amt_small';
      else if (numAmount <= 800) amountBucket = 'amt_medium';
      else if (numAmount <= 2500) amountBucket = 'amt_large';
      else amountBucket = 'amt_xlarge';
      rawTokens.push(amountBucket);
      featuresUsed.push(`ticket size: ₹${numAmount}`);
    }

    return {
      tokens: [...new Set(rawTokens)],
      featuresUsed: [...new Set(featuresUsed)],
      amount: !isNaN(numAmount) && numAmount > 0 ? numAmount : null,
    };
  }

  /**
   * Log-likelihood score for transaction amount given category typical profile
   */
  static scoreAmountLikelihood(category, amount) {
    if (!amount || amount <= 0) return 0;
    const profile = this.AMOUNT_PROFILES[category];
    if (!profile) return 0;

    // Log-distance penalty from typical ticket size
    const logActual = Math.log(amount);
    const logTypical = Math.log(profile.typical);
    const diff = Math.abs(logActual - logTypical);

    // If within bounds, minor penalty; if completely out of bounds, larger penalty
    if (amount >= profile.min && amount <= profile.max) {
      return -0.25 * diff;
    } else {
      return -1.2 * diff;
    }
  }

  /**
   * Predict category using Multinomial Naive Bayes + Laplace smoothing
   *
   * @param {Object} input - { merchantName, upiId, amount, note, mcc }
   * @returns {Object} Prediction result with category, confidence, isUncertain, topCandidates
   */
  static predict({ merchantName = '', upiId = '', amount = null, note = '', mcc = null }) {
    const { frequencies, totals, knownVocab } = this.getModel();
    const { tokens, featuresUsed, amount: parsedAmount } = this.extractFeatures({
      merchantName,
      upiId,
      amount,
      note,
    });

    // Filter tokens: only evaluate tokens that belong to our known dictionary
    // Tokens with zero occurrences across ALL categories provide 0 discriminative evidence and are discarded
    const informativeTokens = tokens.filter((t) => knownVocab.has(t));

    const categoryLogScores = {};
    const laplaceAlpha = 0.5;
    const totalVocabSize = knownVocab.size || 250;

    this.CATEGORIES.forEach((cat) => {
      // 1. Category Prior Log-Probability ln P(C)
      const prior = this.CATEGORY_PRIORS[cat] || 0.05;
      let logScore = Math.log(prior);

      // 2. Token Log-Likelihoods with Laplace Smoothing: ln P(w | C)
      const catFreqs = frequencies[cat] || {};
      const catTotal = (totals[cat] || 0) + laplaceAlpha * totalVocabSize;

      informativeTokens.forEach((token) => {
        const count = catFreqs[token] || 0;
        const tokenProb = (count + laplaceAlpha) / catTotal;
        logScore += Math.log(tokenProb);
      });

      // 3. Amount Likelihood score
      if (parsedAmount) {
        logScore += this.scoreAmountLikelihood(cat, parsedAmount);
      }

      categoryLogScores[cat] = logScore;
    });

    // 4. Softmax Normalization for Calibrated Posterior Probabilities
    const maxLogScore = Math.max(...Object.values(categoryLogScores));
    let sumExp = 0;
    const expScores = {};

    this.CATEGORIES.forEach((cat) => {
      const exp = Math.exp(categoryLogScores[cat] - maxLogScore);
      expScores[cat] = exp;
      sumExp += exp;
    });

    // Generate ranked list of candidates with probabilities
    const candidates = this.CATEGORIES.map((cat) => {
      const prob = sumExp > 0 ? expScores[cat] / sumExp : 0.1;
      return {
        category: cat,
        probability: Math.round(prob * 1000) / 1000,
        confidencePercent: Math.round(prob * 100),
        icon: this.CATEGORY_META[cat]?.icon || '🏷️',
        walletId: this.CATEGORY_META[cat]?.walletId || null,
      };
    }).sort((a, b) => b.probability - a.probability);

    const top = candidates[0];
    const runnerUp = candidates[1] || { probability: 0 };
    const margin = top.probability - runnerUp.probability;

    // Uncertainty criteria:
    // 1. If 0 informative tokens matched -> automatically uncertain
    // 2. OR top probability < 0.80 (80%)
    // 3. OR margin between #1 and #2 is too narrow (< 0.22)
    const hasStrongSignals = informativeTokens.length > 0;
    const isUncertain = !hasStrongSignals || top.probability < this.CONFIDENCE_THRESHOLD || margin < this.MARGIN_THRESHOLD;

    // Resolve matching wallet in user's active wallet set (or fallback descriptor)
    const wallets = stateManager.getWallets() || [];
    const targetMeta = this.CATEGORY_META[top.category];
    let recommendedWallet = null;

    if (targetMeta?.walletId && wallets.length > 0) {
      recommendedWallet = wallets.find((w) => w.id === targetMeta.walletId);
    }
    if (!recommendedWallet && wallets.length > 0) {
      const match = getWalletForCategory(top.category, wallets);
      recommendedWallet = match.wallet;
    }
    if (!recommendedWallet && wallets.length > 0) {
      recommendedWallet = stateManager.getFreeMoneyWallet();
    }
    // Fallback wallet descriptor if wallets list is empty (e.g. unauthenticated test state)
    if (!recommendedWallet) {
      recommendedWallet = {
        id: targetMeta?.walletId || 'wallet_free',
        name: targetMeta?.defaultWalletName || 'Free Money',
        category: top.category,
        icon: targetMeta?.icon || '🏷️',
        balance: 0,
      };
    }

    // Explainable rationale
    let reason = '';
    const cleanPayee = merchantName || (upiId ? upiId.split('@')[0] : 'Merchant');
    if (!isUncertain) {
      reason = `Predicted ${top.category} (${top.confidencePercent}% confidence) from payee "${cleanPayee}"`;
      if (parsedAmount) reason += ` and ₹${parsedAmount} ticket size.`;
      else reason += '.';
    } else {
      reason = `Analyzed payee signals for "${cleanPayee}". Suggested ${top.category} (${top.confidencePercent}% match).`;
    }

    return {
      category: top.category,
      recommendedWallet,
      walletId: recommendedWallet?.id || null,
      confidence: top.probability,
      confidencePercent: top.confidencePercent,
      isUncertain,
      margin: Math.round(margin * 100) / 100,
      topCandidates: candidates.slice(0, 3),
      featuresUsed,
      reason,
      source: isUncertain ? 'ml_fallback_uncertain' : 'ml_fallback_high_confidence',
      icon: top.icon,
    };
  }

  /**
   * Continuous Online Learning: Update model weights when user confirms or overrides a category
   *
   * @param {Object} input - { merchantName, upiId, amount, note }
   * @param {string} confirmedCategory - User-verified or chosen category
   */
  static learn({ merchantName = '', upiId = '', amount = null, note = '' }, confirmedCategory) {
    if (!confirmedCategory || !this.CATEGORIES.includes(confirmedCategory)) return false;

    const { tokens } = this.extractFeatures({ merchantName, upiId, amount, note });
    if (!tokens || tokens.length === 0) return false;

    try {
      // 1. Read existing user adaptation weights
      let userWeights = {};
      const stored = localStorage.getItem('pocketpe_ml_user_weights');
      if (stored) {
        userWeights = JSON.parse(stored);
      }

      if (!userWeights[confirmedCategory]) {
        userWeights[confirmedCategory] = {};
      }

      // 2. Increment weights for tokens associated with this user confirmation (reinforcement bonus = +12)
      tokens.forEach((tok) => {
        userWeights[confirmedCategory][tok] = (userWeights[confirmedCategory][tok] || 0) + 12;
      });

      // 3. Persist back to localStorage
      localStorage.setItem('pocketpe_ml_user_weights', JSON.stringify(userWeights));

      // 4. Invalidate memory cache so next prediction reloads updated weights
      this._tokenFrequencies = null;
      this._totalTokensPerCategory = null;

      console.log(`🧠 [PocketPe ML Engine] Reinforced learning for "${merchantName}" → ${confirmedCategory}`);
      return true;
    } catch (e) {
      console.warn('Error during ML model weight reinforcement:', e);
      return false;
    }
  }

  /**
   * Reset local model adaptation (useful for test isolation)
   */
  static resetUserAdaptation() {
    try {
      localStorage.removeItem('pocketpe_ml_user_weights');
      this._tokenFrequencies = null;
      this._totalTokensPerCategory = null;
    } catch (e) {}
  }
}
