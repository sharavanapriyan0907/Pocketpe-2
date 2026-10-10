/* ==========================================================================
   POCKETPE - AUTHENTICATION MODAL (SUPABASE EMAIL/PASSWORD)
   Supports Sign Up, Log In, Input Validation, and Supabase Auth Integration
   ========================================================================== */

import { supabaseService } from '../services/supabaseService.js';
import { devModeService } from '../services/devModeService.js';
import { stateManager } from '../state.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';

export class AuthModal {
  static init() {
    this.modal = document.getElementById('modal-auth');
    if (!this.modal) return;

    this.currentTab = 'login'; // 'login' or 'signup'
    this.render();
  }

  static open(tab = 'login') {
    this.currentTab = tab;
    this.render();
    NavigationManager.openModal('modal-auth');
  }

  static render() {
    if (!this.modal) return;

    const body = this.modal.querySelector('.sheet-body');
    const title = this.modal.querySelector('.sheet-title');
    if (!body) return;

    if (title) {
      title.textContent = this.currentTab === 'login' ? 'Welcome Back' : 'Create Account';
    }

    const isConfigured = supabaseService.isConfigured();
    const isDev = devModeService.isDevMode();

    body.innerHTML = `
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 2.2rem; margin-bottom: 6px;">
          ${this.currentTab === 'login' ? '🔐' : '✨'}
        </div>
        <h3 class="h3" style="color: var(--text-primary); font-size: 1.15rem;">
          ${this.currentTab === 'login' ? 'Sign In to PocketPe' : 'Join PocketPe'}
        </h3>
        <p class="subtitle" style="font-size: 0.8rem;">
          ${this.currentTab === 'login'
            ? 'Access your purpose wallets and merchant memories'
            : 'Set up your student UPI profile with purpose wallets'}
        </p>
      </div>

      <!-- Supabase Configuration Status Banner (DEVELOPER MODE ONLY) -->
      ${isDev && !isConfigured ? `
        <div class="card" style="padding: 10px 12px; background: rgba(245, 158, 11, 0.1); border: 1px solid #f59e0b; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <div style="font-size: 0.76rem; color: var(--text-secondary);">
            <strong style="color: #f59e0b;">⚙️ Dev Setup:</strong> Connect Supabase Project URL & Anon Key to authenticate.
          </div>
          <button class="btn btn-sm btn-ghost" id="btn-auth-open-config" style="white-space: nowrap; font-size: 0.72rem; padding: 4px 8px;">
            Configure
          </button>
        </div>
      ` : ''}

      <!-- Tab Switcher (Log In / Sign Up) -->
      <div style="display: flex; background: var(--bg-surface-secondary); padding: 4px; border-radius: var(--radius-md); margin-bottom: 14px;">
        <button class="btn ${this.currentTab === 'login' ? 'btn-primary' : 'btn-ghost'}" id="tab-auth-login" style="flex: 1; padding: 8px; font-size: var(--text-xs);">
          Log In
        </button>
        <button class="btn ${this.currentTab === 'signup' ? 'btn-primary' : 'btn-ghost'}" id="tab-auth-signup" style="flex: 1; padding: 8px; font-size: var(--text-xs);">
          Sign Up
        </button>
      </div>

      <!-- Error / Success Alert Box -->
      <div id="auth-alert" style="display: none; padding: 10px 12px; border-radius: var(--radius-md); font-size: 0.78rem; margin-bottom: 14px; font-weight: 600;"></div>

      <!-- One-Click Google Authentication Button -->
      <button type="button" class="btn-google" id="btn-auth-google" style="margin-bottom: 12px;">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <span id="text-auth-google">${this.currentTab === 'login' ? 'Sign in with Google' : 'Sign up with Google'}</span>
      </button>

      <!-- Divider -->
      <div style="display: flex; align-items: center; margin: 4px 0 14px; gap: 10px;">
        <div style="flex: 1; height: 1px; background: var(--border-subtle);"></div>
        <span style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;">or continue with email</span>
        <div style="flex: 1; height: 1px; background: var(--border-subtle);"></div>
      </div>

      <!-- Auth Form -->
      <form id="form-auth" style="display: flex; flex-direction: column; gap: 12px;">
        ${this.currentTab === 'signup' ? `
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" for="auth-name" style="font-size: var(--text-xs);">
              Full Name <span style="color: var(--text-muted); font-size: 0.7rem;">(Optional)</span>
            </label>
            <input
              type="text"
              id="auth-name"
              class="form-input"
              placeholder="e.g. Sharath Kumar"
              autocomplete="name"
            />
          </div>
        ` : ''}

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="auth-email" style="font-size: var(--text-xs);">Email Address</label>
          <input
            type="email"
            id="auth-email"
            class="form-input"
            placeholder="student@university.edu"
            required
            autocomplete="email"
          />
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="auth-password" style="font-size: var(--text-xs);">
            Password ${this.currentTab === 'signup' ? '<span style="color: var(--text-muted); font-size: 0.7rem;">(min 6 characters)</span>' : ''}
          </label>
          <input
            type="password"
            id="auth-password"
            class="form-input"
            placeholder="••••••••"
            required
            autocomplete="${this.currentTab === 'login' ? 'current-password' : 'new-password'}"
          />
        </div>

        <button type="submit" class="btn btn-primary" id="btn-auth-submit" style="width: 100%; margin-top: 8px; padding: 12px;">
          ${this.currentTab === 'login' ? 'Log In' : 'Create Account'}
        </button>

        <!-- Toggle Switch Link -->
        <div style="text-align: center; margin-top: 8px; font-size: 0.78rem; color: var(--text-secondary);">
          ${this.currentTab === 'login' ? `
            Don't have an account?
            <a href="#" id="link-switch-to-signup" style="color: var(--accent-primary); font-weight: 700; text-decoration: none;">Sign Up</a>
          ` : `
            Already have an account?
            <a href="#" id="link-switch-to-login" style="color: var(--accent-primary); font-weight: 700; text-decoration: none;">Log In</a>
          `}
        </div>

        <!-- Connection Settings Link (DEVELOPER MODE ONLY) -->
        ${isDev ? `
          <div style="text-align: center; margin-top: 4px;">
            <button type="button" id="btn-auth-settings-link" style="background: none; border: none; font-size: 0.72rem; color: #f59e0b; cursor: pointer; text-decoration: underline;">
              ⚙️ Supabase Connection Settings
            </button>
          </div>
        ` : ''}
      </form>
    `;

    this.bindEvents();
  }

  static bindEvents() {
    if (!this.modal) return;

    // Google Sign-In Button
    const googleBtn = this.modal.querySelector('#btn-auth-google');
    if (googleBtn) {
      googleBtn.addEventListener('click', async () => {
        await this.handleGoogleSignIn();
      });
    }

    // Tab buttons
    const loginTabBtn = this.modal.querySelector('#tab-auth-login');
    const signupTabBtn = this.modal.querySelector('#tab-auth-signup');
    const switchToSignup = this.modal.querySelector('#link-switch-to-signup');
    const switchToLogin = this.modal.querySelector('#link-switch-to-login');

    const setTab = (tab) => {
      this.currentTab = tab;
      this.render();
      SoundEngine.playTap();
    };

    if (loginTabBtn) loginTabBtn.addEventListener('click', () => setTab('login'));
    if (signupTabBtn) signupTabBtn.addEventListener('click', () => setTab('signup'));
    if (switchToSignup) switchToSignup.addEventListener('click', (e) => { e.preventDefault(); setTab('signup'); });
    if (switchToLogin) switchToLogin.addEventListener('click', (e) => { e.preventDefault(); setTab('login'); });

    // Open Config Modal
    const configBtn = this.modal.querySelector('#btn-auth-open-config');
    const settingsLink = this.modal.querySelector('#btn-auth-settings-link');
    const openConfig = () => {
      NavigationManager.closeModal('modal-auth');
      NavigationManager.openModal('modal-supabase-config');
    };
    if (configBtn) configBtn.addEventListener('click', openConfig);
    if (settingsLink) settingsLink.addEventListener('click', openConfig);

    // Form submission
    const form = this.modal.querySelector('#form-auth');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleAuthSubmit();
      });
    }
  }

  static async handleGoogleSignIn() {
    if (this.isSubmitting) return;

    this.hideAlert();
    const googleBtn = this.modal.querySelector('#btn-auth-google');
    const googleText = this.modal.querySelector('#text-auth-google');
    const submitBtn = this.modal.querySelector('#btn-auth-submit');

    if (!supabaseService.isConfigured()) {
      SoundEngine.playAlert();
      this.showAlert('Supabase credentials required. Please configure your Project URL & Anon Key.', 'error');
      return;
    }

    this.isSubmitting = true;
    if (googleBtn) googleBtn.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    if (googleText) googleText.textContent = 'Redirecting to Google...';
    SoundEngine.playTap();

    try {
      await supabaseService.signInWithGoogle();
      // Browser will redirect to Google OAuth
    } catch (err) {
      console.error('Google Sign-In Error:', err);
      SoundEngine.playAlert();
      const friendlyMsg = this.formatAuthError(err.message || 'Google sign-in failed');
      this.showAlert(friendlyMsg, 'error');
      this.isSubmitting = false;
      if (googleBtn) googleBtn.disabled = false;
      if (submitBtn) submitBtn.disabled = false;
      if (googleText) {
        googleText.textContent = this.currentTab === 'login' ? 'Sign in with Google' : 'Sign up with Google';
      }
    }
  }

  static showAlert(message, type = 'error') {
    const alertBox = this.modal.querySelector('#auth-alert');
    if (!alertBox) return;

    alertBox.style.display = 'block';
    if (type === 'error') {
      alertBox.style.background = 'rgba(239, 68, 68, 0.12)';
      alertBox.style.border = '1px solid #ef4444';
      alertBox.style.color = '#ef4444';
    } else {
      alertBox.style.background = 'rgba(16, 185, 129, 0.12)';
      alertBox.style.border = '1px solid #10b981';
      alertBox.style.color = '#10b981';
    }
    alertBox.textContent = message;
  }

  static hideAlert() {
    const alertBox = this.modal.querySelector('#auth-alert');
    if (alertBox) alertBox.style.display = 'none';
  }

  static isSubmitting = false;

  static async handleAuthSubmit() {
    if (this.isSubmitting) return; // Prevent duplicate submissions

    this.hideAlert();

    const submitBtn = this.modal.querySelector('#btn-auth-submit');
    const emailInput = this.modal.querySelector('#auth-email');
    const passwordInput = this.modal.querySelector('#auth-password');
    const nameInput = this.modal.querySelector('#auth-name');

    const email = emailInput?.value?.trim() || '';
    const password = passwordInput?.value || '';
    const fullName = nameInput?.value?.trim() || '';

    // Basic Validations
    if (!email || !email.includes('@') || !email.includes('.')) {
      this.showAlert('Invalid email address.', 'error');
      return;
    }

    if (!password || password.length < 6) {
      this.showAlert('Password must be at least 6 characters.', 'error');
      return;
    }

    // Set Loading state & disable button
    this.isSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = this.currentTab === 'login' ? 'Signing in...' : 'Creating account...';
    }

    try {
      if (this.currentTab === 'signup') {
        const data = await supabaseService.signUp(email, password, fullName);

        // Check if an immediate session was returned
        if (data?.session && data?.user) {
          stateManager.setAuthUser(data.user);
          SoundEngine.playSuccess();
          NavigationManager.closeModal('modal-auth');
          NavigationManager.switchTab('home'); // Open existing dashboard
          const displayName = fullName || data.user.user_metadata?.full_name || email.split('@')[0];
          NavigationManager.showToast(`🎉 Welcome to PocketPe, ${displayName}!`, 'success');
        } else if (data?.user) {
          // Email confirmation is required
          this.showAlert('Account created. Please check your email to verify your account.', 'success');
          SoundEngine.playSuccess();
        } else {
          this.showAlert('Account created. Please check your email to verify your account.', 'success');
        }
      } else {
        const data = await supabaseService.signIn(email, password);

        if (data?.user) {
          stateManager.setAuthUser(data.user);
          SoundEngine.playSuccess();
          NavigationManager.closeModal('modal-auth');
          NavigationManager.switchTab('home'); // Open existing dashboard
          const displayName = data.user.user_metadata?.full_name || email.split('@')[0];
          NavigationManager.showToast(`✨ Welcome back, ${displayName}!`, 'success');
        } else {
          this.showAlert('Unable to sign in. Please check your credentials.', 'error');
        }
      }
    } catch (err) {
      console.error('Authentication Error:', err);
      SoundEngine.playAlert();
      const friendlyMsg = this.formatAuthError(err.message || 'Authentication error');
      this.showAlert(friendlyMsg, 'error');
    } finally {
      this.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = this.currentTab === 'login' ? 'Log In' : 'Create Account';
      }
    }
  }

  static formatAuthError(msg = '') {
    const lower = String(msg).toLowerCase();

    if (lower.includes('user already registered') || lower.includes('already registered') || lower.includes('email already in use')) {
      return 'Email already registered.';
    }
    if (lower.includes('password should be at least') || lower.includes('weak_password') || lower.includes('password must be at least')) {
      return 'Password must be at least 6 characters.';
    }
    if (lower.includes('invalid email') || lower.includes('unable to validate email')) {
      return 'Invalid email address.';
    }
    if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
      return 'Incorrect email or password.';
    }
    if (lower.includes('email not confirmed')) {
      return 'Please check your email to verify your account before logging in.';
    }
    if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('err_name_not_resolved') || lower.includes('connection failed')) {
      return 'Unable to connect to Supabase.';
    }
    if (lower.includes('provider is not enabled') || lower.includes('unsupported provider') || lower.includes('provider not found')) {
      return 'Google sign-in is not enabled yet in your Supabase project. In Supabase Dashboard, go to Authentication > Providers > Google and enable it.';
    }
    return msg;
  }
}
