// ================================================================
// TRANSACTIONS.JS — Fetches real data from Supabase
// Matches your transactions table columns exactly:
// id, created_at, user_id, type, amount, coin,
// status, note, method, reference
// ================================================================


// ── CURRENT FILTER ──
let activeFilter = 'all';

// ── ALL FETCHED TRANSACTIONS (kept in memory for filtering) ──
let allTransactions = [];


// ================================================================
// INIT
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    setupFilterTabs();
    loadTransactions();
});


// ================================================================
// FILTER TABS
// ================================================================

function setupFilterTabs() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeFilter = tab.dataset.filter;
            renderTable(filteredTransactions());
        });
    });
}

function filteredTransactions() {
    if (activeFilter === 'all') return allTransactions;
    return allTransactions.filter(t => t.type === activeFilter);
}


// ================================================================
// LOAD FROM SUPABASE
// ================================================================

async function loadTransactions() {
    // Show loading, hide others
    showState('loading');

    // Get current user from localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id;

    if (!userId) {
        // Not logged in — show empty state
        showState('empty');
        return;
    }

    try {
        // Fetch this user's transactions, newest first
        const { data, error } = await db
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        allTransactions = data || [];

        if (allTransactions.length === 0) {
            showState('empty');
        } else {
            showState('table');
            renderTable(filteredTransactions());
        }

    } catch (err) {
        console.error('Transactions fetch error:', err.message);
        showState('error');
    }
}


// ================================================================
// RENDER TABLE
// ================================================================

function renderTable(transactions) {
    const tbody = document.getElementById('transTableBody');
    if (!tbody) return;

    if (transactions.length === 0) {
        // No results for this filter — show a "no results" row
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center; padding:3rem; color:var(--color-gray-light);">
                    No ${activeFilter === 'all' ? '' : activeFilter} transactions found.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = transactions.map(t => buildRow(t)).join('');
}

function buildRow(t) {
    const date      = formatDate(t.created_at);
    const reference = t.reference ? '#' + t.reference.slice(0, 10).toUpperCase() : '#' + t.id.slice(0, 8).toUpperCase();
    const typeBadge = buildTypeBadge(t.type);
    const status    = buildStatusBadge(t.status);
    const amount    = buildAmount(t.amount, t.type);
    const coin      = t.coin || '—';
    const method    = t.method || '—';
    const note      = t.note || '—';

    return `
        <tr>
            <td class="td-reference">${reference}</td>
            <td>${date}</td>
            <td>${typeBadge}</td>
            <td>${coin}</td>
            <td class="hide-mobile">${method}</td>
            <td>${amount}</td>
            <td class="td-note hide-mobile" title="${escapeHtml(note)}">${escapeHtml(note)}</td>
            <td>${status}</td>
        </tr>
    `;
}


// ================================================================
// BUILDERS
// ================================================================

function buildTypeBadge(type) {
    const icons = {
        deposit:    'uil uil-arrow-circle-down',
        withdrawal: 'uil uil-arrow-circle-up',
        investment: 'uil uil-diamond',
    };
    const icon  = icons[type] || 'uil uil-exchange';
    const label = type ? (type.charAt(0).toUpperCase() + type.slice(1)) : '—';
    return `<span class="type-badge ${type || ''}"><i class="${icon}"></i>${label}</span>`;
}

function buildStatusBadge(status) {
    const label = status ? (status.charAt(0).toUpperCase() + status.slice(1)) : '—';
    return `<span class="status-badge ${status || ''}">${label}</span>`;
}

function buildAmount(amount, type) {
    const formatted = parseFloat(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    if (type === 'deposit')    return `<span class="amount-positive">+$${formatted}</span>`;
    if (type === 'withdrawal') return `<span class="amount-negative">-$${formatted}</span>`;
    return `<span class="amount-neutral">$${formatted}</span>`;
}


// ================================================================
// STATE MANAGER
// Shows only one section at a time: loading / empty / table / error
// ================================================================

function showState(state) {
    document.getElementById('transLoading').style.display  = state === 'loading' ? 'flex'  : 'none';
    document.getElementById('transEmpty').style.display    = state === 'empty'   ? 'flex'  : 'none';
    document.getElementById('tableWrapper').style.display  = state === 'table'   ? 'block' : 'none';
    document.getElementById('transError').style.display    = state === 'error'   ? 'flex'  : 'none';
}


// ================================================================
// UTILITIES
// ================================================================

function formatDate(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('en-US', {
        day:   '2-digit',
        month: 'short',
        year:  'numeric',
    });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}