// ================================================================
// ADMIN.JS — Overview dashboard
// Shared utility functions also used by other admin pages
// ================================================================


// ── STATE ──
let overviewStats = {
    totalUsers:          0,
    pendingDeposits:     0,
    pendingWithdrawals:  0,
    pendingKyc:          0,
    totalDeposited:      0,
    totalInvested:       0,
};


// ================================================================
// INIT
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    setAdminDate();
    loadAll();
});


// ================================================================
// SET DATE
// ================================================================

function setAdminDate() {
    const el = document.getElementById('adminDate');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}


// ================================================================
// LOAD ALL — called on init and on refresh button
// ================================================================

async function loadAll() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.classList.add('spinning');
        refreshBtn.disabled = true;
    }

    await Promise.all([
        loadStats(),
        loadRecentTransactions(),
        loadNewestUsers(),
    ]);

    if (refreshBtn) {
        refreshBtn.classList.remove('spinning');
        refreshBtn.disabled = false;
    }
}


// ================================================================
// LOAD STATS
// ================================================================

async function loadStats() {
    try {
        // Total users
        const { count: userCount } = await db
            .from('users')
            .select('id', { count: 'exact', head: true })
            .neq('role', 'admin');

        // Pending deposits
        const { count: depCount } = await db
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('type', 'deposit')
            .eq('status', 'pending');

        // Pending withdrawals
        const { count: wdrCount } = await db
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('type', 'withdrawal')
            .eq('status', 'pending');

        // Pending KYC
        const { count: kycCount } = await db
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('kyc_status', 'pending');

        // Total deposited (sum of completed deposits)
        const { data: depSum } = await db
            .from('transactions')
            .select('amount')
            .eq('type', 'deposit')
            .eq('status', 'completed');

        // Total invested (sum of all investments)
        const { data: invSum } = await db
            .from('transactions')
            .select('amount')
            .eq('type', 'investment');

        overviewStats.totalUsers         = userCount  || 0;
        overviewStats.pendingDeposits    = depCount   || 0;
        overviewStats.pendingWithdrawals = wdrCount   || 0;
        overviewStats.pendingKyc         = kycCount   || 0;
        overviewStats.totalDeposited     = (depSum  || []).reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        overviewStats.totalInvested      = (invSum  || []).reduce((s, r) => s + parseFloat(r.amount || 0), 0);

        renderStats();

    } catch (err) {
        console.error('Stats load error:', err.message);
    }
}

function renderStats() {
    setText('statTotalUsers',         overviewStats.totalUsers);
    setText('statPendingDeposits',    overviewStats.pendingDeposits);
    setText('statPendingWithdrawals', overviewStats.pendingWithdrawals);
    setText('statPendingKyc',         overviewStats.pendingKyc);
    setText('statTotalDeposited',     '$' + formatNum(overviewStats.totalDeposited));
    setText('statTotalInvested',      '$' + formatNum(overviewStats.totalInvested));

    // Quick action badges
    setBadge('qaBadgeDeposit',  overviewStats.pendingDeposits);
    setBadge('qaBadgeWithdraw', overviewStats.pendingWithdrawals);
    setBadge('qaBadgeKyc',      overviewStats.pendingKyc);
}

function setBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = count;
    el.classList.toggle('hidden', count === 0);
}


// ================================================================
// RECENT TRANSACTIONS (last 8)
// ================================================================

async function loadRecentTransactions() {
    const loadingEl = document.getElementById('recentTxLoading');
    const emptyEl   = document.getElementById('recentTxEmpty');
    const listEl    = document.getElementById('recentTxList');
    if (!listEl) return;

    try {
        // Fetch recent transactions joined with user name
        const { data, error } = await db
            .from('transactions')
            .select('*, users(full_name, first_name)')
            .order('created_at', { ascending: false })
            .limit(8);

        if (error) throw error;

        loadingEl.style.display = 'none';

        if (!data || data.length === 0) {
            emptyEl.style.display = 'flex';
            return;
        }

        listEl.style.display = 'flex';
        listEl.innerHTML = data.map(t => buildTxItem(t)).join('');

    } catch (err) {
        console.error('Recent tx error:', err.message);
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl)   emptyEl.style.display   = 'flex';
    }
}

function buildTxItem(t) {
    const typeConfig = {
        deposit:    { icon: 'uil-arrow-circle-down', bg: 'bg-success-light',  labelClass: 'deposit'    },
        withdrawal: { icon: 'uil-arrow-circle-up',   bg: 'bg-danger-light',   labelClass: 'withdrawal' },
        investment: { icon: 'uil-diamond',            bg: 'bg-purple-light',  labelClass: 'investment' },
    };

    const cfg    = typeConfig[t.type] || { icon: 'uil-exchange', bg: 'bg-primary-light', labelClass: '' };
    const name   = t.users?.full_name || t.users?.first_name || 'Unknown user';
    const date   = formatDate(t.created_at);
    const amount = parseFloat(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const prefix = t.type === 'deposit' ? '+' : t.type === 'withdrawal' ? '-' : '';

    return `
        <li class="recent-tx-item">
            <div class="tx-icon ${cfg.bg}">
                <i class="uil ${cfg.icon} ${cfg.labelClass}"></i>
            </div>
            <div class="tx-info">
                <div class="tx-info-top">
                    <span class="tx-name">${escapeHtml(name)}</span>
                    <span class="tx-amount-label ${cfg.labelClass}">${prefix}$${amount}</span>
                </div>
                <div class="tx-info-bottom">
                    <span class="tx-date">${date}</span>
                    <span class="badge ${t.status}">${capitalise(t.status)}</span>
                </div>
            </div>
        </li>
    `;
}


// ================================================================
// NEWEST USERS (last 5)
// ================================================================

async function loadNewestUsers() {
    const loadingEl = document.getElementById('newUsersLoading');
    const emptyEl   = document.getElementById('newUsersEmpty');
    const listEl    = document.getElementById('newUsersList');
    if (!listEl) return;

    try {
        const { data, error } = await db
            .from('users')
            .select('id, full_name, first_name, last_name, email, created_at')
            .neq('role', 'admin')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        loadingEl.style.display = 'none';

        if (!data || data.length === 0) {
            emptyEl.style.display = 'flex';
            return;
        }

        listEl.style.display = 'flex';
        listEl.innerHTML = data.map(u => buildUserItem(u)).join('');

    } catch (err) {
        console.error('Newest users error:', err.message);
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl)   emptyEl.style.display   = 'flex';
    }
}

function buildUserItem(u) {
    const initials = getInitials(u);
    const name     = u.full_name || u.first_name || 'Unknown';
    const date     = formatDate(u.created_at);

    return `
        <li>
            <a href="./user/?id=${u.id}" class="new-user-item">
                <div class="user-avatar">${initials}</div>
                <div class="user-info">
                    <div class="user-name">${escapeHtml(name)}</div>
                    <div class="user-email">${escapeHtml(u.email || '')}</div>
                </div>
                <span class="user-date">${date}</span>
            </a>
        </li>
    `;
}


// ================================================================
// SHARED UTILITIES
// Exported on window so other admin pages can use them
// ================================================================

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function formatNum(num) {
    return Number(num).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

function formatDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function getInitials(user) {
    const first = (user.first_name || '').trim();
    const last  = (user.last_name  || '').trim();
    if (first && last) return (first[0] + last[0]).toUpperCase();
    if (first)         return first.slice(0, 2).toUpperCase();
    return 'U';
}

function capitalise(str) {
    if (!str) return '—';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}