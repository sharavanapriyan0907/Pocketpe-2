/* ==========================================================================
   POCKETPE - SMART PAYMENT & LIVE QR SCANNER CONTROLLER
   Supports physical device camera QR scanning (WebRTC + BarcodeDetector / jsQR),
   UPI QR URI parsing (upi://pay?pa=...&pn=...&mc=...), image upload, and
   purpose-based wallet auto-recommendation with Payment Protection Shield.
   ========================================================================== */

import { stateManager } from '../state.js';
import { DEMO_MERCHANTS } from '../config.js';
import { CategoryEngine } from '../engines/categoryEngine.js';
import { WalletEngine } from '../engines/walletEngine.js';
import { TransactionEngine } from '../engines/transactionEngine.js';
import { FraudEngine, RISK_LEVELS } from '../engines/fraudEngine.js';
import { UpiQrEngine, parseUpiQr, getCategoryFromMcc, getPocketPeCategory, getWalletForCategory, MCC_CATEGORY_MAP } from '../engines/upiQrEngine.js';
import { supabaseService } from '../services/supabaseService.js';
import { FraudModal } from './fraudModal.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';
import { devModeService } from '../services/devModeService.js';

export class PayView {
  static container = null;
  static currentPaymentData = null;
  static selectedWalletId = null;
  static pendingCategoryChange = null;

  // Live Camera state
  static stream = null;
  static isScanning = false;
  static scanAnimFrame = null;
  static facingMode = 'environment'; // 'environment' (back) or 'user' (front)
  static barcodeDetector = null;
  static isCameraInitializing = false;

  static init() {
    this.container = document.getElementById('view-pay');
    this.currentPaymentData = null;
    this.selectedWalletId = null;
    this.pendingCategoryChange = null;

    if (!this.container) return;

    this.initBarcodeDetector();
    this.render();

    // Re-render when community reports or appeals update
    stateManager.subscribe('fraud:reported', () => this.render());
    stateManager.subscribe('fraud:appealed', () => this.render());
    stateManager.subscribe('devmode:changed', () => this.render());

    // Lifecycle: Stop camera when leaving 'pay' tab, auto-start camera on entering 'pay' tab
    stateManager.subscribe('tab:switched', (tabId) => {
      if (tabId === 'pay') {
        this.startCamera();
      } else {
        this.stopCamera();
      }
    });
  }

  static async initBarcodeDetector() {
    if ('BarcodeDetector' in window) {
      try {
        const supported = await BarcodeDetector.getSupportedFormats();
        if (supported.includes('qr_code')) {
          this.barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
          console.log('⚡ Native BarcodeDetector enabled for QR scanning');
        }
      } catch (e) {
        console.warn('BarcodeDetector format check error:', e);
      }
    }
  }

  static render() {
    if (!this.container) return;

    const isDev = devModeService.isDevMode();

    this.container.innerHTML = `
      <div class="section-header">
        <h2 class="h2">Scan & Pay</h2>
        ${isDev
          ? '<span class="dev-mode-pill">🛠️ Dev Mode</span>'
          : '<span class="badge badge-success" style="font-size: 0.65rem;">● UPI 2.0 Ready</span>'}
      </div>

      <div class="pay-responsive-grid">
        <div class="pay-camera-pane">
          <!-- Live QR Scanner Viewport -->
          <div class="scanner-viewfinder" id="scanner-box">
            <!-- Live Video Element -->
            <video id="camera-stream" class="camera-stream-video" autoplay playsinline muted></video>

            <!-- Offline / Permission Prompt Overlay -->
            <div class="camera-offline-view" id="camera-offline-prompt">
              <div style="font-size: 2.2rem; margin-bottom: 2px;">📷</div>
              <div style="font-weight: 700; font-size: var(--text-sm); color: var(--text-primary);">Live QR Camera</div>
              <p style="font-size: 0.75rem; color: var(--text-muted); max-width: 220px; line-height: 1.4;">
                Point at any real UPI QR code (Google Pay, PhonePe, Paytm, BharatPe)
              </p>
              <button class="btn btn-sm btn-primary" id="btn-start-camera-overlay" style="width: auto; padding: 7px 18px; margin-top: 6px;">
                ⚡ Turn Camera On
              </button>
            </div>

            <!-- Camera Status Indicator -->
            <div class="camera-status-pill" id="camera-status">
              <span class="camera-status-dot" id="camera-status-dot"></span>
              <span id="camera-status-text">Camera Ready</span>
            </div>

            <!-- Animated Scanner HUD Box -->
            <div class="scanner-grid"></div>
            <div class="scanner-box">
              <div class="scan-corner top-left"></div>
              <div class="scan-corner top-right"></div>
              <div class="scan-corner bottom-left"></div>
              <div class="scan-corner bottom-right"></div>
              <div class="laser-beam"></div>
            </div>
            <div class="scanner-hint" id="scanner-hint-text">Align QR code inside frame</div>

            <!-- Hidden canvas for pixel extraction -->
            <canvas id="qr-scan-canvas" style="display: none;"></canvas>
            <input type="file" id="input-qr-file" accept="image/*" style="display: none;" />
          </div>

          <!-- Live Camera & UPI Controls Row -->
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 12px;">
            <button class="btn btn-secondary btn-sm" id="btn-toggle-camera" title="Start or Stop Live Camera">
              <span>📷</span> <span>Camera</span>
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-flip-camera" title="Switch Front/Back Camera">
              <span>🔄</span> <span>Flip</span>
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-upload-qr" title="Scan QR Code from Photo / Gallery">
              <span>🖼️</span> <span>Upload</span>
            </button>
          </div>

          <!-- Custom UPI / Manual Entry Button -->
          <button class="btn btn-secondary btn-sm" id="btn-custom-qr-input" style="width: 100%; margin-top: 10px;">
            <span>✏️</span> <span>Custom Pay / Paste UPI ID / Link</span>
          </button>
        </div>

        <div class="pay-merchants-pane">
          <!-- Quick UPI Merchants / Contacts -->
          <div class="demo-merchants-section">
            <div class="title" style="display: flex; justify-content: space-between; align-items: center;">
              <span>${isDev ? 'Demo QR Merchants (Instant Test):' : 'Recent UPI Payees'}</span>
              <span style="font-size: 0.72rem; color: var(--text-muted);">${isDev ? 'Tap to simulate' : 'Tap to pay'}</span>
            </div>
            <div class="merchants-scroll-list">
              ${DEMO_MERCHANTS.map((m) => {
                const risk = FraudEngine.evaluateUpiRisk(m.upiId);
                const isHigh = risk.level === RISK_LEVELS.HIGH;
                const isCaution = risk.level === RISK_LEVELS.CAUTION;

                return `
                <div class="merchant-item-card ${isHigh ? 'merchant-item-card-risk' : ''}" data-merchant-id="${m.id}">
                  <div class="merchant-info">
                    <div class="merchant-avatar">${m.icon}</div>
                    <div class="merchant-meta">
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <h4>${m.name}</h4>
                        ${isHigh || isCaution ? FraudModal.renderRiskBadgeHtml(m.upiId, false) : ''}
                      </div>
                      <p>${m.category} • <span class="mono" style="font-size: 0.7rem;">${m.upiId || ''}</span></p>
                    </div>
                  </div>
                  <div class="merchant-amount-tag">
                    ${WalletEngine.formatRupee(m.defaultAmount)}
                  </div>
                </div>
              `;
              }).join('')}
            </div>
          </div>

          <!-- Insufficient Balance Test Shortcut (DEVELOPER MODE ONLY) -->
          ${isDev ? `
            <div class="card" style="padding: 12px 16px; background: rgba(245, 158, 11, 0.05); border: 1.5px dashed #f59e0b; display: flex; align-items: center; justify-content: space-between; margin-top: 12px;">
              <div>
                <div style="font-size: var(--text-xs); font-weight: 700; color: #f59e0b;">🧪 Test Payment Protection Shield</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">Force deficit: pay ₹2,500 from Transport (low balance)</div>
              </div>
              <button class="btn btn-sm btn-secondary" id="btn-test-deficit" style="width: auto;">Test Shield</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  static bindEvents() {
    // 1. Merchant list tap (simulates real UPI QR scan payload)
    const cards = this.container.querySelectorAll('.merchant-item-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const mId = card.getAttribute('data-merchant-id');
        const merchant = DEMO_MERCHANTS.find((m) => m.id === mId);
        if (merchant) {
          SoundEngine.playTap();
          const mccParam = merchant.mcc ? `&mc=${merchant.mcc}` : '';
          const amParam = merchant.defaultAmount ? `&am=${merchant.defaultAmount}` : '';
          const qrPayload = `upi://pay?pa=${merchant.upiId}&pn=${encodeURIComponent(merchant.name)}${mccParam}${amParam}&cu=INR`;
          this.handleScannedQrPayload(qrPayload);
        }
      });
    });

    // 2. Camera Toggle button
    const toggleCameraBtn = document.getElementById('btn-toggle-camera');
    if (toggleCameraBtn) {
      toggleCameraBtn.addEventListener('click', () => {
        if (this.stream) {
          this.stopCamera();
        } else {
          this.startCamera();
        }
      });
    }

    // 3. Camera Start overlay button
    const overlayStartBtn = document.getElementById('btn-start-camera-overlay');
    if (overlayStartBtn) {
      overlayStartBtn.addEventListener('click', () => {
        this.startCamera();
      });
    }

    // 4. Flip camera button
    const flipBtn = document.getElementById('btn-flip-camera');
    if (flipBtn) {
      flipBtn.addEventListener('click', () => {
        this.flipCamera();
      });
    }

    // 5. Upload QR image button
    const uploadBtn = document.getElementById('btn-upload-qr');
    const fileInput = document.getElementById('input-qr-file');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => {
        fileInput.click();
      });
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleQrImageUpload(e.target.files[0]);
          e.target.value = ''; // reset
        }
      });
    }

    // 6. Custom Merchant / UPI input trigger
    const customBtn = document.getElementById('btn-custom-qr-input');
    if (customBtn) {
      customBtn.addEventListener('click', () => {
        this.openCustomMerchantPrompt();
      });
    }

    // 7. Test Deficit button
    const testDeficitBtn = document.getElementById('btn-test-deficit');
    if (testDeficitBtn) {
      testDeficitBtn.addEventListener('click', () => {
        this.initiatePaymentFlow({
          merchantName: 'Shell Super Highway Petrol',
          amount: 2500, // Transport wallet typically has ₹800
          category: 'Transport & Fuel',
          icon: '⛽',
          upiId: 'shell.petrol@paytm',
          mcc: '5541',
        });
      });
    }
  }

  // --- Live Camera Management ---

  static async startCamera() {
    if (this.stream || this.isCameraInitializing) return;

    this.isCameraInitializing = true;
    const video = document.getElementById('camera-stream');
    const offlinePrompt = document.getElementById('camera-offline-prompt');
    const statusText = document.getElementById('camera-status-text');
    const statusDot = document.getElementById('camera-status-dot');
    const toggleBtn = document.getElementById('btn-toggle-camera');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.isCameraInitializing = false;
      if (statusText) statusText.textContent = 'Camera Unsupported';
      if (offlinePrompt) {
        offlinePrompt.style.display = 'flex';
        offlinePrompt.innerHTML = `
          <div style="font-size: 2rem;">📷</div>
          <div style="font-weight: 700; color: var(--text-primary);">Camera API Not Available</div>
          <p style="font-size: 0.75rem; color: var(--text-muted); max-width: 240px;">
            Browser camera access is unavailable in this environment. Use <strong>Upload QR</strong> or <strong>Custom Pay</strong> below.
          </p>
        `;
      }
      return;
    }

    try {
      if (statusText) statusText.textContent = 'Connecting...';
      const constraints = {
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.stream = stream;

      if (video) {
        video.srcObject = stream;
        video.classList.add('active');
        await video.play().catch(() => {});
      }

      if (offlinePrompt) offlinePrompt.style.display = 'none';
      if (statusText) statusText.textContent = 'Camera Live';
      if (statusDot) {
        statusDot.style.background = '#10b981';
        statusDot.style.boxShadow = '0 0 8px #10b981';
      }
      if (toggleBtn) {
        toggleBtn.innerHTML = '<span>⏹️</span> <span>Stop</span>';
        toggleBtn.classList.add('btn-primary');
        toggleBtn.classList.remove('btn-secondary');
      }

      this.isScanning = true;
      this.scanLoop();
      NavigationManager.showToast('Camera active. Scan any UPI QR.', 'info');
    } catch (err) {
      console.warn('Camera start error:', err);
      this.stream = null;

      if (statusText) statusText.textContent = 'Camera Blocked';
      if (statusDot) {
        statusDot.style.background = '#ef4444';
        statusDot.style.boxShadow = '0 0 8px #ef4444';
      }
      if (offlinePrompt) {
        offlinePrompt.style.display = 'flex';
        offlinePrompt.innerHTML = `
          <div style="font-size: 2rem;">🚫</div>
          <div style="font-weight: 700; color: var(--text-primary); font-size: var(--text-sm);">Camera Access Denied</div>
          <p style="font-size: 0.75rem; color: var(--text-muted); max-width: 240px; line-height: 1.4;">
            Please allow camera permissions in your browser, or use <strong>Upload Image</strong> / <strong>Custom Pay</strong>.
          </p>
          <button class="btn btn-sm btn-primary" id="btn-retry-camera-perm" style="width: auto; padding: 6px 16px; margin-top: 4px;">
            🔄 Retry Camera
          </button>
        `;
        offlinePrompt.querySelector('#btn-retry-camera-perm')?.addEventListener('click', () => {
          this.startCamera();
        });
      }
    } finally {
      this.isCameraInitializing = false;
    }
  }

  static stopCamera() {
    this.isScanning = false;
    if (this.scanAnimFrame) {
      cancelAnimationFrame(this.scanAnimFrame);
      this.scanAnimFrame = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    const video = document.getElementById('camera-stream');
    if (video) {
      video.pause();
      video.srcObject = null;
      video.classList.remove('active');
    }

    const offlinePrompt = document.getElementById('camera-offline-prompt');
    if (offlinePrompt) {
      offlinePrompt.style.display = 'flex';
      offlinePrompt.innerHTML = `
        <div style="font-size: 2.2rem; margin-bottom: 2px;">📷</div>
        <div style="font-weight: 700; font-size: var(--text-sm); color: var(--text-primary);">Live QR Camera</div>
        <p style="font-size: 0.75rem; color: var(--text-muted); max-width: 220px; line-height: 1.4;">
          Point at any real UPI QR code (Google Pay, PhonePe, Paytm, BharatPe)
        </p>
        <button class="btn btn-sm btn-primary" id="btn-start-camera-overlay" style="width: auto; padding: 7px 18px; margin-top: 6px;">
          ⚡ Turn Camera On
        </button>
      `;
      offlinePrompt.querySelector('#btn-start-camera-overlay')?.addEventListener('click', () => {
        this.startCamera();
      });
    }

    const statusText = document.getElementById('camera-status-text');
    if (statusText) statusText.textContent = 'Camera Off';

    const statusDot = document.getElementById('camera-status-dot');
    if (statusDot) {
      statusDot.style.background = '#64748b';
      statusDot.style.boxShadow = 'none';
    }

    const toggleBtn = document.getElementById('btn-toggle-camera');
    if (toggleBtn) {
      toggleBtn.innerHTML = '<span>📷</span> <span>Camera</span>';
      toggleBtn.classList.remove('btn-primary');
      toggleBtn.classList.add('btn-secondary');
    }
  }

  static async flipCamera() {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    if (this.stream) {
      this.stopCamera();
      await this.startCamera();
      NavigationManager.showToast(`Camera switched to ${this.facingMode === 'environment' ? 'Rear' : 'Front'}`, 'info');
    } else {
      NavigationManager.showToast(`Camera mode set to ${this.facingMode === 'environment' ? 'Rear' : 'Front'}`, 'info');
    }
  }

  // --- Real-Time Frame QR Detection Loop ---

  static async scanLoop() {
    if (!this.isScanning || !this.stream) return;

    const video = document.getElementById('camera-stream');
    if (!video || video.readyState < 2) {
      this.scanAnimFrame = requestAnimationFrame(() => this.scanLoop());
      return;
    }

    let detectedRaw = null;

    // Fast Path A: Hardware BarcodeDetector
    if (this.barcodeDetector) {
      try {
        const barcodes = await this.barcodeDetector.detect(video);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          detectedRaw = barcodes[0].rawValue;
        }
      } catch (e) {
        // Fall back to jsQR
      }
    }

    // Path B: jsQR Canvas fallback
    if (!detectedRaw && window.jsQR) {
      const canvas = document.getElementById('qr-scan-canvas') || document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw > 0 && vh > 0) {
        let targetW = vw;
        let targetH = vh;
        const maxDim = 960;
        if (targetW > maxDim || targetH > maxDim) {
          const ratio = Math.min(maxDim / targetW, maxDim / targetH);
          targetW = Math.floor(targetW * ratio);
          targetH = Math.floor(targetH * ratio);
        }
        canvas.width = targetW;
        canvas.height = targetH;
        ctx.drawImage(video, 0, 0, targetW, targetH);
        const imgData = ctx.getImageData(0, 0, targetW, targetH);
        const code = window.jsQR(imgData.data, targetW, targetH, {
          inversionAttempts: 'attemptBoth',
        });
        if (code && code.data) {
          detectedRaw = code.data;
        }
      }
    }

    if (detectedRaw) {
      this.handleScannedQrPayload(detectedRaw);
      return;
    }

    // Loop next animation frame
    this.scanAnimFrame = requestAnimationFrame(() => this.scanLoop());
  }

  // --- QR Payload Processing ---

  // --- QR Payload Processing & Decision Tree ---

  static async handleScannedQrPayload(rawPayload) {
    if (!rawPayload) return;

    // STEP 2: Decode payload using parseUpiQr
    const upiResult = parseUpiQr(rawPayload);

    if (!upiResult.isUpi) {
      NavigationManager.showToast(upiResult.error || 'This QR is not a supported UPI payment QR.', 'warning');
      setTimeout(() => {
        if (this.stream) {
          this.isScanning = true;
          this.scanLoop();
        }
      }, 2500);
      return;
    }

    // Pause scanning & stop camera to preserve battery and privacy while reviewing
    this.stopCamera();
    SoundEngine.playSuccess();
    if (navigator.vibrate) {
      navigator.vibrate(120);
    }

    const pa = upiResult.pa;
    const pn = upiResult.pn || pa.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const mc = upiResult.mc || null;
    const amount = upiResult.amount || null;

    // STEP 10: Strict Decision Tree Execution
    await this.processUpiPaymentDecision({
      rawPayload,
      pa,
      pn,
      mc,
      amount,
    });
  }

  /**
   * STEP 10: Decision Tree:
   * QR -> Is UPI? -> Extract pa/pn/mc -> Valid MCC?
   * YES: MCC -> Category -> Wallet -> Suggest wallet ("Based on merchant category.")
   * NO: Check merchant_preferences by user_id + upi_id
   *     Previous wallet?
   *       YES: Suggest it ("Based on your previous choice.")
   *       NO: Ask user "Where should payments to {Name} go?", save choice, then proceed.
   */
  static async processUpiPaymentDecision({ rawPayload, pa, pn, mc, amount = null }) {
    const userId = stateManager.getUserId();
    const allWallets = stateManager.getWallets();

    // STAGE 2: MCC Category Detection
    const merchantCategory = getCategoryFromMcc(mc);

    // DECISION BRANCH 1: Valid MCC exists!
    if (merchantCategory) {
      // STAGE 3: Translate merchant category to PocketPe internal category
      const pocketPeCategory = getPocketPeCategory(merchantCategory);
      // STAGE 4: Category → Wallet mapping
      const walletMatch = getWalletForCategory(pocketPeCategory, allWallets);
      const suggestedWallet = walletMatch.wallet;
      const categoryIcon = MCC_CATEGORY_MAP[mc]?.icon || '🏷️';
      const reason = 'Based on the merchant category.';

      // Dev logging (never logs passwords, PINs, or sensitive tokens)
      console.log('🔍 [PocketPe Dev QR Scan]', {
        'raw QR detected': rawPayload,
        'is UPI': true,
        pa,
        pn,
        mc,
        amount: amount || 'Not specified',
        'merchant category': merchantCategory,
        'pocketpe category': pocketPeCategory,
        'suggested wallet': suggestedWallet ? suggestedWallet.name : 'None',
        source: 'mcc',
      });

      if (suggestedWallet) {
        // Merchant QR flow with suggested wallet
        this.showSuggestedWalletModal({
          merchantName: pn,
          upiId: pa,
          mcc: mc,
          category: pocketPeCategory,
          icon: categoryIcon,
          suggestedWallet,
          reason,
          amount,
          isPersonal: false,
        });
      } else {
        // "No matching wallet found." -> allow manual wallet selection
        NavigationManager.showToast('No matching wallet found.', 'info');
        this.showWalletSelectionPrompt({
          merchantName: pn,
          upiId: pa,
          mcc: mc,
          category: pocketPeCategory,
          icon: categoryIcon,
          amount,
          promptText: `No matching wallet found for ${pocketPeCategory}. Choose a wallet:`,
          isPersonal: false,
          isFirstTime: false,
          askRemember: false,
        });
      }
      return;
    }

    // DECISION BRANCH 2: mc exists but is not in our mapping (Unknown Merchant Category)
    const isUnknownMcc = mc && mc !== '0000' && mc !== '0';

    if (isUnknownMcc) {
      // Check if user previously saved a wallet preference for this merchant
      const existingPref = await supabaseService.getMerchantPreference(userId, pa);
      if (existingPref && existingPref.walletId) {
        const savedWallet = allWallets.find((w) => w.id === existingPref.walletId) || stateManager.getWallet(existingPref.walletId);
        if (savedWallet) {
          console.log('🔍 [PocketPe Dev QR Scan]', {
            'raw QR detected': rawPayload,
            'is UPI': true,
            pa,
            pn,
            mc,
            amount: amount || 'Not specified',
            'detected category': existingPref.category || 'Merchant',
            'suggested wallet': savedWallet.name,
            source: 'merchant_preferences',
          });

          this.showSuggestedWalletModal({
            merchantName: pn,
            upiId: pa,
            mcc: mc,
            category: existingPref.category || 'Merchant',
            icon: savedWallet.icon || '🏪',
            suggestedWallet: savedWallet,
            reason: 'Based on your previous choice.',
            amount,
            isPersonal: false,
          });
          return;
        }
      }

      // STEP 9: Unknown Merchant Category
      console.log('🔍 [PocketPe Dev QR Scan]', {
        'raw QR detected': rawPayload,
        'is UPI': true,
        pa,
        pn,
        mc,
        amount: amount || 'Not specified',
        'detected category': 'Unknown MCC',
        'suggested wallet': 'None',
        source: 'unknown_mcc',
      });

      this.showWalletSelectionPrompt({
        merchantName: pn,
        upiId: pa,
        mcc: mc,
        category: 'Merchant',
        icon: '🏪',
        amount,
        promptText: 'Merchant category not recognized.',
        isPersonal: false,
        isFirstTime: true,
        askRemember: true,
      });
      return;
    }

    // DECISION BRANCH 3: Personal QR (mc missing or "0000")
    // STEP 5: Personal QR fallback - check merchant_preferences by user_id + upi_id
    const userPref = await supabaseService.getMerchantPreference(userId, pa);

    if (userPref && userPref.walletId) {
      // STEP 7: Returning Personal QR
      const savedWallet = allWallets.find((w) => w.id === userPref.walletId) || stateManager.getWallet(userPref.walletId);
      const cat = userPref.category || (savedWallet ? savedWallet.name : 'Friends & Social');
      const icon = savedWallet?.icon || '👥';

      console.log('🔍 [PocketPe Dev QR Scan]', {
        'raw QR detected': rawPayload,
        'is UPI': true,
        pa,
        pn,
        mc: mc || 'None',
        amount: amount || 'Not specified',
        'detected category': cat,
        'suggested wallet': savedWallet ? savedWallet.name : 'None',
        source: 'merchant_preferences',
      });

      if (savedWallet) {
        this.showSuggestedWalletModal({
          merchantName: pn,
          upiId: pa,
          mcc: mc,
          category: cat,
          icon,
          suggestedWallet: savedWallet,
          reason: 'Previously selected by you',
          amount,
          isPersonal: true,
        });
        return;
      }
    }

    // STEP 6: First-time Personal QR
    console.log('🔍 [PocketPe Dev QR Scan]', {
      'raw QR detected': rawPayload,
      'is UPI': true,
      pa,
      pn,
      mc: mc || 'None',
      amount: amount || 'Not specified',
      'detected category': 'Friends & Social',
      'suggested wallet': 'None',
      source: 'first_time_personal',
    });

    this.showWalletSelectionPrompt({
      merchantName: pn,
      upiId: pa,
      mcc: mc,
      category: 'Friends & Social',
      icon: '👥',
      amount,
      promptText: `Where should payments to ${pn} go?`,
      isPersonal: true,
      isFirstTime: true,
      askRemember: false,
    });
  }

  /**
   * STEP 11: Render Simple Suggested Wallet UI
   * Matches exact mockups for Merchant QR and Personal QR
   */
  static showSuggestedWalletModal({
    merchantName,
    upiId,
    mcc,
    category,
    icon = '🛍️',
    suggestedWallet,
    reason,
    amount = null,
    isPersonal = false,
  }) {
    const modal = document.getElementById('modal-confirm-payment');
    if (!modal) return;

    const body = modal.querySelector('.sheet-body');
    const footer = modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    let selectedAmount = amount || (this.currentPaymentData?.amount || 0);

    body.innerHTML = `
      <!-- Payee Info Header -->
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 2.8rem; margin-bottom: 6px;">${icon}</div>
        <h3 class="h3" style="color: var(--text-primary); text-transform: uppercase; font-size: 1.15rem; letter-spacing: 0.5px; margin: 0;">
          ${merchantName}
        </h3>
        <p class="mono" style="color: var(--text-muted); font-size: 0.78rem; margin-top: 4px;">
          ${upiId}
        </p>

        ${
          category
            ? `
          <div style="margin-top: 8px;">
            <span class="badge badge-accent" style="font-size: 0.78rem; padding: 4px 12px; border-radius: var(--radius-full);">
              ${icon} ${category}
            </span>
          </div>
        `
            : ''
        }
      </div>

      <!-- Suggested Wallet Card (Step 11 Mockup) -->
      <div class="card" style="
        padding: 14px 16px;
        background: var(--bg-surface-secondary);
        border: 1.5px solid var(--accent-primary);
        border-radius: var(--radius-lg);
        margin-bottom: 16px;
        text-align: left;
      ">
        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">
          Suggested wallet
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.6rem;">${suggestedWallet.icon}</span>
            <div>
              <div style="font-weight: 700; font-size: var(--text-sm); color: var(--text-primary);">
                ${suggestedWallet.name} ${!suggestedWallet.name.toLowerCase().includes('wallet') ? 'Wallet' : ''}
              </div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">
                Balance: ${WalletEngine.formatRupee(suggestedWallet.balance)}
              </div>
            </div>
          </div>
          <span class="badge" style="font-size: 0.65rem; background: rgba(59, 130, 246, 0.15); color: var(--accent-primary);">
            Suggested
          </span>
        </div>
        <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 10px; border-top: 1px dashed var(--border-subtle); padding-top: 8px;">
          ${reason}
        </div>
      </div>

      <!-- Amount Section -->
      <div class="card" style="padding: 12px 14px; text-align: center; margin-bottom: 14px; background: var(--bg-subtle);">
        <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">
          Amount to Pay
        </div>
        ${
          selectedAmount > 0
            ? `
          <div class="payment-amount-display" style="font-size: 2rem; font-weight: 800; color: var(--text-primary); margin-top: 4px;">
            ${WalletEngine.formatRupee(selectedAmount)}
          </div>
        `
            : `
          <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 6px;">
            <span style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary);">₹</span>
            <input
              type="number"
              id="input-suggest-amount"
              class="input-text"
              placeholder="Enter amount"
              style="font-size: 1.4rem; font-weight: 800; text-align: center; width: 140px; padding: 4px;"
              min="1"
            />
          </div>
        `
        }
      </div>
    `;

    footer.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
        <button class="btn btn-primary" id="btn-suggest-continue" style="width: 100%; padding: 12px;">
          ${isPersonal ? `Use ${suggestedWallet.name}` : 'Continue'}
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-suggest-choose-another" style="width: 100%;">
          ${isPersonal ? 'Choose another' : 'Choose another wallet'}
        </button>
      </div>
    `;

    // Action 1: Continue / Use Wallet -> Proceed to payment review
    footer.querySelector('#btn-suggest-continue')?.addEventListener('click', () => {
      let finalAmt = selectedAmount;
      const amtInput = body.querySelector('#input-suggest-amount');
      if (amtInput) {
        finalAmt = parseFloat(amtInput.value) || 0;
        if (finalAmt <= 0) {
          NavigationManager.showToast('Please enter an amount to proceed', 'warning');
          return;
        }
      }

      SoundEngine.playTap();
      this.initiatePaymentFlow({
        merchantName,
        amount: finalAmt,
        category,
        icon,
        upiId,
        mcc,
        preferredWalletId: suggestedWallet.id,
        reason,
      });
    });

    // Action 2: Choose Another -> Open wallet selector
    footer.querySelector('#btn-suggest-choose-another')?.addEventListener('click', () => {
      SoundEngine.playTap();
      this.showWalletSelectionPrompt({
        merchantName,
        upiId,
        mcc,
        category,
        icon,
        amount: selectedAmount,
        promptText: `Select wallet for ${merchantName}:`,
        isPersonal,
        isFirstTime: false,
        askRemember: true,
      });
    });

    NavigationManager.openModal('modal-confirm-payment');
  }

  /**
   * STEP 6 & 9: Wallet Selection UI (First-time Personal QR or Manual Override)
   */
  static showWalletSelectionPrompt({
    merchantName,
    upiId,
    mcc = null,
    category = 'General',
    icon = '👤',
    amount = null,
    promptText,
    isPersonal = false,
    isFirstTime = false,
    askRemember = false,
  }) {
    const modal = document.getElementById('modal-confirm-payment');
    if (!modal) return;

    const body = modal.querySelector('.sheet-body');
    const footer = modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    const allWallets = stateManager.getWallets();
    const userId = stateManager.getUserId();

    body.innerHTML = `
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 2.4rem; margin-bottom: 4px;">${icon}</div>
        <h3 class="h3" style="color: var(--text-primary); font-size: 1.15rem; margin: 0;">
          ${promptText}
        </h3>
        <p class="mono" style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px;">
          ${upiId}
        </p>
      </div>

      <div class="wallet-select-grid" id="wallet-prompt-options" style="display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto;">
        ${allWallets
          .map(
            (w) => `
          <div class="wallet-option-item" data-prompt-wallet-id="${w.id}" style="
            display: flex; align-items: center; justify-content: space-between;
            padding: 10px 14px; border-radius: var(--radius-md);
            border: 1px solid var(--border-subtle);
            background: var(--bg-subtle);
            cursor: pointer; transition: all var(--transition-fast);
          ">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.3rem;">${w.icon}</span>
              <div>
                <div style="font-weight: 600; font-size: var(--text-sm); color: var(--text-primary);">${w.name}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted);">${w.category || 'General'}</div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 700; font-size: var(--text-sm); color: var(--text-primary);">
                ${WalletEngine.formatRupee(w.balance)}
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>

      ${
        askRemember
          ? `
        <div class="card" id="remember-choice-box" style="margin-top: 14px; padding: 10px 12px; background: var(--bg-surface-secondary); display: flex; align-items: center; justify-content: space-between;">
          <label style="font-size: var(--text-xs); color: var(--text-primary); font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="chk-remember-choice" checked />
            <span>Remember this choice for future payments</span>
          </label>
        </div>
      `
          : ''
      }
    `;

    footer.innerHTML = `
      <button class="btn btn-ghost btn-sm" data-close-modal="modal-confirm-payment" style="width: 100%;">
        Cancel
      </button>
    `;

    // Wallet selection click
    body.querySelectorAll('[data-prompt-wallet-id]').forEach((card) => {
      card.addEventListener('click', async () => {
        const chosenId = card.getAttribute('data-prompt-wallet-id');
        const chosenWallet = stateManager.getWallet(chosenId);
        if (!chosenWallet) return;

        SoundEngine.playTap();

        const shouldRemember = isFirstTime || body.querySelector('#chk-remember-choice')?.checked;

        if (shouldRemember) {
          // STEP 6 & 7: Save to Supabase merchant_preferences (user_id + upi_id)
          await supabaseService.saveMerchantPreference({
            userId,
            upiId,
            merchantName,
            detectedMcc: mcc || null,
            category: chosenWallet.category || chosenWallet.name,
            walletId: chosenWallet.id,
            source: 'user',
          });
          NavigationManager.showToast(`Saved ${chosenWallet.name} as preference for ${merchantName}`, 'success');
        }

        // Proceed to payment confirmation sheet
        this.initiatePaymentFlow({
          merchantName,
          amount,
          category: chosenWallet.category || category,
          icon: chosenWallet.icon || icon,
          upiId,
          mcc,
          preferredWalletId: chosenWallet.id,
          reason: shouldRemember ? 'Based on your previous choice.' : 'Selected for this payment.',
        });
      });
    });

    NavigationManager.openModal('modal-confirm-payment');
  }

  // --- Scan QR from Image File ---

  static handleQrImageUpload(file) {
    if (!file) return;

    NavigationManager.showToast('Scanning QR from image...', 'info');

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        let detected = null;

        // Try BarcodeDetector
        if (this.barcodeDetector) {
          try {
            const barcodes = await this.barcodeDetector.detect(img);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              detected = barcodes[0].rawValue;
            }
          } catch (err) {}
        }

        // Try jsQR fallback
        if (!detected && window.jsQR) {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const res = window.jsQR(imgData.data, canvas.width, canvas.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (res && res.data) {
            detected = res.data;
          }
        }

        if (detected) {
          this.handleScannedQrPayload(detected);
        } else {
          NavigationManager.showToast('Could not detect a valid QR code in this image', 'warning');
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // --- Payment Execution Flow with Fraud Check & User Confirmation ---

  static initiatePaymentFlow({
    merchantName,
    amount = null,
    category = 'General',
    icon = '🛍️',
    upiId = null,
    mcc = null,
    preferredWalletId = null,
    reason = null,
    skipRiskCheck = false,
  }) {
    // 1. Resolve UPI ID
    let resolvedUpiId = upiId;
    if (!resolvedUpiId) {
      const match = DEMO_MERCHANTS.find((m) => m.name.toLowerCase() === merchantName.toLowerCase());
      if (match && match.upiId) {
        resolvedUpiId = match.upiId;
      } else if (merchantName.includes('@')) {
        resolvedUpiId = merchantName.trim();
      } else {
        resolvedUpiId = merchantName.toLowerCase().replace(/[^a-z0-9]/g, '') + '@upi';
      }
    }

    // 2. Evaluate Community Spam / Risk
    const risk = FraudEngine.evaluateUpiRisk(resolvedUpiId);

    // 3. High Risk Interstitial Warning Check
    if (!skipRiskCheck && risk.level === RISK_LEVELS.HIGH) {
      FraudModal.showHighRiskWarning({
        upiId: resolvedUpiId,
        displayName: merchantName,
        amount: amount || 0,
        onProceed: () => {
          this.initiatePaymentFlow({
            merchantName,
            amount,
            category,
            icon,
            upiId: resolvedUpiId,
            mcc,
            preferredWalletId,
            reason,
            skipRiskCheck: true,
          });
        },
        onDeclineAndReport: () => {
          NavigationManager.closeModal('modal-confirm-payment');
        },
      });
      return;
    }

    // Record interaction in fraud engine
    stateManager.recordInteraction(resolvedUpiId);

    // 4. Resolve wallet: if preferredWalletId passed, use that; else run category classification
    let chosenWallet = preferredWalletId ? stateManager.getWallet(preferredWalletId) : null;
    let finalReason = reason;

    if (!chosenWallet) {
      const classification = CategoryEngine.classifyMerchant(merchantName, amount || 0, category, mcc);
      chosenWallet = classification.recommendedWallet || stateManager.getFreeMoneyWallet();
      finalReason = finalReason || classification.reason;
    }

    this.currentPaymentData = {
      merchantName,
      upiId: resolvedUpiId,
      risk,
      amount: amount !== null && amount !== undefined && !isNaN(Number(amount)) && Number(amount) > 0 ? Number(amount) : null,
      category: category || chosenWallet.category || 'General Expense',
      icon: icon || chosenWallet.icon || '🛍️',
      recommendedWallet: chosenWallet,
      reason: finalReason || `Selected ${chosenWallet.name}.`,
      mcc,
    };
    this.selectedWalletId = chosenWallet.id;
    this.pendingCategoryChange = null;

    this.renderPaymentConfirmationSheet();
    NavigationManager.openModal('modal-confirm-payment');
  }

  static renderPaymentConfirmationSheet() {
    const modal = document.getElementById('modal-confirm-payment');
    if (!modal) return;

    const body = modal.querySelector('.sheet-body');
    const footer = modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    const p = this.currentPaymentData;
    const selectedWallet = stateManager.getWallet(this.selectedWalletId) || p.recommendedWallet;
    const allWallets = stateManager.getWallets();

    const currentAmount = p.amount || 0;
    const isSufficient = selectedWallet.balance >= currentAmount;
    const remainingAfterPayment = selectedWallet.balance - currentAmount;
    const risk = FraudEngine.evaluateUpiRisk(p.upiId);

    body.innerHTML = `
      <!-- Payee Info Header -->
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 3rem; margin-bottom: 8px;">${p.icon}</div>
        <h3 class="h3" style="color: var(--text-primary); text-transform: uppercase;">${p.merchantName}</h3>
        <p class="subtitle" style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 4px;">
          <span class="mono">${p.upiId}</span>
          ${FraudModal.renderRiskBadgeHtml(p.upiId, true)}
        </p>

        <!-- Community Spam Warning Banner (if Caution or Elevated) -->
        ${
          risk.level !== RISK_LEVELS.SAFE
            ? `
          <div class="card" style="margin-top: 12px; padding: 10px 14px; background: rgba(245, 158, 11, 0.1); border-left: 3px solid var(--caution); text-align: left; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-size: var(--text-xs); font-weight: 700; color: var(--caution);">
                ⚠️ ${risk.badgeText}: ${risk.score}% Spam Score
              </div>
              <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 2px;">
                ${risk.reportCount} user reports (${risk.reasons[0] || 'Unusual activity'})
              </div>
            </div>
            <button class="btn btn-sm btn-ghost" id="btn-payment-report-fraud" style="color: var(--danger); font-size: 0.72rem; width: auto; padding: 4px 8px;">
              🚨 Report
            </button>
          </div>
        `
            : ''
        }

        <!-- Amount Display / Input -->
        <div class="payment-amount-display" style="font-size: 2.2rem; font-weight: 800; color: var(--text-primary); margin-top: 14px;">
          ${
            currentAmount > 0
              ? WalletEngine.formatRupee(currentAmount)
              : `
            <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
              <span style="font-size: 1.8rem; color: var(--text-secondary);">₹</span>
              <input
                type="number"
                id="input-confirm-amount"
                class="input-text"
                placeholder="0"
                style="font-size: 2rem; font-weight: 800; width: 150px; text-align: center;"
                min="1"
              />
            </div>
          `
          }
        </div>
      </div>

      <!-- Recommendation Reason Banner -->
      <div class="card" style="padding: 10px 14px; background: var(--bg-surface-secondary); margin-bottom: 16px; border-left: 3px solid var(--accent-primary);">
        <div style="font-size: var(--text-xs); color: var(--accent-primary); font-weight: 700; display: flex; align-items: center; gap: 6px;">
          <span>🎯</span> <span>SMART WALLET RECOMMENDATION</span>
          ${p.mcc ? `<span class="badge" style="margin-left: auto; font-size: 0.65rem;">MCC #${p.mcc}</span>` : ''}
        </div>
        <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">
          ${p.reason} PocketPe selected <strong>${selectedWallet.name}</strong> (${p.category}).
        </p>
      </div>

      <!-- Wallet Selector -->
      <div class="form-group">
        <label class="form-label" style="display: flex; justify-content: space-between;">
          <span>Paying From Purpose Wallet</span>
          <span style="color: var(--text-muted); font-size: 0.75rem;">Change if needed</span>
        </label>
        <div class="wallet-select-grid" id="wallet-options-list" style="display: flex; flex-direction: column; gap: 8px;">
          ${allWallets
            .map((w) => {
              const isSelected = w.id === selectedWallet.id;
              const willHaveEnough = w.balance >= currentAmount;

              return `
            <div class="wallet-option-item ${isSelected ? 'selected' : ''}" data-wallet-option-id="${w.id}" style="
              display: flex; align-items: center; justify-content: space-between;
              padding: 10px 14px; border-radius: var(--radius-md);
              border: 1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'};
              background: ${isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-subtle)'};
              cursor: pointer; transition: all var(--transition-fast);
            ">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.3rem;">${w.icon}</span>
                <div>
                  <div style="font-weight: 600; font-size: var(--text-sm); color: var(--text-primary);">${w.name}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">${w.category || 'General'}</div>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 700; font-size: var(--text-sm); color: ${willHaveEnough ? 'var(--text-primary)' : 'var(--danger)'};">
                  ${WalletEngine.formatRupee(w.balance)}
                </div>
                <div style="font-size: 0.68rem; color: ${willHaveEnough ? 'var(--text-muted)' : 'var(--danger)'};">
                  ${willHaveEnough ? 'Sufficient' : 'Deficit'}
                </div>
              </div>
            </div>
          `;
            })
            .join('')}
        </div>
      </div>

      <!-- Balance Status Bar -->
      <div class="card" style="padding: 10px 14px; background: ${isSufficient ? 'var(--bg-surface)' : 'rgba(239, 68, 68, 0.1)'};">
        <div style="display: flex; justify-content: space-between; font-size: var(--text-xs);">
          <span style="color: var(--text-secondary);">Balance after payment:</span>
          <span style="font-weight: 700; color: ${isSufficient ? 'var(--success)' : 'var(--danger)'};">
            ${isSufficient ? WalletEngine.formatRupee(remainingAfterPayment) : `Deficit of ${WalletEngine.formatRupee(Math.abs(remainingAfterPayment))}`}
          </span>
        </div>
      </div>

      <!-- Learning Engine Prompt Container -->
      <div id="learning-prompt-container" style="margin-top: 12px;"></div>
    `;

    footer.innerHTML = `
      <div style="display: flex; gap: 8px; width: 100%;">
        <button class="btn btn-ghost" data-close-modal="modal-confirm-payment" style="flex: 1;">
          Cancel
        </button>
        <button class="btn btn-primary" id="btn-execute-payment" style="flex: 2;">
          ${currentAmount > 0 ? `Pay ${WalletEngine.formatRupee(currentAmount)}` : 'Confirm & Pay'}
        </button>
      </div>
    `;

    // Wallet selection click
    const optionCards = body.querySelectorAll('[data-wallet-option-id]');
    optionCards.forEach((card) => {
      card.addEventListener('click', () => {
        const wId = card.getAttribute('data-wallet-option-id');
        this.selectedWalletId = wId;
        const chosen = stateManager.getWallet(wId);

        // Check if user changed away from recommended
        if (chosen && chosen.id !== p.recommendedWallet?.id) {
          this.showLearningPrompt(p.merchantName, chosen, p.upiId);
        } else {
          const lContainer = body.querySelector('#learning-prompt-container');
          if (lContainer) lContainer.innerHTML = '';
        }

        this.renderPaymentConfirmationSheet();
        SoundEngine.playTap();
      });
    });

    // Report Fraud click from payment sheet
    const reportBtn = body.querySelector('#btn-payment-report-fraud');
    if (reportBtn) {
      reportBtn.addEventListener('click', () => {
        FraudModal.openReportModal({
          upiId: p.upiId,
          merchantName: p.merchantName,
        });
      });
    }

    // Execute Payment Click (STEP 13: User Must Always Explicitly Confirm)
    footer.querySelector('#btn-execute-payment').addEventListener('click', () => {
      this.handlePaymentAttempt();
    });
  }

  static showLearningPrompt(merchantName, chosenWallet, upiId = null) {
    const container = document.getElementById('learning-prompt-container');
    if (!container) return;

    container.innerHTML = `
      <div class="learning-prompt-banner">
        <div class="learning-prompt-header">
          <span>🧠</span>
          <span>Teach PocketPe: Remember this choice?</span>
        </div>
        <p class="learning-prompt-text">
          Would you like PocketPe to remember <strong>"${merchantName}"</strong> as <strong>${chosenWallet.name}</strong> for future payments?
        </p>
        <div class="learning-prompt-buttons">
          <button class="btn btn-sm btn-primary" id="btn-learn-yes" style="padding: 6px 12px; font-size: var(--text-xs); width: auto;">
            Yes, Remember
          </button>
          <button class="btn btn-sm btn-secondary" id="btn-learn-no" style="padding: 6px 12px; font-size: var(--text-xs); width: auto;">
            Only This Time
          </button>
        </div>
      </div>
    `;

    const yesBtn = container.querySelector('#btn-learn-yes');
    if (yesBtn) {
      yesBtn.addEventListener('click', async () => {
        const userId = stateManager.getUserId();
        CategoryEngine.teachMerchantCategory(merchantName, chosenWallet.category || chosenWallet.name, chosenWallet.id);
        if (upiId) {
          await supabaseService.saveMerchantPreference({
            userId,
            upiId,
            merchantName,
            category: chosenWallet.category || chosenWallet.name,
            walletId: chosenWallet.id,
            source: 'user',
          });
        }
        SoundEngine.playTap();
        NavigationManager.showToast(`Saved! Future "${merchantName}" payments will use ${chosenWallet.name}.`, 'success');
        container.innerHTML = `<div style="font-size: var(--text-xs); color: var(--success); font-weight: 600;">✨ Learned: ${chosenWallet.name} will be recommended next time.</div>`;
      });
    }

    const noBtn = container.querySelector('#btn-learn-no');
    if (noBtn) {
      noBtn.addEventListener('click', () => {
        container.innerHTML = '';
      });
    }
  }

  // --- Payment Execution with Protection ---

  static handlePaymentAttempt() {
    const p = this.currentPaymentData;
    const modal = document.getElementById('modal-confirm-payment');
    const amtInput = modal ? modal.querySelector('#input-confirm-amount') : null;
    let finalAmount = p.amount;

    if (amtInput) {
      finalAmount = parseFloat(amtInput.value) || 0;
      p.amount = finalAmount;
    }

    if (!finalAmount || finalAmount <= 0) {
      NavigationManager.showToast('Please enter a valid amount to pay', 'warning');
      return;
    }

    const walletId = this.selectedWalletId || p.recommendedWallet?.id;

    const result = TransactionEngine.processPayment({
      merchantName: p.merchantName,
      amount: finalAmount,
      category: p.category,
      walletId,
      upiId: p.upiId,
      mcc: p.mcc,
    });

    if (result.status === 'success') {
      SoundEngine.playSuccess();
      NavigationManager.closeModal('modal-confirm-payment');
      NavigationManager.showToast(`✅ Payment Successful: ${WalletEngine.formatRupee(finalAmount)} from ${result.wallet.name}`, 'success');
      NavigationManager.switchTab('activity');
    } else if (result.status === 'insufficient_balance') {
      // INSUFFICIENT BALANCE -> Trigger PAYMENT PROTECTION SHIELD!
      SoundEngine.playProtectionAlert();
      NavigationManager.closeModal('modal-confirm-payment');
      this.openPaymentProtectionSheet(result);
    }
  }

  static openPaymentProtectionSheet(deficitResult) {
    const modal = document.getElementById('modal-payment-protection');
    if (!modal) return;

    const body = modal.querySelector('.sheet-body');
    const footer = modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    const { attemptedAmount, wallet, deficit, donorWallet, freeMoneyBalance } = deficitResult;

    body.innerHTML = `
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 2.8rem; margin-bottom: 6px;">🛡️</div>
        <h3 class="h3" style="color: var(--text-primary); font-size: 1.25rem;">Payment Protection Shield</h3>
        <p class="subtitle" style="font-size: 0.8rem;">
          Your <strong>${wallet.name}</strong> wallet has insufficient funds for this payment.
        </p>
      </div>

      <div class="card" style="background: rgba(239, 68, 68, 0.08); border-left: 3px solid var(--danger); padding: 12px 14px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; font-size: var(--text-xs); margin-bottom: 4px;">
          <span>Attempted Payment:</span>
          <span style="font-weight: 700; color: var(--text-primary);">${WalletEngine.formatRupee(attemptedAmount)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: var(--text-xs); margin-bottom: 4px;">
          <span>${wallet.name} Balance:</span>
          <span style="color: var(--text-muted);">${WalletEngine.formatRupee(wallet.balance)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: var(--text-sm); font-weight: 800; color: var(--danger); border-top: 1px dashed var(--border-subtle); padding-top: 6px; margin-top: 4px;">
          <span>Shortage (Deficit):</span>
          <span>${WalletEngine.formatRupee(deficit)}</span>
        </div>
      </div>

      <div class="shield-options-container" style="display: flex; flex-direction: column; gap: 10px;">
        <!-- Option 1: Auto-Borrow from Free Money -->
        ${
          donorWallet && donorWallet.balance >= deficit
            ? `
          <div class="shield-option-card recommended" id="shield-opt-autoborrow" style="
            padding: 14px; border-radius: var(--radius-lg); border: 1.5px solid var(--accent-primary);
            background: rgba(59, 130, 246, 0.08); cursor: pointer; transition: all var(--transition-fast);
          ">
            <div style="display: flex; align-items: flex-start; gap: 10px;">
              <span style="font-size: 1.5rem;">⚡</span>
              <div>
                <div style="font-weight: 700; font-size: var(--text-sm); color: var(--accent-primary); display: flex; align-items: center; gap: 6px;">
                  <span>Auto-Cover from ${donorWallet.name}</span>
                  <span class="badge badge-accent" style="font-size: 0.65rem;">Recommended</span>
                </div>
                <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">
                  Temporarily bridge ₹${deficit} from ${donorWallet.name} (available: ${WalletEngine.formatRupee(donorWallet.balance)}) so your payment goes through instantly.
                </p>
              </div>
            </div>
          </div>
        `
            : `
          <div class="shield-option-card disabled" style="padding: 12px; border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); opacity: 0.5;">
            <div style="font-size: var(--text-xs); color: var(--text-muted);">
              ⚠️ Free Money wallet balance (${WalletEngine.formatRupee(freeMoneyBalance)}) is not enough to cover ₹${deficit}.
            </div>
          </div>
        `
        }

        <!-- Option 2: Switch to another wallet with sufficient balance -->
        <div class="shield-option-card" id="shield-opt-switch" style="
          padding: 12px 14px; border-radius: var(--radius-lg); border: 1px solid var(--border-subtle);
          background: var(--bg-surface); cursor: pointer;
        ">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.3rem;">🔄</span>
            <div>
              <div style="font-weight: 600; font-size: var(--text-sm); color: var(--text-primary);">Choose Another Wallet</div>
              <p style="font-size: 0.72rem; color: var(--text-muted);">Pick a different purpose wallet that has enough money.</p>
            </div>
          </div>
        </div>
      </div>
    `;

    footer.innerHTML = `
      <button class="btn btn-ghost" data-close-modal="modal-payment-protection" style="width: 100%;">
        Cancel Transaction
      </button>
    `;

    // Bind Option 1: Auto-Borrow
    const autoBorrowOpt = body.querySelector('#shield-opt-autoborrow');
    if (autoBorrowOpt) {
      autoBorrowOpt.addEventListener('click', () => {
        const shieldResult = TransactionEngine.resolvePaymentWithProtection(deficitResult);
        if (shieldResult.success) {
          SoundEngine.playSuccess();
          NavigationManager.closeModal('modal-payment-protection');
          NavigationManager.showToast(`🛡️ Shield Activated: ${shieldResult.message}`, 'success');
          NavigationManager.switchTab('activity');
        } else {
          NavigationManager.showToast(shieldResult.message, 'danger');
        }
      });
    }

    // Bind Option 2: Switch Wallet
    const switchOpt = body.querySelector('#shield-opt-switch');
    if (switchOpt) {
      switchOpt.addEventListener('click', () => {
        NavigationManager.closeModal('modal-payment-protection');
        NavigationManager.openModal('modal-confirm-payment');
      });
    }

    NavigationManager.openModal('modal-payment-protection');
  }

  // --- Custom Merchant & UPI Bottom Sheet ---

  static openCustomMerchantPrompt(prefill = {}) {
    const modal = document.getElementById('modal-custom-merchant');
    if (!modal) return;

    const body = modal.querySelector('.sheet-body');
    const footer = modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    let selectedAmount = prefill.amount || 350;
    const initialName = prefill.merchantName || (prefill.upiId ? prefill.upiId : 'Blue Tokai Coffee');
    const initialCategory = prefill.category || 'General Expense';

    const isFriend = initialCategory === 'Friends & Social' || prefill.icon === '🤝' || (prefill.upiId && !prefill.mcc);

    body.innerHTML = `
      <div style="text-align: center; margin-bottom: 8px;">
        <span class="badge ${isFriend ? 'badge-accent' : 'badge-primary'}">${isFriend ? '🤝 Friend Transfer' : 'Pay Anyone'}</span>
        <h3 class="h3" style="color: var(--text-primary); margin-top: 4px;">${isFriend ? `Pay ${initialName}` : 'Custom Merchant or UPI'}</h3>
        <p class="subtitle">${isFriend ? 'Auto-detected as Personal / Friend Transfer (Friends Wallet)' : 'Enter any merchant name, friend name, or paste a UPI ID / link.'}</p>
      </div>

      <div class="form-group">
        <label class="form-label">Merchant Name / UPI ID / upi:// Link</label>
        <input
          type="text"
          class="input-text"
          id="custom-merchant-name"
          placeholder="e.g. Chai Point, priya@okaxis, upi://pay?pa=..."
          value="${initialName}"
        />
        ${prefill.upiId ? `<div style="font-size: 0.72rem; color: var(--accent-primary); margin-top: 4px;">VPA: ${prefill.upiId}</div>` : ''}
      </div>

      <div class="card" style="text-align: center; padding: 16px;">
        <div style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 600;">AMOUNT TO PAY</div>
        <div class="amount-input-hero" style="padding: 6px 0;">
          <span class="amount-currency">₹</span>
          <input
            type="number"
            class="amount-hero-field"
            id="custom-amount-input"
            value="${selectedAmount}"
            min="1"
            step="10"
          />
        </div>
        <div class="quick-amount-pills">
          <button class="pill-btn ${selectedAmount === 100 ? 'active' : ''}" data-custom-amt="100">₹100</button>
          <button class="pill-btn ${selectedAmount === 250 ? 'active' : ''}" data-custom-amt="250">₹250</button>
          <button class="pill-btn ${selectedAmount === 350 ? 'active' : ''}" data-custom-amt="350">₹350</button>
          <button class="pill-btn ${selectedAmount === 500 ? 'active' : ''}" data-custom-amt="500">₹500</button>
          <button class="pill-btn ${selectedAmount === 1200 ? 'active' : ''}" data-custom-amt="1200">₹1,200</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Category Hint (Optional)</label>
        <select class="input-text" id="custom-category-select">
          <option value="Food & Dining" ${initialCategory === 'Food & Dining' ? 'selected' : ''}>🍔 Food & Dining</option>
          <option value="Transport & Fuel" ${initialCategory === 'Transport & Fuel' ? 'selected' : ''}>🚗 Transport & Fuel</option>
          <option value="College & Education" ${initialCategory === 'College & Education' ? 'selected' : ''}>🎓 College & Education</option>
          <option value="Friends & Social" ${initialCategory === 'Friends & Social' ? 'selected' : ''}>🤝 Friends & Social</option>
          <option value="Shopping & Apparel" ${initialCategory === 'Shopping & Apparel' ? 'selected' : ''}>🛍️ Shopping & Apparel</option>
          <option value="Health & Wellness" ${initialCategory === 'Health & Wellness' ? 'selected' : ''}>🩺 Health & Wellness</option>
          <option value="Personal Care" ${initialCategory === 'Personal Care' ? 'selected' : ''}>💈 Personal Care</option>
          <option value="General Expense" ${initialCategory === 'General Expense' ? 'selected' : ''}>💳 General Expense</option>
        </select>
      </div>
    `;

    footer.innerHTML = `
      <button class="btn btn-primary" id="btn-submit-custom-pay">
        Proceed to Smart Recommendation →
      </button>
      <button class="btn btn-ghost btn-sm" data-close-modal="modal-custom-merchant">Cancel</button>
    `;

    const amountInput = body.querySelector('#custom-amount-input');
    const nameInput = body.querySelector('#custom-merchant-name');
    const catSelect = body.querySelector('#custom-category-select');

    // Amount pills
    body.querySelectorAll('[data-custom-amt]').forEach((pill) => {
      pill.addEventListener('click', () => {
        const amt = Number(pill.getAttribute('data-custom-amt'));
        selectedAmount = amt;
        if (amountInput) amountInput.value = amt;
        body.querySelectorAll('[data-custom-amt]').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        SoundEngine.playTap();
      });
    });

    if (amountInput) {
      amountInput.addEventListener('input', (e) => {
        selectedAmount = Number(e.target.value) || 0;
      });
    }

    footer.querySelector('#btn-submit-custom-pay').addEventListener('click', () => {
      const rawInput = nameInput ? nameInput.value.trim() : '';
      if (!rawInput) {
        NavigationManager.showToast('Please enter merchant, UPI ID, or payee', 'warning');
        return;
      }

      const amt = Number(amountInput ? amountInput.value : selectedAmount);
      if (!amt || amt <= 0) {
        NavigationManager.showToast('Please enter a valid amount', 'warning');
        return;
      }

      // Parse with UpiQrEngine to detect if user pasted upi:// URI or plain UPI ID
      const parsed = UpiQrEngine.parse(rawInput);
      const merchantName = parsed.merchantName || rawInput;
      const upiId = prefill.upiId || parsed.upiId || (rawInput.includes('@') ? rawInput : null);
      const cat = catSelect ? catSelect.value : (parsed.category || prefill.category || 'General Expense');
      const mcc = parsed.mcc || prefill.mcc || null;
      const icon = parsed.icon || prefill.icon || '🏷️';

      SoundEngine.playTap();
      NavigationManager.closeModal('modal-custom-merchant');

      // If user pasted a full upi:// URI, decode via QR payload handler
      if (rawInput.toLowerCase().startsWith('upi://') || rawInput.includes('pa=')) {
        this.handleScannedQrPayload(rawInput);
        return;
      }

      // If user provided a UPI ID (e.g., friend@upi or merchant@okaxis), execute 4-tier decision hierarchy
      if (upiId) {
        this.processUpiPaymentDecision({
          rawPayload: rawInput,
          pa: upiId,
          pn: merchantName || upiId.split('@')[0],
          mc: mcc,
          amount: amt,
        });
        return;
      }

      this.initiatePaymentFlow({
        merchantName,
        amount: amt,
        category: cat,
        icon,
        upiId,
        mcc,
      });
    });

    NavigationManager.openModal('modal-custom-merchant');
  }
}
