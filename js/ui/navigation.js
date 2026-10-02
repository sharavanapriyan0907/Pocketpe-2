/* ==========================================================================
   POCKETPE - NAVIGATION & MODAL CONTROLLER
   ========================================================================== */

import { stateManager } from '../state.js';
import { SoundEngine } from './sound.js';

export class NavigationManager {
  static init() {
    this.setupTabNavigation();
    this.setupModalDismissals();
    this.setupStatusBarClock();
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
    stateManager.state.activeTab = tabId;

    // Update bottom nav bar items
    const navItems = document.querySelectorAll('[data-nav-target]');
    navItems.forEach((item) => {
      if (item.getAttribute('data-nav-target') === tabId) {
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

    // Scroll phone screen container to top
    const phoneScreen = document.querySelector('.phone-screen');
    if (phoneScreen) {
      phoneScreen.scrollTo({ top: 0, behavior: 'smooth' });
    }

    stateManager.notify('tab:switched', tabId);
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
