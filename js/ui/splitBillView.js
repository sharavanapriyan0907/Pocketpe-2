/* ==========================================================================
   POCKETPE - SPLIT-BILL WALLET UI CONTROLLER
   Phase 1 Ledger: Group expenses, net balances, simplified settle-up & gentle reminders
   ========================================================================== */

import { stateManager } from '../state.js';
import { WalletEngine } from '../engines/walletEngine.js';
import { SplitEngine } from '../engines/splitEngine.js';
import { NavigationManager } from './navigation.js';
import { SoundEngine } from './sound.js';
import { PayView } from './payView.js';

export class SplitBillView {
  static init() {
    this.modal = document.getElementById('modal-split-bill');
    this.selectedGroupId = null;

    this.setupListeners();
  }

  static open(groupId = null) {
    const groups = stateManager.getSplitGroups();
    this.selectedGroupId = groupId || (groups.length > 0 ? groups[0].id : null);
    this.render();
    NavigationManager.openModal('modal-split-bill');
  }

  static setupListeners() {
    stateManager.subscribe('split:group_created', (g) => {
      this.selectedGroupId = g.id;
      this.render();
    });
    stateManager.subscribe('split:expense_added', () => this.render());
    stateManager.subscribe('split:settled', () => this.render());
  }

  static render() {
    const modal = document.getElementById('modal-split-bill');
    if (!modal) return;

    const body = modal.querySelector('.sheet-body');
    const footer = modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    const groups = stateManager.getSplitGroups();
    if (!this.selectedGroupId && groups.length > 0) {
      this.selectedGroupId = groups[0].id;
    }
    const currentGroup = groups.find((g) => g.id === this.selectedGroupId) || groups[0];

    if (!currentGroup) {
      body.innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">👥</div>
          <h3 class="h3">No Split Groups Yet</h3>
          <p class="subtitle">Create a group with your roommates or friends to track shared expenses.</p>
          <button class="btn btn-primary" id="btn-create-first-group" style="margin-top: 16px;">
            + Create Split Group
          </button>
        </div>
      `;
      footer.innerHTML = `<button class="btn btn-secondary" data-close-modal="modal-split-bill">Close</button>`;

      const btn = body.querySelector('#btn-create-first-group');
      if (btn) btn.addEventListener('click', () => this.openCreateGroupModal());
      return;
    }

    const members = stateManager.getGroupMembers(currentGroup.id);
    const expenses = stateManager.getGroupExpenses(currentGroup.id);
    const balances = SplitEngine.calculateGroupBalances(currentGroup.id);
    const settlements = SplitEngine.calculateSimplifiedSettlements(currentGroup.id);

    // Current user's net position
    const currentUserMember = members.find((m) => m.isCurrentUser);
    const userNet = currentUserMember && balances[currentUserMember.id] ? balances[currentUserMember.id].netBalance : 0;

    body.innerHTML = `
      <!-- Top Group Switcher Pill Carousel -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <div class="group-switcher-scroll" style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; max-width: 80%;">
          ${groups
            .map(
              (g) => `
            <button class="pill-btn ${g.id === currentGroup.id ? 'active' : ''}" data-switch-group="${g.id}" style="white-space: nowrap;">
              <span>${g.icon || '👥'}</span> <span>${g.name}</span>
            </button>
          `
            )
            .join('')}
        </div>
        <button class="btn btn-sm btn-secondary" id="btn-open-new-group-modal" style="width: auto; padding: 4px 10px; font-size: 0.75rem;">
          + New
        </button>
      </div>

      <!-- Current Group Hero Card -->
      <div class="card" style="padding: 16px; background: var(--bg-surface); border: 1.5px solid var(--border-subtle); margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.5rem;">${currentGroup.icon || '👥'}</span>
              <h3 class="h3" style="color: var(--text-primary); font-size: 1.15rem;">${currentGroup.name}</h3>
            </div>
            <div style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px;">
              ${members.length} members • ${expenses.length} expenses recorded
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 600;">YOUR BALANCE</div>
            <div style="font-size: var(--text-lg); font-weight: 800; color: ${userNet > 0 ? 'var(--success)' : userNet < 0 ? 'var(--danger)' : 'var(--text-muted)'};">
              ${userNet > 0 ? `+${WalletEngine.formatRupee(userNet)}` : userNet < 0 ? `-${WalletEngine.formatRupee(Math.abs(userNet))}` : 'Settled'}
            </div>
            <div style="font-size: 0.65rem; color: var(--text-muted);">
              ${userNet > 0 ? 'you are owed' : userNet < 0 ? 'you owe' : 'all squared up'}
            </div>
          </div>
        </div>

        <!-- Action bar inside card -->
        <div style="display: flex; gap: 8px; margin-top: 14px;">
          <button class="btn btn-primary btn-sm" id="btn-open-add-expense" style="flex: 1; font-size: var(--text-xs);">
            <span>➕</span> <span>Add Expense</span>
          </button>
        </div>
      </div>

      <!-- Simplified Settle-Up (Fewest Transactions) Section -->
      <div class="card" style="padding: 14px; margin-bottom: 14px; background: var(--bg-subtle);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary);">⚡ SIMPLIFIED SETTLE-UP</div>
            <div style="font-size: 0.68rem; color: var(--text-muted);">Cross-debts minimized to fewest direct payments</div>
          </div>
          <span class="badge badge-accent" style="font-size: 0.65rem;">Min-Cash-Flow</span>
        </div>

        ${
          settlements.length === 0
            ? `
          <div style="text-align: center; padding: 12px; font-size: var(--text-xs); color: var(--success); font-weight: 600;">
            ✨ Everyone is settled up! No outstanding balances.
          </div>
        `
            : `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${settlements
              .map((stl) => {
                const isCurrentUserPayer = stl.isCurrentUserPayer;
                const isCurrentUserReceiver = stl.isCurrentUserReceiver;

                return `
                <div class="card" style="padding: 10px 12px; background: var(--bg-surface); display: flex; align-items: center; justify-content: space-between;">
                  <div>
                    <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary);">
                      <strong>${stl.fromMember.name}</strong> owes <strong>${stl.toMember.name}</strong>
                    </div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">
                      ${stl.fromMember.upiId} → ${stl.toMember.upiId}
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: var(--text-sm); font-weight: 800; color: var(--text-primary);">
                      ${WalletEngine.formatRupee(stl.amount)}
                    </span>

                    ${
                      isCurrentUserPayer
                        ? `
                      <button class="btn btn-sm btn-primary" data-settle-action="${stl.groupId}" data-from="${stl.fromMember.id}" data-to="${stl.toMember.id}" data-amt="${stl.amount}" style="padding: 4px 10px; font-size: 0.72rem; width: auto;">
                        Settle Up
                      </button>
                    `
                        : isCurrentUserReceiver
                        ? `
                      <button class="btn btn-sm btn-secondary" data-remind-action="${stl.fromMember.name}" data-amt="${stl.amount}" data-grp="${currentGroup.name}" style="padding: 4px 8px; font-size: 0.72rem; width: auto;" title="Send Gentle Reminder">
                        🔔 Remind
                      </button>
                    `
                        : ''
                    }
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
        `
        }
      </div>

      <!-- Members & Balances List -->
      <div class="card" style="padding: 14px; margin-bottom: 14px;">
        <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">
          GROUP MEMBERS & NET BALANCES
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${members
            .map((m) => {
              const b = balances[m.id];
              const net = b ? b.netBalance : 0;
              return `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
                <div>
                  <div style="font-size: var(--text-sm); font-weight: 600; color: var(--text-primary);">${m.name} ${m.isCurrentUser ? '<span class="badge badge-accent" style="font-size: 0.6rem;">You</span>' : ''}</div>
                  <div class="mono" style="font-size: 0.68rem; color: var(--text-muted);">${m.upiId}</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: var(--text-sm); font-weight: 700; color: ${net > 0 ? 'var(--success)' : net < 0 ? 'var(--danger)' : 'var(--text-muted)'};">
                    ${net > 0 ? `+${WalletEngine.formatRupee(net)}` : net < 0 ? `-${WalletEngine.formatRupee(Math.abs(net))}` : '₹0'}
                  </div>
                  <div style="font-size: 0.65rem; color: var(--text-muted);">${net > 0 ? 'gets back' : net < 0 ? 'owes' : 'settled'}</div>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>

      <!-- Expenses Timeline -->
      <div class="card" style="padding: 14px; margin-bottom: 14px;">
        <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">
          RECENT GROUP EXPENSES (${expenses.length})
        </div>
        ${
          expenses.length === 0
            ? '<div style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 10px;">No expenses added yet. Tap "Add Expense" above.</div>'
            : `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${expenses
              .map((exp) => {
                const payer = members.find((m) => m.id === exp.paidBy);
                return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
                  <div>
                    <div style="font-size: var(--text-sm); font-weight: 600; color: var(--text-primary);">${exp.description}</div>
                    <div style="font-size: 0.68rem; color: var(--text-muted);">
                      Paid by ${payer ? payer.name : 'Unknown'} • Split ${exp.splitType} (${exp.shares?.length || 0} people)
                    </div>
                  </div>
                  <div style="font-size: var(--text-sm); font-weight: 800; color: var(--text-primary);">
                    ${WalletEngine.formatRupee(exp.amount)}
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
        `
        }
      </div>

      <!-- Phase 2 Pooled Wallet Preview Banner (Schema Ready) -->
      <div class="card" style="padding: 14px; background: rgba(59, 130, 246, 0.06); border: 1.5px dashed var(--accent-border);">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 1.1rem;">🏦</span>
          <span style="font-size: var(--text-xs); font-weight: 700; color: var(--accent-primary);">PHASE 2: SHARED POOL WALLET</span>
          <span class="badge" style="font-size: 0.6rem; background: var(--bg-surface);">Coming Soon</span>
        </div>
        <p style="font-size: 0.72rem; color: var(--text-secondary); line-height: 1.4; margin: 0;">
          Direct pooled wallet contributions with automated equal refunds are architected in PocketPe’s schema. Feature activates upon partner bank / license confirmation.
        </p>
      </div>
    `;

    footer.innerHTML = `
      <button class="btn btn-secondary" data-close-modal="modal-split-bill">Close</button>
    `;

    // Group switcher pills
    body.querySelectorAll('[data-switch-group]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedGroupId = btn.getAttribute('data-switch-group');
        SoundEngine.playTap();
        this.render();
      });
    });

    // New Group button
    const newGroupBtn = body.querySelector('#btn-open-new-group-modal');
    if (newGroupBtn) {
      newGroupBtn.addEventListener('click', () => this.openCreateGroupModal());
    }

    // Add Expense button
    const addExpenseBtn = body.querySelector('#btn-open-add-expense');
    if (addExpenseBtn) {
      addExpenseBtn.addEventListener('click', () => this.openAddExpenseModal(currentGroup));
    }

    // Settle Up Action
    body.querySelectorAll('[data-settle-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const grpId = btn.getAttribute('data-settle-action');
        const fromId = btn.getAttribute('data-from');
        const toId = btn.getAttribute('data-to');
        const amt = Number(btn.getAttribute('data-amt'));

        SoundEngine.playTap();
        const result = SplitEngine.executeSettlementPayment({
          groupId: grpId,
          fromMemberId: fromId,
          toMemberId: toId,
          amount: amt,
        });

        if (result.success) {
          SoundEngine.playSuccess();
          NavigationManager.showToast(`✅ ${result.message}`, 'success', 4000);
          this.render();
        } else if (result.status === 'insufficient_balance') {
          // Open Payment Protection Shield
          SoundEngine.playProtectionAlert();
          NavigationManager.closeModal('modal-split-bill');
          PayView.openPaymentProtectionSheet(result.deficitInfo);
        } else {
          NavigationManager.showToast(result.error, 'danger');
        }
      });
    });

    // Gentle Reminder Action
    body.querySelectorAll('[data-remind-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const friendName = btn.getAttribute('data-remind-action');
        const amt = btn.getAttribute('data-amt');
        const grpName = btn.getAttribute('data-grp');

        const reminderMsg = `Hey ${friendName}! 👋 Friendly ping for ${WalletEngine.formatRupee(amt)} for our ${grpName} on PocketPe. Settle up whenever you can! 🍕🤝`;

        SoundEngine.playTap();
        if (navigator.clipboard) {
          navigator.clipboard.writeText(reminderMsg);
          NavigationManager.showToast(`🔔 Reminder copied: "${reminderMsg.slice(0, 45)}..."`, 'info', 4000);
        } else {
          NavigationManager.showToast(`🔔 Reminder sent to ${friendName}!`, 'info');
        }
      });
    });
  }

  /**
   * Modal to Create New Group
   */
  static openCreateGroupModal() {
    const modal = document.getElementById('modal-create-group');
    if (!modal) return;

    const body = modal.querySelector('.sheet-body');
    const footer = modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    body.innerHTML = `
      <div style="text-align: center; margin-bottom: 12px;">
        <span class="badge badge-accent">Friends & Social</span>
        <h3 class="h3" style="color: var(--text-primary); margin-top: 4px;">Create Split Group</h3>
        <p class="subtitle">For trips, flat chores, birthday treats, or hostel expenses.</p>
      </div>

      <div class="form-group">
        <label class="form-label">Group Name</label>
        <input type="text" class="input-text" id="new-group-name" placeholder="e.g. Manali Trip 🏔️, Flat 402, Canteen Gang" value="College Canteen Gang 🥪" />
      </div>

      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="input-text" id="new-group-category">
          <option value="Food & Dining">🍔 Food & Dining</option>
          <option value="Travel">✈️ Travel & Trips</option>
          <option value="Housing">🏠 Hostel & Flatmates</option>
          <option value="Entertainment">🎬 Parties & Fun</option>
          <option value="College & Education">🎓 College Projects</option>
        </select>
      </div>

      <!-- Add Members Section -->
      <div class="form-group">
        <label class="form-label">Add Friends (Name & UPI ID / Phone)</label>
        <div id="new-group-members-list" style="display: flex; flex-direction: column; gap: 8px;">
          <div class="member-input-row" style="display: flex; gap: 6px;">
            <input type="text" class="input-text member-name" placeholder="Friend Name" value="Aarav Mehta" style="flex: 1;" />
            <input type="text" class="input-text member-upi" placeholder="UPI ID / Phone" value="aarav@okhdfc" style="flex: 1;" />
          </div>
          <div class="member-input-row" style="display: flex; gap: 6px;">
            <input type="text" class="input-text member-name" placeholder="Friend Name" value="Sneha Rao" style="flex: 1;" />
            <input type="text" class="input-text member-upi" placeholder="UPI ID / Phone" value="sneha@okicici" style="flex: 1;" />
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" id="btn-add-more-member-row" style="margin-top: 6px; font-size: 0.75rem; width: auto;">
          + Add Another Friend
        </button>
      </div>
    `;

    footer.innerHTML = `
      <button class="btn btn-primary" id="btn-save-new-group">Create Group</button>
      <button class="btn btn-ghost btn-sm" data-close-modal="modal-create-group">Cancel</button>
    `;

    // Add row button
    body.querySelector('#btn-add-more-member-row').addEventListener('click', () => {
      const container = body.querySelector('#new-group-members-list');
      const row = document.createElement('div');
      row.className = 'member-input-row';
      row.style = 'display: flex; gap: 6px;';
      row.innerHTML = `
        <input type="text" class="input-text member-name" placeholder="Friend Name" style="flex: 1;" />
        <input type="text" class="input-text member-upi" placeholder="UPI ID / Phone" style="flex: 1;" />
      `;
      container.appendChild(row);
      SoundEngine.playTap();
    });

    // Save group button
    footer.querySelector('#btn-save-new-group').addEventListener('click', () => {
      const nameInput = body.querySelector('#new-group-name');
      const catSelect = body.querySelector('#new-group-category');
      const groupName = nameInput ? nameInput.value.trim() : '';

      if (!groupName) {
        NavigationManager.showToast('Please enter a group name', 'warning');
        return;
      }

      const members = [];
      body.querySelectorAll('.member-input-row').forEach((row) => {
        const mName = row.querySelector('.member-name').value.trim();
        const mUpi = row.querySelector('.member-upi').value.trim();
        if (mName) {
          members.push({
            name: mName,
            upiId: mUpi || `${mName.toLowerCase().replace(/\s+/g, '')}@upi`,
          });
        }
      });

      const iconMap = {
        'Food & Dining': '🍔',
        Travel: '✈️',
        Housing: '🏠',
        Entertainment: '🎬',
        'College & Education': '🎓',
      };

      const newGrp = stateManager.addSplitGroup({
        name: groupName,
        category: catSelect ? catSelect.value : 'General',
        icon: iconMap[catSelect?.value] || '👥',
        members,
      });

      SoundEngine.playSuccess();
      NavigationManager.closeModal('modal-create-group');
      NavigationManager.showToast(`✨ Created "${newGrp.name}" with ${members.length + 1} members!`, 'success');
      this.open(newGrp.id);
    });

    NavigationManager.openModal('modal-create-group');
  }

  /**
   * Modal to Add Expense to Group
   */
  static openAddExpenseModal(group) {
    const modal = document.getElementById('modal-add-expense');
    if (!modal) return;

    const body = modal.querySelector('.sheet-body');
    const footer = modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    const members = stateManager.getGroupMembers(group.id);
    let splitType = 'equal';

    body.innerHTML = `
      <div style="text-align: center; margin-bottom: 12px;">
        <span class="badge badge-accent">${group.name}</span>
        <h3 class="h3" style="color: var(--text-primary); margin-top: 4px;">Add Shared Expense</h3>
      </div>

      <div class="form-group">
        <label class="form-label">Expense Description</label>
        <input type="text" class="input-text" id="expense-desc-input" placeholder="e.g. Dinner at Dosa Corner, Grocery, Swiggy" value="Dinner & Snacks" />
      </div>

      <div class="card" style="text-align: center; padding: 14px; margin-bottom: 12px;">
        <div style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 600;">TOTAL AMOUNT</div>
        <div class="amount-input-hero" style="padding: 6px 0;">
          <span class="amount-currency">₹</span>
          <input type="number" class="amount-hero-field" id="expense-total-amount" value="600" min="1" step="10" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Paid By</label>
        <select class="input-text" id="expense-paid-by-select">
          ${members
            .map(
              (m) => `
            <option value="${m.id}" ${m.isCurrentUser ? 'selected' : ''}>
              ${m.name} ${m.isCurrentUser ? '(You)' : ''}
            </option>
          `
            )
            .join('')}
        </select>
      </div>

      <!-- Split Type Tabs -->
      <div class="form-group">
        <label class="form-label">Split Type</label>
        <div style="display: flex; gap: 8px;">
          <button class="pill-btn active" id="btn-split-type-equal" style="flex: 1;">Equal Split</button>
          <button class="pill-btn" id="btn-split-type-custom" style="flex: 1;">Custom Amounts</button>
        </div>
      </div>

      <!-- Split Members Selector -->
      <div class="form-group" id="split-participants-container">
        <!-- Rendered dynamically -->
      </div>
    `;

    footer.innerHTML = `
      <button class="btn btn-primary" id="btn-submit-add-expense">Record Expense</button>
      <button class="btn btn-ghost btn-sm" data-close-modal="modal-add-expense">Cancel</button>
    `;

    const renderParticipants = () => {
      const container = body.querySelector('#split-participants-container');
      const totalAmt = Number(body.querySelector('#expense-total-amount')?.value) || 0;

      if (splitType === 'equal') {
        container.innerHTML = `
          <label class="form-label" style="display: flex; justify-content: space-between;">
            <span>Split Equally Between:</span>
            <span class="caption" id="equal-share-preview">₹${Math.round(totalAmt / members.length)} each</span>
          </label>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${members
              .map(
                (m) => `
              <label class="card card-interactive" style="padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin: 0;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <input type="checkbox" class="chk-split-member" value="${m.id}" checked style="accent-color: var(--accent-primary);" />
                  <span style="font-size: var(--text-sm); font-weight: 600;">${m.name}</span>
                </div>
              </label>
            `
              )
              .join('')}
          </div>
        `;
      } else {
        // Custom split inputs
        const defaultShare = Math.round(totalAmt / members.length);
        container.innerHTML = `
          <label class="form-label" style="display: flex; justify-content: space-between;">
            <span>Custom Member Amounts:</span>
            <span class="caption" id="custom-sum-indicator">Target: ${WalletEngine.formatRupee(totalAmt)}</span>
          </label>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${members
              .map(
                (m) => `
              <div class="card" style="padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: var(--text-sm); font-weight: 600;">${m.name}</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span style="font-size: var(--text-xs); color: var(--text-muted);">₹</span>
                  <input type="number" class="input-text custom-share-input" data-member="${m.id}" value="${defaultShare}" style="width: 80px; padding: 4px 8px; font-size: var(--text-sm); text-align: right;" />
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        `;
      }
    };

    renderParticipants();

    // Split type buttons
    const equalBtn = body.querySelector('#btn-split-type-equal');
    const customBtn = body.querySelector('#btn-split-type-custom');

    equalBtn.addEventListener('click', () => {
      splitType = 'equal';
      equalBtn.classList.add('active');
      customBtn.classList.remove('active');
      renderParticipants();
      SoundEngine.playTap();
    });

    customBtn.addEventListener('click', () => {
      splitType = 'custom';
      customBtn.classList.add('active');
      equalBtn.classList.remove('active');
      renderParticipants();
      SoundEngine.playTap();
    });

    body.querySelector('#expense-total-amount').addEventListener('input', () => {
      renderParticipants();
    });

    // Submit Add Expense
    footer.querySelector('#btn-submit-add-expense').addEventListener('click', () => {
      const descInput = body.querySelector('#expense-desc-input');
      const amtInput = body.querySelector('#expense-total-amount');
      const payerSelect = body.querySelector('#expense-paid-by-select');

      const desc = descInput ? descInput.value.trim() : '';
      const totalAmount = Number(amtInput?.value) || 0;
      const paidBy = payerSelect ? payerSelect.value : members[0].id;

      if (!desc) {
        NavigationManager.showToast('Please enter an expense description', 'warning');
        return;
      }
      if (totalAmount <= 0) {
        NavigationManager.showToast('Please enter a valid amount', 'warning');
        return;
      }

      let shares = [];
      if (splitType === 'equal') {
        const checkedMembers = [];
        body.querySelectorAll('.chk-split-member:checked').forEach((chk) => {
          checkedMembers.push(chk.value);
        });

        if (checkedMembers.length === 0) {
          NavigationManager.showToast('Select at least one member to split between', 'warning');
          return;
        }

        shares = SplitEngine.calculateEqualShares(totalAmount, checkedMembers);
      } else {
        body.querySelectorAll('.custom-share-input').forEach((input) => {
          const memId = input.getAttribute('data-member');
          const shareVal = Number(input.value) || 0;
          shares.push({
            memberId: memId,
            shareAmount: shareVal,
          });
        });

        const validation = SplitEngine.validateCustomShares(totalAmount, shares);
        if (!validation.valid) {
          NavigationManager.showToast(validation.error, 'danger');
          return;
        }
      }

      stateManager.addSplitExpense({
        groupId: group.id,
        description: desc,
        amount: totalAmount,
        paidBy,
        splitType,
        shares,
      });

      SoundEngine.playSuccess();
      NavigationManager.closeModal('modal-add-expense');
      NavigationManager.showToast(`Recorded "${desc}" for ${WalletEngine.formatRupee(totalAmount)}!`, 'success');
      this.render();
    });

    NavigationManager.openModal('modal-add-expense');
  }
}
