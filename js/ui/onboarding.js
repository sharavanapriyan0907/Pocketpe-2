/* ==========================================================================
   POCKETPE - ONBOARDING TOUR CONTROLLER
   5-step visual introduction: "Give every rupee a purpose."
   ========================================================================== */

import { APP_CONFIG } from '../config.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';

export class OnboardingManager {
  static STEPS = [
    {
      icon: '🎯',
      title: 'Give every rupee a purpose.',
      desc: 'Instead of staring at one confusing balance, divide your money into clear virtual purpose wallets like Food, Rent, Savings, and Friends.',
    },
    {
      icon: '🏦',
      title: 'No extra bank accounts needed.',
      desc: 'All your funds remain in your single existing bank account. PocketPe gives you a powerful virtual mental layer on top of it.',
    },
    {
      icon: '🌊',
      title: 'Automatically split incoming money.',
      desc: 'When salary or pocket money arrives, PocketPe instantly cascades funds into your target wallets according to your rules.',
    },
    {
      icon: '⚡',
      title: 'Pay from the right wallet.',
      desc: 'Scan any QR code. Our smart engine identifies the merchant and suggests the right wallet so you never spend reserved savings.',
    },
    {
      icon: '🛡️',
      title: 'Stay completely protected.',
      desc: 'If a wallet runs low, PocketPe calmly shields you and offers gentle cushions from Free Money instead of frightening errors.',
    },
  ];

  static init() {
    this.modal = document.getElementById('modal-onboarding');
    this.currentStep = 0;

    const hasOnboarded = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.HAS_ONBOARDED);
    if (!hasOnboarded) {
      setTimeout(() => this.open(), 400);
    }
  }

  static open() {
    this.currentStep = 0;
    this.render();
    NavigationManager.openModal('modal-onboarding');
  }

  static render() {
    if (!this.modal) return;
    const body = this.modal.querySelector('.sheet-body');
    const footer = this.modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    const step = this.STEPS[this.currentStep];
    const isLast = this.currentStep === this.STEPS.length - 1;

    body.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-illustration">
          ${step.icon}
        </div>
        <h3 class="onboarding-title">${step.title}</h3>
        <p class="onboarding-desc">${step.desc}</p>
        
        <div class="onboarding-dots">
          ${this.STEPS.map((_, idx) => `
            <div class="dot ${idx === this.currentStep ? 'active' : ''}"></div>
          `).join('')}
        </div>
      </div>
    `;

    footer.innerHTML = `
      <button class="btn btn-primary" id="btn-onboarding-next">
        ${isLast ? "Let's set up your money ✨" : 'Next →'}
      </button>
      ${!isLast ? '<button class="btn btn-ghost btn-sm" id="btn-onboarding-skip">Skip Tour</button>' : ''}
    `;

    // Next / Finish
    footer.querySelector('#btn-onboarding-next').addEventListener('click', () => {
      SoundEngine.playTap();
      if (isLast) {
        this.finish();
      } else {
        this.currentStep++;
        this.render();
      }
    });

    // Skip
    const skipBtn = footer.querySelector('#btn-onboarding-skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        this.finish();
      });
    }
  }

  static finish() {
    localStorage.setItem(APP_CONFIG.STORAGE_KEYS.HAS_ONBOARDED, 'true');
    SoundEngine.playSuccess();
    NavigationManager.closeModal('modal-onboarding');
    NavigationManager.showToast('Welcome to PocketPe! Every rupee has a purpose.', 'success');
  }
}
