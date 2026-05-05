// ================================================================
// ADMIN / PLANS.JS
// Loads all rows from investment_plans table.
// Admin can add, edit, or delete any plan.
// Changes go live instantly — no approval step needed.
// Shared utilities (formatNum, escapeHtml, setText, capitalise)
// come from admin.js which is loaded before this file.
// ================================================================


// ── STATE ──
let allPlans    = [];     // raw rows from Supabase, ordered by sort_order
let activePlan  = null;   // plan currently open in the edit modal
let pendingDeleteId = null; // id held while delete-confirm modal is open


// ================================================================
// INIT
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadPlans();
});


// ================================================================
// LOAD PLANS
// ================================================================

async function loadPlans() {
    const loadingEl  = document.getElementById('plansLoading');
    const emptyEl    = document.getElementById('plansEmpty');
    const gridEl     = document.getElementById('plansGrid');
    const refreshBtn = document.getElementById('refreshBtn');

    loadingEl.style.display = 'flex';
    emptyEl.style.display   = 'none';
    gridEl.style.display    = 'none';

    if (refreshBtn) { refreshBtn.classList.add('spinning'); refreshBtn.disabled = true; }

    try {
        const { data, error } = await db
            .from('investment_plans')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) throw error;

        allPlans = data || [];
        renderGrid();

    } catch (err) {
        console.error('Load plans error:', err.message);
        loadingEl.style.display = 'none';
        emptyEl.style.display   = 'flex';
        document.querySelector('#plansEmpty p').textContent = 'Failed to load. Please retry.';
    }

    if (refreshBtn) { refreshBtn.classList.remove('spinning'); refreshBtn.disabled = false; }
}


// ================================================================
// RENDER GRID
// ================================================================

function renderGrid() {
    const loadingEl = document.getElementById('plansLoading');
    const emptyEl   = document.getElementById('plansEmpty');
    const gridEl    = document.getElementById('plansGrid');

    loadingEl.style.display = 'none';

    if (allPlans.length === 0) {
        emptyEl.style.display = 'flex';
        gridEl.style.display  = 'none';
        return;
    }

    emptyEl.style.display = 'none';
    gridEl.style.display  = 'grid';

    gridEl.innerHTML = allPlans.map(p => buildPlanCard(p)).join('');

    initDragSort();
}


// ================================================================
// BUILD PLAN CARD HTML
// ================================================================

function buildPlanCard(p) {
    const tierClass  = escapeHtml(p.tier_class  || 'plan-basic');
    const name       = escapeHtml(p.name        || 'Unnamed Plan');
    const badge      = escapeHtml(p.badge_label || '');
    const dailyRate  = p.daily_rate  != null ? p.daily_rate  + '%'  : '—';
    const roi        = p.roi_multiplier != null ? p.roi_multiplier + '×' : '—';
    const minAmt     = p.min_amount  != null ? '$' + formatNum(p.min_amount)  : '—';
    const maxAmt     = p.max_amount  != null ? '$' + formatNum(p.max_amount)  : '—';
    const returnType = escapeHtml(p.return_type  || '—');
    const withdraw   = escapeHtml(p.withdraw     || '—');
    const isActive   = p.is_active !== false; // default true if null

    const statusClass = isActive ? 'active'   : 'inactive';
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
                    <span class="plan-admin-row-label">Withdraw</span>
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


// ================================================================
// OPEN MODAL — EDIT
// ================================================================

function openEditModal(id) {
    activePlan = allPlans.find(p => String(p.id) === String(id));
    if (!activePlan) return;

    const p = activePlan;

    setText('planModalTitle', 'Edit Plan');
    setText('pmSaveBtnLabel', 'Save Changes');

    document.getElementById('pmId').value          = p.id;
    document.getElementById('pmName').value        = p.name        || '';
    document.getElementById('pmSlug').value        = p.slug        || '';
    document.getElementById('pmTier').value        = p.tier_class  || '';
    document.getElementById('pmBadge').value       = p.badge_label || '';
    document.getElementById('pmDailyRate').value   = p.daily_rate     != null ? p.daily_rate     : '';
    document.getElementById('pmRoi').value         = p.roi_multiplier != null ? p.roi_multiplier : '';
    document.getElementById('pmMin').value         = p.min_amount     != null ? p.min_amount     : '';
    document.getElementById('pmMax').value         = p.max_amount     != null ? p.max_amount     : '';
    document.getElementById('pmReturnType').value  = p.return_type  || '';
    document.getElementById('pmWithdraw').value    = p.withdraw     || '';
    document.getElementById('pmCancelTime').value  = p.cancel_time  || '';
    document.getElementById('pmSortOrder').value   = p.sort_order   != null ? p.sort_order : '';

    const isActive = p.is_active !== false;
    document.getElementById('pmIsActive').checked = isActive;
    setText('pmActiveLabel', isActive ? 'Active' : 'Inactive');

    // Show delete button in edit mode
    document.getElementById('pmDeleteBtn').style.display = 'inline-flex';
    document.getElementById('pmError').textContent = '';

    openPlanModal();
}


// ================================================================
// OPEN MODAL — ADD
// ================================================================

function openAddModal() {
    activePlan = null;

    setText('planModalTitle', 'Add Plan');
    setText('pmSaveBtnLabel', 'Create Plan');

    // Clear all fields
    ['pmId', 'pmName', 'pmSlug', 'pmTier', 'pmBadge',
     'pmDailyRate', 'pmRoi', 'pmMin', 'pmMax',
     'pmReturnType', 'pmWithdraw', 'pmCancelTime', 'pmSortOrder']
        .forEach(id => { document.getElementById(id).value = ''; });

    document.getElementById('pmIsActive').checked = true;
    setText('pmActiveLabel', 'Active');

    // Hide delete button in add mode
    document.getElementById('pmDeleteBtn').style.display = 'none';
    document.getElementById('pmError').textContent = '';

    openPlanModal();
}


// ── TOGGLE LABEL UPDATE ──
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('pmIsActive').addEventListener('change', function () {
        setText('pmActiveLabel', this.checked ? 'Active' : 'Inactive');
    });
});


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


// ================================================================
// SAVE PLAN (create or update)
// ================================================================

async function savePlan() {
    const saveBtn  = document.getElementById('pmSaveBtn');
    const errorEl  = document.getElementById('pmError');

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

    // ── Validation ──
    if (!name)  { errorEl.textContent = 'Plan name is required.'; return; }
    if (!slug)  { errorEl.textContent = 'Slug is required.'; return; }
    if (slug.includes(' ')) { errorEl.textContent = 'Slug cannot contain spaces.'; return; }

    const payload = {
        name,
        slug,
        tier_class:      tierClass  || null,
        badge_label:     badge      || null,
        daily_rate:      dailyRate  !== '' ? parseFloat(dailyRate)  : null,
        roi_multiplier:  roi        !== '' ? parseFloat(roi)        : null,
        min_amount:      minAmt     !== '' ? parseFloat(minAmt)     : null,
        max_amount:      maxAmt     !== '' ? parseFloat(maxAmt)     : null,
        return_type:     retType    || null,
        withdraw:        withdraw   || null,
        cancel_time:     cancel     || null,
        sort_order:      sortOrder  !== '' ? parseInt(sortOrder, 10) : null,
        is_active:       isActive,
    };

    saveBtn.disabled = true;
    setText('pmSaveBtnLabel', activePlan ? 'Saving…' : 'Creating…');

    try {
        let error;

        if (activePlan) {
            // UPDATE
            ({ error } = await db
                .from('investment_plans')
                .update(payload)
                .eq('id', activePlan.id));
        } else {
            // INSERT
            ({ error } = await db
                .from('investment_plans')
                .insert(payload));
        }

        if (error) throw error;

        // Close modal and reload
        document.getElementById('planModal').classList.remove('open');
        document.body.style.overflow = '';
        activePlan = null;
        await loadPlans();

    } catch (err) {
        console.error('Save plan error:', err.message);
        errorEl.textContent = err.message || 'Something went wrong. Please try again.';
    }

    saveBtn.disabled = false;
    setText('pmSaveBtnLabel', activePlan ? 'Save Changes' : 'Create Plan');
}


// ================================================================
// DELETE PLAN — two-step confirm
// ================================================================

function deletePlan() {
    if (!activePlan) return;

    pendingDeleteId = activePlan.id;
    setText('dcPlanName', activePlan.name || 'this plan');

    // Close edit modal, open confirm modal
    document.getElementById('planModal').classList.remove('open');
    document.getElementById('deleteConfirmModal').classList.add('open');
    // body overflow stays hidden — another modal is opening
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
        const { error } = await db
            .from('investment_plans')
            .delete()
            .eq('id', pendingDeleteId);

        if (error) throw error;

        document.getElementById('deleteConfirmModal').classList.remove('open');
        document.body.style.overflow = '';
        pendingDeleteId = null;
        activePlan = null;
        await loadPlans();

    } catch (err) {
        console.error('Delete plan error:', err.message);
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="uil uil-trash-alt"></i> Yes, Delete';
        alert('Delete failed: ' + err.message);
    }
}


// ================================================================
// DRAG-TO-REORDER (sort_order)
// ================================================================

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
                // Swap DOM positions
                const allCards = [...grid.querySelectorAll('.plan-admin-card')];
                const srcIdx   = allCards.indexOf(dragSrc);
                const tgtIdx   = allCards.indexOf(this);

                if (srcIdx < tgtIdx) {
                    grid.insertBefore(dragSrc, this.nextSibling);
                } else {
                    grid.insertBefore(dragSrc, this);
                }

                hint.style.display = 'flex';
            }
        });
    });
}


// ================================================================
// SAVE ORDER
// ================================================================

async function saveOrder() {
    const hint      = document.getElementById('plansOrderHint');
    const saveBtn   = hint.querySelector('.save-order-btn');

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="uil uil-spinner-alt spin"></i> Saving…';

    try {
        const cards = [...document.querySelectorAll('#plansGrid .plan-admin-card')];

        // Build updates array — one per card in current DOM order
        const updates = cards.map((card, index) => ({
            id:         card.dataset.id,
            sort_order: index + 1,
        }));

        // Upsert each row individually (Supabase JS v2 doesn't batch update by pk easily)
        for (const u of updates) {
            const { error } = await db
                .from('investment_plans')
                .update({ sort_order: u.sort_order })
                .eq('id', u.id);
            if (error) throw error;
        }

        hint.style.display = 'none';
        await loadPlans(); // re-fetch to confirm server state

    } catch (err) {
        console.error('Save order error:', err.message);
        alert('Failed to save order: ' + err.message);
    }

    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="uil uil-check"></i> Save Order';
}
