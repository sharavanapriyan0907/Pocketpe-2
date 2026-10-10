/* ==========================================================================
   POCKETPE - NAVIGATION & MODAL CONTROLLER
   Unified In-App Navigation, Centralized Auth Guards,
   and Native Android / Browser History Back-Stack Synchronization
   ========================================================================== */

import { stateManager } from '../state.js';
import { SoundEngine } from './sound.js';

export class NavigationManager {
  static intendedRoute = 'home';
  static currentRoute = 'home';
  static currentModal = null;
  static currentDepth = 0;
  static isApplyingPopState = false;

  static PROTECTED_ROUTES = new Set([
    'home',
    'balance',
    'wallets',
    'split',
    'pay',
    'activity',
    'profile',
  ]);

  static isProtectedRoute(tabId) {
    return this.PROTECTED_ROUTES.has(tabId);
  }

  static init() {
    this.setupHistoryRouting();
    this.setupTabNavigation();
    this.setupModalDismissals();
    this.setupStatusBarClock();
  }

  static setupHashRouting() {
    return this.setupHistoryRouting();
  }

  static setupHistoryRouting() {
    const isAuth = stateManager.isUserAuthenticated();
    const rawHash = window.location.hash.replace(/^#/, '').trim();
    const hashParts = rawHash ? rawHash.split('/') : [];
    let initialRoute = hashParts[0] || 'home';
    let initialModal = hashParts[1] || null;

    if (!isAuth) {
      if (this.isProtectedRoute(initialRoute)) {
        this.intendedRoute = initialRoute;
      }
      initialRoute = 'auth';
      initialModal = null;
    } else if (initialRoute === 'auth') {
      initialRoute = 'home';
      initialModal = null;
    } else if (!this.isProtectedRoute(initialRoute)) {
      initialRoute = 'home';
    }

    this.currentRoute = initialRoute;
    this.currentModal = initialModal;

    // Direct navigation / refresh on a nested route:
    // If an authenticated user lands directly on a non-home tab (e.g. #profile or #balance),
    // set up home at depth 0 so pressing Android back returns to Home instead of exiting!
    if (isAuth && initialRoute !== 'home') {
      window.history.replaceState({ route: 'home', modal: null, depth: 0 }, '', '#home');
      this.currentDepth = 1;
      const targetHash = initialModal ? `#${initialRoute}/${initialModal}` : `#${initialRoute}`;
      window.history.pushState(
        { route: initialRoute, modal: initialModal, depth: 1 },
        '',
        targetHash
      );
    } else {
      this.currentDepth = 0;
      const targetHash = initialModal ? `#${initialRoute}/${initialModal}` : `#${initialRoute}`;
      window.history.replaceState(
        { route: initialRoute, modal: initialModal, depth: 0 },
        '',
        targetHash
      );
    }

    this.applyTabDOM(initialRoute);
    if (initialModal) {
      this.openModalDOM(initialModal);
    }

    // Android Hardware / Gesture Back Button & Browser Back/Forward
    window.addEventListener('popstate', (e) => {
      this.handlePopState(e);
    });

    // Hash change fallback
    window.addEventListener('hashchange', () => {
      if (this.isApplyingPopState) return;
      const raw = window.location.hash.replace(/^#/, '').trim();
      const parts = raw.split('/');
      const targetRoute = parts[0];
      if (targetRoute && targetRoute !== this.currentRoute) {
        this.switchTab(targetRoute);
      }
    });
  }

  static handlePopState(e) {
    this.isApplyingPopState = true;
    try {
      const isAuth = stateManager.isUserAuthenticated();
      const state = e.state || {};

      // 1. Mandatory authentication check:
      // If user is logged out, NEVER allow back button to expose protected views or modals!
      if (!isAuth) {
        this.closeAllModalsDirectly();
        this.applyTabDOM('auth');
        this.currentRoute = 'auth';
        this.currentModal = null;
        this.currentDepth = 0;
        return;
      }

      const targetRoute =
        state.route && this.isProtectedRoute(state.route) ? state.route : 'home';
      const targetModal = state.modal || null;
      this.currentDepth = typeof state.depth === 'number' ? state.depth : 0;

      // 2. Synchronize Modals:
      const activeModals = document.querySelectorAll('.modal-overlay.active');
      activeModals.forEach((m) => {
        if (m.id !== targetModal) {
          m.classList.remove('active');
          m.setAttribute('aria-hidden', 'true');
        }
      });

      if (targetModal) {
        const modalEl = document.getElementById(targetModal);
        if (modalEl) {
          modalEl.classList.add('active');
          modalEl.setAttribute('aria-hidden', 'false');
        }
      }
      this.currentModal = targetModal;

      // 3. Synchronize Tab Views:
      if (targetRoute !== this.currentRoute) {
        this.currentRoute = targetRoute;
        this.applyTabDOM(targetRoute);
        stateManager.state.activeTab = targetRoute;
        this.scrollToTop();
        stateManager.notify('tab:switched', targetRoute);
      }
    } finally {
      this.isApplyingPopState = false;
    }
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

  static switchTab(tabId, options = {}) {
    const isAuth = stateManager.isUserAuthenticated();

    // Centralized Route Guard
    if (this.isProtectedRoute(tabId) && !isAuth) {
      this.intendedRoute = tabId;
      tabId = 'auth';
    } else if (tabId === 'auth' && isAuth) {
      tabId =
        this.intendedRoute && this.intendedRoute !== 'auth' ? this.intendedRoute : 'home';
    }

    // Always close open modals when switching tabs
    this.closeAllModalsDirectly();
    this.currentModal = null;

    if (this.currentRoute === tabId && !options.force) {
      this.scrollToTop();
      return;
    }

    this.currentRoute = tabId;
    stateManager.state.activeTab = tabId;
    this.applyTabDOM(tabId);
    this.scrollToTop();

    if (!options.fromPopState) {
      this.currentDepth++;
      window.history.pushState(
        { route: tabId, modal: null, depth: this.currentDepth },
        '',
        `#${tabId}`
      );
    }

    stateManager.notify('tab:switched', tabId);
  }

  static applyTabDOM(tabId) {
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
  }

  static scrollToTop() {
    const phoneScreen = document.querySelector('.phone-screen');
    if (phoneScreen) {
      phoneScreen.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  static openModalDOM(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
    }
  }

  static closeAllModalsDirectly() {
    const activeModals = document.querySelectorAll('.modal-overlay.active');
    activeModals.forEach((m) => {
      m.classList.remove('active');
      m.setAttribute('aria-hidden', 'true');
    });
    this.currentModal = null;
  }

  static updateAuthStateUI(isAuth) {
    if (isAuth) {
      document.body.classList.remove('unauthenticated');
      const authBtn = document.getElementById('btn-desktop-auth');
      const labelDesktopAuth = document.getElementById('label-desktop-auth');
      if (authBtn && labelDesktopAuth) {
        const user = stateManager.getState().user;
        const shortName = (
          user?.name ||
          user?.email?.split('@')[0] ||
          'Account'
        ).split(' ')[0];
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
        const modalId =
          btn.getAttribute('data-close-modal') || btn.closest('.modal-overlay')?.id;
        if (modalId) {
          this.closeModal(modalId);
        }
      });
    });

    // Universal In-App Back Navigation buttons ([data-back-nav])
    document.addEventListener('click', (e) => {
      const backBtn = e.target.closest('[data-back-nav]');
      if (backBtn) {
        e.preventDefault();
        this.goBack();
      }
    });

    // ESC key closes active modal or goes back
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.currentModal) {
          this.closeModal(this.currentModal);
        }
      }
    });
  }

  /**
   * Universal in-app back navigation
   */
  static goBack() {
    SoundEngine.playTap();
    if (this.currentModal) {
      this.closeModal(this.currentModal);
    } else if (window.history.length > 1 && this.currentDepth > 0) {
      window.history.back();
    } else {
      if (this.currentRoute !== 'home' && stateManager.isUserAuthenticated()) {
        this.switchTab('home');
      }
    }
  }

  static openModal(modalId) {
    const options = arguments[1] || {};
    const isAuth = stateManager.isUserAuthenticated();
    const publicModals = ['modal-auth', 'modal-supabase-config'];

    if (!publicModals.includes(modalId) && !isAuth) {
      this.switchTab('auth');
      this.showToast('Please sign in to access this feature', 'warning');
      return;
    }

    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    this.currentModal = modalId;
    SoundEngine.playTap();

    if (!options.fromPopState) {
      this.currentDepth++;
      const currentRoute = this.currentRoute || 'home';
      window.history.pushState(
        { route: currentRoute, modal: modalId, depth: this.currentDepth },
        '',
        `#${currentRoute}/${modalId}`
      );
    }
  }

  static closeModal(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }

    if (this.currentModal === modalId) {
      this.currentModal = null;
    }

    // If modal is at the top of browser history, pop history state to keep history stack in sync
    if (!options.fromPopState && !options.withoutHistory && window.history.state?.modal === modalId) {
      window.history.back();
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
      clockEl.textContent = `${hours}:${minutes}`;
    };

    updateTime();
    setInterval(updateTime, 10000);
  }
}
