// ================================================================
// ADMIN / INVESTMENTS.JS
// Lists all investment transactions. Admin can approve or reject.
//
// Approve: status → 'completed', user balance DECREASES by amount
//          (the funds are moved from available balance into the plan).
// Reject:  status → 'failed', balance stays the same
//          (user never had balance deducted on submission).
// ================================================================


// ── STATE ──
let allInvestments      = [];
let filteredInvestments = [];
let activeStatus        = 'pending';
let activeInvestment    = null;


// ================================================================
// INIT
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadInvestments();
    initFilterTabs();
    initSearch();
});


// ================================================================
// LOAD INVESTMENTS
// ================================================================

async function loadInvestments() {
    const loadingEl  = document.getElementById('invLoading');
    const emptyEl    = document.getElementById('invEmpty');
    const tableEl    = document.getElementById('invTable');
    const refreshBtn = document.getElementById('refreshBtn');

    loadingEl.style.display = 'flex';
    emptyEl.style.display   = 'none';
    tableEl.style.display   = 'none';

    if (refreshBtn) { refreshBtn.classList.add('spinning'); refreshBtn.disabled = true; }

    try {
        const { data, error } = await db
            .from('transactions')
            .select('*, users(id, full_name, first_name, last_name, email, balance)')
            .eq('type', 'investment')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allInvestments = data || [];
        applyFilter();

    } catch (err) {
        console.error('Load investments error:', err.message);
        loadingEl.style.display = 'none';
        emptyEl.style.display   = 'flex';
        document.querySelector('#invEmpty p').textContent = 'Failed to load. Please retry.';
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
    document.getElementById('invSearch').addEventListener('input', applyFilter);
}


// ================================================================
// APPLY FILTER + SEARCH → RENDER
// ================================================================

function applyFilter() {
    const query = (document.getElementById('invSearch').value || '').toLowerCase().trim();

    filteredInvestments = allInvestments.filter(inv => {
        const matchStatus = activeStatus === 'all' || inv.status === activeStatus;
        if (!matchStatus) return false;
        if (!query) return true;

        const name   = (inv.users?.full_name || inv.users?.first_name || '').toLowerCase();
        const ref    = (inv.reference || '').toLowerCase();
        const plan   = (inv.method   || '').toLowerCase(); // plan stored in method field
        const coin   = (inv.coin     || '').toLowerCase();
        return name.includes(query) || ref.includes(query) || plan.includes(query) || coin.includes(query);
    });

    renderTable();
}


// ================================================================
// RENDER TABLE
// ================================================================

function renderTable() {
    const loadingEl = document.getElementById('invLoading');
    const emptyEl   = document.getElementById('invEmpty');
    const tableEl   = document.getElementById('invTable');
    const bodyEl    = document.getElementById('invBody');

    loadingEl.style.display = 'none';

    if (filteredInvestments.length === 0) {
        emptyEl.style.display = 'flex';
        tableEl.style.display = 'none';
        document.querySelector('#invEmpty p').textContent =
            activeStatus === 'pending' ? 'No pending investments.' : 'No investments found.';
        return;
    }

    emptyEl.style.display = 'none';
    tableEl.style.display = 'table';

    bodyEl.innerHTML = filteredInvestments.map(inv => {
        const name   = escapeHtml(inv.users?.full_name || inv.users?.first_name || 'Unknown');
        const amount = '$' + parseFloat(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
        const date   = formatDate(inv.created_at);
        const plan   = escapeHtml(inv.method || '—');  // plan name stored in method
        const coin   = escapeHtml((inv.coin || '—').toUpperCase());

        const actions = inv.status === 'pending'
            ? `<div class="row-actions">
                   <button class="action-btn view" onclick="openInvModal('${inv.id}')">
                       <i class="uil uil-eye"></i> Review
                   </button>
               </div>`
            : `<div class="row-actions">
                   <button class="action-btn view" onclick="openInvModal('${inv.id}')">
                       <i class="uil uil-eye"></i> View
                   </button>
               </div>`;

        return `
            <tr>
                <td>
                    <span class="td-name">${name}</span><br>
                    <small class="text-muted">${escapeHtml(inv.users?.email || '')}</small>
                </td>
                <td class="tx-reference">${escapeHtml(inv.reference || '—')}</td>
                <td>${plan}</td>
                <td>${coin}</td>
                <td class="tx-amount-label investment">${amount}</td>
                <td class="tx-date">${date}</td>
                <td><span class="badge ${inv.status}">${capitalise(inv.status)}</span></td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');
}


// ================================================================
// OPEN MODAL
// ================================================================

function openInvModal(id) {
    activeInvestment = allInvestments.find(inv => inv.id === id);
    if (!activeInvestment) return;

    const inv       = activeInvestment;
    const isPending = inv.status === 'pending';
    const name      = inv.users?.full_name || inv.users?.first_name || 'Unknown';
    const amount    = '$' + parseFloat(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const balance   = '$' + parseFloat(inv.users?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

    setText('miUser',      name);
    setText('miEmail',     inv.users?.email || '—');
    setText('miReference', inv.reference    || '—');
    setText('miPlan',      inv.method       || '—');   // plan stored in method
    setText('miCoin',      (inv.coin || '—').toUpperCase());
    setText('miAmount',    amount);
    setText('miBalance',   balance);
    setText('miDate',      formatDateTime(inv.created_at));
    document.getElementById('miStatus').innerHTML =
        `<span class="badge ${inv.status}">${capitalise(inv.status)}</span>`;

    // Show note + actions only for pending
    document.getElementById('miNoteWrap').style.display = isPending ? 'flex'  : 'none';
    document.getElementById('miActions').style.display  = isPending ? 'flex'  : 'none';
    document.getElementById('miResolved').style.display = 'none';
    document.getElementById('miNote').value             = '';

    const approveBtn = document.getElementById('miApproveBtn');
    const rejectBtn  = document.getElementById('miRejectBtn');
    approveBtn.disabled = false;
    approveBtn.innerHTML = '<i class="uil uil-check-circle"></i> Approve & Deduct';
    rejectBtn.disabled   = false;
    rejectBtn.innerHTML  = '<i class="uil uil-times-circle"></i> Reject';

    document.getElementById('invModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeInvModal(event) {
    if (event && event.target !== document.getElementById('invModal')) return;
    document.getElementById('invModal').classList.remove('open');
    document.body.style.overflow = '';
    activeInvestment = null;
}


// ================================================================
// HANDLE APPROVE / REJECT
// ================================================================

async function handleInvAction(newStatus) {
    if (!activeInvestment) return;

    const approveBtn = document.getElementById('miApproveBtn');
    const rejectBtn  = document.getElementById('miRejectBtn');
    const note       = document.getElementById('miNote').value.trim();

    approveBtn.disabled = true;
    rejectBtn.disabled  = true;

    if (newStatus === 'completed') {
        approveBtn.innerHTML = '<i class="uil uil-spinner-alt spin"></i> Approving…';
    } else {
        rejectBtn.innerHTML  = '<i class="uil uil-spinner-alt spin"></i> Rejecting…';
    }

    try {
        const inv    = activeInvestment;
        const amount = parseFloat(inv.amount);
        const userId = inv.users?.id || inv.user_id;

        // 1. Update transaction status
        const txUpdate = { status: newStatus };
        if (note) txUpdate.note = note;

        const { error: txError } = await db
            .from('transactions')
            .update(txUpdate)
            .eq('id', inv.id);

        if (txError) throw txError;

        // 2. Fetch fresh user balance to avoid stale data
        const { data: userData, error: fetchError } = await db
            .from('users')
            .select('balance')
            .eq('id', userId)
            .single();

        if (fetchError) throw fetchError;

        const currentBalance = parseFloat(userData.balance || 0);
        let   newBalance;

        if (newStatus === 'completed') {
            // Approved — deduct the investment amount from the user's available balance
            newBalance = Math.max(0, currentBalance - amount);
        } else {
            // Rejected — no balance change (user never had it deducted on submission)
            newBalance = currentBalance;
        }

        const { error: userError } = await db
            .from('users')
            .update({ balance: newBalance })
            .eq('id', userId);

        if (userError) throw userError;

        // 3. Update local state so table reflects change without full reload
        activeInvestment.status = newStatus;
        allInvestments = allInvestments.map(i =>
            i.id === inv.id ? { ...i, status: newStatus } : i
        );
        applyFilter();

        // 4. Show resolved state inside modal
        document.getElementById('miActions').style.display  = 'none';
        document.getElementById('miNoteWrap').style.display = 'none';
        const resolvedEl  = document.getElementById('miResolved');
        const resolvedMsg = document.getElementById('miResolvedMsg');
        resolvedEl.style.display = 'flex';

        if (newStatus === 'completed') {
            resolvedMsg.textContent =
                `✓ Investment approved. $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} deducted from user balance.`;
        } else {
            resolvedMsg.textContent = '✕ Investment rejected. No balance change.';
        }

        document.getElementById('miStatus').innerHTML =
            `<span class="badge ${newStatus}">${capitalise(newStatus)}</span>`;

    } catch (err) {
        console.error('Investment action error:', err.message);
        approveBtn.disabled = false;
        rejectBtn.disabled  = false;
        approveBtn.innerHTML = '<i class="uil uil-check-circle"></i> Approve & Deduct';
        rejectBtn.innerHTML  = '<i class="uil uil-times-circle"></i> Reject';
        alert('Something went wrong: ' + err.message);
    }
}
