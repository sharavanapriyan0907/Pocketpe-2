/* ==========================================================================
   POCKETPE - NAVIGATION & MODAL CONTROLLER
   ========================================================================== */

import { stateManager } from '../state.js';
import { SoundEngine } from './sound.js';

export class NavigationManager {
  static intendedRoute = 'home';
  static PROTECTED_ROUTES = new Set(['home', 'wallets', 'pay', 'activity', 'profile', 'split']);

  static isProtectedRoute(tabId) {
    return this.PROTECTED_ROUTES.has(tabId);
  }

  static init() {
    this.setupTabNavigation();
    this.setupModalDismissals();
    this.setupStatusBarClock();
    this.setupHashRouting();
  }

  static setupHashRouting() {
    // Check initial hash in URL
    const initialHash = window.location.hash.replace(/^#/, '').trim();
    if (initialHash && this.isProtectedRoute(initialHash)) {
      this.intendedRoute = initialHash;
    }

    // Intercept address bar hash changes
    window.addEventListener('hashchange', () => {
      const target = window.location.hash.replace(/^#/, '').trim();
      if (target) {
        this.switchTab(target);
      }
    });
  }

  static setupTabNavigation() {
    const navItems = document.querySelectorAll('[data-nav-target]');
    navItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = item.getAttribute('data-nav-target');
        this.switchTab(targetView);
        SoundEngine.playTap();
      });
    });
  }

  static switchTab(tabId) {
    const isAuth = stateManager.isUserAuthenticated();

    // Centralized Route Guard: Unauthenticated users are redirected to login
    if (this.isProtectedRoute(tabId) && !isAuth) {
      this.intendedRoute = tabId;
      tabId = 'auth';
    } else if (tabId === 'auth' && isAuth) {
      // Authenticated users are redirected away from login to intended or home
      tabId = (this.intendedRoute && this.intendedRoute !== 'auth') ? this.intendedRoute : 'home';
    }

    stateManager.state.activeTab = tabId;

    // Update bottom nav bar items
    const navItems = document.querySelectorAll('[data-nav-target]');
    navItems.forEach((item) => {
      if (tabId !== 'auth' && item.getAttribute('data-nav-target') === tabId) {
        item.classList.add('active');
        item.setAttribute('aria-selected', 'true');
      } else {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
      }
    });

    // Update views visibility
    const views = document.querySelectorAll('.view-screen');
    views.forEach((view) => {
      if (view.id === `view-${tabId}`) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // Sync address bar URL hash
    if (window.location.hash !== `#${tabId}`) {
      window.history.replaceState(null, '', `#${tabId}`);
    }

    // Scroll container to top
    const phoneScreen = document.querySelector('.phone-screen');
    if (phoneScreen) {
      phoneScreen.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    stateManager.notify('tab:switched', tabId);
  }

  static updateAuthStateUI(isAuth) {
    if (isAuth) {
      document.body.classList.remove('unauthenticated');
      const authBtn = document.getElementById('btn-desktop-auth');
      const labelDesktopAuth = document.getElementById('label-desktop-auth');
      if (authBtn && labelDesktopAuth) {
        const user = stateManager.getState().user;
        const shortName = (user?.name || user?.email?.split('@')[0] || 'Account').split(' ')[0];
        authBtn.classList.add('active');
        labelDesktopAuth.textContent = shortName;
      }
    } else {
      document.body.classList.add('unauthenticated');
      const authBtn = document.getElementById('btn-desktop-auth');
      const labelDesktopAuth = document.getElementById('label-desktop-auth');
      if (authBtn && labelDesktopAuth) {
        authBtn.classList.remove('active');
        labelDesktopAuth.textContent = 'Sign In';
      }
    }
  }

  static setupModalDismissals() {
    // Backdrop click dismisses modal
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.closeModal(overlay.id);
        }
      });
    });

    // Close button dismisses modal
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const modalId = btn.getAttribute('data-close-modal') || btn.closest('.modal-overlay')?.id;
        if (modalId) {
          this.closeModal(modalId);
        }
      });
    });

    // ESC key closes active modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeTopModal();
      }
    });
  }

  static openModal(modalId) {
    const isAuth = stateManager.isUserAuthenticated();
    const publicModals = ['modal-auth', 'modal-supabase-config'];

    if (!publicModals.includes(modalId) && !isAuth) {
      this.switchTab('auth');
      this.showToast('Please sign in to access this feature', 'warning');
      return;
    }

    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      SoundEngine.playTap();
    }
  }

  static closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  static closeTopModal() {
    const activeModals = document.querySelectorAll('.modal-overlay.active');
    if (activeModals.length > 0) {
      const topModal = activeModals[activeModals.length - 1];
      this.closeModal(topModal.id);
    }
  }

  static showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'danger') icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  static setupStatusBarClock() {
    const clockEl = document.getElementById('status-bar-clock');
    if (!clockEl) return;

    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      // Format 9:41 style or current 24hr/12hr
      clockEl.textContent = `${hours}:${minutes}`;
    };

    updateTime();
    setInterval(updateTime, 10000);
  }
}
