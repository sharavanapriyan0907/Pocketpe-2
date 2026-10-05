/* ==========================================================================
   POCKETPE - UPI QR CODE DECODER & PARSER ENGINE
   Parses standard Indian UPI QR specification (upi://pay?pa=...&pn=...)
   Extracts payee, merchant name, amount, MCC code, currency, and note.
   Intelligently distinguishes commercial merchants (MCC) vs P2P Friends (no MCC / mc=0000).
   ========================================================================== */

export const MCC_CATEGORY_MAP = {
  // Food & Dining
  '5411': { category: 'Food & Dining', icon: '🛒', label: 'Grocery Stores / Supermarkets' },
  '5462': { category: 'Food & Dining', icon: '🥖', label: 'Bakeries' },
  '5499': { category: 'Food & Dining', icon: '🏪', label: 'Misc Food Stores / Convenience' },
  '5811': { category: 'Food & Dining', icon: '🍱', label: 'Caterers' },
  '5812': { category: 'Food & Dining', icon: '🍔', label: 'Restaurants & Eating Places' },
  '5813': { category: 'Food & Dining', icon: '🍻', label: 'Drinking Places / Lounges' },
  '5814': { category: 'Food & Dining', icon: '🍕', label: 'Fast Food Restaurants' },

  // Transport & Fuel
  '4111': { category: 'Transport & Fuel', icon: '🚆', label: 'Local Commuter Transport / Metro' },
  '4121': { category: 'Transport & Fuel', icon: '🚕', label: 'Taxicabs / Uber / Ola' },
  '4131': { category: 'Transport & Fuel', icon: '🚌', label: 'Bus Lines' },
  '4789': { category: 'Transport & Fuel', icon: '🚗', label: 'Transportation Services' },
  '5541': { category: 'Transport & Fuel', icon: '⛽', label: 'Service Stations / Petrol / Fuel' },
  '5542': { category: 'Transport & Fuel', icon: '⛽', label: 'Automated Fuel Dispensers' },

  // Education & College
  '8211': { category: 'College & Education', icon: '🏫', label: 'Elementary & Secondary Schools' },
  '8220': { category: 'College & Education', icon: '🎓', label: 'Colleges & Universities' },
  '8299': { category: 'College & Education', icon: '📚', label: 'Educational Services / Courses' },
  '5942': { category: 'College & Education', icon: '📖', label: 'Book Stores' },
  '5943': { category: 'College & Education', icon: '✏️', label: 'Stationery Stores' },

  // Health & Wellness
  '5912': { category: 'Health & Wellness', icon: '💊', label: 'Pharmacies & Drug Stores' },
  '8011': { category: 'Health & Wellness', icon: '🩺', label: 'Doctors & Physicians' },
  '8021': { category: 'Health & Wellness', icon: '🦷', label: 'Dentists' },
  '8062': { category: 'Health & Wellness', icon: '🏥', label: 'Hospitals' },

  // Shopping & Apparel
  '5311': { category: 'Shopping & Apparel', icon: '🏬', label: 'Department Stores' },
  '5651': { category: 'Shopping & Apparel', icon: '👕', label: 'Family Clothing Stores' },
  '5661': { category: 'Shopping & Apparel', icon: '👟', label: 'Shoe Stores' },
  '5944': { category: 'Shopping & Apparel', icon: '💍', label: 'Jewelry Stores' },

  // Personal Care
  '7230': { category: 'Personal Care', icon: '💈', label: 'Beauty & Barber Shops' },
  '7298': { category: 'Personal Care', icon: '🧖', label: 'Health & Beauty Spas' },

  // Entertainment
  '7832': { category: 'Entertainment', icon: '🎬', label: 'Motion Picture Theaters / Cinema' },
  '7999': { category: 'Entertainment', icon: '🎮', label: 'Recreation & Gaming Services' },

  // Housing & Utilities
  '4900': { category: 'Housing', icon: '💡', label: 'Utilities (Electric, Gas, Water)' },
  '4899': { category: 'Housing', icon: '📡', label: 'Cable & Internet Services' },
};

export class UpiQrEngine {
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

    // 2. BharatPe / PhonePe / Paytm / GPay web link formats
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
        category: 'Friends & Social', // Auto-detected as Friend / P2P
        icon: '🤝',
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
      icon: isPhoneNumber ? '🤝' : '🏷️',
      note: null,
      raw: trimmed,
    };
  }

  /**
   * Parse standard upi://pay?pa=...&pn=... string with case-insensitivity and P2P auto-detection
   */
  static parseUpiUri(uriString) {
    try {
      const queryIdx = uriString.indexOf('?');
      if (queryIdx === -1) {
        return null;
      }

      const queryString = uriString.substring(queryIdx + 1);
      const params = new URLSearchParams(queryString);

      // Case-insensitive query parameter extractor
      const getParam = (name) => {
        const lowerName = name.toLowerCase();
        for (const [k, v] of params.entries()) {
          if (k.toLowerCase() === lowerName) return v;
        }
        return null;
      };

      const rawPa = getParam('pa') || ''; // Payee UPI address (e.g. rohan@okaxis)
      const rawPn = getParam('pn') || ''; // Payee Name (e.g. Rohan Sharma)
      const rawAm = getParam('am'); // Amount (e.g. 150.00)
      const rawMc = getParam('mc'); // Merchant Category Code (e.g. 5812 or 0000)
      const rawTn = getParam('tn') || ''; // Transaction note (e.g. Bill)
      const rawCu = getParam('cu') || 'INR'; // Currency

      if (!rawPa) {
        return null;
      }

      // Safely decode parameters (supporting %40 for @ and + for spaces)
      const pa = decodeURIComponent(rawPa).trim();
      const pn = rawPn ? decodeURIComponent(rawPn.replace(/\+/g, ' ')).trim() : '';
      const decodedName = pn || pa.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const parsedAmount = rawAm ? parseFloat(rawAm) : null;
      const cleanMc = rawMc ? rawMc.trim() : null;

      // Intelligent P2P Friend Auto-Detection vs Merchant MCC:
      // Personal / Friend QR codes in GPay, PhonePe, Paytm have no MCC or mc=0000.
      const isP2p = !cleanMc || cleanMc === '0000' || cleanMc === '0';

      let mappedCategory = null;
      let mappedIcon = '🏷️';

      if (!isP2p && cleanMc && MCC_CATEGORY_MAP[cleanMc]) {
        // Commercial merchant with registered MCC
        mappedCategory = MCC_CATEGORY_MAP[cleanMc].category;
        mappedIcon = MCC_CATEGORY_MAP[cleanMc].icon;
      } else if (isP2p) {
        // Peer-to-Peer Personal / Friend QR
        mappedCategory = 'Friends & Social';
        mappedIcon = '🤝';
      }

      return {
        isValid: true,
        isUpiQr: true,
        isP2p,
        upiId: pa,
        merchantName: decodedName,
        amount: parsedAmount && !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : null,
        mcc: cleanMc,
        category: mappedCategory,
        icon: mappedIcon,
        currency: rawCu,
        note: rawTn ? decodeURIComponent(rawTn.replace(/\+/g, ' ')).trim() : '',
        raw: uriString,
      };
    } catch (e) {
      console.warn('Error parsing UPI URI:', e);
      return null;
    }
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

      // If no query params, extract hostname as merchant
      return {
        isValid: true,
        isUpiQr: false,
        isP2p: false,
        upiId: `merchant@${url.hostname.replace(/[^a-z0-9]/g, '')}`,
        merchantName: url.hostname.replace('www.', ''),
        amount: am ? parseFloat(am) : null,
        mcc: mc || null,
        category: null,
        icon: '🔗',
        note: null,
        raw: urlString,
      };
    } catch (e) {
      return null;
    }
  }
}
