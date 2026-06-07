// ================================================================
// ADMIN / WITHDRAWALS.JS
// ================================================================
// BUG FIX: duplicate `const w` declaration inside handleWdrAction
// caused a SyntaxError that crashed the entire script on load,
// preventing loadWithdrawals() from ever running.
// ================================================================


// ── STATE ──
let allWithdrawals      = [];
let filteredWithdrawals = [];
let activeStatus        = 'pending';
let activeWithdrawal    = null;


// ── INIT ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadWithdrawals();
    initFilterTabs();
    initSearch();
});


// ── LOAD ────────────────────────────────────────────────────────
async function loadWithdrawals() {
    const loadingEl  = document.getElementById('wdrLoading');
    const emptyEl    = document.getElementById('wdrEmpty');
    const listEl     = document.getElementById('wdrList');
    const refreshBtn = document.getElementById('refreshBtn');

    loadingEl.style.display = 'flex';
    emptyEl.style.display   = 'none';
    listEl.style.display    = 'none';

    if (refreshBtn) { refreshBtn.classList.add('spinning'); refreshBtn.disabled = true; }

    try {
        const { data, error } = await db
            .from('transactions')
            .select('*, users(id, full_name, first_name, last_name, email, balance)')
            .eq('type', 'withdrawal')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allWithdrawals = data || [];
        applyFilter();

    } catch (err) {
        console.error('Load withdrawals error:', err.message);
        loadingEl.style.display = 'none';
        emptyEl.style.display   = 'flex';
        document.querySelector('#wdrEmpty p').textContent = 'Failed to load. Please retry.';
    }

    if (refreshBtn) { refreshBtn.classList.remove('spinning'); refreshBtn.disabled = false; }
}


// ── FILTER TABS ─────────────────────────────────────────────────
function initFilterTabs() {
    document.querySelectorAll('.filter-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeStatus = btn.dataset.status;
            applyFilter();
        });
    });
}


// ── SEARCH ──────────────────────────────────────────────────────
function initSearch() {
    const searchEl = document.getElementById('wdrSearch');
    if (searchEl) searchEl.addEventListener('input', applyFilter);
}


// ── APPLY FILTER + SEARCH → RENDER ──────────────────────────────
function applyFilter() {
    const query = (document.getElementById('wdrSearch')?.value || '').toLowerCase().trim();

    filteredWithdrawals = allWithdrawals.filter(w => {
        const matchStatus = activeStatus === 'all' || w.status === activeStatus;
        if (!matchStatus) return false;
        if (!query) return true;

        const name   = (w.users?.full_name || w.users?.first_name || '').toLowerCase();
        const ref    = (w.reference || '').toLowerCase();
        const method = (w.method   || '').toLowerCase();
        return name.includes(query) || ref.includes(query) || method.includes(query);
    });

    renderCards();
}


// ── RENDER CARDS (mobile-first card layout) ──────────────────────
function renderCards() {
    const loadingEl = document.getElementById('wdrLoading');
    const emptyEl   = document.getElementById('wdrEmpty');
    const listEl    = document.getElementById('wdrList');

    loadingEl.style.display = 'none';

    if (filteredWithdrawals.length === 0) {
        emptyEl.style.display = 'flex';
        listEl.style.display  = 'none';
        document.querySelector('#wdrEmpty p').textContent =
            activeStatus === 'pending' ? 'No pending withdrawals.' : 'No withdrawals found.';
        return;
    }

    emptyEl.style.display = 'none';
    listEl.style.display  = 'grid';

    listEl.innerHTML = filteredWithdrawals.map(w => {
        const name   = escapeHtml(w.users?.full_name || w.users?.first_name || 'Unknown');
        const email  = escapeHtml(w.users?.email || '');
        const amount = '$' + parseFloat(w.amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
        const date   = formatDate(w.created_at);
        const method = escapeHtml(w.method || '—');
        const ref    = escapeHtml(w.reference || '—');

        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        const actionBtn = w.status === 'pending'
            ? `<button class="wdr-action-btn review" onclick="openWdrModal('${w.id}')">
                   <i class="uil uil-eye"></i> Review
               </button>`
            : `<button class="wdr-action-btn view" onclick="openWdrModal('${w.id}')">
                   <i class="uil uil-eye"></i> View
               </button>`;

        return `
        <div class="wdr-card ${w.status}">
            <div class="wdr-card-top">
                <div class="wdr-avatar">${initials}</div>
                <div class="wdr-card-user">
                    <div class="wdr-card-name">${name}</div>
                    <div class="wdr-card-email">${email}</div>
                </div>
                <span class="badge ${w.status}">${capitalise(w.status)}</span>
            </div>

            <div class="wdr-card-body">
                <div class="wdr-card-amount">−${amount}</div>
                <div class="wdr-card-meta">
                    <span class="wdr-meta-item">
                        <i class="uil uil-link"></i> ${ref}
                    </span>
                    <span class="wdr-meta-item">
                        <i class="uil uil-wallet"></i> ${method}
                    </span>
                    <span class="wdr-meta-item">
                        <i class="uil uil-calendar-alt"></i> ${date}
                    </span>
                </div>
            </div>

            <div class="wdr-card-footer">
                ${actionBtn}
            </div>
        </div>`;
    }).join('');
}


// ── OPEN MODAL ──────────────────────────────────────────────────
function openWdrModal(id) {
    activeWithdrawal = allWithdrawals.find(w => w.id === id);
    if (!activeWithdrawal) return;

    const w         = activeWithdrawal;
    const isPending = w.status === 'pending';
    const name      = w.users?.full_name || w.users?.first_name || 'Unknown';
    const amount    = '$' + parseFloat(w.amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const balance   = '$' + parseFloat(w.users?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

    setText('mwUser',      name);
    setText('mwEmail',     w.users?.email || '—');
    setText('mwReference', w.reference    || '—');
    setText('mwMethod',    w.method       || '—');
    setText('mwAmount',    amount);
    setText('mwBalance',   balance);
    setText('mwDate',      formatDateTime(w.created_at));

    document.getElementById('mwStatus').innerHTML =
        `<span class="badge ${w.status}">${capitalise(w.status)}</span>`;

    // Destination box
    const destEl  = document.getElementById('mwDestination');
    const destBox = document.getElementById('mwDestinationBox');
    if (w.coin) {
        destBox.innerHTML = `
            <div class="dest-row"><span>Coin</span><strong>${escapeHtml(w.coin.toUpperCase())}</strong></div>
            <div class="dest-row"><span>Wallet / Method</span><strong>${escapeHtml(w.method || '—')}</strong></div>
        `;
        destEl.style.display = 'block';
    } else if (w.method) {
        destBox.innerHTML = `
            <div class="dest-row"><span>Bank / Method</span><strong>${escapeHtml(w.method)}</strong></div>
        `;
        destEl.style.display = 'block';
    } else {
        destEl.style.display = 'none';
    }

    // Controls
    document.getElementById('mwNoteWrap').style.display = isPending ? 'flex'  : 'none';
    document.getElementById('mwActions').style.display  = isPending ? 'flex'  : 'none';
    document.getElementById('mwResolved').style.display = 'none';
    document.getElementById('mwNote').value             = '';

    const approveBtn = document.getElementById('mwApproveBtn');
    const rejectBtn  = document.getElementById('mwRejectBtn');
    approveBtn.disabled  = false;
    approveBtn.innerHTML = '<i class="uil uil-check-circle"></i> Mark as Processed';
    rejectBtn.disabled   = false;
    rejectBtn.innerHTML  = '<i class="uil uil-times-circle"></i> Reject';

    document.getElementById('wdrModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeWdrModal(event) {
    if (event && event.target !== document.getElementById('wdrModal')) return;
    document.getElementById('wdrModal').classList.remove('open');
    document.body.style.overflow = '';
    activeWithdrawal = null;
}


// ── HANDLE PROCESS / REJECT ──────────────────────────────────────
async function handleWdrAction(newStatus) {
    if (!activeWithdrawal) return;

    const approveBtn = document.getElementById('mwApproveBtn');
    const rejectBtn  = document.getElementById('mwRejectBtn');
    const note       = document.getElementById('mwNote').value.trim();

    approveBtn.disabled = true;
    rejectBtn.disabled  = true;

    if (newStatus === 'completed') {
        approveBtn.innerHTML = '<i class="uil uil-spinner-alt spin"></i> Processing…';
    } else {
        rejectBtn.innerHTML  = '<i class="uil uil-spinner-alt spin"></i> Rejecting…';
    }

    try {
        // Single reference — no duplicate const
        const withdrawal = activeWithdrawal;
        const amount     = parseFloat(withdrawal.amount);
        const userId     = withdrawal.users?.id || withdrawal.user_id;

        // 1. Update transaction status
        const txUpdate = { status: newStatus };
        if (note) txUpdate.note = note;

        const { error: txError } = await db
            .from('transactions')
            .update(txUpdate)
            .eq('id', withdrawal.id);

        if (txError) throw txError;

        // 2. Update user balance
        const { data: userData, error: fetchError } = await db
            .from('users')
            .select('balance')
            .eq('id', userId)
            .single();

        if (fetchError) throw fetchError;

        const currentBalance = parseFloat(userData.balance || 0);
        // Approved → deduct; Rejected → balance unchanged
        const newBalance = newStatus === 'completed'
            ? Math.max(0, currentBalance - amount)
            : currentBalance;

        const { error: userError } = await db
            .from('users')
            .update({ balance: newBalance })
            .eq('id', userId);

        if (userError) throw userError;

        // 3. Send notification
        sendNotification({
            type:   newStatus === 'completed' ? 'withdrawal_approved' : 'withdrawal_rejected',
            email:  withdrawal.users?.email || '',
            name:   withdrawal.users?.full_name || withdrawal.users?.first_name || 'there',
            amount: amount,
            method: withdrawal.method || '',
            ref:    withdrawal.reference || withdrawal.id,
        });

        // 4. Update local state
        allWithdrawals = allWithdrawals.map(wdr =>
            wdr.id === withdrawal.id ? { ...wdr, status: newStatus } : wdr
        );
        applyFilter();

        // 5. Show resolved state in modal
        document.getElementById('mwActions').style.display  = 'none';
        document.getElementById('mwNoteWrap').style.display = 'none';

        const resolvedEl = document.getElementById('mwResolved');
        resolvedEl.style.display = 'flex';

        document.getElementById('mwResolvedMsg').textContent = newStatus === 'completed'
            ? `✓ Processed. $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} deducted from user balance.`
            : '✕ Rejected. No balance change.';

        document.getElementById('mwStatus').innerHTML =
            `<span class="badge ${newStatus}">${capitalise(newStatus)}</span>`;

    } catch (err) {
        console.error('Withdrawal action error:', err.message);
        approveBtn.disabled  = false;
        rejectBtn.disabled   = false;
        approveBtn.innerHTML = '<i class="uil uil-check-circle"></i> Mark as Processed';
        rejectBtn.innerHTML  = '<i class="uil uil-times-circle"></i> Reject';
        alert('Something went wrong: ' + err.message);
    }
}
