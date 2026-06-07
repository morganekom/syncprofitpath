// ================================================================
// ADMIN / KYC.JS
// Lists all users grouped by KYC status.
// Admin can verify or reject — updates kyc_status in users table.
// ================================================================


// ── STATE ──
let allUsers      = [];
let filteredUsers = [];
let activeStatus  = 'pending';
let activeUser    = null;


// ================================================================
// INIT
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadKyc();
    initFilterTabs();
    initSearch();
});


// ================================================================
// LOAD USERS WITH KYC DATA
// ================================================================

async function loadKyc() {
    const loadingEl  = document.getElementById('kycLoading');
    const emptyEl    = document.getElementById('kycEmpty');
    const refreshBtn = document.getElementById('refreshBtn');

    loadingEl.style.display = 'flex';
    emptyEl.style.display   = 'none';

    if (refreshBtn) { refreshBtn.classList.add('spinning'); refreshBtn.disabled = true; }

    try {
        const { data, error } = await db
            .from('users')
            .select('id, full_name, first_name, last_name, email, phone, country, dob, balance, kyc_status, created_at')
            .neq('role', 'admin')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allUsers = data || [];
        applyFilter();

    } catch (err) {
        console.error('KYC load error:', err.message);
        loadingEl.style.display = 'none';
        emptyEl.style.display   = 'flex';
        document.querySelector('#kycEmpty p').textContent = 'Failed to load. Please retry.';
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
    document.getElementById('kycSearch').addEventListener('input', applyFilter);
}


// ================================================================
// APPLY FILTER + SEARCH → RENDER
// ================================================================

function applyFilter() {
    const query = (document.getElementById('kycSearch').value || '').toLowerCase().trim();

    filteredUsers = allUsers.filter(u => {
        const status      = u.kyc_status || 'unsubmitted';
        const matchStatus = activeStatus === 'all' || status === activeStatus;
        if (!matchStatus) return false;
        if (!query) return true;

        const name  = (u.full_name  || u.first_name || '').toLowerCase();
        const email = (u.email      || '').toLowerCase();
        return name.includes(query) || email.includes(query);
    });

    renderTable();
}


// ================================================================
// RENDER TABLE
// ================================================================

function renderTable() {
    const loadingEl = document.getElementById('kycLoading');
    const emptyEl   = document.getElementById('kycEmpty');
    const listEl    = document.getElementById('kycList');

    loadingEl.style.display = 'none';

    if (filteredUsers.length === 0) {
        emptyEl.style.display = 'flex';
        listEl.style.display  = 'none';
        const msgs = {
            pending: 'No pending KYC submissions.',
            verified: 'No verified users yet.',
            rejected: 'No rejected submissions.',
            unsubmitted: 'All users have submitted KYC.',
            all: 'No users found.',
        };
        document.querySelector('#kycEmpty p').textContent = msgs[activeStatus] || 'No users found.';
        return;
    }

    emptyEl.style.display = 'none';
    listEl.style.display  = 'grid';

    listEl.innerHTML = filteredUsers.map(u => {
        const name     = escapeHtml(u.full_name || u.first_name || 'Unknown');
        const email    = escapeHtml(u.email || '—');
        const country  = escapeHtml(u.country || '—');
        const joined   = formatDate(u.created_at);
        const status   = u.kyc_status || 'unsubmitted';
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        const actionBtn = status === 'pending'
            ? `<button class="wdr-action-btn review" onclick="openKycModal('${u.id}')">
                   <i class="uil uil-shield-check"></i> Review
               </button>`
            : `<button class="wdr-action-btn view" onclick="openKycModal('${u.id}')">
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
                <span class="badge ${status}">${capitalise(status)}</span>
            </div>
            <div class="wdr-card-body">
                <div class="wdr-card-meta">
                    <span class="wdr-meta-item"><i class="uil uil-map-marker"></i> ${country}</span>
                    <span class="wdr-meta-item"><i class="uil uil-calendar-alt"></i> Joined ${joined}</span>
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

function openKycModal(id) {
    activeUser = allUsers.find(u => u.id === id);
    if (!activeUser) return;

    const u         = activeUser;
    const status    = u.kyc_status || 'unsubmitted';
    const isPending = status === 'pending';
    const name      = u.full_name || u.first_name || 'Unknown';
    const initials  = getInitials(u);
    const balance   = '$' + parseFloat(u.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

    // User snapshot
    setText('mkName',    name);
    setText('mkEmail',   u.email   || '—');
    setText('mkCountry', u.country || '—');
    setText('mkDob',     u.dob     || '—');
    setText('mkPhone',   u.phone   || '—');
    setText('mkBalance', balance);
    setText('mkJoined',  formatDate(u.created_at));
    setText('mkAvatar',  initials);

    // Status badge
    document.getElementById('mkBadge').className   = `badge ${status}`;
    document.getElementById('mkBadge').textContent = capitalise(status);

    // Documents section
    // We store kyc_status but not file URLs yet — show note if unsubmitted
    const noDocs  = document.getElementById('mkNoDocs');
    const noteWrap = document.getElementById('mkNoteWrap');
    const actions  = document.getElementById('mkActions');

    if (status === 'unsubmitted') {
        noDocs.style.display   = 'flex';
        noteWrap.style.display = 'none';
        actions.style.display  = 'none';
    } else {
        noDocs.style.display   = 'none';
        noteWrap.style.display = isPending ? 'flex' : 'none';
        actions.style.display  = isPending ? 'flex' : 'none';
    }

    document.getElementById('mkResolved').style.display = 'none';
    document.getElementById('mkNote').value = '';

    // Reset buttons
    const verifyBtn = document.getElementById('mkVerifyBtn');
    const rejectBtn = document.getElementById('mkRejectBtn');
    verifyBtn.disabled = false;
    verifyBtn.innerHTML = '<i class="uil uil-shield-check"></i> Verify';
    rejectBtn.disabled  = false;
    rejectBtn.innerHTML = '<i class="uil uil-times-circle"></i> Reject';

    document.getElementById('kycModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeKycModal(event) {
    if (event && event.target !== document.getElementById('kycModal')) return;
    document.getElementById('kycModal').classList.remove('open');
    document.body.style.overflow = '';
    activeUser = null;
}


// ================================================================
// HANDLE VERIFY / REJECT
// ================================================================

async function handleKycAction(newStatus) {
    if (!activeUser) return;

    const verifyBtn = document.getElementById('mkVerifyBtn');
    const rejectBtn = document.getElementById('mkRejectBtn');

    verifyBtn.disabled = true;
    rejectBtn.disabled = true;

    if (newStatus === 'verified') {
        verifyBtn.innerHTML = '<i class="uil uil-spinner-alt spin"></i> Verifying…';
    } else {
        rejectBtn.innerHTML = '<i class="uil uil-spinner-alt spin"></i> Rejecting…';
    }

    try {
        const { error } = await db
            .from('users')
            .update({ kyc_status: newStatus })
            .eq('id', activeUser.id);

        if (error) throw error;

        // Update local state
        // Send email notification
        sendNotification({
            type:  newStatus === 'verified' ? 'kyc_approved' : 'kyc_rejected',
            email: activeUser.email || '',
            name:  activeUser.full_name || activeUser.first_name || 'there',
        });

        activeUser.kyc_status = newStatus;
        allUsers = allUsers.map(u =>
            u.id === activeUser.id ? { ...u, kyc_status: newStatus } : u
        );
        applyFilter();

        // Update badge in modal
        document.getElementById('mkBadge').className   = `badge ${newStatus}`;
        document.getElementById('mkBadge').textContent = capitalise(newStatus);

        // Show resolved
        document.getElementById('mkActions').style.display  = 'none';
        document.getElementById('mkNoteWrap').style.display = 'none';
        const resolvedEl  = document.getElementById('mkResolved');
        const resolvedMsg = document.getElementById('mkResolvedMsg');
        resolvedEl.style.display = 'flex';
        resolvedMsg.textContent  = newStatus === 'verified'
            ? `✓ ${activeUser.full_name || activeUser.first_name} is now verified.`
            : `✕ KYC rejected. User has been notified.`;

    } catch (err) {
        console.error('KYC action error:', err.message);
        verifyBtn.disabled  = false;
        rejectBtn.disabled  = false;
        verifyBtn.innerHTML = '<i class="uil uil-shield-check"></i> Verify';
        rejectBtn.innerHTML = '<i class="uil uil-times-circle"></i> Reject';
        alert('Something went wrong: ' + err.message);
    }
}