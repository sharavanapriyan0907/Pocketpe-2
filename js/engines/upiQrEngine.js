/* ==========================================================================
   POCKETPE - UPI QR CODE DECODER & PARSER ENGINE
   Parses standard Indian UPI QR specification (upi://pay?pa=...&pn=...)
   Extracts payee, merchant name, amount, MCC code, currency, and note.
   Provides centralized MCC mapping (getCategoryFromMcc) and wallet matching (getWalletForCategory).
   ========================================================================== */

/**
 * Centralized MCC Category Mapping Table
 * Maps standardized 4-digit Merchant Category Codes to Merchant Categories and PocketPe categories.
 */
export const MCC_CATEGORY_MAP = {
  // 5912 → Medical / Pharmacy
  '5912': { merchantCategory: 'Medical / Pharmacy', category: 'Medical', label: 'Pharmacies & Drug Stores', icon: '💊' },
  '8011': { merchantCategory: 'Medical / Pharmacy', category: 'Medical', label: 'Doctors & Physicians', icon: '🩺' },
  '8021': { merchantCategory: 'Medical / Pharmacy', category: 'Medical', label: 'Dentists', icon: '🦷' },
  '8062': { merchantCategory: 'Medical / Pharmacy', category: 'Medical', label: 'Hospitals', icon: '🏥' },

  // 5812 → Restaurant, 5814 → Fast Food, 5411 → Grocery
  '5812': { merchantCategory: 'Restaurant', category: 'Food', label: 'Restaurants & Dining', icon: '🍔' },
  '5814': { merchantCategory: 'Fast Food', category: 'Food', label: 'Fast Food Restaurants', icon: '🍕' },
  '5411': { merchantCategory: 'Grocery', category: 'Grocery', label: 'Grocery Stores / Supermarkets', icon: '🛒' },
  '5462': { merchantCategory: 'Restaurant', category: 'Food', label: 'Bakeries', icon: '🥖' },
  '5499': { merchantCategory: 'Grocery', category: 'Grocery', label: 'Misc Food & Convenience Stores', icon: '🏪' },
  '5811': { merchantCategory: 'Restaurant', category: 'Food', label: 'Caterers', icon: '🍱' },
  '5813': { merchantCategory: 'Restaurant', category: 'Food', label: 'Drinking Places / Bars', icon: '🍻' },

  // 4121 → Transportation / Taxi, 5541 → Fuel
  '4121': { merchantCategory: 'Transportation / Taxi', category: 'Transportation', label: 'Taxi & Rideshare', icon: '🚕' },
  '4111': { merchantCategory: 'Transportation / Taxi', category: 'Transportation', label: 'Commuter Transport & Metro', icon: '🚆' },
  '4131': { merchantCategory: 'Transportation / Taxi', category: 'Transportation', label: 'Bus Lines', icon: '🚌' },
  '4789': { merchantCategory: 'Transportation / Taxi', category: 'Transportation', label: 'Transportation Services', icon: '🚗' },
  '5541': { merchantCategory: 'Fuel', category: 'Fuel', label: 'Service Stations / Petrol', icon: '⛽' },
  '5542': { merchantCategory: 'Fuel', category: 'Fuel', label: 'Automated Fuel Dispensers', icon: '⛽' },

  // 8220 → Education
  '8220': { merchantCategory: 'Education', category: 'Education', label: 'Colleges & Universities', icon: '🎓' },
  '8211': { merchantCategory: 'Education', category: 'Education', label: 'Elementary & Secondary Schools', icon: '🏫' },
  '8299': { merchantCategory: 'Education', category: 'Education', label: 'Educational Services & Courses', icon: '📚' },
  '5942': { merchantCategory: 'Education', category: 'Education', label: 'Book Stores', icon: '📖' },
  '5943': { merchantCategory: 'Education', category: 'Education', label: 'Stationery Stores', icon: '✏️' },

  // 7230 → Salon / Barber
  '7230': { merchantCategory: 'Salon / Barber', category: 'Personal Care', label: 'Salon & Barber', icon: '💈' },
  '7298': { merchantCategory: 'Salon / Barber', category: 'Personal Care', label: 'Health & Beauty Spas', icon: '🧖' },

  // 4900 → Utilities
  '4900': { merchantCategory: 'Utilities', category: 'Utilities', label: 'Utilities (Electric, Gas, Water)', icon: '💡' },
  '4899': { merchantCategory: 'Utilities', category: 'Utilities', label: 'Cable & Internet Services', icon: '📡' },

  // Shopping & Apparel
  '5311': { merchantCategory: 'Shopping', category: 'Shopping', label: 'Department Stores', icon: '🏬' },
  '5651': { merchantCategory: 'Shopping', category: 'Shopping', label: 'Family Clothing Stores', icon: '👕' },
  '5661': { merchantCategory: 'Shopping', category: 'Shopping', label: 'Shoe Stores', icon: '👟' },
  '5944': { merchantCategory: 'Shopping', category: 'Shopping', label: 'Jewelry Stores', icon: '💍' },

  // Entertainment
  '7832': { merchantCategory: 'Entertainment', category: 'Entertainment', label: 'Motion Picture Theaters / Cinema', icon: '🎬' },
  '7999': { merchantCategory: 'Entertainment', category: 'Entertainment', label: 'Recreation & Gaming Services', icon: '🎮' },
};

/**
 * STEP 2: Reusable UPI QR parser function
 * Safely decodes upi://pay?... payloads into parameter map.
 * Extracts: pa, pn, mc, am, cu, tn, tr, mid, msid, mtid.
 * Only stores fields that actually exist.
 * Returns { isUpi: false, error: "This QR is not a supported UPI payment QR." } on non-UPI QR.
 *
 * @param {string} rawQrData
 * @returns {Object}
 */
export function parseUpiQr(rawQrData) {
  const notSupportedResult = {
    isUpi: false,
    error: 'This QR is not a supported UPI payment QR.',
    raw: rawQrData,
  };

  if (!rawQrData || typeof rawQrData !== 'string') {
    return notSupportedResult;
  }

  const trimmed = rawQrData.trim();
  const lower = trimmed.toLowerCase();

  // Check if string contains UPI intent protocol
  if (!lower.startsWith('upi://pay')) {
    return notSupportedResult;
  }

  try {
    const qIdx = trimmed.indexOf('?');
    if (qIdx === -1) {
      return notSupportedResult;
    }

    const queryString = trimmed.substring(qIdx + 1);
    const params = new URLSearchParams(queryString);

    const getParam = (name) => {
      const target = name.toLowerCase();
      for (const [k, v] of params.entries()) {
        if (k.toLowerCase() === target) {
          return v;
        }
      }
      return null;
    };

    const decodeVal = (val, replacePlus = false) => {
      if (val === null || val === undefined) return undefined;
      const clean = val.trim();
      if (!clean) return undefined;
      try {
        const str = replacePlus ? clean.replace(/\+/g, ' ') : clean;
        return decodeURIComponent(str).trim();
      } catch (e) {
        return clean;
      }
    };

    const rawPa = getParam('pa');
    if (!rawPa) {
      return notSupportedResult;
    }

    const pa = decodeVal(rawPa, false);
    if (!pa) {
      return notSupportedResult;
    }

    const result = {
      isUpi: true,
      pa,
      raw: rawQrData,
    };

    // Extract all supported fields, ONLY storing fields that actually exist!
    const pn = decodeVal(getParam('pn'), true);
    if (pn !== undefined) result.pn = pn;

    const mc = decodeVal(getParam('mc'), false);
    if (mc !== undefined) result.mc = mc;

    const am = decodeVal(getParam('am'), false);
    if (am !== undefined) {
      result.am = am;
      const numAm = parseFloat(am);
      if (!isNaN(numAm) && numAm > 0) {
        result.amount = numAm;
      }
    }

    const cu = decodeVal(getParam('cu'), false);
    if (cu !== undefined) result.cu = cu;

    const tn = decodeVal(getParam('tn'), true);
    if (tn !== undefined) result.tn = tn;

    const tr = decodeVal(getParam('tr'), false);
    if (tr !== undefined) result.tr = tr;

    const mid = decodeVal(getParam('mid'), false);
    if (mid !== undefined) result.mid = mid;

    const msid = decodeVal(getParam('msid'), false);
    if (msid !== undefined) result.msid = msid;

    const mtid = decodeVal(getParam('mtid'), false);
    if (mtid !== undefined) result.mtid = mtid;

    return result;
  } catch (err) {
    return notSupportedResult;
  }
}

/**
 * STEP 3: Centralized MCC Category Mapping Function
 * Maps MCC code to Merchant Category (e.g. 5912 → Medical / Pharmacy).
 * If MCC is missing, null, empty, "0000", "0", or unknown: returns null.
 * Does NOT guess category from merchant name.
 *
 * @param {string|number|null} mcc
 * @returns {string|null}
 */
export function getCategoryFromMcc(mcc) {
  if (!mcc) return null;
  const cleanMcc = String(mcc).trim();
  if (!cleanMcc || cleanMcc === '0000' || cleanMcc === '0') {
    return null;
  }

  const match = MCC_CATEGORY_MAP[cleanMcc];
  if (!match) return null;
  return match.merchantCategory || match.category || null;
}

/**
 * Map Merchant Category (e.g. "Medical / Pharmacy") to PocketPe Category ("Medical")
 * @param {string} merchantCategory
 * @returns {string}
 */
export function getPocketPeCategory(merchantCategory) {
  if (!merchantCategory) return 'General';
  const clean = merchantCategory.trim();
  const map = {
    'Medical / Pharmacy': 'Medical',
    'Medical': 'Medical',
    'Restaurant': 'Food',
    'Fast Food': 'Food',
    'Grocery': 'Grocery',
    'Salon / Barber': 'Personal Care',
    'Transportation / Taxi': 'Transportation',
    'Fuel': 'Fuel',
    'Utilities': 'Utilities',
    'Education': 'Education',
    'Shopping': 'Shopping',
    'Entertainment': 'Entertainment',
  };
  return map[clean] || clean;
}

/**
 * STEP 4: MCC Category to User Wallet Resolver
 * Maps a spending category (Medical, Food, Grocery, Transportation, Fuel, Education, etc.)
 * to the user's actual active wallet list.
 * Does NOT create duplicate wallets.
 * Returns { wallet: null, matched: false, message: "No matching wallet found." } if missing.
 *
 * @param {string} category
 * @param {Array} wallets
 * @returns {{ wallet: Object|null, matched: boolean, message: string|null }}
 */
export function getWalletForCategory(category, wallets = []) {
  if (!category || !Array.isArray(wallets) || wallets.length === 0) {
    return {
      wallet: null,
      matched: false,
      message: 'No matching wallet found.',
    };
  }

  const cleanCat = category.trim().toLowerCase();

  // Category keyword mappings for user wallets
  const CATEGORY_WALLET_MATCHERS = {
    medical: ['medical', 'health', 'care', 'pharmacy', 'medicine', 'hospital', 'doctor'],
    food: ['food', 'dining', 'restaurant', 'eat', 'snack', 'grocery'],
    grocery: ['grocery', 'food', 'dining', 'supermarket', 'mart'],
    transportation: ['travel', 'transport', 'commute', 'transit', 'fuel', 'cab', 'taxi', 'ride'],
    fuel: ['travel', 'transport', 'fuel', 'petrol', 'diesel'],
    education: ['education', 'college', 'courses', 'course', 'study', 'books', 'tuition'],
    utilities: ['housing', 'utilities', 'bills', 'rent', 'electric'],
    'personal care': ['personal care', 'salon', 'barber', 'grooming', 'beauty'],
    'friends & social': ['friends', 'friend', 'social', 'p2p', 'personal'],
    shopping: ['shopping', 'apparel', 'clothes', 'lifestyle'],
    entertainment: ['entertainment', 'movies', 'fun'],
    savings: ['savings', 'growth', 'investment'],
  };

  const keywords = CATEGORY_WALLET_MATCHERS[cleanCat] || [cleanCat];

  for (const kw of keywords) {
    const found = wallets.find((w) => {
      const wName = (w.name || '').toLowerCase();
      const wCat = (w.category || '').toLowerCase();
      const wId = (w.id || '').toLowerCase();

      return (
        wName.includes(kw) ||
        wCat.includes(kw) ||
        wId.includes(`wallet_${kw}`) ||
        (kw === 'transportation' && (wName.includes('travel') || wCat.includes('travel') || wId.includes('transport'))) ||
        (kw === 'education' && (wName.includes('college') || wCat.includes('college') || wId.includes('college'))) ||
        (kw === 'medical' && (wName.includes('health') || wCat.includes('health')))
      );
    });

    if (found) {
      return {
        wallet: found,
        matched: true,
        message: null,
      };
    }
  }

  return {
    wallet: null,
    matched: false,
    message: 'No matching wallet found.',
  };
}

export class UpiQrEngine {
  static parseUpiQr = parseUpiQr;
  static getCategoryFromMcc = getCategoryFromMcc;
  static getWalletForCategory = getWalletForCategory;

  /**
   * Parse any scanned QR text or pasted UPI input into a normalized payment object
   * @param {string} rawString
   * @returns {Object|null}
   */
  static parse(rawString) {
    if (!rawString || typeof rawString !== 'string') return null;

    const trimmed = rawString.trim();

    // 1. Standard UPI intent format: upi://pay?... (case-insensitive)
    if (trimmed.toLowerCase().includes('upi://pay')) {
      return this.parseUpiUri(trimmed);
    }

    // 2. Web payment link formats (BharatPe / PhonePe / Paytm / GPay)
    if (
      trimmed.includes('phonepe.com') ||
      trimmed.includes('phon.pe') ||
      trimmed.includes('paytm.me') ||
      trimmed.includes('p-y.tm') ||
      trimmed.includes('bharatpe.com') ||
      trimmed.includes('gpay.app.goo.gl') ||
      trimmed.includes('upiqr.in')
    ) {
      return this.parseWebPaymentUrl(trimmed);
    }

    // 3. Plain UPI ID: username@bank
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9]{2,64}$/;
    if (upiRegex.test(trimmed)) {
      const username = trimmed.split('@')[0];
      const prettyName = username
        .replace(/[._]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      return {
        isValid: true,
        isUpiQr: true,
        isP2p: true,
        upiId: trimmed,
        merchantName: prettyName,
        amount: null,
        mcc: null,
        category: null, // Personal: Category determined by user preferences, not guessed!
        icon: '👤',
        note: null,
        raw: trimmed,
      };
    }

    // 4. Raw text merchant or phone number fallback
    const isPhoneNumber = /^[6-9]\d{9}$/.test(trimmed.replace(/[\s\-+]/g, ''));
    return {
      isValid: true,
      isUpiQr: false,
      isP2p: isPhoneNumber,
      upiId: trimmed.includes('@') ? trimmed : `${trimmed.toLowerCase().replace(/[^a-z0-9]/g, '')}@upi`,
      merchantName: trimmed,
      amount: null,
      mcc: null,
      category: isPhoneNumber ? 'Friends & Social' : null,
      icon: isPhoneNumber ? '👤' : '🏷️',
      note: null,
      raw: trimmed,
    };
  }

  /**
   * Parse standard upi://pay?pa=...&pn=... string with case-insensitivity
   */
  static parseUpiUri(uriString) {
    const upiResult = parseUpiQr(uriString);
    if (!upiResult.isUpi) {
      return null;
    }

    const { pa, pn, mc, amount, cu, tn } = upiResult;
    const cleanMc = mc || null;
    const isP2p = !cleanMc || cleanMc === '0000' || cleanMc === '0';

    const decodedName = pn || pa.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const detectedCategory = getCategoryFromMcc(cleanMc);

    let icon = '🏷️';
    if (cleanMc && MCC_CATEGORY_MAP[cleanMc]) {
      icon = MCC_CATEGORY_MAP[cleanMc].icon;
    } else if (isP2p) {
      icon = '👤';
    }

    return {
      isValid: true,
      isUpiQr: true,
      isP2p,
      upiId: pa,
      merchantName: decodedName,
      amount: amount || null,
      mcc: cleanMc,
      category: detectedCategory, // Strictly null if no MCC or unknown MCC!
      icon,
      currency: cu || 'INR',
      note: tn || '',
      raw: uriString,
    };
  }

  /**
   * Handle Web payment links containing embedded parameters
   */
  static parseWebPaymentUrl(urlString) {
    try {
      const url = new URL(urlString);
      const pa = url.searchParams.get('pa') || url.searchParams.get('PA');
      const pn = url.searchParams.get('pn') || url.searchParams.get('PN');
      const am = url.searchParams.get('am') || url.searchParams.get('AM');
      const mc = url.searchParams.get('mc') || url.searchParams.get('MC');

      if (pa) {
        return this.parseUpiUri(`upi://pay?${url.searchParams.toString()}`);
      }

      return {
        isValid: true,
        isUpiQr: false,
        isP2p: false,
        upiId: `merchant@${url.hostname.replace(/[^a-z0-9]/g, '')}`,
        merchantName: url.hostname.replace('www.', ''),
        amount: am ? parseFloat(am) : null,
        mcc: mc || null,
        category: getCategoryFromMcc(mc),
        icon: '🔗',
        note: null,
        raw: urlString,
      };
    } catch (e) {
      return null;
    }
  }
}
