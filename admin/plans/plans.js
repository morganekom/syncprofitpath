// plans.js — Admin Investment Plans page
// Requires: supabase.js (dbAdmin), admin.js, auth.js


// ================================================================
// STATE
// ================================================================

let allPlans   = [];   // plans loaded from DB
let planOrder  = [];   // current drag-sorted id array
let editingId  = null; // uuid of plan being edited, null = add mode
let deleteTarget = null; // { id, name } for delete confirm modal


// ================================================================
// LOAD PLANS
// ================================================================

async function loadPlans() {
    const grid    = document.getElementById('plansGrid');
    const loading = document.getElementById('plansLoading');
    const empty   = document.getElementById('plansEmpty');
    const hint    = document.getElementById('plansOrderHint');

    grid.style.display    = 'none';
    empty.style.display   = 'none';
    hint.style.display    = 'none';
    loading.style.display = 'flex';

    // Spin the refresh icon
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.classList.add('spinning');

    // Admin reads ALL plans (active + inactive), ordered by sort_order
    const { data, error } = await dbAdmin
        .from('investment_plans')
        .select('*')
        .order('sort_order', { ascending: true });

    refreshBtn.classList.remove('spinning');
    loading.style.display = 'none';

    if (error) {
        console.error('loadPlans error:', error.message);
        empty.style.display = 'flex';
        return;
    }

    allPlans  = data || [];
    planOrder = allPlans.map(p => p.id);

    if (allPlans.length === 0) {
        empty.style.display = 'flex';
        return;
    }

    renderCards();
    grid.style.display = 'grid';
    hint.style.display = 'flex';
}


// ================================================================
// RENDER PLAN CARDS
// ================================================================

function renderCards() {
    const grid = document.getElementById('plansGrid');
    grid.innerHTML = '';

    allPlans.forEach(plan => {
        const card = buildCard(plan);
        grid.appendChild(card);
        initDrag(card);
    });
}

function buildCard(plan) {
    const isActive = plan.is_active;

    const card = document.createElement('div');
    card.className = `plan-admin-card ${plan.tier}${isActive ? '' : ' inactive'}`;
    card.dataset.id = plan.id;
    card.draggable  = true;

    card.innerHTML = `
        <div class="plan-admin-card_band"></div>
        <div class="plan-admin-card_body">

            <div class="plan-admin-card_top">
                <h3>${escHtml(plan.name)}</h3>
                <span class="plan-status-badge ${isActive ? 'active' : 'inactive'}">
                    ${isActive ? '● Active' : '○ Inactive'}
                </span>
            </div>

            <div class="plan-admin-card_meta">
                <span class="plan-meta-pill highlight">${escHtml(plan.badge_label)}</span>
                <span class="plan-meta-pill">ROI ${plan.roi}×</span>
                <span class="plan-meta-pill">Sort #${plan.sort_order}</span>
            </div>

            <div class="plan-admin-card_stats">
                <div class="plan-stat-row">
                    <span>Investment range</span>
                    <span>$${fmtNum(plan.min_amount)} – $${fmtNum(plan.max_amount)}</span>
                </div>
                <div class="plan-stat-row">
                    <span>Daily rate</span>
                    <span>${plan.daily_rate}%</span>
                </div>
                <div class="plan-stat-row">
                    <span>Return type</span>
                    <span>${escHtml(plan.return_type)}</span>
                </div>
                <div class="plan-stat-row">
                    <span>Withdraw</span>
                    <span>${escHtml(plan.withdraw)}</span>
                </div>
                <div class="plan-stat-row">
                    <span>Cancel time</span>
                    <span>${escHtml(plan.cancel_time)}</span>
                </div>
            </div>

        </div>
        <div class="plan-admin-card_footer">
            <span class="plan-drag-handle">
                <i class="uil uil-draggabledots"></i> Drag to reorder
            </span>
            <button class="plan-edit-btn" onclick="openEditModal('${plan.id}')">
                <i class="uil uil-edit"></i> Edit
            </button>
        </div>
    `;

    return card;
}


// ================================================================
// DRAG-TO-REORDER
// ================================================================

let dragSrc = null;

function initDrag(card) {
    card.addEventListener('dragstart', e => {
        dragSrc = card;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.plan-admin-card').forEach(c => c.classList.remove('drag-over'));
        // Update planOrder from current DOM
        planOrder = [...document.querySelectorAll('.plan-admin-card')].map(c => c.dataset.id);
    });

    card.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (card !== dragSrc) card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));

    card.addEventListener('drop', e => {
        e.preventDefault();
        if (dragSrc && dragSrc !== card) {
            const grid = document.getElementById('plansGrid');
            const cards = [...grid.children];
            const srcIdx  = cards.indexOf(dragSrc);
            const destIdx = cards.indexOf(card);
            if (srcIdx < destIdx) {
                grid.insertBefore(dragSrc, card.nextSibling);
            } else {
                grid.insertBefore(dragSrc, card);
            }
        }
        card.classList.remove('drag-over');
    });
}

async function saveOrder() {
    const saveBtn = document.querySelector('.save-order-btn');
    saveBtn.innerHTML = '<i class="uil uil-spinner-alt spin"></i> Saving…';
    saveBtn.disabled  = true;

    const ids = [...document.querySelectorAll('.plan-admin-card')].map(c => c.dataset.id);

    // Update sort_order for each plan using dbAdmin (bypasses RLS)
    const updates = ids.map((id, index) =>
        dbAdmin
            .from('investment_plans')
            .update({ sort_order: index + 1 })
            .eq('id', id)
            .select()   // forces Supabase to return changed rows — catches silent failures
    );

    const results = await Promise.all(updates);
    const failed  = results.filter(r => r.error);

    saveBtn.innerHTML = '<i class="uil uil-check"></i> Save Order';
    saveBtn.disabled  = false;

    if (failed.length > 0) {
        console.error('saveOrder errors:', failed.map(r => r.error.message));
        alert('Some order updates failed. Check the console for details.');
        return;
    }

    // Refresh cards so sort badges update
    loadPlans();
}


// ================================================================
// ADD MODAL
// ================================================================

function openAddModal() {
    editingId = null;

    document.getElementById('planModalTitle').textContent = 'Add New Plan';
    document.getElementById('pmSaveBtnLabel').textContent = 'Create Plan';
    document.getElementById('pmDeleteBtn').style.display  = 'none';
    document.getElementById('pmId').value = '';

    // Clear all fields
    ['pmName','pmSlug','pmTier','pmBadge','pmReturnType','pmWithdraw','pmCancelTime'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('pmDailyRate').value  = '';
    document.getElementById('pmRoi').value        = '';
    document.getElementById('pmMin').value        = '';
    document.getElementById('pmMax').value        = '';
    document.getElementById('pmSortOrder').value  = allPlans.length + 1;
    document.getElementById('pmIsActive').checked = true;
    document.getElementById('pmActiveLabel').textContent = 'Active';
    document.getElementById('pmError').textContent = '';

    document.getElementById('planModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}


// ================================================================
// EDIT MODAL
// ================================================================

function openEditModal(id) {
    const plan = allPlans.find(p => p.id === id);
    if (!plan) return;
    editingId = id;

    document.getElementById('planModalTitle').textContent = 'Edit Plan';
    document.getElementById('pmSaveBtnLabel').textContent = 'Save Changes';
    document.getElementById('pmDeleteBtn').style.display  = 'inline-flex';
    document.getElementById('pmId').value = plan.id;

    document.getElementById('pmName').value       = plan.name;
    document.getElementById('pmSlug').value       = plan.slug;
    document.getElementById('pmTier').value       = plan.tier;
    document.getElementById('pmBadge').value      = plan.badge_label;
    document.getElementById('pmDailyRate').value  = plan.daily_rate;
    document.getElementById('pmRoi').value        = plan.roi;
    document.getElementById('pmMin').value        = plan.min_amount;
    document.getElementById('pmMax').value        = plan.max_amount;
    document.getElementById('pmReturnType').value = plan.return_type;
    document.getElementById('pmWithdraw').value   = plan.withdraw;
    document.getElementById('pmCancelTime').value = plan.cancel_time;
    document.getElementById('pmSortOrder').value  = plan.sort_order;
    document.getElementById('pmIsActive').checked = plan.is_active;
    document.getElementById('pmActiveLabel').textContent = plan.is_active ? 'Active' : 'Inactive';
    document.getElementById('pmError').textContent = '';

    document.getElementById('planModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closePlanModal(event) {
    if (event && event.target !== document.getElementById('planModal') &&
        event.currentTarget !== document.getElementById('planModal') &&
        !event.target.classList.contains('admin-modal-overlay')) return;
    document.getElementById('planModal').classList.remove('open');
    document.body.style.overflow = '';
}

// Update the Active/Inactive label as the toggle flips
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('pmIsActive').addEventListener('change', function () {
        document.getElementById('pmActiveLabel').textContent = this.checked ? 'Active' : 'Inactive';
    });
});


// ================================================================
// SAVE (CREATE or UPDATE)
// ================================================================

async function savePlan() {
    const saveBtn = document.getElementById('pmSaveBtn');
    const errEl   = document.getElementById('pmError');
    errEl.textContent = '';

    // Collect and validate fields
    const name       = document.getElementById('pmName').value.trim();
    const slug       = document.getElementById('pmSlug').value.trim().toLowerCase().replace(/\s+/g, '-');
    const tier       = document.getElementById('pmTier').value.trim();
    const badge      = document.getElementById('pmBadge').value.trim();
    const dailyRate  = parseFloat(document.getElementById('pmDailyRate').value);
    const roi        = parseFloat(document.getElementById('pmRoi').value);
    const minAmount  = parseFloat(document.getElementById('pmMin').value);
    const maxAmount  = parseFloat(document.getElementById('pmMax').value);
    const returnType = document.getElementById('pmReturnType').value.trim();
    const withdraw   = document.getElementById('pmWithdraw').value.trim();
    const cancelTime = document.getElementById('pmCancelTime').value.trim();
    const sortOrder  = parseInt(document.getElementById('pmSortOrder').value, 10);
    const isActive   = document.getElementById('pmIsActive').checked;

    if (!name || !slug || !tier || !badge) {
        errEl.textContent = 'Name, slug, tier, and badge label are required.'; return;
    }
    if (isNaN(dailyRate) || isNaN(roi) || isNaN(minAmount) || isNaN(maxAmount)) {
        errEl.textContent = 'All financial fields must be valid numbers.'; return;
    }
    if (minAmount >= maxAmount) {
        errEl.textContent = 'Min amount must be less than max amount.'; return;
    }

    const payload = {
        name, slug, tier,
        badge_label: badge,
        daily_rate:  dailyRate,
        roi, min_amount: minAmount, max_amount: maxAmount,
        return_type: returnType, withdraw, cancel_time: cancelTime,
        sort_order:  sortOrder,
        is_active:   isActive
    };

    saveBtn.disabled = true;
    document.getElementById('pmSaveBtnLabel').textContent = 'Saving…';

    let error, data;

    if (editingId) {
        // ── UPDATE ──
        ({ data, error } = await dbAdmin
            .from('investment_plans')
            .update(payload)
            .eq('id', editingId)
            .select()); // .select() ensures we get back rows — a silent RLS block returns [] not an error
    } else {
        // ── INSERT ──
        ({ data, error } = await dbAdmin
            .from('investment_plans')
            .insert([payload])
            .select());
    }

    saveBtn.disabled = false;
    document.getElementById('pmSaveBtnLabel').textContent = editingId ? 'Save Changes' : 'Create Plan';

    if (error) {
        console.error('savePlan error:', error);
        errEl.textContent = `Error: ${error.message}`;
        return;
    }

    // If data came back empty the row wasn't written (RLS blocked it silently)
    if (!data || data.length === 0) {
        errEl.textContent = 'Save was blocked — check that your service role key is set correctly in supabase.js.';
        return;
    }

    // Success — close modal and reload
    document.getElementById('planModal').classList.remove('open');
    document.body.style.overflow = '';
    loadPlans();
}


// ================================================================
// DELETE
// ================================================================

function deletePlan() {
    const plan = allPlans.find(p => p.id === editingId);
    if (!plan) return;
    deleteTarget = { id: plan.id, name: plan.name };
    document.getElementById('dcPlanName').textContent = plan.name;
    document.getElementById('deleteConfirmModal').classList.add('open');
}

function closeDeleteConfirm(event) {
    if (event && !event.target.classList.contains('admin-modal-overlay') &&
        event.target !== document.getElementById('deleteConfirmModal')) return;
    document.getElementById('deleteConfirmModal').classList.remove('open');
}

async function confirmDeletePlan() {
    if (!deleteTarget) return;

    const btn = document.querySelector('#deleteConfirmModal .action-btn.reject');
    btn.innerHTML = '<i class="uil uil-spinner-alt spin"></i> Deleting…';
    btn.disabled  = true;

    // Use dbAdmin so the delete bypasses the RLS policy
    const { error, data } = await dbAdmin
        .from('investment_plans')
        .delete()
        .eq('id', deleteTarget.id)
        .select();

    btn.innerHTML = '<i class="uil uil-trash-alt"></i> Yes, Delete';
    btn.disabled  = false;

    if (error) {
        console.error('delete error:', error.message);
        alert(`Delete failed: ${error.message}`);
        return;
    }

    if (!data || data.length === 0) {
        alert('Delete was blocked — check that your service role key is set correctly in supabase.js.');
        return;
    }

    // Close both modals and reload
    document.getElementById('deleteConfirmModal').classList.remove('open');
    document.getElementById('planModal').classList.remove('open');
    document.body.style.overflow = '';
    deleteTarget = null;
    editingId    = null;
    loadPlans();
}


// ================================================================
// INIT
// ================================================================

document.addEventListener('DOMContentLoaded', loadPlans);


// ================================================================
// UTILITIES
// ================================================================

function fmtNum(n) {
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
