// ================================================================
// ADMIN / DEPOSIT.JS
// Lists all deposit transactions. Admin can approve or reject.
// Approve: sets status → 'completed', increments user balance,
//          decrements user pending.
// Reject:  sets status → 'failed', decrements user pending.
// ================================================================


// ── STATE ──
let allDeposits   = [];      // raw data from Supabase
let filteredDeposits = [];   // after filter + search
let activeStatus  = 'pending';
let activeDeposit = null;    // the deposit currently open in modal


// ================================================================
// INIT
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadDeposits();
    initFilterTabs();
    initSearch();
});


// ================================================================
// LOAD DEPOSITS
// ================================================================

async function loadDeposits() {
    const loadingEl = document.getElementById('depositLoading');
    const emptyEl   = document.getElementById('depositEmpty');
    const tableEl   = document.getElementById('depositTable');
    const refreshBtn = document.getElementById('refreshBtn');

    loadingEl.style.display = 'flex';
    emptyEl.style.display   = 'none';
    tableEl.style.display   = 'none';

    if (refreshBtn) {
        refreshBtn.classList.add('spinning');
        refreshBtn.disabled = true;
    }

    try {
        const { data, error } = await db
            .from('transactions')
            .select('*, users(id, full_name, first_name, last_name, email, balance, pending)')
            .eq('type', 'deposit')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allDeposits = data || [];
        applyFilter();

    } catch (err) {
        console.error('Load deposits error:', err.message);
        loadingEl.style.display = 'none';
        emptyEl.style.display   = 'flex';
        document.querySelector('#depositEmpty p').textContent = 'Failed to load. Please retry.';
    }

    if (refreshBtn) {
        refreshBtn.classList.remove('spinning');
        refreshBtn.disabled = false;
    }
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
    document.getElementById('depositSearch').addEventListener('input', applyFilter);
}


// ================================================================
// APPLY FILTER + SEARCH THEN RENDER
// ================================================================

function applyFilter() {
    const query = (document.getElementById('depositSearch').value || '').toLowerCase().trim();

    filteredDeposits = allDeposits.filter(d => {
        const matchStatus = activeStatus === 'all' || d.status === activeStatus;
        if (!matchStatus) return false;
        if (!query) return true;

        const name = (d.users?.full_name || d.users?.first_name || '').toLowerCase();
        const ref  = (d.reference || '').toLowerCase();
        const coin = (d.coin      || '').toLowerCase();
        return name.includes(query) || ref.includes(query) || coin.includes(query);
    });

    renderTable();
}


// ================================================================
// RENDER TABLE
// ================================================================

function renderTable() {
    const loadingEl = document.getElementById('depositLoading');
    const emptyEl   = document.getElementById('depositEmpty');
    const tableEl   = document.getElementById('depositTable');
    const bodyEl    = document.getElementById('depositBody');

    loadingEl.style.display = 'none';

    if (filteredDeposits.length === 0) {
        emptyEl.style.display  = 'flex';
        tableEl.style.display  = 'none';
        document.querySelector('#depositEmpty p').textContent =
            activeStatus === 'pending' ? 'No pending deposits.' : 'No deposits found.';
        return;
    }

    emptyEl.style.display  = 'none';
    tableEl.style.display  = 'table';

    bodyEl.innerHTML = filteredDeposits.map(d => {
        const name    = escapeHtml(d.users?.full_name || d.users?.first_name || 'Unknown');
        const amount  = '$' + parseFloat(d.amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
        const date    = formatDate(d.created_at);
        const hasProof = !!d.proof_url;

        const proofCell = hasProof
            ? `<a href="${escapeHtml(d.proof_url)}" target="_blank" class="proof-link">
                   <i class="uil uil-image"></i> View
               </a>`
            : `<span class="text-muted">None</span>`;

        const isPending = d.status === 'pending';
        const actions = isPending
            ? `<div class="row-actions">
                   <button class="action-btn view" onclick="openDepositModal('${d.id}')">
                       <i class="uil uil-eye"></i> Review
                   </button>
               </div>`
            : `<div class="row-actions">
                   <button class="action-btn view" onclick="openDepositModal('${d.id}')">
                       <i class="uil uil-eye"></i> View
                   </button>
               </div>`;

        return `
            <tr>
                <td><span class="td-name">${name}</span><br>
                    <small class="text-muted">${escapeHtml(d.users?.email || '')}</small>
                </td>
                <td class="tx-reference">${escapeHtml(d.reference || '—')}</td>
                <td>${escapeHtml((d.coin || '—').toUpperCase())}</td>
                <td class="tx-amount-label deposit">${amount}</td>
                <td class="tx-date">${date}</td>
                <td>${proofCell}</td>
                <td><span class="badge ${d.status}">${capitalise(d.status)}</span></td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');
}


// ================================================================
// OPEN MODAL
// ================================================================

function openDepositModal(id) {
    activeDeposit = allDeposits.find(d => d.id === id);
    if (!activeDeposit) return;

    const d       = activeDeposit;
    const name    = d.users?.full_name || d.users?.first_name || 'Unknown';
    const amount  = '$' + parseFloat(d.amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const isPending = d.status === 'pending';

    setText('mdUser',      name);
    setText('mdReference', d.reference || '—');
    setText('mdCoin',      (d.coin || '—').toUpperCase());
    setText('mdAmount',    amount);
    setText('mdDate',      formatDateTime(d.created_at));
    document.getElementById('mdStatus').innerHTML = `<span class="badge ${d.status}">${capitalise(d.status)}</span>`;

    // Proof link
    const proofRow  = document.getElementById('mdProofRow');
    const proofLink = document.getElementById('mdProofLink');
    if (d.proof_url) {
        proofRow.style.display  = 'flex';
        proofLink.href          = d.proof_url;
    } else {
        proofRow.style.display  = 'none';
    }

    // Note & action buttons — only for pending
    document.getElementById('mdNoteWrap').style.display  = isPending ? 'flex' : 'none';
    document.getElementById('mdActions').style.display   = isPending ? 'flex' : 'none';
    document.getElementById('mdResolved').style.display  = 'none';
    document.getElementById('mdNote').value              = '';

    // Reset buttons
    const approveBtn = document.getElementById('mdApproveBtn');
    const rejectBtn  = document.getElementById('mdRejectBtn');
    approveBtn.disabled = false;
    approveBtn.innerHTML = '<i class="uil uil-check-circle"></i> Approve';
    rejectBtn.disabled  = false;
    rejectBtn.innerHTML  = '<i class="uil uil-times-circle"></i> Reject';

    document.getElementById('depositModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeDepositModal(event) {
    if (event && event.target !== document.getElementById('depositModal')) return;
    document.getElementById('depositModal').classList.remove('open');
    document.body.style.overflow = '';
    activeDeposit = null;
}


// ================================================================
// HANDLE APPROVE / REJECT
// ================================================================

async function handleAction(newStatus) {
    if (!activeDeposit) return;

    const approveBtn = document.getElementById('mdApproveBtn');
    const rejectBtn  = document.getElementById('mdRejectBtn');
    const note       = document.getElementById('mdNote').value.trim();

    approveBtn.disabled = true;
    rejectBtn.disabled  = true;

    if (newStatus === 'completed') {
        approveBtn.innerHTML = '<i class="uil uil-spinner-alt spin"></i> Approving…';
    } else {
        rejectBtn.innerHTML  = '<i class="uil uil-spinner-alt spin"></i> Rejecting…';
    }

    try {
        const d      = activeDeposit;
        const amount = parseFloat(d.amount);
        const userId = d.users?.id || d.user_id;

        // 1. Update transaction status (+ note if provided)
        const txUpdate = { status: newStatus };
        if (note) txUpdate.note = note;

        const { error: txError } = await db
            .from('transactions')
            .update(txUpdate)
            .eq('id', d.id);

        if (txError) throw txError;

        // 2. Update user balance and pending
        // First fetch current values fresh from DB to avoid stale data
        const { data: userData, error: fetchError } = await db
            .from('users')
            .select('balance, pending')
            .eq('id', userId)
            .single();

        if (fetchError) throw fetchError;

        const currentBalance = parseFloat(userData.balance || 0);
        const currentPending = parseFloat(userData.pending || 0);

        // pending always goes down — deposit is no longer pending
        const newPending = Math.max(0, currentPending - amount);

        // balance goes up only on approve
        const newBalance = newStatus === 'completed'
            ? currentBalance + amount
            : currentBalance;

        const { error: userError } = await db
            .from('users')
            .update({ balance: newBalance, pending: newPending })
            .eq('id', userId);

        if (userError) throw userError;

        // 3. Update local state so table reflects change without re-fetch
        activeDeposit.status = newStatus;
        allDeposits = allDeposits.map(dep =>
            dep.id === d.id ? { ...dep, status: newStatus } : dep
        );
        applyFilter();

        // 4. Send email notification
        const emailData = {
            email:  d.users?.email || '',
            name:   d.users?.full_name || d.users?.first_name || 'there',
            amount: amount,
            coin:   d.coin || d.method || '',
            ref:    d.reference || d.id,
            note:   note || '',
        };
        if (newStatus === 'completed') sendEmail('deposit_approved', emailData);
        else                           sendEmail('deposit_rejected', emailData);

        // 5. Show resolved state in modal
        document.getElementById('mdActions').style.display  = 'none';
        document.getElementById('mdNoteWrap').style.display = 'none';
        const resolvedEl = document.getElementById('mdResolved');
        const resolvedMsg = document.getElementById('mdResolvedMsg');
        resolvedEl.style.display = 'flex';
        resolvedMsg.textContent = newStatus === 'completed'
            ? `✓ Deposit approved. $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} added to user balance.`
            : '✕ Deposit rejected. User pending balance updated.';

        document.getElementById('mdStatus').innerHTML =
            `<span class="badge ${newStatus}">${capitalise(newStatus)}</span>`;

    } catch (err) {
        console.error('Action error:', err.message);
        approveBtn.disabled = false;
        rejectBtn.disabled  = false;
        approveBtn.innerHTML = '<i class="uil uil-check-circle"></i> Approve';
        rejectBtn.innerHTML  = '<i class="uil uil-times-circle"></i> Reject';
        alert('Something went wrong: ' + err.message);
    }
}

