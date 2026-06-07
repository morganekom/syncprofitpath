// ================================================================
// USERS.JS — Admin user management page
// Load all users, filter by KYC status, search, view detail modal,
// edit balance, approve/reject KYC, send broadcast emails
// ================================================================

let allUsers     = [];
let activeFilter = 'all';
let activeUserId = null;

// Set of selected user IDs for email broadcast
let selectedUserIds = new Set();

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
        const kycMatch    = activeFilter === 'all' || u.kyc_status === activeFilter;
        const searchMatch = !query ||
            (u.full_name || '').toLowerCase().includes(query) ||
            (u.email     || '').toLowerCase().includes(query) ||
            (u.country   || '').toLowerCase().includes(query);
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
            <td class="col-check">
                <input
                    type="checkbox"
                    class="user-checkbox row-checkbox"
                    data-id="${u.id}"
                    data-email="${escapeHtml(u.email || '')}"
                    data-name="${escapeHtml(u.full_name || u.email || 'User')}"
                    ${selectedUserIds.has(u.id) ? 'checked' : ''}
                    onchange="handleRowCheckbox(this)"
                >
            </td>
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

    syncSelectAllCheckbox();
}


// ========================= SELECTION =========================
function handleRowCheckbox(checkbox) {
    const id = checkbox.dataset.id;
    if (checkbox.checked) {
        selectedUserIds.add(id);
    } else {
        selectedUserIds.delete(id);
    }
    syncToolbar();
    syncSelectAllCheckbox();
}

function handleSelectAllCheckbox(masterCheckbox) {
    const filtered = getFilteredUsers();
    if (masterCheckbox.checked) {
        filtered.forEach(u => selectedUserIds.add(u.id));
    } else {
        filtered.forEach(u => selectedUserIds.delete(u.id));
    }
    renderUsers();   // re-render to sync row checkboxes
    syncToolbar();
}

function toggleSelectAll() {
    const filtered  = getFilteredUsers();
    const allSelected = filtered.every(u => selectedUserIds.has(u.id));
    if (allSelected) {
        filtered.forEach(u => selectedUserIds.delete(u.id));
    } else {
        filtered.forEach(u => selectedUserIds.add(u.id));
    }
    renderUsers();
    syncToolbar();
}

function clearSelection() {
    selectedUserIds.clear();
    renderUsers();
    syncToolbar();
}

function syncToolbar() {
    const toolbar = document.getElementById('emailToolbar');
    const label   = document.getElementById('selectedCountLabel');
    const count   = selectedUserIds.size;
    label.textContent = `${count} user${count !== 1 ? 's' : ''} selected`;
    toolbar.classList.toggle('visible', count > 0);
}

function syncSelectAllCheckbox() {
    const cb       = document.getElementById('selectAllCheckbox');
    if (!cb) return;
    const filtered = getFilteredUsers();
    if (filtered.length === 0) {
        cb.checked       = false;
        cb.indeterminate = false;
        return;
    }
    const checkedCount = filtered.filter(u => selectedUserIds.has(u.id)).length;
    if (checkedCount === 0) {
        cb.checked = false; cb.indeterminate = false;
    } else if (checkedCount === filtered.length) {
        cb.checked = true;  cb.indeterminate = false;
    } else {
        cb.checked = false; cb.indeterminate = true;
    }
}


// ========================= COMPOSE EMAIL MODAL =========================
function openComposeModal() {
    if (selectedUserIds.size === 0) return;

    // Populate recipients list
    const recipients = allUsers.filter(u => selectedUserIds.has(u.id));
    document.getElementById('recipientCount').textContent = recipients.length;
    document.getElementById('recipientList').textContent  =
        recipients.map(u => `${u.full_name || 'User'} <${u.email}>`).join(', ');

    // Reset form
    document.getElementById('emailSubject').value = '';
    document.getElementById('emailBody').value     = '';
    document.getElementById('charCount').textContent = '0';
    setEmailFeedback('', '');
    document.getElementById('emailSendBtn').disabled = false;

    document.getElementById('emailModalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('emailSubject').focus(), 100);
}

function closeComposeModal() {
    document.getElementById('emailModalOverlay').classList.remove('open');
    document.body.style.overflow = '';
}

function handleEmailOverlayClick(e) {
    if (e.target === document.getElementById('emailModalOverlay')) closeComposeModal();
}

function updateCharCount() {
    const len = document.getElementById('emailBody').value.length;
    document.getElementById('charCount').textContent = len;
}

function setEmailFeedback(message, type) {
    const el = document.getElementById('emailFeedback');
    el.textContent = message;
    el.className   = 'email-feedback' + (type ? ` ${type}` : '');
}


// ========================= SEND EMAILS =========================
async function sendBroadcastEmails() {
    const subject = document.getElementById('emailSubject').value.trim();
    const body    = document.getElementById('emailBody').value.trim();

    if (!subject) { setEmailFeedback('Please enter a subject.', 'error'); return; }
    if (!body)    { setEmailFeedback('Please write a message.', 'error'); return; }

    const recipients = allUsers.filter(u => selectedUserIds.has(u.id));
    if (recipients.length === 0) { closeComposeModal(); return; }

    const sendBtn = document.getElementById('emailSendBtn');
    sendBtn.disabled = true;
    setEmailFeedback(`Sending to ${recipients.length} user${recipients.length !== 1 ? 's' : ''}…`, 'info');

    let sent   = 0;
    let failed = 0;

    for (const user of recipients) {
        try {
            const res = await fetch(
                'https://syqdwottzrhpclnvzdmz.supabase.co/functions/v1/send-admin-email',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':  'application/json',
                        'apikey':        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5cWR3b3R0enJocGNsbnZ6ZG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MzQyMzAsImV4cCI6MjA5MzIxMDIzMH0.YCVOAparA-_MxBrn-O_pXdZgdeFpPXGUeWdu1TkeMz0',
                        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5cWR3b3R0enJocGNsbnZ6ZG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MzQyMzAsImV4cCI6MjA5MzIxMDIzMH0.YCVOAparA-_MxBrn-O_pXdZgdeFpPXGUeWdu1TkeMz0',
                    },
                    body: JSON.stringify({
                        to:      user.email,
                        name:    user.full_name || 'User',
                        subject: subject,
                        body:    body,
                    }),
                }
            );
            res.ok ? sent++ : failed++;
        } catch {
            failed++;
        }

        // Update progress live
        setEmailFeedback(
            `Sending… ${sent + failed} / ${recipients.length}`,
            'info'
        );
    }

    // Done
    if (failed === 0) {
        setEmailFeedback(`✓ Email sent to ${sent} user${sent !== 1 ? 's' : ''}.`, 'success');
    } else {
        setEmailFeedback(
            `Sent: ${sent} • Failed: ${failed}. Check your edge function logs.`,
            failed === recipients.length ? 'error' : 'info'
        );
    }

    // Re-enable after a moment; keep modal open so admin can see result
    setTimeout(() => { sendBtn.disabled = false; }, 2000);
}


// ========================= USER DETAIL MODAL =========================
function openUserModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    activeUserId = userId;

    document.getElementById('modalUserName').textContent = user.full_name || 'User';

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

    document.getElementById('editBalance').value = user.balance || 0;
    document.getElementById('editProfit').value  = user.profit  || 0;
    document.getElementById('editPending').value = user.pending || 0;

    document.getElementById('balanceError').textContent    = '';
    document.getElementById('balanceSuccess').textContent  = '';
    document.getElementById('kycActionSuccess').textContent = '';

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

    const balance   = parseFloat(document.getElementById('editBalance').value);
    const profit    = parseFloat(document.getElementById('editProfit').value);
    const pending   = parseFloat(document.getElementById('editPending').value);
    const errorEl   = document.getElementById('balanceError');
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


// ========================= KYC ACTIONS =========================
async function modalApproveKyc() { await updateKycStatus('verified'); }
async function modalRejectKyc()  { await updateKycStatus('rejected'); }

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
    document.getElementById('usersLoading').style.display      = state === 'loading' ? 'flex'  : 'none';
    document.getElementById('usersEmpty').style.display        = state === 'empty'   ? 'flex'  : 'none';
    document.getElementById('usersTableWrapper').style.display = state === 'table'   ? 'block' : 'none';
}
