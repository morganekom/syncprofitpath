// ================================================================
// ADMIN / INVESTMENTS.JS
// Lists all investment transactions. Admin can approve or reject.
//
// Approve: status → 'completed', user balance DECREASES by amount
//          (the funds move from available balance into the plan).
//          Sets daily_rate, start_date, end_date, inv_active = true
//          so the daily cron can calculate profits automatically.
// Reject:  status → 'failed', balance stays the same.
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
    const refreshBtn = document.getElementById('refreshBtn');

    loadingEl.style.display = 'flex';
    emptyEl.style.display   = 'none';

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

        const name = (inv.users?.full_name || inv.users?.first_name || '').toLowerCase();
        const ref  = (inv.reference || '').toLowerCase();
        const plan = (inv.method   || '').toLowerCase();
        const coin = (inv.coin     || '').toLowerCase();
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
    const listEl    = document.getElementById('invList');

    loadingEl.style.display = 'none';

    if (filteredInvestments.length === 0) {
        emptyEl.style.display = 'flex';
        listEl.style.display  = 'none';
        document.querySelector('#invEmpty p').textContent =
            activeStatus === 'pending' ? 'No pending investments.' : 'No investments found.';
        return;
    }

    emptyEl.style.display = 'none';
    listEl.style.display  = 'grid';

    listEl.innerHTML = filteredInvestments.map(inv => {
        const name     = escapeHtml(inv.users?.full_name || inv.users?.first_name || 'Unknown');
        const email    = escapeHtml(inv.users?.email || '');
        const amount   = '$' + parseFloat(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
        const date     = formatDate(inv.created_at);
        const plan     = escapeHtml(inv.method || '—');
        const coin     = escapeHtml((inv.coin || '—').toUpperCase());
        const ref      = escapeHtml(inv.reference || '—');
        const rate     = inv.daily_rate != null ? inv.daily_rate + '%/day' : '—';
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        // Maturity tag
        let maturityTag = '';
        if (inv.end_date) {
            const endDate  = new Date(inv.end_date);
            const today    = new Date(); today.setHours(0,0,0,0); endDate.setHours(0,0,0,0);
            const daysLeft = Math.ceil((endDate - today) / 86400000);
            const endFmt   = endDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
            const tag = daysLeft > 0
                ? `${endFmt} · ${daysLeft}d left`
                : daysLeft === 0 ? `${endFmt} · Matures today`
                : `${endFmt} · Matured`;
            maturityTag = `<span class="wdr-meta-item"><i class="uil uil-hourglass"></i> ${tag}</span>`;
        }

        const actionBtn = inv.status === 'pending'
            ? `<button class="wdr-action-btn review" onclick="openInvModal('${inv.id}')">
                   <i class="uil uil-eye"></i> Review
               </button>`
            : `<button class="wdr-action-btn view" onclick="openInvModal('${inv.id}')">
                   <i class="uil uil-eye"></i> View
               </button>`;

        return `
        <div class="adm-card">
            <div class="wdr-card-top">
                <div class="wdr-avatar">${initials}</div>
                <div class="wdr-card-user">
                    <div class="wdr-card-name">${name}</div>
                    <div class="wdr-card-email">${email}</div>
                </div>
                <span class="badge ${inv.status}">${capitalise(inv.status)}</span>
            </div>
            <div class="wdr-card-body">
                <div class="adm-card-amount investment">${amount}</div>
                <div class="wdr-card-meta">
                    <span class="wdr-meta-item"><i class="uil uil-link"></i> ${ref}</span>
                    <span class="wdr-meta-item"><i class="uil uil-diamond"></i> ${plan} · ${coin}</span>
                    <span class="wdr-meta-item"><i class="uil uil-chart-line"></i> ${rate}</span>
                    <span class="wdr-meta-item"><i class="uil uil-calendar-alt"></i> ${date}</span>
                    ${maturityTag}
                </div>
            </div>
            <div class="adm-card-footer">
                ${actionBtn}
            </div>
        </div>`;
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

    // Parse daily rate from note field: "Standard plan — 3% daily"
    const noteMatch = (inv.note || '').match(/([\d.]+)%\s*daily/i);
    const parsedRate = noteMatch ? parseFloat(noteMatch[1]) : null;

    setText('miUser',      name);
    setText('miEmail',     inv.users?.email || '—');
    setText('miReference', inv.reference    || '—');
    setText('miPlan',      inv.method       || '—');
    setText('miCoin',      (inv.coin || '—').toUpperCase());
    setText('miAmount',    amount);
    setText('miBalance',   balance);
    setText('miDate',      formatDateTime(inv.created_at));
    setText('miRate',      parsedRate != null ? parsedRate + '% daily' : '—');

    // ── Maturity info in modal ──
    if (inv.end_date) {
        const endDate  = new Date(inv.end_date);
        const today    = new Date();
        today.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil((endDate - today) / 86400000);
        const endFmt   = endDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
        const daysStr  = daysLeft > 0 ? `(${daysLeft} days left)` : daysLeft === 0 ? '(matures today)' : '(matured)';
        setText('miMaturity', `${endFmt} ${daysStr}`);
    } else {
        setText('miMaturity', '—');
    }
    document.getElementById('miStatus').innerHTML =
        `<span class="badge ${inv.status}">${capitalise(inv.status)}</span>`;

    // Store parsed rate on the modal for use in handleInvAction
    document.getElementById('invModal').dataset.parsedRate = parsedRate != null ? parsedRate : '';

    document.getElementById('miNoteWrap').style.display = isPending ? 'flex' : 'none';
    document.getElementById('miActions').style.display  = isPending ? 'flex' : 'none';
    document.getElementById('miResolved').style.display = 'none';
    document.getElementById('miNote').value             = '';

    const approveBtn = document.getElementById('miApproveBtn');
    const rejectBtn  = document.getElementById('miRejectBtn');
    approveBtn.disabled = false;
    approveBtn.innerHTML = '<i class="uil uil-check-circle"></i> Approve & Activate';
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

        // ── BUILD TRANSACTION UPDATE ──
        const txUpdate = { status: newStatus };
        if (note) txUpdate.note = note;

        if (newStatus === 'completed') {
            // Parse daily rate from the note field e.g. "Standard plan — 3% daily"
            const parsedRate = parseFloat(
                document.getElementById('invModal').dataset.parsedRate || '0'
            );

            const today    = new Date();
            const endDate  = new Date(today);
            endDate.setDate(endDate.getDate() + 30);

            const toDateStr = d => d.toISOString().split('T')[0];

            txUpdate.daily_rate    = parsedRate || null;
            txUpdate.start_date    = toDateStr(today);
            txUpdate.end_date      = toDateStr(endDate);
            txUpdate.duration_days = 30;
            txUpdate.inv_active    = true;
        }

        // 1. Update transaction
        const { error: txError } = await db
            .from('transactions')
            .update(txUpdate)
            .eq('id', inv.id);

        if (txError) throw txError;

        // 2. Update user balance
        const { data: userData, error: fetchError } = await db
            .from('users')
            .select('balance')
            .eq('id', userId)
            .single();

        if (fetchError) throw fetchError;

        const currentBalance = parseFloat(userData.balance || 0);
        const newBalance = newStatus === 'completed'
            ? Math.max(0, currentBalance - amount)  // deduct invested amount
            : currentBalance;                         // reject — no change

        const { error: userError } = await db
            .from('users')
            .update({ balance: newBalance })
            .eq('id', userId);

        if (userError) throw userError;

        // 3. Send email notification
        sendNotification({
            type:   newStatus === 'completed' ? 'investment_approved' : 'investment_rejected',
            email:  inv.users?.email || '',
            name:   inv.users?.full_name || inv.users?.first_name || 'there',
            amount: amount,
            plan:   inv.method || '',
            coin:   inv.coin || '',
            ref:    inv.reference || inv.id,
        });

        // 4. Update local state
        activeInvestment.status = newStatus;
        allInvestments = allInvestments.map(i =>
            i.id === inv.id ? { ...i, status: newStatus } : i
        );
        applyFilter();

        // 4. Show resolved state in modal
        document.getElementById('miActions').style.display  = 'none';
        document.getElementById('miNoteWrap').style.display = 'none';
        const resolvedEl  = document.getElementById('miResolved');
        const resolvedMsg = document.getElementById('miResolvedMsg');
        resolvedEl.style.display = 'flex';

        if (newStatus === 'completed') {
            resolvedMsg.textContent =
                `✓ Investment activated. $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} deducted from balance. Daily profits will be credited automatically.`;
        } else {
            resolvedMsg.textContent = '✕ Investment rejected. No balance change.';
        }

        document.getElementById('miStatus').innerHTML =
            `<span class="badge ${newStatus}">${capitalise(newStatus)}</span>`;

    } catch (err) {
        console.error('Investment action error:', err.message);
        approveBtn.disabled = false;
        rejectBtn.disabled  = false;
        approveBtn.innerHTML = '<i class="uil uil-check-circle"></i> Approve & Activate';
        rejectBtn.innerHTML  = '<i class="uil uil-times-circle"></i> Reject';
        alert('Something went wrong: ' + err.message);
    }
}
