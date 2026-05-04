// ================================================================
// USERS.JS — Admin user management page
// Load all users, filter by KYC status, search, view detail modal,
// edit balance, approve/reject KYC
// ================================================================

let allUsers    = [];
let activeFilter = 'all';
let activeUserId = null;

// ========================= INIT =========================
document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
});


// ========================= LOAD USERS =========================
async function loadUsers() {
    showState('loading');

    try {
        const { data, error } = await db
            .from('users')
            .select('id, first_name, last_name, full_name, email, country, balance, profit, pending, kyc_status, created_at, last_login, phone, role')
            .neq('role', 'admin')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allUsers = data || [];
        document.getElementById('userCountLabel').textContent = allUsers.length;
        renderUsers();

    } catch (err) {
        console.error('Load users error:', err.message);
        showState('empty');
    }
}


// ========================= FILTER =========================
function setFilter(filter, btn) {
    activeFilter = filter;
    document.querySelectorAll('.admin-filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderUsers();
}

function filterUsers() {
    renderUsers();
}

function getFilteredUsers() {
    const query = (document.getElementById('userSearch')?.value || '').toLowerCase().trim();

    return allUsers.filter(u => {
        // KYC filter
        const kycMatch = activeFilter === 'all' || u.kyc_status === activeFilter;

        // Search filter
        const searchMatch = !query ||
            (u.full_name  || '').toLowerCase().includes(query) ||
            (u.email      || '').toLowerCase().includes(query) ||
            (u.country    || '').toLowerCase().includes(query);

        return kycMatch && searchMatch;
    });
}


// ========================= RENDER TABLE =========================
function renderUsers() {
    const filtered = getFilteredUsers();
    const tbody    = document.getElementById('usersTableBody');

    if (filtered.length === 0) {
        showState('empty');
        return;
    }

    showState('table');

    tbody.innerHTML = filtered.map(u => `
        <tr>
            <td>
                <div class="admin-user-cell">
                    <div class="admin-item-avatar">${getInitials(u)}</div>
                    <div>
                        <div class="admin-item-name">${escapeHtml(u.full_name || '—')}</div>
                        <div class="admin-item-meta">${escapeHtml(u.phone || '—')}</div>
                    </div>
                </div>
            </td>
            <td>${escapeHtml(u.email || '—')}</td>
            <td>${escapeHtml(u.country || '—')}</td>
            <td>
                <div>$${formatNum(u.balance || 0)}</div>
                <div class="admin-item-meta">Profit: $${formatNum(u.profit || 0)}</div>
            </td>
            <td><span class="badge ${u.kyc_status || 'unsubmitted'}">${capitalise(u.kyc_status || 'unsubmitted')}</span></td>
            <td>${formatDate(u.created_at)}</td>
            <td>
                <button class="admin-view-btn" onclick="openUserModal('${u.id}')">
                    <i class="uil uil-eye"></i> View
                </button>
            </td>
        </tr>
    `).join('');
}


// ========================= MODAL =========================
function openUserModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    activeUserId = userId;

    document.getElementById('modalUserName').textContent = user.full_name || 'User';

    // Populate modal body with user details
    document.getElementById('userModalBody').innerHTML = `
        <div class="admin-modal-profile">
            <div class="admin-item-avatar admin-item-avatar-lg">${getInitials(user)}</div>
            <div>
                <h3>${escapeHtml(user.full_name || '—')}</h3>
                <p>${escapeHtml(user.email || '—')}</p>
            </div>
        </div>
        <div class="admin-modal-grid">
            <div class="admin-modal-field">
                <label>Phone</label>
                <p>${escapeHtml(user.phone || '—')}</p>
            </div>
            <div class="admin-modal-field">
                <label>Country</label>
                <p>${escapeHtml(user.country || '—')}</p>
            </div>
            <div class="admin-modal-field">
                <label>Joined</label>
                <p>${formatDateTime(user.created_at)}</p>
            </div>
            <div class="admin-modal-field">
                <label>Last Login</label>
                <p>${formatDateTime(user.last_login)}</p>
            </div>
            <div class="admin-modal-field">
                <label>Balance</label>
                <p class="success">$${formatNum(user.balance || 0)}</p>
            </div>
            <div class="admin-modal-field">
                <label>Profit</label>
                <p class="purple">$${formatNum(user.profit || 0)}</p>
            </div>
            <div class="admin-modal-field">
                <label>Pending</label>
                <p class="warning">$${formatNum(user.pending || 0)}</p>
            </div>
            <div class="admin-modal-field">
                <label>KYC Status</label>
                <p><span class="badge ${user.kyc_status || 'unsubmitted'}">${capitalise(user.kyc_status || 'unsubmitted')}</span></p>
            </div>
        </div>
    `;

    // Pre-fill balance fields
    document.getElementById('editBalance').value = user.balance  || 0;
    document.getElementById('editProfit').value  = user.profit   || 0;
    document.getElementById('editPending').value = user.pending  || 0;

    // Clear feedback
    document.getElementById('balanceError').textContent   = '';
    document.getElementById('balanceSuccess').textContent = '';
    document.getElementById('kycActionSuccess').textContent = '';

    // Show current KYC status note
    document.getElementById('kycCurrentStatus').textContent =
        `Current status: ${capitalise(user.kyc_status || 'unsubmitted')}`;

    document.getElementById('userModalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeUserModal(event) {
    if (event && event.target !== document.getElementById('userModalOverlay')) return;
    document.getElementById('userModalOverlay').classList.remove('open');
    document.body.style.overflow = '';
    activeUserId = null;
}


// ========================= SAVE BALANCE =========================
async function saveBalance() {
    if (!activeUserId) return;

    const balance  = parseFloat(document.getElementById('editBalance').value);
    const profit   = parseFloat(document.getElementById('editProfit').value);
    const pending  = parseFloat(document.getElementById('editPending').value);
    const errorEl  = document.getElementById('balanceError');
    const successEl = document.getElementById('balanceSuccess');

    errorEl.textContent   = '';
    successEl.textContent = '';

    if (isNaN(balance) || isNaN(profit) || isNaN(pending)) {
        errorEl.textContent = 'Please enter valid numbers for all fields.';
        return;
    }

    if (balance < 0 || profit < 0 || pending < 0) {
        errorEl.textContent = 'Values cannot be negative.';
        return;
    }

    try {
        const { error } = await db
            .from('users')
            .update({ balance, profit, pending })
            .eq('id', activeUserId);

        if (error) throw error;

        // Update local data
        const user = allUsers.find(u => u.id === activeUserId);
        if (user) { user.balance = balance; user.profit = profit; user.pending = pending; }

        successEl.textContent = '✓ Balance updated successfully.';
        setTimeout(() => successEl.textContent = '', 3000);
        renderUsers();

    } catch (err) {
        errorEl.textContent = 'Failed to update balance. Try again.';
        console.error('Balance update error:', err.message);
    }
}


// ========================= KYC ACTIONS FROM MODAL =========================
async function modalApproveKyc() {
    await updateKycStatus('verified');
}

async function modalRejectKyc() {
    await updateKycStatus('rejected');
}

async function updateKycStatus(status) {
    if (!activeUserId) return;

    const successEl = document.getElementById('kycActionSuccess');
    successEl.textContent = '';

    try {
        const { error } = await db
            .from('users')
            .update({ kyc_status: status })
            .eq('id', activeUserId);

        if (error) throw error;

        // Update local data
        const user = allUsers.find(u => u.id === activeUserId);
        if (user) user.kyc_status = status;

        document.getElementById('kycCurrentStatus').textContent =
            `Current status: ${capitalise(status)}`;

        successEl.textContent = `✓ KYC ${status === 'verified' ? 'verified' : 'rejected'} successfully.`;
        setTimeout(() => successEl.textContent = '', 3000);
        renderUsers();

    } catch (err) {
        successEl.textContent = 'Failed. Please try again.';
        console.error('KYC update error:', err.message);
    }
}


// ========================= STATE MANAGER =========================
function showState(state) {
    document.getElementById('usersLoading').style.display       = state === 'loading' ? 'flex'  : 'none';
    document.getElementById('usersEmpty').style.display         = state === 'empty'   ? 'flex'  : 'none';
    document.getElementById('usersTableWrapper').style.display  = state === 'table'   ? 'block' : 'none';
}