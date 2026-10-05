/* ==========================================================================
   POCKETPE - UPI QR CODE DECODER & PARSER ENGINE
   Parses standard Indian UPI QR specification (upi://pay?pa=...&pn=...)
   Extracts payee, merchant name, amount, MCC code, currency, and note.
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

    // 1. Standard UPI intent format: upi://pay?...
    if (trimmed.toLowerCase().startsWith('upi://pay')) {
      return this.parseUpiUri(trimmed);
    }

    // 2. BharatPe / PhonePe / Paytm web link formats
    if (trimmed.includes('phonepe.com') || trimmed.includes('paytm.me') || trimmed.includes('bharatpe.com')) {
      return this.parseWebPaymentUrl(trimmed);
    }

    // 3. Plain UPI ID: username@bank
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    if (upiRegex.test(trimmed)) {
      const username = trimmed.split('@')[0];
      const prettyName = username
        .replace(/[._]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      return {
        isValid: true,
        isUpiQr: true,
        upiId: trimmed,
        merchantName: prettyName,
        amount: null,
        mcc: null,
        category: null,
        icon: '🏷️',
        note: null,
        raw: trimmed,
      };
    }

    // 4. Raw text merchant fallback
    return {
      isValid: true,
      isUpiQr: false,
      upiId: trimmed.includes('@') ? trimmed : `${trimmed.toLowerCase().replace(/[^a-z0-9]/g, '')}@upi`,
      merchantName: trimmed,
      amount: null,
      mcc: null,
      category: null,
      icon: '🏷️',
      note: null,
      raw: trimmed,
    };
  }

  /**
   * Parse standard upi://pay?pa=...&pn=... string
   */
  static parseUpiUri(uriString) {
    try {
      const queryIdx = uriString.indexOf('?');
      if (queryIdx === -1) {
        return null;
      }

      const queryString = uriString.substring(queryIdx + 1);
      const params = new URLSearchParams(queryString);

      const pa = params.get('pa') || ''; // Payee UPI address (e.g. coffee@okaxis)
      const pn = params.get('pn') || ''; // Payee Name (e.g. Chai Point)
      const am = params.get('am') || null; // Amount (e.g. 150.00)
      const mc = params.get('mc') || null; // Merchant Category Code (e.g. 5812)
      const tn = params.get('tn') || ''; // Transaction note (e.g. Bill)
      const cu = params.get('cu') || 'INR'; // Currency

      if (!pa) {
        return null;
      }

      const decodedName = decodeURIComponent(pn || pa.split('@')[0]).trim();
      const parsedAmount = am ? parseFloat(am) : null;

      // Map MCC code to category if present
      let mappedCategory = null;
      let mappedIcon = '🏷️';
      if (mc && MCC_CATEGORY_MAP[mc]) {
        mappedCategory = MCC_CATEGORY_MAP[mc].category;
        mappedIcon = MCC_CATEGORY_MAP[mc].icon;
      }

      return {
        isValid: true,
        isUpiQr: true,
        upiId: pa.trim(),
        merchantName: decodedName || pa.trim(),
        amount: parsedAmount && !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : null,
        mcc: mc ? mc.trim() : null,
        category: mappedCategory,
        icon: mappedIcon,
        currency: cu,
        note: decodeURIComponent(tn).trim(),
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
      const pa = url.searchParams.get('pa');
      const pn = url.searchParams.get('pn');
      const am = url.searchParams.get('am');
      const mc = url.searchParams.get('mc');

      if (pa) {
        return this.parseUpiUri(`upi://pay?${url.searchParams.toString()}`);
      }

      // If no query params, extract hostname as merchant
      return {
        isValid: true,
        isUpiQr: false,
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
