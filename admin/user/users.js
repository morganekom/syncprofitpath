// ================================================================
// USERS.JS — Admin user management page
// Card-based layout. Select users, send broadcast emails.
// ================================================================

let allUsers      = [];
let activeFilter  = 'all';
let activeUserId  = null;
let selectedUserIds = new Set();
let composeImages = [];   // [{ id, file, previewUrl, uploadedUrl, uploading, error }]
const MAX_EMAIL_IMAGES = 4;

// ========================= INIT =========================
document.addEventListener('DOMContentLoaded', () => {
    loadUsers().then(() => {
        // If navigated here from admin dashboard with a specific user id, open their modal
        const params = new URLSearchParams(window.location.search);
        const targetId = params.get('id');
        if (targetId) openUserModal(targetId);
    });
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


// ========================= FILTER & SEARCH =========================
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


// ========================= RENDER CARDS =========================
function renderUsers() {
    const filtered = getFilteredUsers();
    const grid     = document.getElementById('usersGrid');

    if (filtered.length === 0) { showState('empty'); return; }

    showState('grid');

    grid.innerHTML = filtered.map(u => {
        const isChecked = selectedUserIds.has(u.id);
        const kyc       = u.kyc_status || 'unsubmitted';
        const initials  = getInitials(u);
        return `
        <div class="um-card ${isChecked ? 'um-card--selected' : ''}" data-id="${u.id}">
            <div class="um-card-top">
                <label class="um-checkbox-wrap">
                    <input type="checkbox" class="um-checkbox"
                        data-id="${u.id}"
                        ${isChecked ? 'checked' : ''}
                        onchange="handleRowCheckbox(this)"
                        onclick="event.stopPropagation()">
                </label>
                <div class="um-avatar">${initials}</div>
                <div class="um-card-identity">
                    <div class="um-card-name">${escapeHtml(u.full_name || '—')}</div>
                    <div class="um-card-email">${escapeHtml(u.email || '—')}</div>
                </div>
                <span class="badge ${kyc} um-card-badge">${capitalise(kyc)}</span>
            </div>

            <div class="um-card-stats">
                <div class="um-stat">
                    <span class="um-stat-label">Balance</span>
                    <span class="um-stat-value success">$${formatNum(u.balance || 0)}</span>
                </div>
                <div class="um-stat">
                    <span class="um-stat-label">Profit</span>
                    <span class="um-stat-value purple">$${formatNum(u.profit || 0)}</span>
                </div>
                <div class="um-stat">
                    <span class="um-stat-label">Pending</span>
                    <span class="um-stat-value warning">$${formatNum(u.pending || 0)}</span>
                </div>
            </div>

            <div class="um-card-meta">
                <span><i class="uil uil-map-marker"></i> ${escapeHtml(u.country || '—')}</span>
                <span><i class="uil uil-calendar-alt"></i> ${formatDate(u.created_at)}</span>
            </div>

            <div class="um-card-actions">
                <button class="um-view-btn" onclick="openUserModal('${u.id}')">
                    <i class="uil uil-eye"></i> View Details
                </button>
                <button class="um-email-btn" onclick="quickEmailUser('${u.id}')" title="Send email to this user">
                    <i class="uil uil-envelope-alt"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}


// ========================= SELECTION =========================
function handleRowCheckbox(checkbox) {
    const id = checkbox.dataset.id;
    if (checkbox.checked) {
        selectedUserIds.add(id);
    } else {
        selectedUserIds.delete(id);
    }
    // Toggle card selected style
    const card = checkbox.closest('.um-card');
    if (card) card.classList.toggle('um-card--selected', checkbox.checked);
    syncToolbar();
}

function toggleSelectAll() {
    const filtered    = getFilteredUsers();
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
    toolbar.classList.toggle('um-toolbar--visible', count > 0);
}


// ========================= QUICK EMAIL (single user) =========================
function quickEmailUser(userId) {
    // Select just this one user, then open compose modal
    selectedUserIds.clear();
    selectedUserIds.add(userId);
    renderUsers();
    syncToolbar();
    openComposeModal();
}


// ========================= COMPOSE EMAIL MODAL =========================
function openComposeModal() {
    if (selectedUserIds.size === 0) return;

    const recipients = allUsers.filter(u => selectedUserIds.has(u.id));
    document.getElementById('recipientCount').textContent = recipients.length;
    document.getElementById('recipientList').textContent  =
        recipients.map(u => `${u.full_name || 'User'} <${u.email}>`).join(', ');

    document.getElementById('emailSubject').value  = '';
    document.getElementById('emailBody').value     = '';
    document.getElementById('charCount').textContent = '0';
    setEmailFeedback('', '');
    document.getElementById('emailSendBtn').disabled = false;

    // Reset image attachments
    composeImages.forEach(img => { if (img.previewUrl) URL.revokeObjectURL(img.previewUrl); });
    composeImages = [];
    renderEmailImagePreviews();

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
    document.getElementById('charCount').textContent =
        document.getElementById('emailBody').value.length;
}

function setEmailFeedback(msg, type) {
    const el = document.getElementById('emailFeedback');
    el.textContent = msg;
    el.className   = 'um-feedback' + (type ? ` um-feedback--${type}` : '');
}


// ========================= EMAIL IMAGE ATTACHMENTS =========================
function handleEmailImageSelect(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = ''; // allow re-selecting the same file later

    const remaining = MAX_EMAIL_IMAGES - composeImages.length;
    if (remaining <= 0) {
        setEmailFeedback(`You can attach up to ${MAX_EMAIL_IMAGES} images.`, 'error');
        return;
    }

    files.slice(0, remaining).forEach(file => {
        if (!file.type.startsWith('image/')) return;

        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const entry = {
            id,
            file,
            previewUrl:  URL.createObjectURL(file),
            uploadedUrl: null,
            uploading:   true,
            error:       null,
        };
        composeImages.push(entry);
        renderEmailImagePreviews();
        uploadEmailImage(entry);
    });
}

async function uploadEmailImage(entry) {
    try {
        const ext      = (entry.file.name.split('.').pop() || 'jpg').toLowerCase();
        const filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

        const { error: uploadErr } = await db.storage
            .from('admin-email-images')
            .upload(filePath, entry.file, { upsert: false });

        if (uploadErr) throw uploadErr;

        const { data: urlData } = db.storage.from('admin-email-images').getPublicUrl(filePath);

        entry.uploadedUrl = urlData.publicUrl;
        entry.uploading   = false;

    } catch (err) {
        console.error('Email image upload error:', err.message);
        entry.uploading = false;
        entry.error      = 'Upload failed';
    }
    renderEmailImagePreviews();
}

function removeEmailImage(id) {
    const entry = composeImages.find(img => img.id === id);
    if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    composeImages = composeImages.filter(img => img.id !== id);
    renderEmailImagePreviews();
}

function renderEmailImagePreviews() {
    const wrap = document.getElementById('emailImagePreviews');
    const addBtn = document.getElementById('emailImageAddBtn');
    if (!wrap) return;

    wrap.innerHTML = composeImages.map(img => `
        <div class="um-image-preview">
            <img src="${img.previewUrl}" alt="Attachment">
            ${img.uploading ? '<div class="um-image-preview-status"><i class="uil uil-spinner-alt spin"></i></div>' : ''}
            ${img.error ? `<div class="um-image-preview-status error">${escapeHtml(img.error)}</div>` : ''}
            <button type="button" class="um-image-preview-remove" onclick="removeEmailImage('${img.id}')">
                <i class="uil uil-times"></i>
            </button>
        </div>
    `).join('');

    if (addBtn) {
        addBtn.classList.toggle('um-image-add-btn--disabled', composeImages.length >= MAX_EMAIL_IMAGES);
    }
}


// ========================= SEND EMAILS =========================
async function sendBroadcastEmails() {
    const subject = document.getElementById('emailSubject').value.trim();
    const body    = document.getElementById('emailBody').value.trim();

    if (!subject) { setEmailFeedback('Please enter a subject.', 'error'); return; }
    if (!body)    { setEmailFeedback('Please write a message.', 'error'); return; }

    if (composeImages.some(img => img.uploading)) {
        setEmailFeedback('Still uploading images — please wait a moment.', 'error');
        return;
    }
    if (composeImages.some(img => img.error)) {
        setEmailFeedback('One or more images failed to upload. Remove them or try again.', 'error');
        return;
    }

    const imageUrls = composeImages.map(img => img.uploadedUrl).filter(Boolean);

    const recipients = allUsers.filter(u => selectedUserIds.has(u.id));
    if (!recipients.length) { closeComposeModal(); return; }

    const sendBtn = document.getElementById('emailSendBtn');
    sendBtn.disabled = true;

    let sent = 0, failed = 0;

    for (const user of recipients) {
        setEmailFeedback(`Sending… ${sent + failed + 1} / ${recipients.length}`, 'info');
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
                    body: JSON.stringify({ to: user.email, name: user.full_name || 'User', subject, body, imageUrls }),
                }
            );
            res.ok ? sent++ : failed++;
        } catch { failed++; }
    }

    if (failed === 0) {
        setEmailFeedback(`✓ Sent to ${sent} user${sent !== 1 ? 's' : ''}.`, 'success');
    } else {
        setEmailFeedback(`Sent: ${sent} · Failed: ${failed}`, failed === recipients.length ? 'error' : 'info');
    }

    setTimeout(() => { sendBtn.disabled = false; }, 2000);
}


// ========================= USER DETAIL MODAL =========================
function openUserModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    activeUserId = userId;

    document.getElementById('modalUserName').textContent = user.full_name || 'User';

    document.getElementById('userModalBody').innerHTML = `
        <div class="um-modal-profile">
            <div class="um-avatar um-avatar--lg">${getInitials(user)}</div>
            <div>
                <p class="um-modal-name">${escapeHtml(user.full_name || '—')}</p>
                <p class="um-modal-email">${escapeHtml(user.email || '—')}</p>
            </div>
        </div>
        <div class="um-detail-grid">
            <div class="um-detail-item"><span>Phone</span><strong>${escapeHtml(user.phone || '—')}</strong></div>
            <div class="um-detail-item"><span>Country</span><strong>${escapeHtml(user.country || '—')}</strong></div>
            <div class="um-detail-item"><span>Joined</span><strong>${formatDateTime(user.created_at)}</strong></div>
            <div class="um-detail-item"><span>Last Login</span><strong>${formatDateTime(user.last_login)}</strong></div>
            <div class="um-detail-item"><span>Balance</span><strong class="success">$${formatNum(user.balance || 0)}</strong></div>
            <div class="um-detail-item"><span>Profit</span><strong class="purple">$${formatNum(user.profit || 0)}</strong></div>
            <div class="um-detail-item"><span>Pending</span><strong class="warning">$${formatNum(user.pending || 0)}</strong></div>
            <div class="um-detail-item"><span>KYC</span><strong><span class="badge ${user.kyc_status || 'unsubmitted'}">${capitalise(user.kyc_status || 'unsubmitted')}</span></strong></div>
        </div>
    `;

    document.getElementById('editBalance').value = user.balance || 0;
    document.getElementById('editProfit').value  = user.profit  || 0;
    document.getElementById('editPending').value = user.pending || 0;

    document.getElementById('balanceError').textContent     = '';
    document.getElementById('balanceSuccess').textContent   = '';
    document.getElementById('kycActionSuccess').textContent = '';
    document.getElementById('kycCurrentStatus').textContent =
        `Current status: ${capitalise(user.kyc_status || 'unsubmitted')}`;

    document.getElementById('userModalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';

    loadUserActiveInvestments(userId);
}

// ========================= ACTIVE INVESTMENTS (read-only) =========================
const ADMIN_COIN_ICONS = {
    btc:  { symbol: '₿', bg: '#f7931a22', color: '#f7931a', label: 'Bitcoin'  },
    eth:  { symbol: 'Ξ', bg: '#627eea22', color: '#627eea', label: 'Ethereum' },
    usdt: { symbol: '₮', bg: '#26a17b22', color: '#26a17b', label: 'Tether'   },
    bnb:  { symbol: 'B', bg: '#f3ba2f22', color: '#f3ba2f', label: 'BNB'      },
    sol:  { symbol: '◎', bg: '#9945ff22', color: '#9945ff', label: 'Solana'   },
    ltc:  { symbol: 'Ł', bg: '#bfbbbb22', color: '#bfbbbb', label: 'Litecoin' },
    doge: { symbol: 'Ð', bg: '#c2a63322', color: '#c2a633', label: 'Dogecoin' },
    xrp:  { symbol: '✕', bg: '#00aae422', color: '#00aae4', label: 'XRP'      },
};

function adminFmtMoney(n) {
    return '$' + (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadUserActiveInvestments(userId) {
    const loadingEl = document.getElementById('userInvLoading');
    const emptyEl   = document.getElementById('userInvEmpty');
    const listEl    = document.getElementById('userInvList');

    loadingEl.style.display = 'flex';
    emptyEl.style.display   = 'none';
    listEl.style.display    = 'none';
    listEl.innerHTML        = '';

    try {
        const { data, error } = await db
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .eq('type', 'investment')
            .eq('inv_active', true)
            .order('start_date', { ascending: true });

        if (error) throw error;

        const investments = (data || []).filter(inv => inv.start_date && inv.end_date);
        loadingEl.style.display = 'none';

        // Only render if this is still the open user (modal may have been closed/switched while fetching)
        if (activeUserId !== userId) return;

        if (investments.length === 0) {
            emptyEl.style.display = 'block';
            return;
        }

        listEl.innerHTML   = investments.map(buildAdminInvCard).join('');
        listEl.style.display = 'flex';

    } catch (err) {
        console.error('User active investments error:', err.message);
        loadingEl.style.display = 'none';
        if (activeUserId === userId) {
            emptyEl.textContent    = 'Could not load investments.';
            emptyEl.style.display  = 'block';
        }
    }
}

function buildAdminInvCard(inv) {
    const today       = new Date(); today.setHours(0, 0, 0, 0);
    const startDate    = new Date(inv.start_date); startDate.setHours(0, 0, 0, 0);
    const duration     = inv.duration_days || 30;
    const daysElapsed  = Math.min(Math.max(Math.floor((today - startDate) / 86400000), 0), duration);
    const daysLeft     = Math.max(duration - daysElapsed, 0);
    const progressPct  = Math.min(Math.round((daysElapsed / duration) * 100), 100);
    const amount       = parseFloat(inv.amount) || 0;
    const dailyRate    = parseFloat(inv.daily_rate) || 0;
    const dailyProfit  = amount * (dailyRate / 100);
    const totalProfit  = dailyProfit * daysElapsed;
    const coinKey      = (inv.coin || '').toLowerCase();
    const coinData     = ADMIN_COIN_ICONS[coinKey] || {
        symbol: coinKey.toUpperCase().slice(0, 2) || '?',
        bg: 'rgba(0,226,123,0.12)', color: 'var(--color-primary)', label: coinKey.toUpperCase()
    };
    const isMatured = daysLeft === 0;
    const startFmt   = new Date(inv.start_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    const endFmt     = new Date(inv.end_date).toLocaleDateString('en-US',   { day: '2-digit', month: 'short', year: 'numeric' });

    return `
        <div class="um-inv-card">
            <div class="um-inv-top">
                <div class="um-inv-coin-icon" style="background:${coinData.bg};color:${coinData.color};">${coinData.symbol}</div>
                <div class="um-inv-top-info">
                    <div class="um-inv-plan">${escapeHtml(inv.method || 'Investment')}</div>
                    <div class="um-inv-sub">${escapeHtml(coinData.label)} · ${startFmt} → ${endFmt}</div>
                </div>
                <span class="badge ${isMatured ? 'unsubmitted' : 'verified'}">${isMatured ? 'Matured' : 'Active'}</span>
            </div>
            <div class="um-inv-amounts">
                <div><span>Invested</span><strong>${adminFmtMoney(amount)}</strong></div>
                <div><span>Profit so far</span><strong class="success">${adminFmtMoney(totalProfit)}</strong></div>
                <div><span>Daily</span><strong>+${adminFmtMoney(dailyProfit)}</strong></div>
            </div>
            <div class="um-inv-progress-track">
                <div class="um-inv-progress-fill" style="width:${progressPct}%;background:${isMatured ? 'var(--color-gray-light)' : 'var(--color-primary)'};"></div>
            </div>
            <div class="um-inv-footer">
                <span>${daysElapsed} of ${duration} days</span>
                <span>Ref: ${escapeHtml(inv.reference || inv.id.slice(0, 8).toUpperCase())}</span>
            </div>
        </div>
    `;
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

    errorEl.textContent = successEl.textContent = '';

    if (isNaN(balance) || isNaN(profit) || isNaN(pending)) {
        errorEl.textContent = 'Please enter valid numbers.'; return;
    }
    if (balance < 0 || profit < 0 || pending < 0) {
        errorEl.textContent = 'Values cannot be negative.'; return;
    }

    try {
        const { error } = await db.from('users')
            .update({ balance, profit, pending })
            .eq('id', activeUserId);
        if (error) throw error;

        const user = allUsers.find(u => u.id === activeUserId);
        if (user) { user.balance = balance; user.profit = profit; user.pending = pending; }

        successEl.textContent = '✓ Balance updated.';
        setTimeout(() => successEl.textContent = '', 3000);
        renderUsers();
    } catch (err) {
        errorEl.textContent = 'Failed to update. Try again.';
        console.error(err.message);
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
        const { error } = await db.from('users')
            .update({ kyc_status: status })
            .eq('id', activeUserId);
        if (error) throw error;

        const user = allUsers.find(u => u.id === activeUserId);
        if (user) user.kyc_status = status;

        document.getElementById('kycCurrentStatus').textContent =
            `Current status: ${capitalise(status)}`;
        successEl.textContent = `✓ KYC ${status === 'verified' ? 'verified' : 'rejected'}.`;
        setTimeout(() => successEl.textContent = '', 3000);
        renderUsers();
    } catch (err) {
        successEl.textContent = 'Failed. Please try again.';
        console.error(err.message);
    }
}


// ========================= STATE MANAGER =========================
function showState(state) {
    document.getElementById('usersLoading').style.display = state === 'loading' ? 'flex'  : 'none';
    document.getElementById('usersEmpty').style.display   = state === 'empty'   ? 'flex'  : 'none';
    document.getElementById('usersGrid').style.display    = state === 'grid'    ? 'grid'  : 'none';
}
