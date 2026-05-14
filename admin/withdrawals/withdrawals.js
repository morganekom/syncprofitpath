// ================================================================
// ADMIN / WITHDRAWALS.JS
// Lists all withdrawal transactions. Admin can process or reject.
//
// Process (approve): status → 'completed', user balance decreases
//                    by the withdrawal amount.
// Reject:            status → 'failed', user balance is restored
//                    (amount returned — withdrawal never sent).
// ================================================================


// ── STATE ──
let allWithdrawals      = [];
let filteredWithdrawals = [];
let activeStatus        = 'pending';
let activeWithdrawal    = null;


// ================================================================
// INIT
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadWithdrawals();
    initFilterTabs();
    initSearch();
});


// ================================================================
// LOAD WITHDRAWALS
// ================================================================

async function loadWithdrawals() {
    const loadingEl  = document.getElementById('wdrLoading');
    const emptyEl    = document.getElementById('wdrEmpty');
    const tableEl    = document.getElementById('wdrTable');
    const refreshBtn = document.getElementById('refreshBtn');

    loadingEl.style.display = 'flex';
    emptyEl.style.display   = 'none';
    tableEl.style.display   = 'none';

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


// ================================================================
// FILTER TABS
// ================================================================

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


// ================================================================
// SEARCH
// ================================================================

function initSearch() {
    document.getElementById('wdrSearch').addEventListener('input', applyFilter);
}


// ================================================================
// APPLY FILTER + SEARCH → RENDER
// ================================================================

function applyFilter() {
    const query = (document.getElementById('wdrSearch').value || '').toLowerCase().trim();

    filteredWithdrawals = allWithdrawals.filter(w => {
        const matchStatus = activeStatus === 'all' || w.status === activeStatus;
        if (!matchStatus) return false;
        if (!query) return true;

        const name   = (w.users?.full_name || w.users?.first_name || '').toLowerCase();
        const ref    = (w.reference || '').toLowerCase();
        const method = (w.method   || '').toLowerCase();
        return name.includes(query) || ref.includes(query) || method.includes(query);
    });

    renderTable();
}


// ================================================================
// RENDER TABLE
// ================================================================

function renderTable() {
    const loadingEl = document.getElementById('wdrLoading');
    const emptyEl   = document.getElementById('wdrEmpty');
    const tableEl   = document.getElementById('wdrTable');
    const bodyEl    = document.getElementById('wdrBody');

    loadingEl.style.display = 'none';

    if (filteredWithdrawals.length === 0) {
        emptyEl.style.display = 'flex';
        tableEl.style.display = 'none';
        document.querySelector('#wdrEmpty p').textContent =
            activeStatus === 'pending' ? 'No pending withdrawals.' : 'No withdrawals found.';
        return;
    }

    emptyEl.style.display = 'none';
    tableEl.style.display = 'table';

    bodyEl.innerHTML = filteredWithdrawals.map(w => {
        const name   = escapeHtml(w.users?.full_name || w.users?.first_name || 'Unknown');
        const amount = '$' + parseFloat(w.amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
        const date   = formatDate(w.created_at);
        const method = escapeHtml(w.method || '—');

        const actions = w.status === 'pending'
            ? `<div class="row-actions">
                   <button class="action-btn view" onclick="openWdrModal('${w.id}')">
                       <i class="uil uil-eye"></i> Review
                   </button>
               </div>`
            : `<div class="row-actions">
                   <button class="action-btn view" onclick="openWdrModal('${w.id}')">
                       <i class="uil uil-eye"></i> View
                   </button>
               </div>`;

        return `
            <tr>
                <td>
                    <span class="td-name">${name}</span><br>
                    <small class="text-muted">${escapeHtml(w.users?.email || '')}</small>
                </td>
                <td class="tx-reference">${escapeHtml(w.reference || '—')}</td>
                <td>${method}</td>
                <td class="tx-amount-label withdrawal">−${amount}</td>
                <td class="tx-date">${date}</td>
                <td><span class="badge ${w.status}">${capitalise(w.status)}</span></td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');
}


// ================================================================
// OPEN MODAL
// ================================================================

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

    // Destination box — built from method field
    const destEl  = document.getElementById('mwDestination');
    const destBox = document.getElementById('mwDestinationBox');
    if (w.method && w.coin) {
        destBox.innerHTML = `
            <div class="dest-row"><span>Coin</span><strong>${escapeHtml(w.coin.toUpperCase())}</strong></div>
            <div class="dest-row"><span>Wallet</span><strong>${escapeHtml(w.method)}</strong></div>
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
    document.getElementById('mwNoteWrap').style.display  = isPending ? 'flex'  : 'none';
    document.getElementById('mwActions').style.display   = isPending ? 'flex'  : 'none';
    document.getElementById('mwResolved').style.display  = 'none';
    document.getElementById('mwNote').value              = '';

    const approveBtn = document.getElementById('mwApproveBtn');
    const rejectBtn  = document.getElementById('mwRejectBtn');
    approveBtn.disabled = false;
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


// ================================================================
// HANDLE PROCESS / REJECT
// ================================================================

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
        const w      = activeWithdrawal;
        const amount = parseFloat(w.amount);
        const userId = w.users?.id || w.user_id;

        // 1. Update transaction status
        const txUpdate = { status: newStatus };
        if (note) txUpdate.note = note;

        const { error: txError } = await db
            .from('transactions')
            .update(txUpdate)
            .eq('id', w.id);

        if (txError) throw txError;

        // 2. Update user balance
        // Fetch fresh from DB to avoid stale data
        const { data: userData, error: fetchError } = await db
            .from('users')
            .select('balance')
            .eq('id', userId)
            .single();

        if (fetchError) throw fetchError;

        const currentBalance = parseFloat(userData.balance || 0);
        let   newBalance;

        if (newStatus === 'completed') {
            // Processed — deduct amount from balance (the money has been sent)
            newBalance = Math.max(0, currentBalance - amount);
        } else {
            // Rejected — balance stays as-is; amount was never deducted on submission
            // (withdraw.js doesn't deduct balance on request — admin deducts on approval)
            newBalance = currentBalance;
        }

        const { error: userError } = await db
            .from('users')
            .update({ balance: newBalance })
            .eq('id', userId);

        if (userError) throw userError;

        // 3. Send email notification
        const w = activeWithdrawal;
        sendNotification({
            type:   newStatus === 'completed' ? 'withdrawal_approved' : 'withdrawal_rejected',
            email:  w.users?.email || '',
            name:   w.users?.full_name || w.users?.first_name || 'there',
            amount: amount,
            method: w.method || '',
            ref:    w.reference || w.id,
        });

        // 4. Update local state
        activeWithdrawal.status = newStatus;
        allWithdrawals = allWithdrawals.map(wdr =>
            wdr.id === w.id ? { ...wdr, status: newStatus } : wdr
        );
        applyFilter();

        // 4. Show resolved state
        document.getElementById('mwActions').style.display  = 'none';
        document.getElementById('mwNoteWrap').style.display = 'none';
        const resolvedEl  = document.getElementById('mwResolved');
        const resolvedMsg = document.getElementById('mwResolvedMsg');
        resolvedEl.style.display  = 'flex';

        if (newStatus === 'completed') {
            resolvedMsg.textContent =
                `✓ Withdrawal processed. $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} deducted from user balance.`;
        } else {
            resolvedMsg.textContent = '✕ Withdrawal rejected. No balance change.';
        }

        document.getElementById('mwStatus').innerHTML =
            `<span class="badge ${newStatus}">${capitalise(newStatus)}</span>`;

    } catch (err) {
        console.error('Withdrawal action error:', err.message);
        approveBtn.disabled = false;
        rejectBtn.disabled  = false;
        approveBtn.innerHTML = '<i class="uil uil-check-circle"></i> Mark as Processed';
        rejectBtn.innerHTML  = '<i class="uil uil-times-circle"></i> Reject';
        alert('Something went wrong: ' + err.message);
    }
}