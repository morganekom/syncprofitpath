// ================================================================
// ADMIN / SETTINGS.JS
// Handles all admin settings sections:
//   - Investment Plans (carried over from plans.js)
//   - Withdrawal limits
//   - Deposit wallet addresses + min deposit
//   - KYC toggle
//   - Referral bonus
//   - Email / notifications
//   - Site / general (maintenance, registrations)
//
// All non-plan settings live in the site_settings table (one row, id=1)
// Investment plans live in the investment_plans table (unchanged)
// ================================================================


// ── STATE ──
let allPlans        = [];
let activePlan      = null;
let pendingDeleteId = null;
let siteSettings    = null;   // the one row from site_settings


// ================================================================
// INIT
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    bindToggleLabels();
    bindPlanModalListeners();
});


// ================================================================
// LOAD EVERYTHING
// ================================================================

async function loadSettings() {
    const loadingEl  = document.getElementById('settingsLoading');
    const contentEl  = document.getElementById('settingsContent');
    const refreshBtn = document.getElementById('refreshBtn');

    loadingEl.style.display = 'flex';
    contentEl.style.display = 'none';
    if (refreshBtn) { refreshBtn.classList.add('spinning'); refreshBtn.disabled = true; }

    try {
        await Promise.all([loadSiteSettings(), loadPlans()]);
        contentEl.style.display = 'block';
    } catch (err) {
        console.error('loadSettings error:', err.message);
    }

    loadingEl.style.display = 'none';
    if (refreshBtn) { refreshBtn.classList.remove('spinning'); refreshBtn.disabled = false; }
}


// ================================================================
// SITE SETTINGS
// ================================================================

async function loadSiteSettings() {
    const { data, error } = await db
        .from('site_settings')
        .select('*')
        .eq('id', 1)
        .single();

    if (error) throw error;

    siteSettings = data;
    populateSiteSettings(data);
}

function populateSiteSettings(s) {
    // Withdrawal
    document.getElementById('withdrawalMin').value = s.withdrawal_min ?? '';
    document.getElementById('withdrawalMax').value = s.withdrawal_max ?? '';

    // Deposit
    document.getElementById('depositMin').value  = s.deposit_min  ?? '';
    document.getElementById('walletBtc').value   = s.wallet_btc   ?? '';
    document.getElementById('walletEth').value   = s.wallet_eth   ?? '';
    document.getElementById('walletUsdt').value  = s.wallet_usdt  ?? '';
    document.getElementById('walletUsdc').value  = s.wallet_usdc  ?? '';
    document.getElementById('walletSol').value   = s.wallet_sol   ?? '';
    document.getElementById('walletLtc').value   = s.wallet_ltc   ?? '';

    // KYC
    const kycEl = document.getElementById('kycRequired');
    kycEl.checked = s.kyc_required !== false;
    setText('kycRequiredLabel', kycEl.checked ? 'Required' : 'Not Required');

    // Referral
    document.getElementById('referralBonus').value = s.referral_bonus ?? '';

    // Email
    document.getElementById('emailFromName').value = s.email_from_name ?? '';
    document.getElementById('emailSupport').value  = s.email_support   ?? '';

    // Site
    const maintEl = document.getElementById('maintenanceMode');
    const regEl   = document.getElementById('registrationsOpen');
    maintEl.checked = s.maintenance_mode    === true;
    regEl.checked   = s.registrations_open !== false;
    setText('maintenanceModeLabel',  maintEl.checked ? 'On'   : 'Off');
    setText('registrationsOpenLabel', regEl.checked  ? 'Open' : 'Closed');
}


// ── SAVE A SECTION ──

async function saveSection(section) {
    const feedbackEl = document.getElementById(section + 'Feedback');
    const btn = feedbackEl.nextElementSibling;

    feedbackEl.textContent  = '';
    feedbackEl.className    = 'settings-feedback';
    btn.disabled            = true;

    let payload = {};

    switch (section) {
        case 'withdrawal':
            payload = {
                withdrawal_min: parseFloat(document.getElementById('withdrawalMin').value) || 0,
                withdrawal_max: parseFloat(document.getElementById('withdrawalMax').value) || 0,
            };
            if (payload.withdrawal_min > payload.withdrawal_max) {
                showFeedback(feedbackEl, 'Minimum cannot be greater than maximum.', false);
                btn.disabled = false;
                return;
            }
            break;

        case 'deposit':
            payload = {
                deposit_min:  parseFloat(document.getElementById('depositMin').value)    || 0,
                wallet_btc:   document.getElementById('walletBtc').value.trim()  || null,
                wallet_eth:   document.getElementById('walletEth').value.trim()  || null,
                wallet_usdt:  document.getElementById('walletUsdt').value.trim() || null,
                wallet_usdc:  document.getElementById('walletUsdc').value.trim() || null,
                wallet_sol:   document.getElementById('walletSol').value.trim()  || null,
                wallet_ltc:   document.getElementById('walletLtc').value.trim()  || null,
            };
            break;

        case 'kyc':
            payload = { kyc_required: document.getElementById('kycRequired').checked };
            break;

        case 'referral':
            payload = { referral_bonus: parseFloat(document.getElementById('referralBonus').value) || 0 };
            break;

        case 'email':
            payload = {
                email_from_name: document.getElementById('emailFromName').value.trim() || null,
                email_support:   document.getElementById('emailSupport').value.trim()  || null,
            };
            break;

        case 'site':
            payload = {
                maintenance_mode:   document.getElementById('maintenanceMode').checked,
                registrations_open: document.getElementById('registrationsOpen').checked,
            };
            break;
    }

    payload.updated_at = new Date().toISOString();

    try {
        const { error } = await db
            .from('site_settings')
            .update(payload)
            .eq('id', 1);

        if (error) throw error;

        siteSettings = { ...siteSettings, ...payload };
        showFeedback(feedbackEl, 'Saved successfully.', true);

    } catch (err) {
        console.error('saveSection error:', err.message);
        showFeedback(feedbackEl, err.message || 'Save failed. Please try again.', false);
    }

    btn.disabled = false;
}

function showFeedback(el, msg, success) {
    el.textContent = msg;
    el.className   = 'settings-feedback ' + (success ? 'settings-feedback--ok' : 'settings-feedback--err');
    setTimeout(() => { el.textContent = ''; el.className = 'settings-feedback'; }, 4000);
}


// ================================================================
// BIND TOGGLE LABELS
// ================================================================

function bindToggleLabels() {
    const toggles = [
        { id: 'kycRequired',       labelId: 'kycRequiredLabel',       on: 'Required',   off: 'Not Required' },
        { id: 'maintenanceMode',   labelId: 'maintenanceModeLabel',   on: 'On',         off: 'Off'    },
        { id: 'registrationsOpen', labelId: 'registrationsOpenLabel', on: 'Open',       off: 'Closed' },
    ];
    toggles.forEach(({ id, labelId, on, off }) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', function () {
            setText(labelId, this.checked ? on : off);
        });
    });
}


// ================================================================
// INVESTMENT PLANS  (identical logic to plans.js, just embedded here)
// ================================================================

async function loadPlans() {
    const loadingEl = document.getElementById('plansLoading');
    const emptyEl   = document.getElementById('plansEmpty');
    const gridEl    = document.getElementById('plansGrid');

    loadingEl.style.display = 'flex';
    emptyEl.style.display   = 'none';
    gridEl.style.display    = 'none';

    const { data, error } = await db
        .from('investment_plans')
        .select('*')
        .order('sort_order', { ascending: true });

    loadingEl.style.display = 'none';

    if (error) {
        console.error('Load plans error:', error.message);
        emptyEl.style.display = 'flex';
        document.querySelector('#plansEmpty p').textContent = 'Failed to load plans. Please refresh.';
        return;
    }

    allPlans = data || [];
    renderGrid();
}

function renderGrid() {
    const emptyEl = document.getElementById('plansEmpty');
    const gridEl  = document.getElementById('plansGrid');

    if (allPlans.length === 0) {
        emptyEl.style.display = 'flex';
        gridEl.style.display  = 'none';
        return;
    }

    emptyEl.style.display = 'none';
    gridEl.style.display  = 'grid';
    gridEl.innerHTML      = allPlans.map(p => buildPlanCard(p)).join('');
    initDragSort();
}

function buildPlanCard(p) {
    const tierClass  = escapeHtml(p.tier_class    || 'plan-basic');
    const name       = escapeHtml(p.name          || 'Unnamed Plan');
    const badge      = escapeHtml(p.badge_label   || '');
    const dailyRate  = p.daily_rate      != null ? p.daily_rate + '%'       : '—';
    const roi        = p.roi_multiplier  != null ? p.roi_multiplier + '×'   : '—';
    const minAmt     = p.min_amount      != null ? '$' + formatNum(p.min_amount) : '—';
    const maxAmt     = p.max_amount      != null ? '$' + formatNum(p.max_amount) : '—';
    const returnType = escapeHtml(p.return_type   || '—');
    const withdraw   = escapeHtml(p.withdraw      || '—');
    const isActive   = p.is_active !== false;

    const statusClass = isActive ? 'active'    : 'inactive';
    const statusIcon  = isActive ? 'uil-check' : 'uil-minus';
    const statusLabel = isActive ? 'Active'    : 'Inactive';
    const cardClass   = isActive ? ''          : 'plan-inactive';

    return `
        <div class="plan-admin-card ${cardClass}" data-id="${escapeHtml(String(p.id))}" draggable="true">
            <div class="plan-admin-strip ${tierClass}">
                <div class="plan-admin-strip-left">
                    <span class="plan-admin-name">${name}</span>
                    ${badge ? `<span class="plan-admin-badge">${badge}</span>` : ''}
                </div>
                <span class="plan-admin-status ${statusClass}">
                    <i class="uil ${statusIcon}"></i> ${statusLabel}
                </span>
            </div>
            <div class="plan-admin-body">
                <div class="plan-admin-row">
                    <span class="plan-admin-row-label">Daily Rate</span>
                    <span class="plan-admin-row-value">${dailyRate}</span>
                </div>
                <div class="plan-admin-row">
                    <span class="plan-admin-row-label">ROI Multiplier</span>
                    <span class="plan-admin-row-value">${roi}</span>
                </div>
                <div class="plan-admin-row">
                    <span class="plan-admin-row-label">Min / Max</span>
                    <span class="plan-admin-row-value">${minAmt} – ${maxAmt}</span>
                </div>
                <div class="plan-admin-row">
                    <span class="plan-admin-row-label">Return Type</span>
                    <span class="plan-admin-row-value">${returnType}</span>
                </div>
                <div class="plan-admin-row">
                    <span class="plan-admin-row-label">Maturity Period</span>
                    <span class="plan-admin-row-value">${withdraw}</span>
                </div>
            </div>
            <div class="plan-admin-footer">
                <button class="plan-edit-btn" onclick="openEditModal('${escapeHtml(String(p.id))}')">
                    <i class="uil uil-edit"></i> Edit Plan
                </button>
            </div>
        </div>
    `;
}

function openEditModal(id) {
    activePlan = allPlans.find(p => String(p.id) === String(id));
    if (!activePlan) return;
    const p = activePlan;

    setText('planModalTitle', 'Edit Plan');
    setText('pmSaveBtnLabel', 'Save Changes');

    document.getElementById('pmId').value         = p.id;
    document.getElementById('pmName').value       = p.name         || '';
    document.getElementById('pmSlug').value       = p.slug         || '';
    document.getElementById('pmTier').value       = p.tier_class   || '';
    document.getElementById('pmBadge').value      = p.badge_label  || '';
    document.getElementById('pmSlug').readOnly    = true;
    document.getElementById('pmTier').readOnly    = true;
    document.getElementById('pmBadge').readOnly   = true;
    document.getElementById('pmRoi').readOnly     = true;
    document.getElementById('pmDailyRate').value  = p.daily_rate      != null ? p.daily_rate     : '';
    document.getElementById('pmRoi').value        = p.roi_multiplier  != null ? p.roi_multiplier : '';
    document.getElementById('pmMin').value        = p.min_amount      != null ? p.min_amount     : '';
    document.getElementById('pmMax').value        = p.max_amount      != null ? p.max_amount     : '';
    document.getElementById('pmReturnType').value = p.return_type  || '';
    document.getElementById('pmWithdraw').value   = p.withdraw     || '';
    document.getElementById('pmCancelTime').value = p.cancel_time  || '';
    document.getElementById('pmSortOrder').value  = p.sort_order   != null ? p.sort_order : '';

    const isActive = p.is_active !== false;
    document.getElementById('pmIsActive').checked = isActive;
    setText('pmActiveLabel', isActive ? 'Active' : 'Inactive');
    document.getElementById('pmDeleteBtn').style.display = 'inline-flex';
    document.getElementById('pmError').textContent       = '';
    openPlanModal();
}

function openAddModal() {
    activePlan = null;
    setText('planModalTitle', 'Add Plan');
    setText('pmSaveBtnLabel', 'Create Plan');
    ['pmId','pmName','pmSlug','pmTier','pmBadge','pmDailyRate','pmRoi',
     'pmMin','pmMax','pmReturnType','pmWithdraw','pmCancelTime','pmSortOrder']
        .forEach(id => {
            const el    = document.getElementById(id);
            el.value    = '';
            el.readOnly = false;
        });
    document.getElementById('pmIsActive').checked          = true;
    setText('pmActiveLabel', 'Active');
    document.getElementById('pmDeleteBtn').style.display   = 'none';
    document.getElementById('pmError').textContent         = '';
    openPlanModal();
}

function openPlanModal() {
    document.getElementById('planModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closePlanModal(event) {
    if (event && event.target !== document.getElementById('planModal')) return;
    document.getElementById('planModal').classList.remove('open');
    document.body.style.overflow = '';
    activePlan = null;
}

async function savePlan() {
    const saveBtn = document.getElementById('pmSaveBtn');
    const errorEl = document.getElementById('pmError');

    const name      = document.getElementById('pmName').value.trim();
    const slug      = document.getElementById('pmSlug').value.trim();
    const tierClass = document.getElementById('pmTier').value.trim();
    const badge     = document.getElementById('pmBadge').value.trim();
    const dailyRate = document.getElementById('pmDailyRate').value;
    const roi       = document.getElementById('pmRoi').value;
    const minAmt    = document.getElementById('pmMin').value;
    const maxAmt    = document.getElementById('pmMax').value;
    const retType   = document.getElementById('pmReturnType').value.trim();
    const withdraw  = document.getElementById('pmWithdraw').value.trim();
    const cancel    = document.getElementById('pmCancelTime').value.trim();
    const sortOrder = document.getElementById('pmSortOrder').value;
    const isActive  = document.getElementById('pmIsActive').checked;

    errorEl.textContent = '';

    if (!name) { errorEl.textContent = 'Plan name is required.'; return; }
    if (!slug) { errorEl.textContent = 'Slug is required.'; return; }
    if (slug.includes(' ')) { errorEl.textContent = 'Slug cannot contain spaces.'; return; }

    const payload = {
        name,
        slug,
        tier_class:     tierClass  || null,
        badge_label:    badge      || null,
        daily_rate:     dailyRate  !== '' ? parseFloat(dailyRate)  : null,
        roi_multiplier: roi        !== '' ? parseFloat(roi)        : null,
        min_amount:     minAmt     !== '' ? parseFloat(minAmt)     : null,
        max_amount:     maxAmt     !== '' ? parseFloat(maxAmt)     : null,
        return_type:    retType    || null,
        withdraw:       withdraw   || null,
        cancel_time:    cancel     || null,
        sort_order:     sortOrder  !== '' ? parseInt(sortOrder, 10) : null,
        is_active:      isActive,
    };

    saveBtn.disabled = true;
    setText('pmSaveBtnLabel', activePlan ? 'Saving…' : 'Creating…');

    try {
        let error;
        if (activePlan) {
            ({ error } = await db.from('investment_plans').update(payload).eq('id', activePlan.id));
        } else {
            ({ error } = await db.from('investment_plans').insert(payload));
        }
        if (error) throw error;

        document.getElementById('planModal').classList.remove('open');
        document.body.style.overflow = '';
        activePlan = null;
        await loadPlans();

    } catch (err) {
        console.error('Save plan error:', err.message);
        errorEl.textContent = err.message || 'Something went wrong.';
    }

    saveBtn.disabled = false;
    setText('pmSaveBtnLabel', activePlan ? 'Save Changes' : 'Create Plan');
}

function deletePlan() {
    if (!activePlan) return;
    pendingDeleteId = activePlan.id;
    setText('dcPlanName', activePlan.name || 'this plan');
    document.getElementById('planModal').classList.remove('open');
    document.getElementById('deleteConfirmModal').classList.add('open');
}

function closeDeleteConfirm(event) {
    if (event && event.target !== document.getElementById('deleteConfirmModal')) return;
    document.getElementById('deleteConfirmModal').classList.remove('open');
    document.body.style.overflow = '';
    pendingDeleteId = null;
}

async function confirmDeletePlan() {
    if (!pendingDeleteId) return;
    const confirmBtn = document.querySelector('#deleteConfirmModal .action-btn.reject');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="uil uil-spinner-alt spin"></i> Deleting…';

    try {
        const { error } = await db.from('investment_plans').delete().eq('id', pendingDeleteId);
        if (error) throw error;
        document.getElementById('deleteConfirmModal').classList.remove('open');
        document.body.style.overflow = '';
        pendingDeleteId = null;
        activePlan      = null;
        await loadPlans();
    } catch (err) {
        console.error('Delete plan error:', err.message);
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="uil uil-trash-alt"></i> Yes, Delete';
        alert('Delete failed: ' + err.message);
    }
}

function bindPlanModalListeners() {
    document.getElementById('pmIsActive').addEventListener('change', function () {
        setText('pmActiveLabel', this.checked ? 'Active' : 'Inactive');
    });
    document.getElementById('pmDailyRate').addEventListener('input', function () {
        const rate = parseFloat(this.value);
        if (isNaN(rate) || rate <= 0) return;
        document.getElementById('pmRoi').value   = parseFloat((1 + (rate / 100) * 30).toFixed(2));
        document.getElementById('pmBadge').value = 'Daily ' + rate + '%';
    });
}

function initDragSort() {
    const grid = document.getElementById('plansGrid');
    const hint = document.getElementById('plansOrderHint');
    let dragSrc = null;

    grid.querySelectorAll('.plan-admin-card').forEach(card => {
        card.addEventListener('dragstart', function (e) {
            dragSrc = this;
            this.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        card.addEventListener('dragend', function () {
            this.classList.remove('dragging');
            grid.querySelectorAll('.plan-admin-card').forEach(c => c.classList.remove('drag-over'));
        });
        card.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (this !== dragSrc) {
                grid.querySelectorAll('.plan-admin-card').forEach(c => c.classList.remove('drag-over'));
                this.classList.add('drag-over');
            }
        });
        card.addEventListener('drop', function (e) {
            e.preventDefault();
            if (dragSrc && this !== dragSrc) {
                const allCards = [...grid.querySelectorAll('.plan-admin-card')];
                const srcIdx   = allCards.indexOf(dragSrc);
                const tgtIdx   = allCards.indexOf(this);
                if (srcIdx < tgtIdx) grid.insertBefore(dragSrc, this.nextSibling);
                else                  grid.insertBefore(dragSrc, this);
                hint.style.display = 'flex';
            }
        });
    });
}

async function saveOrder() {
    const hint    = document.getElementById('plansOrderHint');
    const saveBtn = hint.querySelector('.save-order-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="uil uil-spinner-alt spin"></i> Saving…';

    try {
        const cards   = [...document.querySelectorAll('#plansGrid .plan-admin-card')];
        const updates = cards.map((card, index) => ({ id: card.dataset.id, sort_order: index + 1 }));
        for (const u of updates) {
            const { error } = await db.from('investment_plans').update({ sort_order: u.sort_order }).eq('id', u.id);
            if (error) throw error;
        }
        hint.style.display = 'none';
        await loadPlans();
    } catch (err) {
        console.error('Save order error:', err.message);
        alert('Failed to save order: ' + err.message);
    }

    saveBtn.disabled  = false;
    saveBtn.innerHTML = '<i class="uil uil-check"></i> Save Order';
}
