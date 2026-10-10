/* ==========================================================================
   POCKETPE - MANDATORY AUTHENTICATION VIEW (LOGIN & SIGN UP ENTRY POINT)
   Enforces authentication before users can access protected application features.
   Supports Email/Password and One-Click Google OAuth via Supabase.
   ========================================================================== */

import { supabaseService } from '../services/supabaseService.js';
import { devModeService } from '../services/devModeService.js';
import { stateManager } from '../state.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';

export class AuthView {
  static container = null;
  static currentTab = 'login'; // 'login' or 'signup'
  static isSubmitting = false;

  static init() {
    this.container = document.getElementById('view-auth');
    if (!this.container) return;

    this.render();
  }

  static setTab(tab = 'login') {
    this.currentTab = tab;
    this.render();
  }

  static render() {
    if (!this.container) return;

    const isDev = devModeService.isDevMode();

    this.container.innerHTML = `
      <div class="auth-page-container">
        <!-- Brand Header -->
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: var(--radius-lg); background: var(--accent-light); color: var(--accent-primary); font-size: 1.8rem; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);">
            ${this.currentTab === 'login' ? '🔐' : '✨'}
          </div>
          <h2 class="h2" style="color: var(--text-primary); font-size: 1.4rem; font-weight: 800; margin-bottom: 4px; letter-spacing: -0.02em;">
            ${this.currentTab === 'login' ? 'Sign In to PocketPe' : 'Join PocketPe'}
          </h2>
          <p class="subtitle" style="font-size: 0.82rem; color: var(--text-secondary); max-width: 300px; margin: 0 auto; line-height: 1.4;">
            ${this.currentTab === 'login'
              ? 'Enter your credentials to access your purpose wallets, commitments, and payments.'
              : 'Create your account to manage your money with purpose-led virtual wallets.'}
          </p>
        </div>

        <!-- Tab Switcher (Log In / Sign Up) -->
        <div style="display: flex; background: var(--bg-surface-secondary); padding: 4px; border-radius: var(--radius-md); margin-bottom: 16px;">
          <button type="button" class="btn ${this.currentTab === 'login' ? 'btn-primary' : 'btn-ghost'}" id="view-tab-auth-login" style="flex: 1; padding: 8px 12px; font-size: var(--text-xs); font-weight: 700;">
            Log In
          </button>
          <button type="button" class="btn ${this.currentTab === 'signup' ? 'btn-primary' : 'btn-ghost'}" id="view-tab-auth-signup" style="flex: 1; padding: 8px 12px; font-size: var(--text-xs); font-weight: 700;">
            Sign Up
          </button>
        </div>

        <!-- Error / Success Alert Box -->
        <div id="view-auth-alert" style="display: none; padding: 12px 14px; border-radius: var(--radius-md); font-size: 0.8rem; margin-bottom: 16px; font-weight: 600; line-height: 1.4;"></div>

        <!-- One-Click Google Authentication Button -->
        <button type="button" class="btn-google" id="btn-view-auth-google" style="margin-bottom: 14px; width: 100%;">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span id="text-view-auth-google">${this.currentTab === 'login' ? 'Sign in with Google' : 'Sign up with Google'}</span>
        </button>

        <!-- Divider -->
        <div style="display: flex; align-items: center; margin: 4px 0 16px; gap: 10px;">
          <div style="flex: 1; height: 1px; background: var(--border-subtle);"></div>
          <span style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;">or continue with email</span>
          <div style="flex: 1; height: 1px; background: var(--border-subtle);"></div>
        </div>

        <!-- Mandatory Email Authentication Form -->
        <form id="form-view-auth" style="display: flex; flex-direction: column; gap: 14px;">
          ${this.currentTab === 'signup' ? `
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="view-auth-name" style="font-size: var(--text-xs); font-weight: 700;">
                Full Name <span style="color: var(--text-muted); font-size: 0.7rem; font-weight: 400;">(Optional)</span>
              </label>
              <input
                type="text"
                id="view-auth-name"
                class="form-input"
                placeholder="e.g. Sharath Kumar"
                autocomplete="name"
              />
            </div>
          ` : ''}

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" for="view-auth-email" style="font-size: var(--text-xs); font-weight: 700;">
              Email Address <span style="color: var(--danger);">*</span>
            </label>
            <input
              type="email"
              id="view-auth-email"
              class="form-input"
              placeholder="student@university.edu"
              required
              autocomplete="email"
            />
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label class="form-label" for="view-auth-password" style="font-size: var(--text-xs); font-weight: 700;">
                Password <span style="color: var(--danger);">*</span>
              </label>
              ${this.currentTab === 'signup' ? `
                <span style="color: var(--text-muted); font-size: 0.7rem;">min 6 characters</span>
              ` : ''}
            </div>
            <input
              type="password"
              id="view-auth-password"
              class="form-input"
              placeholder="••••••••"
              required
              autocomplete="${this.currentTab === 'login' ? 'current-password' : 'new-password'}"
            />
          </div>

          <button type="submit" class="btn btn-primary" id="btn-view-auth-submit" style="width: 100%; margin-top: 6px; padding: 12px; font-weight: 700; font-size: var(--text-sm);">
            ${this.currentTab === 'login' ? 'Sign In with Email' : 'Create Account'}
          </button>

          <!-- Toggle Switch Link -->
          <div style="text-align: center; margin-top: 6px; font-size: 0.8rem; color: var(--text-secondary);">
            ${this.currentTab === 'login' ? `
              Don't have an account?
              <a href="#" id="link-view-switch-to-signup" style="color: var(--accent-primary); font-weight: 700; text-decoration: none;">Sign Up</a>
            ` : `
              Already have an account?
              <a href="#" id="link-view-switch-to-login" style="color: var(--accent-primary); font-weight: 700; text-decoration: none;">Log In</a>
            `}
          </div>

          <!-- Dev Mode Connection Settings Shortcut -->
          ${isDev ? `
            <div style="text-align: center; margin-top: 8px;">
              <button type="button" id="btn-view-auth-open-config" style="background: none; border: none; font-size: 0.72rem; color: #f59e0b; cursor: pointer; text-decoration: underline;">
                ⚙️ Supabase Connection Settings
              </button>
            </div>
          ` : ''}
        </form>
      </div>
    `;

    this.bindEvents();
  }

  static bindEvents() {
    if (!this.container) return;

    // Google Sign-In Button
    const googleBtn = this.container.querySelector('#btn-view-auth-google');
    if (googleBtn) {
      googleBtn.addEventListener('click', async () => {
        await this.handleGoogleSignIn();
      });
    }

    // Tab buttons & switcher links
    const loginTabBtn = this.container.querySelector('#view-tab-auth-login');
    const signupTabBtn = this.container.querySelector('#view-tab-auth-signup');
    const switchToSignup = this.container.querySelector('#link-view-switch-to-signup');
    const switchToLogin = this.container.querySelector('#link-view-switch-to-login');

    if (loginTabBtn) {
      loginTabBtn.addEventListener('click', () => {
        SoundEngine.playTap();
        this.setTab('login');
      });
    }

    if (signupTabBtn) {
      signupTabBtn.addEventListener('click', () => {
        SoundEngine.playTap();
        this.setTab('signup');
      });
    }

    if (switchToSignup) {
      switchToSignup.addEventListener('click', (e) => {
        e.preventDefault();
        SoundEngine.playTap();
        this.setTab('signup');
      });
    }

    if (switchToLogin) {
      switchToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        SoundEngine.playTap();
        this.setTab('login');
      });
    }

    // Dev settings link
    const devConfigBtn = this.container.querySelector('#btn-view-auth-open-config');
    if (devConfigBtn) {
      devConfigBtn.addEventListener('click', () => {
        NavigationManager.openModal('modal-supabase-config');
      });
    }

    // Form submission
    const form = this.container.querySelector('#form-view-auth');
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
    const googleBtn = this.container.querySelector('#btn-view-auth-google');
    const googleText = this.container.querySelector('#text-view-auth-google');
    const submitBtn = this.container.querySelector('#btn-view-auth-submit');

    if (!supabaseService.isConfigured()) {
      SoundEngine.playAlert();
      this.showAlert('Supabase configuration is required for Google Sign-In.', 'error');
      return;
    }

    this.isSubmitting = true;
    if (googleBtn) googleBtn.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    if (googleText) googleText.textContent = 'Redirecting to Google...';
    SoundEngine.playTap();

    try {
      await supabaseService.signInWithGoogle();
      // Browser redirects to Google OAuth
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

  static async handleAuthSubmit() {
    if (this.isSubmitting) return;

    this.hideAlert();

    const submitBtn = this.container.querySelector('#btn-view-auth-submit');
    const emailInput = this.container.querySelector('#view-auth-email');
    const passwordInput = this.container.querySelector('#view-auth-password');
    const nameInput = this.container.querySelector('#view-auth-name');

    const email = emailInput?.value?.trim() || '';
    const password = passwordInput?.value || '';
    const fullName = nameInput?.value?.trim() || '';

    // Credential Validations
    if (!email || !email.includes('@') || !email.includes('.')) {
      SoundEngine.playAlert();
      this.showAlert('Please enter a valid email address.', 'error');
      return;
    }

    if (!password || password.length < 6) {
      SoundEngine.playAlert();
      this.showAlert('Password must be at least 6 characters.', 'error');
      return;
    }

    this.isSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = this.currentTab === 'login' ? 'Verifying credentials...' : 'Creating account...';
    }

    try {
      if (this.currentTab === 'signup') {
        const data = await supabaseService.signUp(email, password, fullName);

        if (data?.session && data?.user) {
          // Immediate session established
          stateManager.setAuthUser(data.user);
          SoundEngine.playSuccess();
          NavigationManager.updateAuthStateUI(true);
          const target = NavigationManager.intendedRoute || 'home';
          NavigationManager.switchTab(target);
          const displayName = fullName || data.user.user_metadata?.full_name || email.split('@')[0];
          NavigationManager.showToast(`🎉 Welcome to PocketPe, ${displayName}!`, 'success', 3500);
        } else if (data?.user) {
          // Email confirmation is required by Supabase project
          SoundEngine.playSuccess();
          this.showAlert('✅ Account created! Please check your email inbox to verify your account before logging in.', 'success');
        } else {
          this.showAlert('Account created. Please verify your email before logging in.', 'success');
        }
      } else {
        // Sign In Flow
        const data = await supabaseService.signIn(email, password);

        if (data?.user) {
          stateManager.setAuthUser(data.user);
          SoundEngine.playSuccess();
          NavigationManager.updateAuthStateUI(true);
          const target = NavigationManager.intendedRoute || 'home';
          NavigationManager.switchTab(target);
          const displayName = data.user.user_metadata?.full_name || email.split('@')[0];
          NavigationManager.showToast(`✨ Welcome back, ${displayName}!`, 'success', 3500);
        } else {
          SoundEngine.playAlert();
          this.showAlert('Unable to sign in. Please verify your email and password.', 'error');
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
        submitBtn.textContent = this.currentTab === 'login' ? 'Sign In with Email' : 'Create Account';
      }
    }
  }

  static showAlert(message, type = 'error') {
    const alertBox = this.container?.querySelector('#view-auth-alert');
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
    const alertBox = this.container?.querySelector('#view-auth-alert');
    if (alertBox) alertBox.style.display = 'none';
  }

  static formatAuthError(msg = '') {
    const lower = String(msg).toLowerCase();

    if (lower.includes('user already registered') || lower.includes('already registered') || lower.includes('email already in use')) {
      return 'An account with this email already exists. Please log in instead.';
    }
    if (lower.includes('password should be at least') || lower.includes('weak_password') || lower.includes('password must be at least')) {
      return 'Password must be at least 6 characters.';
    }
    if (lower.includes('invalid email') || lower.includes('unable to validate email')) {
      return 'Please enter a valid email address.';
    }
    if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
      return 'Incorrect email or password. Please verify your credentials.';
    }
    if (lower.includes('email not confirmed')) {
      return 'Your email address has not been confirmed yet. Please check your inbox for the verification link.';
    }
    if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('err_name_not_resolved') || lower.includes('connection failed')) {
      return 'Unable to reach authentication server. Please check your network connection.';
    }
    if (lower.includes('provider is not enabled') || lower.includes('unsupported provider') || lower.includes('provider not found')) {
      return 'Google sign-in is not enabled in your Supabase project (Authentication > Providers > Google).';
    }
    if (lower.includes('expired') || lower.includes('otp expired') || lower.includes('token has expired')) {
      return 'Verification link or session has expired. Please sign in or request a new link.';
    }
    return msg;
  }
}
