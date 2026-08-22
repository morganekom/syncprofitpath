// ================================================================
// NOTIFY-INAPP.JS — In-App Notification System
// Reads from existing DB tables — no new table needed.
//
// ADMIN_ONLY flag: when true, bell only renders for admins.
// Set to false when ready to open notifications to all users.
// ================================================================

const NOTIF_ADMIN_ONLY = false; // ← flip to false to enable for all users

// ── Config ──────────────────────────────────────────────────────
const NOTIF_LAST_SEEN_KEY = 'notif_last_seen';
const NOTIF_CACHE_KEY     = 'notif_cache';
const NOTIF_CACHE_TTL     = 2 * 60 * 1000; // 2 minutes

// ── Icons and colours per notification type ──────────────────────
const NOTIF_META = {
    // User notifications
    deposit_approved:    { icon: 'uil-check-circle',    color: 'success', label: 'Deposit Approved'    },
    deposit_rejected:    { icon: 'uil-times-circle',    color: 'danger',  label: 'Deposit Rejected'    },
    deposit_pending:     { icon: 'uil-clock',           color: 'warning', label: 'Deposit Received'    },
    withdrawal_approved: { icon: 'uil-check-circle',    color: 'success', label: 'Withdrawal Processed'},
    withdrawal_rejected: { icon: 'uil-times-circle',    color: 'danger',  label: 'Withdrawal Rejected' },
    investment_approved: { icon: 'uil-diamond',         color: 'purple',  label: 'Investment Approved' },
    investment_rejected: { icon: 'uil-times-circle',    color: 'danger',  label: 'Investment Rejected' },
    investment_matured:  { icon: 'uil-trophy',          color: 'success', label: 'Investment Matured'  },
    kyc_approved:        { icon: 'uil-shield-check',    color: 'success', label: 'KYC Verified'        },
    kyc_rejected:        { icon: 'uil-shield-slash',    color: 'danger',  label: 'KYC Rejected'        },
    password_changed:    { icon: 'uil-lock-alt',        color: 'primary', label: 'Password Changed'    },
    // Admin notifications
    admin_deposit:       { icon: 'uil-arrow-circle-down', color: 'primary', label: 'New Deposit'      },
    admin_withdrawal:    { icon: 'uil-arrow-circle-up',   color: 'warning', label: 'New Withdrawal'   },
    admin_investment:    { icon: 'uil-diamond',           color: 'purple',  label: 'New Investment'   },
    admin_kyc:           { icon: 'uil-shield-check',      color: 'primary', label: 'KYC Submission'   },
};

// ── State ────────────────────────────────────────────────────────
let _notifData     = [];
let _dropdownOpen  = false;
let _isAdmin       = false;
let _userId        = null;

// ── Bootstrap ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!user || !user.id) return;

    _userId  = user.id;
    _isAdmin = user.role === 'admin';

    // Admin always sees bell. Users only see it if NOTIF_ADMIN_ONLY is false.
    if (_isAdmin || !NOTIF_ADMIN_ONLY) {
        const wrap = document.getElementById('navBellWrap');
        if (wrap) wrap.style.display = 'flex';
    }

    // Load and render
    loadNotifications();

    // Close dropdown when clicking outside
    document.addEventListener('click', e => {
        const dropdown = document.getElementById('notifDropdown');
        const btn      = document.getElementById('navBellBtn');
        if (_dropdownOpen && dropdown && !dropdown.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
            closeNotifDropdown();
        }
    });
});

// ── Load notifications ───────────────────────────────────────────
async function loadNotifications() {
    // Try cache first
    try {
        const cached = JSON.parse(localStorage.getItem(NOTIF_CACHE_KEY) || 'null');
        if (cached && (Date.now() - cached.ts) < NOTIF_CACHE_TTL) {
            _notifData = cached.items;
            updateBellBadge();
            renderDropdownList();
            return;
        }
    } catch (e) {}

    try {
        _notifData = _isAdmin ? await fetchAdminNotifs() : await fetchUserNotifs();

        // Cache results
        localStorage.setItem(NOTIF_CACHE_KEY, JSON.stringify({
            ts: Date.now(),
            items: _notifData,
        }));

        updateBellBadge();
        renderDropdownList();
    } catch (err) {
        console.warn('notify-inapp: failed to load', err.message);
    }
}

// ── Fetch for users ──────────────────────────────────────────────
async function fetchUserNotifs() {
    const items = [];

    // 1. Transactions: deposits, withdrawals, investments
    const { data: txs } = await db
        .from('transactions')
        .select('id, type, status, amount, coin, method, created_at, updated_at')
        .eq('user_id', _userId)
        .order('created_at', { ascending: false })
        .limit(30);

    (txs || []).forEach(tx => {
        const type = resolveUserTxType(tx);
        if (!type) return;
        items.push({
            id:   tx.id,
            type,
            ts:   tx.updated_at || tx.created_at,
            body: buildUserTxBody(tx),
        });
    });

    // 2. KYC status from users table
    const { data: userData } = await db
        .from('users')
        .select('kyc_status, kyc_updated_at')
        .eq('id', _userId)
        .maybeSingle();

    if (userData?.kyc_status === 'verified' && userData?.kyc_updated_at) {
        items.push({
            id:   'kyc_verified',
            type: 'kyc_approved',
            ts:   userData.kyc_updated_at,
            body: 'Your identity has been verified. You now have full account access.',
        });
    } else if (userData?.kyc_status === 'rejected' && userData?.kyc_updated_at) {
        items.push({
            id:   'kyc_rejected',
            type: 'kyc_rejected',
            ts:   userData.kyc_updated_at,
            body: 'Your KYC submission was not approved. Please resubmit with valid documents.',
        });
    }

    // Sort by timestamp descending
    items.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    return items;
}

function resolveUserTxType(tx) {
    const { type, status } = tx;
    if (type === 'deposit') {
        if (status === 'completed') return 'deposit_approved';
        if (status === 'failed')    return 'deposit_rejected';
        if (status === 'pending')   return 'deposit_pending';
    }
    if (type === 'withdrawal') {
        if (status === 'completed') return 'withdrawal_approved';
        if (status === 'failed')    return 'withdrawal_rejected';
    }
    if (type === 'investment') {
        if (status === 'completed') return 'investment_approved';
        if (status === 'failed')    return 'investment_rejected';
    }
    return null;
}

function buildUserTxBody(tx) {
    const amount = '$' + parseFloat(tx.amount || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
    const coin = tx.coin ? tx.coin.toUpperCase() : '';
    if (tx.type === 'deposit')    return `Your ${coin} deposit of ${amount} has been ${tx.status === 'completed' ? 'approved and added to your balance' : tx.status === 'failed' ? 'rejected' : 'received and is under review'}.`;
    if (tx.type === 'withdrawal') return `Your withdrawal of ${amount}${tx.method ? ' via ' + tx.method : ''} has been ${tx.status === 'completed' ? 'processed' : 'rejected'}.`;
    if (tx.type === 'investment') return `Your ${amount} investment${tx.method ? ' in ' + tx.method : ''} has been ${tx.status === 'completed' ? 'approved and is now active' : 'rejected'}.`;
    return '';
}

// ── Fetch for admins ─────────────────────────────────────────────
async function fetchAdminNotifs() {
    const items = [];

    // Pending transactions (deposits, withdrawals, investments)
    const { data: txs } = await db
        .from('transactions')
        .select('id, type, status, amount, coin, method, created_at, users(full_name, first_name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);

    (txs || []).forEach(tx => {
        const name   = tx.users?.full_name || tx.users?.first_name || 'A user';
        const amount = '$' + parseFloat(tx.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
        let type, body;

        if (tx.type === 'deposit') {
            type = 'admin_deposit';
            body = `${name} submitted a ${tx.coin?.toUpperCase() || ''} deposit of ${amount}.`;
        } else if (tx.type === 'withdrawal') {
            type = 'admin_withdrawal';
            body = `${name} requested a withdrawal of ${amount}${tx.method ? ' via ' + tx.method : ''}.`;
        } else if (tx.type === 'investment') {
            type = 'admin_investment';
            body = `${name} submitted an investment of ${amount}${tx.method ? ' — ' + tx.method : ''}.`;
        } else return;

        items.push({ id: tx.id, type, ts: tx.created_at, body });
    });

    // Pending KYC
    const { data: kycUsers } = await db
        .from('users')
        .select('id, full_name, first_name, kyc_updated_at, created_at')
        .eq('kyc_status', 'pending')
        .order('kyc_updated_at', { ascending: false })
        .limit(20);

    (kycUsers || []).forEach(u => {
        const name = u.full_name || u.first_name || 'A user';
        items.push({
            id:   `kyc_${u.id}`,
            type: 'admin_kyc',
            ts:   u.kyc_updated_at || u.created_at,
            body: `${name} submitted their KYC documents for review.`,
        });
    });

    items.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    return items;
}

// ── Badge ────────────────────────────────────────────────────────
function updateBellBadge() {
    const badge     = document.getElementById('navBellBadge');
    if (!badge) return;

    const lastSeen  = localStorage.getItem(NOTIF_LAST_SEEN_KEY);
    const unreadCount = lastSeen
        ? _notifData.filter(n => new Date(n.ts) > new Date(lastSeen)).length
        : _notifData.length;

    if (unreadCount > 0) {
        badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// ── Dropdown ─────────────────────────────────────────────────────
function toggleNotifDropdown(e) {
    e.stopPropagation();
    if (_dropdownOpen) {
        closeNotifDropdown();
    } else {
        openNotifDropdown();
    }
}

function openNotifDropdown() {
    const dropdown = document.getElementById('notifDropdown');
    if (!dropdown) return;
    dropdown.classList.add('open');
    _dropdownOpen = true;
    renderDropdownList();
}

function closeNotifDropdown() {
    const dropdown = document.getElementById('notifDropdown');
    if (dropdown) dropdown.classList.remove('open');
    _dropdownOpen = false;
}

function renderDropdownList() {
    const list = document.getElementById('notifDropdownList');
    if (!list || !_dropdownOpen) return;

    const preview = _notifData.slice(0, 3);

    if (preview.length === 0) {
        list.innerHTML = '<div class="notif-empty"><i class="uil uil-bell-slash"></i><span>No notifications yet</span></div>';
        return;
    }

    list.innerHTML = preview.map(n => buildNotifItem(n)).join('');
}

function buildNotifItem(n) {
    const meta    = NOTIF_META[n.type] || { icon: 'uil-bell', color: 'primary', label: 'Notification' };
    const lastSeen = localStorage.getItem(NOTIF_LAST_SEEN_KEY);
    const isUnread = !lastSeen || new Date(n.ts) > new Date(lastSeen);
    const timeAgo  = formatTimeAgo(n.ts);

    return `
    <div class="notif-item${isUnread ? ' unread' : ''}">
        <div class="notif-item-icon ${meta.color}">
            <i class="uil ${meta.icon}"></i>
        </div>
        <div class="notif-item-body">
            <div class="notif-item-title">${meta.label}</div>
            <div class="notif-item-desc">${n.body}</div>
            <div class="notif-item-time">${timeAgo}</div>
        </div>
        ${isUnread ? '<div class="notif-item-dot"></div>' : ''}
    </div>`;
}

function markAllRead() {
    localStorage.setItem(NOTIF_LAST_SEEN_KEY, new Date().toISOString());
    updateBellBadge();
    renderDropdownList();
}

// ── Time formatting ──────────────────────────────────────────────
function formatTimeAgo(isoStr) {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)  return 'Just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days  < 7)  return `${days}d ago`;
    return new Date(isoStr).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
}
