/* ==========================================================================
   POCKETPE - SUPABASE CONFIGURATION MODAL
   Allows testing and setting Supabase Project URL & Anon Key dynamically
   ========================================================================== */

import { supabaseService } from '../services/supabaseService.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';

export class SupabaseConfigModal {
  static init() {
    this.modal = document.getElementById('modal-supabase-config');
    if (!this.modal) return;
    this.render();
  }

  static open() {
    this.render();
    NavigationManager.openModal('modal-supabase-config');
  }

  static render() {
    if (!this.modal) return;

    const body = this.modal.querySelector('.sheet-body');
    const footer = this.modal.querySelector('.sheet-footer');
    if (!body) return;

    const cfg = supabaseService.getConfig();

    body.innerHTML = `
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 2.2rem; margin-bottom: 6px;">⚡</div>
        <h3 class="h3" style="color: var(--text-primary); font-size: 1.15rem;">Supabase Project Settings</h3>
        <p class="subtitle" style="font-size: 0.8rem;">
          Connect PocketPe to your Supabase project for real email/password authentication
        </p>
      </div>

      <div id="config-status-alert" style="display: none; padding: 10px 12px; border-radius: var(--radius-md); font-size: 0.78rem; margin-bottom: 14px; font-weight: 600;"></div>

      <div class="card" style="padding: 12px; margin-bottom: 14px; background: var(--bg-surface-secondary);">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: var(--text-xs); color: var(--text-secondary);">Connection Status:</span>
          <span class="badge ${cfg.isConfigured ? 'badge-success' : 'badge-caution'}" id="badge-config-status">
            ${cfg.isConfigured ? '● Configured' : '● Needs Credentials'}
          </span>
        </div>
      </div>

      <form id="form-supabase-config" style="display: flex; flex-direction: column; gap: 12px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="input-supabase-url" style="font-size: var(--text-xs);">
            Project URL <span style="color: var(--text-muted); font-size: 0.7rem;">(https://xyzcompany.supabase.co)</span>
          </label>
          <input
            type="url"
            id="input-supabase-url"
            class="form-input"
            value="${cfg.url || ''}"
            placeholder="https://your-project-id.supabase.co"
            required
            autocomplete="off"
            spellcheck="false"
          />
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="input-supabase-key" style="font-size: var(--text-xs);">
            Anon Public Key <span style="color: var(--text-muted); font-size: 0.7rem;">(eyJhbGciOi...)</span>
          </label>
          <textarea
            id="input-supabase-key"
            class="form-input"
            rows="3"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            required
            style="font-family: var(--font-mono); font-size: 0.72rem; resize: vertical;"
            spellcheck="false"
          >${cfg.anonKey || ''}</textarea>
        </div>

        <div style="font-size: 0.72rem; color: var(--text-muted); line-height: 1.4;">
          💡 Find these credentials in your Supabase Dashboard: <strong>Project Settings → API → Project URL & Project API Keys (anon public)</strong>.
        </div>
      </form>
    `;

    if (footer) {
      footer.innerHTML = `
        <div style="display: flex; gap: 8px; width: 100%;">
          <button type="button" class="btn btn-secondary" id="btn-test-supabase-conn" style="flex: 1;">
            🔍 Test Connection
          </button>
          <button type="button" class="btn btn-primary" id="btn-save-supabase-config" style="flex: 1.2;">
            💾 Save & Connect
          </button>
        </div>
      `;
    }

    this.bindEvents();
  }

  static bindEvents() {
    if (!this.modal) return;

    const testBtn = this.modal.querySelector('#btn-test-supabase-conn');
    const saveBtn = this.modal.querySelector('#btn-save-supabase-config');
    const urlInput = this.modal.querySelector('#input-supabase-url');
    const keyInput = this.modal.querySelector('#input-supabase-key');
    const alertBox = this.modal.querySelector('#config-status-alert');

    const showAlert = (msg, type = 'info') => {
      if (!alertBox) return;
      alertBox.style.display = 'block';
      if (type === 'error') {
        alertBox.style.background = 'rgba(239, 68, 68, 0.12)';
        alertBox.style.border = '1px solid #ef4444';
        alertBox.style.color = '#ef4444';
      } else if (type === 'success') {
        alertBox.style.background = 'rgba(16, 185, 129, 0.12)';
        alertBox.style.border = '1px solid #10b981';
        alertBox.style.color = '#10b981';
      } else {
        alertBox.style.background = 'rgba(59, 130, 246, 0.12)';
        alertBox.style.border = '1px solid #3b82f6';
        alertBox.style.color = '#3b82f6';
      }
      alertBox.textContent = msg;
    };

    if (testBtn) {
      testBtn.addEventListener('click', async () => {
        const url = urlInput?.value?.trim();
        const key = keyInput?.value?.trim();

        if (!url || !key) {
          showAlert('Please provide both Project URL and Anon Key.', 'error');
          return;
        }

        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';
        showAlert('Contacting Supabase endpoint...', 'info');

        try {
          await supabaseService.updateConfig(url, key);
          const result = await supabaseService.testConnection();
          if (result.success) {
            showAlert('✅ Successfully reached Supabase project endpoint!', 'success');
            SoundEngine.playSuccess();
          } else {
            showAlert(`❌ Supabase test failed: ${result.message}`, 'error');
            SoundEngine.playAlert();
          }
        } catch (e) {
          showAlert(`❌ Connection failed: ${e.message}`, 'error');
        } finally {
          testBtn.disabled = false;
          testBtn.textContent = '🔍 Test Connection';
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const url = urlInput?.value?.trim();
        const key = keyInput?.value?.trim();

        if (!url || !key) {
          showAlert('Please fill in both Project URL and Anon Key.', 'error');
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
          await supabaseService.updateConfig(url, key);
          SoundEngine.playSuccess();
          NavigationManager.closeModal('modal-supabase-config');
          NavigationManager.showToast('✅ Supabase credentials saved', 'success');
        } catch (e) {
          showAlert(`Failed to save: ${e.message}`, 'error');
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 Save & Connect';
        }
      });
    }
  }
}
