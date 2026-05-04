// ================================================================
// OVERVIEW.JS — Admin overview page
// Loads stat cards, pending items, recent signups
// Supports quick approve/reject directly from overview
// ================================================================


// ========================= INIT =========================
document.addEventListener('DOMContentLoaded', () => {
    // Set date
    const dateEl = document.getElementById('overviewDate');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    loadOverview();
});


// ========================= LOAD ALL DATA =========================
async function loadOverview() {
    await Promise.all([
        loadStatCards(),
        loadPendingDeposits(),
        loadPendingWithdrawals(),
        loadPendingKyc(),
        loadRecentSignups(),
    ]);
}


// ========================= STAT CARDS =========================
async function loadStatCards() {
    try {
        // Total users
        const { count: userCount } = await db
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'user');

        setText('statTotalUsers', userCount ?? 0);

        // Total completed deposits value
        const { data: deposits } = await db
            .from('transactions')
            .select('amount')
            .eq('type', 'deposit')
            .eq('status', 'completed');

        const totalDeposits = (deposits || []).reduce((sum, t) => sum + parseFloat(t.amount), 0);
        setText('statTotalDeposits', '$' + formatNum(totalDeposits));

        // Total completed withdrawals value
        const { data: withdrawals } = await db
            .from('transactions')
            .select('amount')
            .eq('type', 'withdrawal')
            .eq('status', 'completed');

        const totalWithdrawals = (withdrawals || []).reduce((sum, t) => sum + parseFloat(t.amount), 0);
        setText('statTotalWithdrawals', '$' + formatNum(totalWithdrawals));

        // Total investments value
        const { data: investments } = await db
            .from('transactions')
            .select('amount')
            .eq('type', 'investment');

        const totalInvestments = (investments || []).reduce((sum, t) => sum + parseFloat(t.amount), 0);
        setText('statTotalInvestments', '$' + formatNum(totalInvestments));

    } catch (err) {
        console.error('Stat cards error:', err.message);
    }
}


// ========================= PENDING DEPOSITS =========================
async function loadPendingDeposits() {
    const container = document.getElementById('pendingDepositsList');

    try {
        const { data, error } = await db
            .from('transactions')
            .select('*, users(full_name, email)')
            .eq('type', 'deposit')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(5);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = emptyState('No pending deposits');
            return;
        }

        container.innerHTML = data.map(t => `
            <div class="admin-item-row" id="dep-${t.id}">
                <div class="admin-item-left">
                    <div class="admin-item-avatar">${getInitials(t.users?.full_name)}</div>
                    <div>
                        <div class="admin-item-name">${t.users?.full_name || 'Unknown'}</div>
                        <div class="admin-item-meta">${t.coin?.toUpperCase() || '—'} · ${formatDate(t.created_at)}</div>
                    </div>
                </div>
                <div class="admin-item-right">
                    <div class="admin-item-amount">$${formatNum(t.amount)}</div>
                    <div class="admin-action-btns">
                        <button class="admin-approve-btn"
                            onclick="approveDeposit('${t.id}', '${t.user_id}', ${t.amount})">
                            Approve
                        </button>
                        <button class="admin-reject-btn"
                            onclick="rejectTransaction('${t.id}', 'dep')">
                            Reject
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        container.innerHTML = errorState();
        console.error('Pending deposits error:', err.message);
    }
}


// ========================= PENDING WITHDRAWALS =========================
async function loadPendingWithdrawals() {
    const container = document.getElementById('pendingWithdrawalsList');

    try {
        const { data, error } = await db
            .from('transactions')
            .select('*, users(full_name, email, balance)')
            .eq('type', 'withdrawal')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(5);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = emptyState('No pending withdrawals');
            return;
        }

        container.innerHTML = data.map(t => `
            <div class="admin-item-row" id="wdr-${t.id}">
                <div class="admin-item-left">
                    <div class="admin-item-avatar">${getInitials(t.users?.full_name)}</div>
                    <div>
                        <div class="admin-item-name">${t.users?.full_name || 'Unknown'}</div>
                        <div class="admin-item-meta">${t.method || '—'} · ${formatDate(t.created_at)}</div>
                    </div>
                </div>
                <div class="admin-item-right">
                    <div class="admin-item-amount">$${formatNum(t.amount)}</div>
                    <div class="admin-action-btns">
                        <button class="admin-approve-btn"
                            onclick="approveWithdrawal('${t.id}', '${t.user_id}', ${t.amount}, ${t.users?.balance || 0})">
                            Approve
                        </button>
                        <button class="admin-reject-btn"
                            onclick="rejectTransaction('${t.id}', 'wdr')">
                            Reject
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        container.innerHTML = errorState();
        console.error('Pending withdrawals error:', err.message);
    }
}


// ========================= PENDING KYC =========================
async function loadPendingKyc() {
    const container = document.getElementById('pendingKycList');

    try {
        const { data, error } = await db
            .from('users')
            .select('id, full_name, email, created_at, country')
            .eq('kyc_status', 'pending')
            .order('created_at', { ascending: true })
            .limit(5);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = emptyState('No pending KYC submissions');
            return;
        }

        container.innerHTML = data.map(u => `
            <div class="admin-item-row" id="kyc-${u.id}">
                <div class="admin-item-left">
                    <div class="admin-item-avatar">${getInitials(u.full_name)}</div>
                    <div>
                        <div class="admin-item-name">${u.full_name || 'Unknown'}</div>
                        <div class="admin-item-meta">${u.country || '—'} · ${formatDate(u.created_at)}</div>
                    </div>
                </div>
                <div class="admin-item-right">
                    <div class="admin-action-btns">
                        <button class="admin-approve-btn"
                            onclick="approveKyc('${u.id}')">
                            Verify
                        </button>
                        <button class="admin-reject-btn"
                            onclick="rejectKyc('${u.id}')">
                            Reject
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        container.innerHTML = errorState();
        console.error('Pending KYC error:', err.message);
    }
}


// ========================= RECENT SIGNUPS =========================
async function loadRecentSignups() {
    const container = document.getElementById('recentSignupsList');

    try {
        const { data, error } = await db
            .from('users')
            .select('id, full_name, email, country, created_at, kyc_status')
            .eq('role', 'user')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = emptyState('No users yet');
            return;
        }

        container.innerHTML = data.map(u => `
            <div class="admin-item-row">
                <div class="admin-item-left">
                    <div class="admin-item-avatar">${getInitials(u.full_name)}</div>
                    <div>
                        <div class="admin-item-name">${u.full_name || 'Unknown'}</div>
                        <div class="admin-item-meta">${u.email} · ${u.country || '—'}</div>
                    </div>
                </div>
                <div class="admin-item-right">
                    <span class="status-badge ${u.kyc_status || 'unsubmitted'}">
                        ${u.kyc_status || 'Unverified'}
                    </span>
                    <div class="admin-item-meta">${formatDate(u.created_at)}</div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        container.innerHTML = errorState();
        console.error('Recent signups error:', err.message);
    }
}


// ================================================================
// QUICK ACTIONS — Approve / Reject directly from overview
// ================================================================

// APPROVE DEPOSIT:
// 1. Mark transaction as completed
// 2. Add amount to user's balance, clear from pending
async function approveDeposit(txId, userId, amount) {
    disableRowBtns('dep-' + txId);

    try {
        // Mark transaction completed
        const { error: txError } = await db
            .from('transactions')
            .update({ status: 'completed' })
            .eq('id', txId);

        if (txError) throw txError;

        // Get current user balances
        const { data: user, error: userFetchError } = await db
            .from('users')
            .select('balance, pending')
            .eq('id', userId)
            .single();

        if (userFetchError) throw userFetchError;

        const newBalance = parseFloat(user.balance || 0) + parseFloat(amount);
        const newPending = Math.max(0, parseFloat(user.pending || 0) - parseFloat(amount));

        // Update user balance
        const { error: updateError } = await db
            .from('users')
            .update({ balance: newBalance, pending: newPending })
            .eq('id', userId);

        if (updateError) throw updateError;

        // Remove row from UI
        removeRow('dep-' + txId);
        loadStatCards();
        loadSidebarBadges();

    } catch (err) {
        console.error('Approve deposit error:', err.message);
        alert('Failed to approve deposit. Please try again.');
        enableRowBtns('dep-' + txId);
    }
}


// APPROVE WITHDRAWAL:
// 1. Mark transaction as completed
// 2. Deduct amount from user's balance
async function approveWithdrawal(txId, userId, amount, currentBalance) {
    disableRowBtns('wdr-' + txId);

    // Check user has enough balance
    if (parseFloat(amount) > parseFloat(currentBalance)) {
        alert('User does not have sufficient balance for this withdrawal.');
        enableRowBtns('wdr-' + txId);
        return;
    }

    try {
        const { error: txError } = await db
            .from('transactions')
            .update({ status: 'completed' })
            .eq('id', txId);

        if (txError) throw txError;

        const newBalance = Math.max(0, parseFloat(currentBalance) - parseFloat(amount));

        const { error: updateError } = await db
            .from('users')
            .update({ balance: newBalance })
            .eq('id', userId);

        if (updateError) throw updateError;

        removeRow('wdr-' + txId);
        loadStatCards();
        loadSidebarBadges();

    } catch (err) {
        console.error('Approve withdrawal error:', err.message);
        alert('Failed to approve withdrawal. Please try again.');
        enableRowBtns('wdr-' + txId);
    }
}


// REJECT TRANSACTION (deposit or withdrawal)
async function rejectTransaction(txId, prefix) {
    disableRowBtns(prefix + '-' + txId);

    try {
        const { error } = await db
            .from('transactions')
            .update({ status: 'failed' })
            .eq('id', txId);

        if (error) throw error;

        removeRow(prefix + '-' + txId);
        loadSidebarBadges();

    } catch (err) {
        console.error('Reject transaction error:', err.message);
        alert('Failed to reject. Please try again.');
        enableRowBtns(prefix + '-' + txId);
    }
}


// APPROVE KYC
async function approveKyc(userId) {
    disableRowBtns('kyc-' + userId);

    try {
        const { error } = await db
            .from('users')
            .update({ kyc_status: 'verified' })
            .eq('id', userId);

        if (error) throw error;

        removeRow('kyc-' + userId);
        loadSidebarBadges();

    } catch (err) {
        console.error('Approve KYC error:', err.message);
        alert('Failed to verify KYC. Please try again.');
        enableRowBtns('kyc-' + userId);
    }
}


// REJECT KYC
async function rejectKyc(userId) {
    disableRowBtns('kyc-' + userId);

    try {
        const { error } = await db
            .from('users')
            .update({ kyc_status: 'rejected' })
            .eq('id', userId);

        if (error) throw error;

        removeRow('kyc-' + userId);
        loadSidebarBadges();

    } catch (err) {
        console.error('Reject KYC error:', err.message);
        alert('Failed to reject KYC. Please try again.');
        enableRowBtns('kyc-' + userId);
    }
}


// ========================= HELPERS =========================

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function removeRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.style.opacity = '0';
        row.style.transition = 'opacity 300ms ease';
        setTimeout(() => row.remove(), 300);
    }
}

function disableRowBtns(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    row.querySelectorAll('button').forEach(btn => {
        btn.disabled    = true;
        btn.textContent = '...';
    });
}

function enableRowBtns(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    row.querySelectorAll('button').forEach(btn => { btn.disabled = false; });
}

function emptyState(msg) {
    return `<div class="admin-empty"><i class="uil uil-check-circle"></i><p>${msg}</p></div>`;
}

function errorState() {
    return `<div class="admin-empty"><i class="uil uil-exclamation-triangle"></i><p>Failed to load. Try refreshing.</p></div>`;
}