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

document.addEventListener('DOMContentLoaded', initNavSearch);


// ================================================================
// NAV QUICK SEARCH — jump to a user's profile from any admin page
// ================================================================

function initNavSearch() {
    const input = document.getElementById('adminSearch');
    if (!input) return;

    const nav = input.closest('.nav_search');
    const dropdown = document.createElement('div');
    dropdown.className = 'nav-search-dropdown';
    dropdown.id = 'navSearchDropdown';
    nav.appendChild(dropdown);

    let debounceTimer = null;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const query = input.value.trim();

        if (query.length < 2) {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
            return;
        }

        dropdown.classList.add('open');
        dropdown.innerHTML = '<div class="nav-search-loading"><i class="uil uil-spinner-alt spin"></i> Searching…</div>';

        debounceTimer = setTimeout(() => runNavSearch(query, dropdown), 300);
    });

    document.addEventListener('click', e => {
        if (!nav.contains(e.target)) dropdown.classList.remove('open');
    });

    input.addEventListener('keydown', e => {
        if (e.key === 'Escape') { dropdown.classList.remove('open'); input.blur(); }
    });
}

async function runNavSearch(query, dropdown) {
    try {
        // Strip characters that have special meaning in PostgREST's .or() filter syntax
        const safeQuery = query.replace(/[,()]/g, ' ').trim();
        if (!safeQuery) { dropdown.innerHTML = '<div class="nav-search-empty">No users found.</div>'; return; }

        const { data, error } = await db
            .from('users')
            .select('id, full_name, email')
            .neq('role', 'admin')
            .or(`full_name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`)
            .limit(6);

        if (error) throw error;

        if (!data || data.length === 0) {
            dropdown.innerHTML = '<div class="nav-search-empty">No users found.</div>';
            return;
        }

        dropdown.innerHTML = data.map(u => `
            <div class="nav-search-result" onclick="goToUser('${u.id}')">
                <div class="nav-search-result-avatar">${getInitials(u)}</div>
                <div class="nav-search-result-info">
                    <div class="nav-search-result-name">${escapeHtml(u.full_name || '—')}</div>
                    <div class="nav-search-result-email">${escapeHtml(u.email || '—')}</div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error('Nav search error:', err.message);
        dropdown.innerHTML = '<div class="nav-search-empty">Search failed. Try again.</div>';
    }
}

function goToUser(userId) {
    const path = window.location.pathname;
    const idx  = path.indexOf('/admin/');
    const base = idx === -1 ? '' : path.slice(0, idx);
    window.location.href = `${base}/admin/user/?id=${userId}`;
}


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
        loadStorageUsage(),
    ]);

    if (refreshBtn) {
        refreshBtn.classList.remove('spinning');
        refreshBtn.disabled = false;
    }
}


// ================================================================
// FILE STORAGE METER
// Reads admin_storage_usage() (admin-only database function).
// Supabase counts 1 GB as 1024 MB (MiB), so the limit below does too.
// If you upgrade the plan, change STORAGE_LIMIT_BYTES and PLAN_LABEL.
// ================================================================

const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;   // Free plan: 1 GB
const STORAGE_PLAN_LABEL  = 'Free plan \u00b7 1 GB included';
const STORAGE_WARN_PCT    = 70;                    // amber
const STORAGE_DANGER_PCT  = 90;                    // red

const STORAGE_BUCKET_LABELS = {
    'kyc-documents':      'KYC documents',
    'deposit-proofs':     'Deposit proofs',
    'chat-attachments':   'Chat attachments',
    'admin-email-images': 'Admin email images',
};

function formatBytes(bytes) {
    const b = Number(bytes) || 0;
    if (b >= 1024 * 1024 * 1024) return parseFloat((b / (1024 * 1024 * 1024)).toFixed(2)) + ' GB';
    if (b >= 1024 * 1024)        return (b / (1024 * 1024)).toFixed(b >= 100 * 1024 * 1024 ? 0 : 1) + ' MB';
    if (b >= 1024)               return Math.round(b / 1024) + ' KB';
    return b + ' B';
}

async function loadStorageUsage() {
    const card = document.getElementById('storageCard');
    if (!card) return;                       // not on this page

    const loadingEl = document.getElementById('storageLoading');
    const bodyEl    = document.getElementById('storageBody');
    const errorEl   = document.getElementById('storageError');
    const planEl    = card.querySelector('.storage-plan');
    if (planEl) planEl.textContent = STORAGE_PLAN_LABEL;

    loadingEl.style.display = 'flex';
    bodyEl.style.display    = 'none';
    errorEl.style.display   = 'none';

    const { data, error } = await db.rpc('admin_storage_usage');
    loadingEl.style.display = 'none';

    if (error || !data) {
        console.warn('loadStorageUsage error:', error && error.message);
        errorEl.querySelector('p').textContent = 'Storage figures are unavailable right now. Refresh to try again.';
        errorEl.style.display = 'flex';
        return;
    }

    const used = Number(data.total_bytes) || 0;
    const pct  = Math.min(100, (used / STORAGE_LIMIT_BYTES) * 100);
    const left = Math.max(0, STORAGE_LIMIT_BYTES - used);

    let level = 'ok', pill = 'Healthy';
    if (pct >= STORAGE_DANGER_PCT)    { level = 'danger'; pill = 'Almost full'; }
    else if (pct >= STORAGE_WARN_PCT) { level = 'warn';   pill = 'Getting full'; }
    if (used >= STORAGE_LIMIT_BYTES)  { level = 'danger'; pill = 'Over limit'; }

    card.setAttribute('data-level', level);
    document.getElementById('storageUsed').textContent = formatBytes(used);
    document.getElementById('storageOf').textContent   = ' of ' + formatBytes(STORAGE_LIMIT_BYTES) + ' used (' + pct.toFixed(1) + '%)';
    document.getElementById('storagePill').textContent = pill;
    document.getElementById('storageFill').style.width = pct.toFixed(1) + '%';
    document.getElementById('storageLeft').textContent =
        used >= STORAGE_LIMIT_BYTES
            ? 'You are over the included storage by ' + formatBytes(used - STORAGE_LIMIT_BYTES) + '.'
            : formatBytes(left) + ' left before the limit.';

    const alertEl = document.getElementById('storageAlert');
    if (level === 'danger') {
        alertEl.textContent = 'Storage is nearly full. New KYC, deposit and chat uploads can start failing. Delete old or test files, or upgrade the plan.';
        alertEl.style.display = 'block';
    } else if (level === 'warn') {
        alertEl.textContent = 'Storage is past ' + STORAGE_WARN_PCT + '%. Plan ahead: clear old files or upgrade before it fills.';
        alertEl.style.display = 'block';
    } else {
        alertEl.style.display = 'none';
    }

    // Per-bucket breakdown (always list the known buckets, even when empty)
    const rows = {};
    Object.keys(STORAGE_BUCKET_LABELS).forEach(k => { rows[k] = { bucket: k, files: 0, bytes: 0 }; });
    (data.buckets || []).forEach(b => { rows[b.bucket] = { bucket: b.bucket, files: Number(b.files) || 0, bytes: Number(b.bytes) || 0 }; });

    const list = Object.values(rows).sort((a, b) => b.bytes - a.bytes);
    document.getElementById('storageBuckets').innerHTML = list.map(r => {
        const share = used > 0 ? (r.bytes / used) * 100 : 0;
        const label = STORAGE_BUCKET_LABELS[r.bucket] || r.bucket;
        return `
        <li class="storage-bucket">
            <div class="storage-bucket-top">
                <span class="storage-bucket-name">${escapeHtml(label)}</span>
                <span class="storage-bucket-size">${formatBytes(r.bytes)} <small>&middot; ${r.files} file${r.files === 1 ? '' : 's'}</small></span>
            </div>
            <div class="storage-mini-track"><div class="storage-mini-fill" style="width:${share.toFixed(1)}%"></div></div>
        </li>`;
    }).join('');

    bodyEl.style.display = 'block';
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