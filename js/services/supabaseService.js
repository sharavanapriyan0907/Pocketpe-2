/* ==========================================================================
   POCKETPE - SUPABASE AUTHENTICATION SERVICE
   Provides email/password authentication (Sign Up, Log In, Log Out, Profile)
   and exposes authenticated Supabase user.id to the application.
   ========================================================================== */

import { APP_CONFIG } from '../config.js';

class SupabaseService {
  constructor() {
    this.client = null;
    this.url = this.sanitizeUrl(
      (typeof window !== 'undefined' && window.__ENV__?.SUPABASE_URL) ||
      localStorage.getItem(APP_CONFIG.STORAGE_KEYS.SUPABASE_URL) ||
      APP_CONFIG.SUPABASE.DEFAULT_URL
    );
    this.anonKey = (
      (typeof window !== 'undefined' && (window.__ENV__?.SUPABASE_ANON_KEY || window.__ENV__?.SUPABASE_PUBLISHABLE_KEY)) ||
      localStorage.getItem(APP_CONFIG.STORAGE_KEYS.SUPABASE_ANON_KEY) ||
      APP_CONFIG.SUPABASE.DEFAULT_ANON_KEY || ''
    ).trim();
    this.initialized = false;
    this.authListeners = new Set();
  }

  /**
   * Normalize Supabase project URL by removing trailing slashes, /rest/v1, etc.
   */
  sanitizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    let clean = rawUrl.trim();
    clean = clean.replace(/\/rest\/v1\/?$/i, '');
    clean = clean.replace(/\/auth\/v1\/?$/i, '');
    clean = clean.replace(/\/+$/, '');
    return clean;
  }

  /**
   * Check whether real Supabase credentials are configured
   */
  isConfigured() {
    if (!this.url || !this.anonKey) return false;
    if (this.url.includes('xyzcompany') || this.url.includes('placeholder') || this.anonKey.includes('placeholder')) {
      return false;
    }
    return true;
  }

  /**
   * Get current URL and Anon key
   */
  getConfig() {
    return {
      url: this.url,
      anonKey: this.anonKey,
      isConfigured: this.isConfigured(),
    };
  }

  /**
   * Update credentials at runtime and re-initialize client
   */
  async updateConfig(url, anonKey) {
    this.url = this.sanitizeUrl(url);
    this.anonKey = (anonKey || '').trim();
    localStorage.setItem(APP_CONFIG.STORAGE_KEYS.SUPABASE_URL, this.url);
    localStorage.setItem(APP_CONFIG.STORAGE_KEYS.SUPABASE_ANON_KEY, this.anonKey);
    this.initialized = false;
    this.client = null;
    return this.init();
  }

  /**
   * Initialize Supabase client via window.supabase (vendor) or ESM CDN fallback
   */
  async init() {
    if (this.initialized && this.client) return this.client;

    let createClientFn = window.supabase?.createClient;

    if (!createClientFn) {
      try {
        const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        createClientFn = mod.createClient;
      } catch (err) {
        console.warn('Could not load Supabase from ESM fallback:', err);
      }
    }

    if (createClientFn && this.url && this.anonKey) {
      try {
        this.client = createClientFn(this.url, this.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
        this.initialized = true;

        // Subscribe to auth state changes from Supabase
        this.client.auth.onAuthStateChange((event, session) => {
          this.notifyAuthListeners(event, session);
        });

        console.log('⚡ Supabase client initialized for:', this.url);
      } catch (err) {
        console.error('Failed to create Supabase client:', err);
      }
    }

    return this.client;
  }

  /**
   * Subscribe to Supabase auth events (SIGNED_IN, SIGNED_OUT, USER_UPDATED, etc.)
   */
  onAuthStateChange(callback) {
    this.authListeners.add(callback);
    return () => this.authListeners.delete(callback);
  }

  notifyAuthListeners(event, session) {
    this.authListeners.forEach((cb) => {
      try {
        cb(event, session);
      } catch (e) {
        console.error('Error in Supabase auth listener:', e);
      }
    });
  }

  /**
   * Validate credentials (enforces non-anonymous authentication)
   */
  validateCredentials(email, password, fullName = '') {
    const trimmedEmail = (email || '').trim().toLowerCase();
    const trimmedName = (fullName || '').trim();

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      return { valid: false, error: 'Please enter a valid email address.' };
    }
    if (!password || password.length < 6) {
      return { valid: false, error: 'Password must be at least 6 characters.' };
    }
    return { valid: true, email: trimmedEmail, fullName: trimmedName };
  }

  /**
   * Email and password registration (Strictly non-anonymous)
   */
  async signUp(email, password, fullName) {
    await this.init();
    if (!this.client) {
      throw new Error('Supabase client is not initialized. Please configure your Supabase Project URL and Anon Key.');
    }

    const validation = this.validateCredentials(email, password, fullName);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const trimmedEmail = validation.email;
    const trimmedName = validation.fullName;

    const { data, error } = await this.client.auth.signUp({
      email: trimmedEmail,
      password: password,
      options: {
        data: {
          full_name: trimmedName || trimmedEmail.split('@')[0],
        },
      },
    });

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Email and password sign in
   */
  async signIn(email, password) {
    await this.init();
    if (!this.client) {
      throw new Error('Supabase client is not initialized. Please configure your Supabase Project URL and Anon Key.');
    }

    const trimmedEmail = (email || '').trim().toLowerCase();
    if (!trimmedEmail) {
      throw new Error('Please enter your email.');
    }
    if (!password) {
      throw new Error('Please enter your password.');
    }

    const { data, error } = await this.client.auth.signInWithPassword({
      email: trimmedEmail,
      password: password,
    });

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Google OAuth sign in / sign up
   */
  async signInWithGoogle() {
    await this.init();
    if (!this.client) {
      throw new Error('Supabase client is not initialized. Please configure your Supabase Project URL and Anon Key.');
    }

    // Determine redirect URL: current origin + pathname (without query or hash)
    const redirectUrl = window.location.origin + window.location.pathname;

    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      throw error;
    }

    if (data?.url) {
      window.location.assign(data.url);
    }

    return data;
  }

  /**
   * Sign out current user
   */
  async signOut() {
    await this.init();
    if (this.client) {
      const { error } = await this.client.auth.signOut();
      if (error) {
        console.warn('Supabase sign out error:', error);
      }
    }
  }

  /**
   * Get current active session
   */
  async getSession() {
    await this.init();
    if (!this.client) return null;
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      console.warn('Error fetching Supabase session:', error);
      return null;
    }
    return data?.session || null;
  }

  /**
   * Get current authenticated user
   */
  async getUser() {
    await this.init();
    if (!this.client) return null;
    const { data, error } = await this.client.auth.getUser();
    if (error) {
      return null;
    }
    return data?.user || null;
  }

  /**
   * Update profile metadata (e.g. full name)
   */
  async updateProfile({ fullName }) {
    await this.init();
    if (!this.client) {
      throw new Error('Supabase client is not initialized.');
    }

    const trimmedName = (fullName || '').trim();
    if (!trimmedName) {
      throw new Error('Please enter a valid display name.');
    }

    // Check if active Supabase session exists before remote update
    const session = await this.getSession();
    if (!session) {
      console.log('Notice: No active remote Supabase session to update profile metadata.');
      return null;
    }

    const { data, error } = await this.client.auth.updateUser({
      data: {
        full_name: trimmedName,
      },
    });

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Test connection to Supabase endpoint and check if database tables exist
   */
  async testConnection() {
    try {
      await this.init();
      if (!this.client) return { success: false, message: 'Client not initialized' };
      const { data, error } = await this.client.auth.getSession();
      if (error && !error.message.includes('Auth session missing')) {
        return { success: false, message: error.message };
      }

      // Check if tables are queryable
      let tablesStatus = 'Tables ready';
      try {
        const { error: tableErr } = await this.client.from('wallets').select('id').limit(1);
        if (tableErr) {
          if (tableErr.code === '42P01') {
            tablesStatus = 'Auth connected, but database tables need schema setup (run supabase_schema.sql)';
          } else if (tableErr.message) {
            tablesStatus = `Auth connected (${tableErr.message})`;
          }
        }
      } catch (err) {
        // Ignored if offline
      }

      return { 
        success: true, 
        message: `Connected successfully to Supabase! (${tablesStatus})` 
      };
    } catch (e) {
      return { success: false, message: e.message || 'Connection failed' };
    }
  }

  // --- Database Sync Operations ---

  /**
   * Sync wallets to Supabase PostgreSQL table
   */
  async syncWalletsToCloud(userId, wallets) {
    if (!this.isConfigured() || !this.client || !userId) return;
    try {
      const records = wallets.map((w) => ({
        id: w.id,
        user_id: userId,
        name: w.name,
        icon: w.icon,
        color: w.color,
        balance: w.balance,
        target_amount: w.targetAmount || 0,
        monthly_limit: w.monthlyLimit || 0,
        allocation_percentage: w.allocationPercentage || 0,
        category: w.category || '',
        is_free_money: !!w.isFreeMoney,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await this.client.from('wallets').upsert(records, { onConflict: 'user_id, id' });
      if (error) {
        console.warn('Supabase wallets sync notice:', error.message);
      }
    } catch (e) {
      console.warn('Could not sync wallets to Supabase:', e.message);
    }
  }

  /**
   * Fetch wallets from Supabase PostgreSQL table
   */
  async fetchWalletsFromCloud(userId) {
    if (!this.isConfigured() || !this.client || !userId) return null;
    try {
      const { data, error } = await this.client
        .from('wallets')
        .select('*')
        .eq('user_id', userId);

      if (error || !data || data.length === 0) return null;

      return data.map((row) => ({
        id: row.id,
        name: row.name,
        icon: row.icon,
        color: row.color,
        balance: Number(row.balance),
        targetAmount: Number(row.target_amount),
        monthlyLimit: Number(row.monthly_limit),
        allocationPercentage: Number(row.allocation_percentage),
        category: row.category,
        isFreeMoney: row.is_free_money,
      }));
    } catch (e) {
      return null;
    }
  }

  /**
   * Sync single transaction to Supabase
   */
  async syncTransactionToCloud(userId, tx) {
    if (!this.isConfigured() || !this.client || !userId || !tx) return;
    try {
      const { error } = await this.client.from('transactions').upsert([
        {
          id: tx.id,
          user_id: userId,
          merchant_name: tx.merchantName,
          amount: tx.amount,
          type: tx.type || 'debit',
          category: tx.category || '',
          wallet_id: tx.walletId || null,
          wallet_name: tx.walletName || null,
          wallet_icon: tx.walletIcon || null,
          upi_id: tx.upiId || null,
          mcc: tx.mcc || null,
          status: tx.status || 'success',
          created_at: tx.timestamp || new Date().toISOString(),
        },
      ], { onConflict: 'user_id, id' });

      if (error) {
        console.warn('Supabase transaction sync notice:', error.message);
      }
    } catch (e) {
      console.warn('Could not sync transaction to Supabase:', e.message);
    }
  }

  /**
   * STEP 5: Fetch saved user merchant preference for a specific UPI ID
   * Looks up merchant_preferences table using authenticated user_id + upi_id
   */
  async getMerchantPreference(userId, upiId) {
    if (!userId || !upiId) return null;
    const cleanUpi = upiId.trim().toLowerCase();

    // 1. Try cloud Supabase lookup
    if (this.isConfigured() && this.client) {
      try {
        const { data, error } = await this.client
          .from('merchant_preferences')
          .select('*')
          .eq('user_id', userId)
          .eq('upi_id', cleanUpi)
          .maybeSingle();

        if (!error && data) {
          this.setLocalPreference(userId, cleanUpi, data);
          return {
            userId: data.user_id,
            upiId: data.upi_id,
            merchantName: data.merchant_name,
            detectedMcc: data.detected_mcc,
            category: data.category,
            walletId: data.wallet_id,
            source: data.source,
          };
        }
      } catch (err) {
        console.warn('Supabase merchant_preferences query notice:', err);
      }
    }

    // 2. Local fallback cache (for offline / instant response)
    return this.getLocalPreference(userId, cleanUpi);
  }

  /**
   * STEP 6 & 7: Save / update user merchant preference into Supabase merchant_preferences table
   * Scoped strictly by authenticated user_id + upi_id
   */
  async saveMerchantPreference({ userId, upiId, merchantName, detectedMcc = null, category = '', walletId, source = 'user' }) {
    if (!userId || !upiId || !walletId) return { success: false, error: 'Missing required parameters' };
    const cleanUpi = upiId.trim().toLowerCase();

    const record = {
      user_id: userId,
      upi_id: cleanUpi,
      merchant_name: merchantName || '',
      detected_mcc: detectedMcc || null,
      category: category || '',
      wallet_id: walletId,
      source: source || 'user',
      updated_at: new Date().toISOString(),
    };

    // Always update local user-scoped cache
    this.setLocalPreference(userId, cleanUpi, record);

    // Save to Supabase cloud if connected
    if (this.isConfigured() && this.client) {
      try {
        const { data, error } = await this.client
          .from('merchant_preferences')
          .upsert([record], { onConflict: 'user_id, upi_id' });

        if (error) {
          console.warn('Supabase save merchant preference notice:', error.message);
          return { success: true, localOnly: true, error: error.message };
        }
        return { success: true, data };
      } catch (err) {
        console.warn('Could not sync merchant preference to Supabase:', err.message);
        return { success: true, localOnly: true, error: err.message };
      }
    }

    return { success: true, localOnly: true };
  }

  getLocalPreference(userId, upiId) {
    try {
      const storageKey = `pocketpe_user_${userId}_merchant_prefs`;
      const stored = localStorage.getItem(storageKey);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      const pref = parsed[upiId.toLowerCase()];
      if (pref) {
        return {
          userId: pref.user_id || userId,
          upiId: pref.upi_id || upiId,
          merchantName: pref.merchant_name,
          detectedMcc: pref.detected_mcc,
          category: pref.category,
          walletId: pref.wallet_id,
          source: pref.source,
        };
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  setLocalPreference(userId, upiId, record) {
    try {
      const storageKey = `pocketpe_user_${userId}_merchant_prefs`;
      const stored = localStorage.getItem(storageKey);
      const map = stored ? JSON.parse(stored) : {};
      map[upiId.toLowerCase()] = record;
      localStorage.setItem(storageKey, JSON.stringify(map));
    } catch (e) {}
  }

  /**
   * Test Supabase connectivity and API key validity
   */
  async testConnection() {
    await this.init();
    if (!this.url || !this.anonKey) {
      return { success: false, message: 'Supabase Project URL or Anon Key is missing.' };
    }

    try {
      // 1. Check Auth service endpoint
      const authRes = await fetch(`${this.url}/auth/v1/settings`, {
        headers: {
          apikey: this.anonKey,
        },
      });

      if (authRes.ok) {
        return { success: true, message: 'Successfully reached Supabase project endpoint!' };
      }

      // 2. Fallback check against PostgREST
      if (this.client) {
        const { error } = await this.client.from('merchant_preferences').select('upi_id').limit(1);
        if (!error || !error.message?.includes('Failed to fetch')) {
          return { success: true, message: 'Database connection verified.' };
        }
      }

      return { success: false, message: `Server returned HTTP ${authRes.status}: ${authRes.statusText}` };
    } catch (err) {
      return { success: false, message: err.message || 'Network error reaching Supabase endpoint.' };
    }
  }
}

export const supabaseService = new SupabaseService();

