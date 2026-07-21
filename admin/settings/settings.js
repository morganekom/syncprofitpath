// ================================================================
// ADMIN / SETTINGS.JS
// Sections:
//   Investment Plans  — edit modal (unchanged)
//   Withdrawal        — dirty-state button (color-light → primary on change)
//   Deposit           — locked view + edit modal + confirm modal
//   KYC               — auto-save on toggle, no button
//   Referral          — dirty-state button
//   Email             — dirty-state button
//   Site & General    — auto-save on toggle, no button
// ================================================================


// ── STATE ──
let allPlans        = [];
let activePlan      = null;
let pendingDeleteId = null;
let siteSettings    = null;

let allFaqs            = [];
let activeFaq          = null;
let pendingDeleteFaqId = null;

let landingFooter = null;


// ================================================================
// INIT
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    bindToggleLabels();
    bindPlanModalListeners();
    bindDirtyListeners();
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
        await Promise.all([loadSiteSettings(), loadPlans(), loadFaqs(), loadFooterSettings(), loadTestimonials()]);
        contentEl.style.display = 'block';
    } catch (err) {
        console.error('loadSettings error:', err.message);
    }

    loadingEl.style.display = 'none';
    if (refreshBtn) { refreshBtn.classList.remove('spinning'); refreshBtn.disabled = false; }
}


// ================================================================
// SITE SETTINGS — LOAD & POPULATE
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
    resetDirty('withdrawal');

    // Deposit — show locked view
    populateDepositLockedView(s);

    // KYC
    const kycEl = document.getElementById('kycRequired');
    kycEl.checked = s.kyc_required !== false;
    setText('kycRequiredLabel', kycEl.checked ? 'Required' : 'Not Required');

    // Referral
    document.getElementById('referralBonus').value = s.referral_bonus ?? '';
    resetDirty('referral');

    // Email
    document.getElementById('emailFromName').value = s.email_from_name ?? '';
    document.getElementById('emailSupport').value  = s.email_support   ?? '';
    resetDirty('email');

    // Site
    const maintEl = document.getElementById('maintenanceMode');
    const regEl   = document.getElementById('registrationsOpen');
    maintEl.checked = s.maintenance_mode    === true;
    regEl.checked   = s.registrations_open !== false;
    setText('maintenanceModeLabel',  maintEl.checked ? 'On'   : 'Off');
    setText('registrationsOpenLabel', regEl.checked  ? 'Open' : 'Closed');
}

// Populate the read-only locked deposit view
function populateDepositLockedView(s) {
    setText('lockedDepositMin',  s.deposit_min  != null ? '$' + formatNum(s.deposit_min) : '—');
    setText('lockedWalletBtc',   s.wallet_btc   || '—');
    setText('lockedWalletEth',   s.wallet_eth   || '—');
    setText('lockedWalletUsdt',  s.wallet_usdt  || '—');
    setText('lockedWalletUsdc',  s.wallet_usdc  || '—');
    setText('lockedWalletSol',   s.wallet_sol   || '—');
    setText('lockedWalletLtc',   s.wallet_ltc   || '—');
}


// ================================================================
// DIRTY-STATE BUTTONS
// Sections: withdrawal, referral, email
// Btn starts as color-light / "Saved", turns primary / "Save" on input
// ================================================================

const DIRTY_SECTIONS = ['withdrawal', 'referral', 'email', 'footer'];

function bindDirtyListeners() {
    // Withdrawal inputs
    ['withdrawalMin', 'withdrawalMax'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => markDirty('withdrawal'));
    });
    // Referral inputs
    ['referralBonus'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => markDirty('referral'));
    });
    // Email inputs
    ['emailFromName', 'emailSupport'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => markDirty('email'));
    });
    // Footer inputs
    [
        'footerTaglineInput', 'footerTwitterInput', 'footerTelegramInput', 'footerWhatsappInput',
        'footerInstagramInput', 'footerContactInput', 'footerPrivacyInput', 'footerTermsInput',
        'footerCopyrightInput', 'footerDisclaimerInput'
    ].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => markDirty('footer'));
    });
}

function markDirty(section) {
    const btn = document.getElementById(section + 'SaveBtn');
    if (!btn) return;
    btn.classList.add('dirty');
    btn.innerHTML = '<i class="uil uil-check-circle"></i> Save';
}

function resetDirty(section) {
    const btn = document.getElementById(section + 'SaveBtn');
    if (!btn) return;
    btn.classList.remove('dirty');
    btn.innerHTML = '<i class="uil uil-check-circle"></i> Saved';
}


// ================================================================
// SAVE SECTION
// ================================================================

async function saveSection(section) {
    const btn        = document.getElementById(section + 'SaveBtn');
    const feedbackEl = document.getElementById(section + 'Feedback');

    if (feedbackEl) { feedbackEl.textContent = ''; feedbackEl.className = 'settings-feedback'; }
    if (btn) btn.disabled = true;

    let payload = {};

    switch (section) {
        case 'withdrawal':
            payload = {
                withdrawal_min: parseFloat(document.getElementById('withdrawalMin').value) || 0,
                withdrawal_max: parseFloat(document.getElementById('withdrawalMax').value) || 0,
            };
            if (payload.withdrawal_min > payload.withdrawal_max) {
                if (feedbackEl) showFeedback(feedbackEl, 'Minimum cannot be greater than maximum.', false);
                if (btn) btn.disabled = false;
                return;
            }
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

        case 'kyc':
            payload = { kyc_required: document.getElementById('kycRequired').checked };
            break;

        case 'site':
            payload = {
                maintenance_mode:   document.getElementById('maintenanceMode').checked,
                registrations_open: document.getElementById('registrationsOpen').checked,
            };
            break;

        case 'footer':
            payload = {
                brand_tagline:        document.getElementById('footerTaglineInput').value.trim()    || null,
                social_twitter_url:   document.getElementById('footerTwitterInput').value.trim()    || null,
                social_telegram_url:  document.getElementById('footerTelegramInput').value.trim()   || null,
                social_whatsapp_url:  document.getElementById('footerWhatsappInput').value.trim()   || null,
                social_instagram_url: document.getElementById('footerInstagramInput').value.trim()  || null,
                contact_url:          document.getElementById('footerContactInput').value.trim()    || null,
                privacy_policy_url:   document.getElementById('footerPrivacyInput').value.trim()    || null,
                terms_url:            document.getElementById('footerTermsInput').value.trim()      || null,
                copyright_text:       document.getElementById('footerCopyrightInput').value.trim()  || null,
                disclaimer_text:      document.getElementById('footerDisclaimerInput').value.trim() || null,
            };
            break;
    }

    payload.updated_at = new Date().toISOString();

    try {
        const table = section === 'footer' ? 'landing_footer' : 'site_settings';

        const { error } = await db
            .from(table)
            .update(payload)
            .eq('id', 1);

        if (error) throw error;

        if (section === 'footer') {
            landingFooter = { ...landingFooter, ...payload };
        } else {
            siteSettings = { ...siteSettings, ...payload };
        }

        // Dirty-state sections: reset to "Saved"
        if (DIRTY_SECTIONS.includes(section)) {
            resetDirty(section);
        }

        if (feedbackEl) showFeedback(feedbackEl, 'Saved.', true);

    } catch (err) {
        console.error('saveSection error:', err.message);
        if (feedbackEl) showFeedback(feedbackEl, err.message || 'Save failed.', false);
    }

    if (btn) btn.disabled = false;
}

function showFeedback(el, msg, success) {
    el.textContent = msg;
    el.className   = 'settings-feedback ' + (success ? 'settings-feedback--ok' : 'settings-feedback--err');
    setTimeout(() => { if (el) { el.textContent = ''; el.className = 'settings-feedback'; } }, 4000);
}


// ================================================================
// KYC + SITE TOGGLES — auto-save on change, no button needed
// ================================================================

function bindToggleLabels() {
    const toggles = [
        { id: 'kycRequired',       labelId: 'kycRequiredLabel',       on: 'Required', off: 'Not Required', section: 'kyc'  },
        { id: 'maintenanceMode',   labelId: 'maintenanceModeLabel',   on: 'On',       off: 'Off',          section: 'site' },
        { id: 'registrationsOpen', labelId: 'registrationsOpenLabel', on: 'Open',     off: 'Closed',       section: 'site' },
    ];

    toggles.forEach(({ id, labelId, on, off, section }) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', function () {
            setText(labelId, this.checked ? on : off);
            saveSection(section);
        });
    });
}


// ================================================================
// DEPOSIT SECTION — locked view + edit modal + confirm modal
// ================================================================

function openDepositEditModal() {
    if (!siteSettings) return;
    const s = siteSettings;

    // Populate the edit modal fields with current values
    document.getElementById('dmDepositMin').value  = s.deposit_min  ?? '';
    document.getElementById('dmWalletBtc').value   = s.wallet_btc   ?? '';
    document.getElementById('dmWalletEth').value   = s.wallet_eth   ?? '';
    document.getElementById('dmWalletUsdt').value  = s.wallet_usdt  ?? '';
    document.getElementById('dmWalletUsdc').value  = s.wallet_usdc  ?? '';
    document.getElementById('dmWalletSol').value   = s.wallet_sol   ?? '';
    document.getElementById('dmWalletLtc').value   = s.wallet_ltc   ?? '';
    document.getElementById('dmError').textContent = '';

    document.getElementById('depositEditModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeDepositEditModal(event) {
    if (event && event.target !== document.getElementById('depositEditModal')) return;
    document.getElementById('depositEditModal').classList.remove('open');
    document.body.style.overflow = '';
}

// "Save" in edit modal → show confirm modal
function requestDepositSave() {
    const errorEl = document.getElementById('dmError');
    errorEl.textContent = '';

    const min = parseFloat(document.getElementById('dmDepositMin').value);
    if (isNaN(min) || min < 0) {
        errorEl.textContent = 'Minimum deposit must be a valid positive number.';
        return;
    }

    // Pass staged values to confirm modal
    document.getElementById('confirmDepositMin').textContent   = '$' + formatNum(min);
    document.getElementById('confirmWalletBtc').textContent    = document.getElementById('dmWalletBtc').value.trim()  || '—';
    document.getElementById('confirmWalletEth').textContent    = document.getElementById('dmWalletEth').value.trim()  || '—';
    document.getElementById('confirmWalletUsdt').textContent   = document.getElementById('dmWalletUsdt').value.trim() || '—';
    document.getElementById('confirmWalletUsdc').textContent   = document.getElementById('dmWalletUsdc').value.trim() || '—';
    document.getElementById('confirmWalletSol').textContent    = document.getElementById('dmWalletSol').value.trim()  || '—';
    document.getElementById('confirmWalletLtc').textContent    = document.getElementById('dmWalletLtc').value.trim()  || '—';

    document.getElementById('depositEditModal').classList.remove('open');
    document.getElementById('depositConfirmModal').classList.add('open');
}

function closeDepositConfirmModal(event) {
    if (event && event.target !== document.getElementById('depositConfirmModal')) return;
    // Go back to edit modal
    document.getElementById('depositConfirmModal').classList.remove('open');
    document.getElementById('depositEditModal').classList.add('open');
}

function cancelDepositConfirm() {
    document.getElementById('depositConfirmModal').classList.remove('open');
    document.getElementById('depositEditModal').classList.add('open');
}

async function confirmDepositSave() {
    const confirmBtn = document.getElementById('depositConfirmBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="uil uil-spinner-alt spin"></i> Saving…';

    const payload = {
        deposit_min:  parseFloat(document.getElementById('dmDepositMin').value) || 0,
        wallet_btc:   document.getElementById('dmWalletBtc').value.trim()  || null,
        wallet_eth:   document.getElementById('dmWalletEth').value.trim()  || null,
        wallet_usdt:  document.getElementById('dmWalletUsdt').value.trim() || null,
        wallet_usdc:  document.getElementById('dmWalletUsdc').value.trim() || null,
        wallet_sol:   document.getElementById('dmWalletSol').value.trim()  || null,
        wallet_ltc:   document.getElementById('dmWalletLtc').value.trim()  || null,
        updated_at:   new Date().toISOString(),
    };

    try {
        const { error } = await db
            .from('site_settings')
            .update(payload)
            .eq('id', 1);

        if (error) throw error;

        siteSettings = { ...siteSettings, ...payload };
        populateDepositLockedView(siteSettings);

        document.getElementById('depositConfirmModal').classList.remove('open');
        document.body.style.overflow = '';

    } catch (err) {
        console.error('confirmDepositSave error:', err.message);
        document.getElementById('depositConfirmModal').classList.remove('open');
        document.getElementById('depositEditModal').classList.add('open');
        document.getElementById('dmError').textContent = err.message || 'Save failed. Please try again.';
    }

    confirmBtn.disabled = false;
    confirmBtn.innerHTML = '<i class="uil uil-check-circle"></i> Reconfirm & Save';
}


// ================================================================
// INVESTMENT PLANS
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
    const dailyRate  = p.daily_rate      != null ? p.daily_rate + '%'             : '—';
    const roi        = p.roi_multiplier  != null ? p.roi_multiplier + '×'         : '—';
    const minAmt     = p.min_amount      != null ? '$' + formatNum(p.min_amount)  : '—';
    const maxAmt     = p.max_amount      != null ? '$' + formatNum(p.max_amount)  : '—';
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
    document.getElementById('pmIsActive').checked        = true;
    setText('pmActiveLabel', 'Active');
    document.getElementById('pmDeleteBtn').style.display = 'none';
    document.getElementById('pmError').textContent       = '';
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
        daily_rate:     dailyRate  !== '' ? parseFloat(dailyRate)   : null,
        roi_multiplier: roi        !== '' ? parseFloat(roi)         : null,
        min_amount:     minAmt     !== '' ? parseFloat(minAmt)      : null,
        max_amount:     maxAmt     !== '' ? parseFloat(maxAmt)      : null,
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
    saveBtn.disabled  = true;
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


// ================================================================
// LANDING PAGE FAQ
// ================================================================

async function loadFaqs() {
    const loadingEl = document.getElementById('faqsLoading');
    const emptyEl   = document.getElementById('faqsEmpty');
    const listEl    = document.getElementById('faqsList');

    loadingEl.style.display = 'flex';
    emptyEl.style.display   = 'none';
    listEl.style.display    = 'none';

    const { data, error } = await db
        .from('landing_faqs')
        .select('*')
        .order('sort_order', { ascending: true });

    loadingEl.style.display = 'none';

    if (error) {
        console.error('Load FAQs error:', error.message);
        emptyEl.style.display = 'flex';
        document.querySelector('#faqsEmpty p').textContent = 'Failed to load FAQs. Please refresh.';
        return;
    }

    allFaqs = data || [];
    renderFaqsList();
}

function renderFaqsList() {
    const emptyEl = document.getElementById('faqsEmpty');
    const listEl  = document.getElementById('faqsList');
    const hint    = document.getElementById('faqsOrderHint');

    if (allFaqs.length === 0) {
        emptyEl.style.display = 'flex';
        listEl.style.display  = 'none';
        hint.style.display    = 'none';
        return;
    }

    emptyEl.style.display = 'none';
    listEl.style.display  = 'flex';
    listEl.innerHTML      = allFaqs.map(f => buildFaqCard(f)).join('');
    initFaqDragSort();
}

function buildFaqCard(f) {
    const question  = escapeHtml(f.question || 'Untitled question');
    const answer    = escapeHtml(f.answer || '');
    const isActive  = f.is_active !== false;
    const cardClass = isActive ? '' : 'faq-inactive';
    const statusClass = isActive ? 'active'   : 'inactive';
    const statusLabel = isActive ? 'Visible'  : 'Hidden';

    return `
        <div class="faq-admin-card ${cardClass}" data-id="${escapeHtml(String(f.id))}" draggable="true">
            <i class="uil uil-draggabledots faq-admin-drag"></i>
            <div class="faq-admin-body">
                <div class="faq-admin-question">${question}</div>
                <div class="faq-admin-answer">${answer}</div>
                <span class="faq-admin-status ${statusClass}">
                    <i class="uil ${isActive ? 'uil-check' : 'uil-minus'}"></i> ${statusLabel}
                </span>
            </div>
            <div class="faq-admin-actions">
                <button onclick="openEditFaqModal('${escapeHtml(String(f.id))}')" aria-label="Edit FAQ">
                    <i class="uil uil-edit"></i>
                </button>
                <button class="faq-admin-delete" onclick="requestDeleteFaq('${escapeHtml(String(f.id))}')" aria-label="Delete FAQ">
                    <i class="uil uil-trash-alt"></i>
                </button>
            </div>
        </div>
    `;
}


// ── ADD / EDIT MODAL ──

function openAddFaqModal() {
    activeFaq = null;
    document.getElementById('faqModalTitle').textContent = 'Add FAQ';
    document.getElementById('fmId').value       = '';
    document.getElementById('fmQuestion').value = '';
    document.getElementById('fmAnswer').value   = '';
    document.getElementById('fmActive').checked = true;
    document.getElementById('fmError').textContent = '';

    document.getElementById('faqModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function openEditFaqModal(id) {
    activeFaq = allFaqs.find(f => String(f.id) === String(id));
    if (!activeFaq) return;

    document.getElementById('faqModalTitle').textContent = 'Edit FAQ';
    document.getElementById('fmId').value       = activeFaq.id;
    document.getElementById('fmQuestion').value = activeFaq.question || '';
    document.getElementById('fmAnswer').value   = activeFaq.answer || '';
    document.getElementById('fmActive').checked = activeFaq.is_active !== false;
    document.getElementById('fmError').textContent = '';

    document.getElementById('faqModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeFaqModal(event) {
    if (event && event.target !== document.getElementById('faqModal')) return;
    document.getElementById('faqModal').classList.remove('open');
    document.body.style.overflow = '';
    activeFaq = null;
}

async function saveFaq() {
    const errorEl  = document.getElementById('fmError');
    const saveBtn  = document.getElementById('fmSaveBtn');
    errorEl.textContent = '';

    const question = document.getElementById('fmQuestion').value.trim();
    const answer   = document.getElementById('fmAnswer').value.trim();
    const isActive = document.getElementById('fmActive').checked;

    if (!question || !answer) {
        errorEl.textContent = 'Both question and answer are required.';
        return;
    }

    saveBtn.disabled  = true;
    saveBtn.innerHTML = '<i class="uil uil-spinner-alt spin"></i> Saving…';

    const payload = {
        question,
        answer,
        is_active:  isActive,
        updated_at: new Date().toISOString(),
    };

    try {
        let error;
        if (activeFaq) {
            ({ error } = await db.from('landing_faqs').update(payload).eq('id', activeFaq.id));
        } else {
            payload.sort_order = allFaqs.length > 0
                ? Math.max(...allFaqs.map(f => f.sort_order || 0)) + 1
                : 1;
            ({ error } = await db.from('landing_faqs').insert(payload));
        }

        if (error) throw error;

        document.getElementById('faqModal').classList.remove('open');
        document.body.style.overflow = '';
        activeFaq = null;
        await loadFaqs();

    } catch (err) {
        console.error('saveFaq error:', err.message);
        errorEl.textContent = err.message || 'Save failed. Please try again.';
    }

    saveBtn.disabled  = false;
    saveBtn.innerHTML = '<i class="uil uil-check-circle"></i> Save';
}


// ── DELETE ──

function requestDeleteFaq(id) {
    const faq = allFaqs.find(f => String(f.id) === String(id));
    if (!faq) return;

    pendingDeleteFaqId = id;
    document.getElementById('fdcQuestion').textContent = faq.question || 'this FAQ';
    document.getElementById('faqDeleteConfirmModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeFaqDeleteConfirm(event) {
    if (event && event.target !== document.getElementById('faqDeleteConfirmModal')) return;
    document.getElementById('faqDeleteConfirmModal').classList.remove('open');
    document.body.style.overflow = '';
    pendingDeleteFaqId = null;
}

async function confirmDeleteFaq() {
    if (!pendingDeleteFaqId) return;
    const confirmBtn = document.getElementById('fdcConfirmBtn');
    confirmBtn.disabled  = true;
    confirmBtn.innerHTML = '<i class="uil uil-spinner-alt spin"></i> Deleting…';

    try {
        const { error } = await db.from('landing_faqs').delete().eq('id', pendingDeleteFaqId);
        if (error) throw error;

        document.getElementById('faqDeleteConfirmModal').classList.remove('open');
        document.body.style.overflow = '';
        pendingDeleteFaqId = null;
        await loadFaqs();

    } catch (err) {
        console.error('confirmDeleteFaq error:', err.message);
        alert('Failed to delete: ' + err.message);
    }

    confirmBtn.disabled  = false;
    confirmBtn.innerHTML = '<i class="uil uil-trash-alt"></i> Yes, Delete';
}


// ── DRAG REORDER ──

function initFaqDragSort() {
    const list = document.getElementById('faqsList');
    const hint = document.getElementById('faqsOrderHint');
    let dragSrc = null;

    list.querySelectorAll('.faq-admin-card').forEach(card => {
        card.addEventListener('dragstart', function (e) {
            dragSrc = this;
            this.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        card.addEventListener('dragend', function () {
            this.classList.remove('dragging');
            list.querySelectorAll('.faq-admin-card').forEach(c => c.classList.remove('drag-over'));
        });
        card.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (this !== dragSrc) {
                list.querySelectorAll('.faq-admin-card').forEach(c => c.classList.remove('drag-over'));
                this.classList.add('drag-over');
            }
        });
        card.addEventListener('drop', function (e) {
            e.preventDefault();
            if (dragSrc && this !== dragSrc) {
                const allCards = [...list.querySelectorAll('.faq-admin-card')];
                const srcIdx   = allCards.indexOf(dragSrc);
                const tgtIdx   = allCards.indexOf(this);
                if (srcIdx < tgtIdx) list.insertBefore(dragSrc, this.nextSibling);
                else                  list.insertBefore(dragSrc, this);
                hint.style.display = 'flex';
            }
        });
    });
}

async function saveFaqOrder() {
    const hint    = document.getElementById('faqsOrderHint');
    const saveBtn = hint.querySelector('.save-order-btn');
    saveBtn.disabled  = true;
    saveBtn.innerHTML = '<i class="uil uil-spinner-alt spin"></i> Saving…';

    try {
        const cards   = [...document.querySelectorAll('#faqsList .faq-admin-card')];
        const updates = cards.map((card, index) => ({ id: card.dataset.id, sort_order: index + 1 }));
        for (const u of updates) {
            const { error } = await db.from('landing_faqs').update({ sort_order: u.sort_order }).eq('id', u.id);
            if (error) throw error;
        }
        hint.style.display = 'none';
        await loadFaqs();
    } catch (err) {
        console.error('Save FAQ order error:', err.message);
        alert('Failed to save order: ' + err.message);
    }

    saveBtn.disabled  = false;
    saveBtn.innerHTML = '<i class="uil uil-check"></i> Save Order';
}


// ================================================================
// LANDING PAGE FOOTER — LOAD & POPULATE
// ================================================================

async function loadFooterSettings() {
    const { data, error } = await db
        .from('landing_footer')
        .select('*')
        .eq('id', 1)
        .single();

    if (error) {
        console.error('Load footer settings error:', error.message);
        return;
    }

    landingFooter = data;
    populateFooterSettings(data);
}

function populateFooterSettings(f) {
    document.getElementById('footerTaglineInput').value    = f.brand_tagline        ?? '';
    document.getElementById('footerTwitterInput').value    = f.social_twitter_url   ?? '';
    document.getElementById('footerTelegramInput').value   = f.social_telegram_url  ?? '';
    document.getElementById('footerWhatsappInput').value   = f.social_whatsapp_url  ?? '';
    document.getElementById('footerInstagramInput').value  = f.social_instagram_url ?? '';
    document.getElementById('footerContactInput').value    = f.contact_url          ?? '';
    document.getElementById('footerPrivacyInput').value    = f.privacy_policy_url   ?? '';
    document.getElementById('footerTermsInput').value      = f.terms_url            ?? '';
    document.getElementById('footerCopyrightInput').value  = f.copyright_text       ?? '';
    document.getElementById('footerDisclaimerInput').value = f.disclaimer_text      ?? '';
    resetDirty('footer');
}


// ================================================================
// SETTINGS TABS
// ================================================================

function switchTab(tabId, btn) {
    // Deactivate all panels and buttons
    document.querySelectorAll('.settings-tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));

    // Activate selected
    document.getElementById('tab-' + tabId).classList.add('active');
    btn.classList.add('active');
}


// ================================================================
// TESTIMONIALS — state
// ================================================================

let allTestimonials    = [];
let tmSelectedRating   = 5;
let tmSelectedBg       = '#00e27b';
let tmSelectedColor    = '#27282f';

// Init testimonials UI once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    loadTestimonials();
    initTmStarPicker();
    initTmColorSwatches();
    document.getElementById('tmInitials')?.addEventListener('input', updateTmAvatarPreview);
});


// ================================================================
// LOAD TESTIMONIALS
// ================================================================

async function loadTestimonials() {
    const loadingEl = document.getElementById('tmLoading');
    const emptyEl   = document.getElementById('tmEmpty');
    const listEl    = document.getElementById('tmList');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (emptyEl)   emptyEl.style.display   = 'none';
    if (listEl)    listEl.style.display    = 'none';

    try {
        const { data, error } = await db
            .from('testimonials')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) throw error;

        allTestimonials = data || [];
        renderTmList();

    } catch (err) {
        console.error('loadTestimonials error:', err.message);
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl)   emptyEl.style.display   = 'flex';
    }
}

function renderTmList() {
    const loadingEl = document.getElementById('tmLoading');
    const emptyEl   = document.getElementById('tmEmpty');
    const listEl    = document.getElementById('tmList');

    if (loadingEl) loadingEl.style.display = 'none';

    if (allTestimonials.length === 0) {
        if (emptyEl) emptyEl.style.display = 'flex';
        if (listEl)  listEl.style.display  = 'none';
        return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    if (listEl) {
        listEl.style.display = 'flex';
        listEl.innerHTML = allTestimonials.map(t => buildTmListItem(t)).join('');
    }
}

function buildTmListItem(t) {
    const bg       = t.avatar_bg    || '#00e27b';
    const color    = t.avatar_color || '#27282f';
    const initials = escapeHtml(t.avatar_initials || '?');
    const starsOn  = '★'.repeat(Math.min(5, Math.max(1, t.rating || 5)));
    const starsOff = '★'.repeat(5 - (t.rating || 5));
    const isVisible = t.is_visible !== false;
    const visClass  = isVisible ? 'visible' : 'hidden-ic';
    const visIcon   = isVisible ? 'uil-eye' : 'uil-eye-slash';
    const visTitle  = isVisible ? 'Hide from landing page' : 'Show on landing page';

    return `
        <div class="tm-list-item" id="tmItem-${t.id}">
            <div class="tm-list-avatar" style="background:${bg};color:${color}">${initials}</div>
            <div class="tm-list-body">
                <div class="tm-list-name">${escapeHtml(t.name)}</div>
                <div class="tm-list-meta">
                    <span class="tm-list-stars">
                        <span class="on">${starsOn}</span><span class="off">${starsOff}</span>
                    </span>
                    ${t.plan_label ? `<span class="tm-list-plan">${escapeHtml(t.plan_label)}</span>` : ''}
                </div>
                <div class="tm-list-quote">${escapeHtml(t.quote)}</div>
            </div>
            <div class="tm-list-actions">
                <button class="tm-vis-btn ${visClass}" title="${visTitle}"
                    onclick="toggleTmVisibility(${t.id}, ${!isVisible})">
                    <i class="uil ${visIcon}"></i>
                </button>
                <button class="tm-edit-btn" title="Edit" onclick="openEditTestimonialModal(${t.id})">
                    <i class="uil uil-edit"></i>
                </button>
                <button class="tm-delete-btn" title="Delete"
                    onclick="openTmDeleteModal(${t.id}, '${escapeHtml(t.name)}')">
                    <i class="uil uil-trash-alt"></i>
                </button>
            </div>
        </div>
    `;
}


// ================================================================
// STAR PICKER
// ================================================================

function initTmStarPicker() {
    const picker = document.getElementById('tmStarPicker');
    if (!picker) return;
    picker.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click',      () => setTmRating(parseInt(btn.dataset.v)));
        btn.addEventListener('mouseenter', () => highlightTmStars(parseInt(btn.dataset.v)));
        btn.addEventListener('mouseleave', () => highlightTmStars(tmSelectedRating));
    });
    highlightTmStars(5);
}

function setTmRating(v) {
    tmSelectedRating = v;
    document.getElementById('tmRating').value = v;
    highlightTmStars(v);
}

function highlightTmStars(v) {
    document.getElementById('tmStarPicker')?.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.v) <= v);
    });
}


// ================================================================
// COLOUR SWATCHES
// ================================================================

function initTmColorSwatches() {
    document.getElementById('tmColorSwatches')?.querySelectorAll('.tm-swatch').forEach(s => {
        s.addEventListener('click', () => {
            document.querySelectorAll('#tmColorSwatches .tm-swatch').forEach(x => x.classList.remove('active'));
            s.classList.add('active');
            tmSelectedBg    = s.dataset.bg;
            tmSelectedColor = s.dataset.color;
            document.getElementById('tmAvatarBg').value    = tmSelectedBg;
            document.getElementById('tmAvatarColor').value = tmSelectedColor;
            updateTmAvatarPreview();
        });
    });
}

function updateTmAvatarPreview() {
    const initials = (document.getElementById('tmInitials')?.value || '').toUpperCase() || '?';
    const preview  = document.getElementById('tmAvatarPreview');
    if (!preview) return;
    preview.textContent      = initials;
    preview.style.background = tmSelectedBg;
    preview.style.color      = tmSelectedColor;
}


// ================================================================
// ADD / EDIT MODALS
// ================================================================

function openAddTestimonialModal() {
    resetTmModal();
    document.getElementById('tmModalTitle').textContent = 'Add Testimonial';
    document.getElementById('tmEditId').value = '';
    document.getElementById('tmModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function openEditTestimonialModal(id) {
    const t = allTestimonials.find(x => x.id === id);
    if (!t) return;

    resetTmModal();
    document.getElementById('tmModalTitle').textContent = 'Edit Testimonial';
    document.getElementById('tmEditId').value           = t.id;
    document.getElementById('tmName').value             = t.name         || '';
    document.getElementById('tmPlanLabel').value        = t.plan_label   || '';
    document.getElementById('tmQuote').value            = t.quote        || '';
    document.getElementById('tmInitials').value         = t.avatar_initials || '';
    document.getElementById('tmSortOrder').value        = t.sort_order   || 10;
    document.getElementById('tmVisible').checked        = t.is_visible !== false;

    setTmRating(t.rating || 5);

    tmSelectedBg    = t.avatar_bg    || '#00e27b';
    tmSelectedColor = t.avatar_color || '#27282f';
    document.getElementById('tmAvatarBg').value    = tmSelectedBg;
    document.getElementById('tmAvatarColor').value = tmSelectedColor;
    document.querySelectorAll('#tmColorSwatches .tm-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.bg === tmSelectedBg);
    });
    updateTmAvatarPreview();

    document.getElementById('tmModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeTmModal(e) {
    if (e && e.target !== document.getElementById('tmModal')) return;
    document.getElementById('tmModal').classList.remove('open');
    document.body.style.overflow = '';
}

function resetTmModal() {
    document.getElementById('tmName').value        = '';
    document.getElementById('tmPlanLabel').value   = '';
    document.getElementById('tmQuote').value       = '';
    document.getElementById('tmInitials').value    = '';
    document.getElementById('tmSortOrder').value   = '10';
    document.getElementById('tmVisible').checked   = true;
    document.getElementById('tmError').textContent = '';

    tmSelectedRating = 5;
    document.getElementById('tmRating').value = '5';
    highlightTmStars(5);

    tmSelectedBg    = '#00e27b';
    tmSelectedColor = '#27282f';
    document.getElementById('tmAvatarBg').value    = '#00e27b';
    document.getElementById('tmAvatarColor').value = '#27282f';
    document.querySelectorAll('#tmColorSwatches .tm-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.bg === '#00e27b');
    });
    updateTmAvatarPreview();
}


// ================================================================
// SAVE TESTIMONIAL
// ================================================================

async function saveTestimonial() {
    const saveBtn = document.getElementById('tmSaveBtn');
    const errorEl = document.getElementById('tmError');
    errorEl.textContent = '';

    const id        = document.getElementById('tmEditId').value;
    const name      = document.getElementById('tmName').value.trim();
    const planLabel = document.getElementById('tmPlanLabel').value.trim();
    const quote     = document.getElementById('tmQuote').value.trim();
    const initials  = document.getElementById('tmInitials').value.trim().toUpperCase();
    const rating    = parseInt(document.getElementById('tmRating').value) || 5;
    const avatarBg  = document.getElementById('tmAvatarBg').value;
    const avatarClr = document.getElementById('tmAvatarColor').value;
    const visible   = document.getElementById('tmVisible').checked;
    const sortOrder = parseInt(document.getElementById('tmSortOrder').value) || 10;

    if (!name)     { errorEl.textContent = 'Name is required.';             return; }
    if (!quote)    { errorEl.textContent = 'Quote is required.';            return; }
    if (!initials) { errorEl.textContent = 'Avatar initials are required.'; return; }

    const payload = {
        name,
        plan_label:      planLabel || null,
        quote,
        rating,
        avatar_initials: initials,
        avatar_bg:       avatarBg,
        avatar_color:    avatarClr,
        is_visible:      visible,
        sort_order:      sortOrder,
    };

    saveBtn.disabled  = true;
    saveBtn.innerHTML = '<i class="uil uil-spinner-alt spin"></i> Saving…';

    try {
        let error;
        if (id) {
            ({ error } = await db.from('testimonials').update(payload).eq('id', id));
        } else {
            ({ error } = await db.from('testimonials').insert(payload));
        }
        if (error) throw error;

        closeTmModal();
        await loadTestimonials();

    } catch (err) {
        console.error('saveTestimonial error:', err.message);
        errorEl.textContent = 'Failed to save. Please try again.';
    }

    saveBtn.disabled  = false;
    saveBtn.innerHTML = '<i class="uil uil-check"></i> Save';
}


// ================================================================
// TOGGLE VISIBILITY (inline)
// ================================================================

async function toggleTmVisibility(id, newVisible) {
    try {
        const { error } = await db
            .from('testimonials')
            .update({ is_visible: newVisible })
            .eq('id', id);

        if (error) throw error;

        const t = allTestimonials.find(x => x.id === id);
        if (t) t.is_visible = newVisible;
        renderTmList();

    } catch (err) {
        console.error('toggleTmVisibility error:', err.message);
    }
}


// ================================================================
// DELETE
// ================================================================

function openTmDeleteModal(id, name) {
    document.getElementById('tmDeleteId').value          = id;
    document.getElementById('tmDeleteName').textContent  = name;
    document.getElementById('tmDeleteModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeTmDeleteModal(e) {
    if (e && e.target !== document.getElementById('tmDeleteModal')) return;
    document.getElementById('tmDeleteModal').classList.remove('open');
    document.body.style.overflow = '';
    const btn = document.getElementById('tmDeleteBtn');
    btn.disabled  = false;
    btn.innerHTML = '<i class="uil uil-trash-alt"></i> Delete';
}

async function confirmDeleteTestimonial() {
    const btn = document.getElementById('tmDeleteBtn');
    const id  = document.getElementById('tmDeleteId').value;

    btn.disabled  = true;
    btn.innerHTML = '<i class="uil uil-spinner-alt spin"></i> Deleting…';

    try {
        const { error } = await db.from('testimonials').delete().eq('id', id);
        if (error) throw error;

        closeTmDeleteModal();
        await loadTestimonials();

    } catch (err) {
        console.error('confirmDeleteTestimonial error:', err.message);
        btn.disabled  = false;
        btn.innerHTML = '<i class="uil uil-trash-alt"></i> Delete';
    }
}
