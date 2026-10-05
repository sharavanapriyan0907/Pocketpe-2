/* ==========================================================================
   POCKETPE - EDIT PROFILE MODAL
   Allows authenticated user to update their display name in Supabase
   ========================================================================== */

import { supabaseService } from '../services/supabaseService.js';
import { stateManager } from '../state.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';

export class EditProfileModal {
  static init() {
    this.modal = document.getElementById('modal-edit-profile');
    if (!this.modal) return;
    this.render();
  }

  static open() {
    this.render();
    NavigationManager.openModal('modal-edit-profile');
  }

  static render() {
    if (!this.modal) return;

    const body = this.modal.querySelector('.sheet-body');
    const footer = this.modal.querySelector('.sheet-footer');
    if (!body) return;

    const state = stateManager.getState();
    const currentName = state.user?.name || '';
    const currentEmail = state.user?.email || 'N/A';

    body.innerHTML = `
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 2.2rem; margin-bottom: 6px;">👤</div>
        <h3 class="h3" style="color: var(--text-primary); font-size: 1.15rem;">Edit Profile</h3>
        <p class="subtitle" style="font-size: 0.8rem;">
          Update your student profile display name
        </p>
      </div>

      <div id="edit-profile-alert" style="display: none; padding: 10px 12px; border-radius: var(--radius-md); font-size: 0.78rem; margin-bottom: 14px; font-weight: 600;"></div>

      <form id="form-edit-profile" style="display: flex; flex-direction: column; gap: 12px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-size: var(--text-xs);">Email Address</label>
          <input
            type="email"
            class="form-input"
            value="${currentEmail}"
            disabled
            style="opacity: 0.7; background: var(--bg-surface-secondary);"
          />
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="input-edit-name" style="font-size: var(--text-xs);">Full Name</label>
          <input
            type="text"
            id="input-edit-name"
            class="form-input"
            value="${currentName}"
            placeholder="e.g. Sharath Kumar"
            required
            autocomplete="name"
          />
        </div>

        <div style="font-size: 0.72rem; color: var(--text-muted);">
          Your name appears across Split-Bill groups and payment receipts.
        </div>
      </form>
    `;

    if (footer) {
      footer.innerHTML = `
        <div style="display: flex; gap: 8px; width: 100%;">
          <button type="button" class="btn btn-secondary" data-close-modal="modal-edit-profile" style="flex: 1;">
            Cancel
          </button>
          <button type="button" class="btn btn-primary" id="btn-save-profile-name" style="flex: 1.5;">
            💾 Save Changes
          </button>
        </div>
      `;
    }

    this.bindEvents();
  }

  static bindEvents() {
    if (!this.modal) return;

    const saveBtn = this.modal.querySelector('#btn-save-profile-name');
    const nameInput = this.modal.querySelector('#input-edit-name');
    const alertBox = this.modal.querySelector('#edit-profile-alert');

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const newName = nameInput?.value?.trim();
        if (!newName) {
          if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(239, 68, 68, 0.12)';
            alertBox.style.border = '1px solid #ef4444';
            alertBox.style.color = '#ef4444';
            alertBox.textContent = 'Please enter a valid display name.';
          }
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
          if (stateManager.isUserAuthenticated()) {
            try {
              await supabaseService.updateProfile({ fullName: newName });
            } catch (err) {
              console.warn('Notice while updating remote Supabase profile:', err);
              if (!err.message?.includes('Auth session missing')) {
                throw err;
              }
            }
          }
          
          stateManager.state.user.name = newName;
          stateManager.notify('auth:changed', stateManager.state.user);
          stateManager.notify('state:changed');

          SoundEngine.playSuccess();
          NavigationManager.closeModal('modal-edit-profile');
          NavigationManager.showToast('✅ Profile name updated', 'success');
        } catch (e) {
          console.error('Failed to update profile:', e);
          if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(239, 68, 68, 0.12)';
            alertBox.style.border = '1px solid #ef4444';
            alertBox.style.color = '#ef4444';
            alertBox.textContent = e.message || 'Failed to update name.';
          }
          SoundEngine.playAlert();
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 Save Changes';
        }
      });
    }
  }
}
