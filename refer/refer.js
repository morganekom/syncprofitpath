// ================================================================
// REFER.JS — Connected to Supabase
// Reads the current user's referral code from the users table,
// fetches all users who signed up with that code, and renders
// stats + activity list.
// ================================================================


// ── STATE ──
let referralCode = '';
let referralLink = '';
let referralStats = {
    total: 0,
    earnings: 0,
    pending: 0,
};
let referralHistory = [];


// ================================================================
// INIT
// ================================================================

window.addEventListener('DOMContentLoaded', async () => {
    loadReferralCode();
    await fetchReferralStats();
    renderStats();
    renderHistory();
});


// ================================================================
// LOAD REFERRAL CODE
// Priority: currentUser from localStorage (set by login/signup)
// Falls back to generating one locally if somehow not present.
// ================================================================

function loadReferralCode() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

    // The user's OWN referral code is stored as my_referral_code in the DB.
    // At signup we store referral_code = the code they USED to sign up.
    // So my_referral_code is a different field, generated uniquely per user.
    // If the column doesn't exist yet, we derive a code from the user's ID.
    referralCode = currentUser.my_referral_code
        || localStorage.getItem('myReferralCode')
        || deriveCode(currentUser);

    // Persist it locally so it's stable
    localStorage.setItem('myReferralCode', referralCode);

    // Build the referral link
    const origin = window.location.origin || (window.location.protocol + '//' + window.location.hostname);
    // Point to the signup page with the ref param pre-filled
    referralLink = origin + '/auth/signup.html?ref=' + encodeURIComponent(referralCode);

    // Populate UI
    const codeEl = document.getElementById('referralCode');
    const linkEl = document.getElementById('referralLink');
    if (codeEl) codeEl.textContent = referralCode;
    if (linkEl) linkEl.value = referralLink;
}

function deriveCode(user) {
    // Build a stable, readable code from name + ID slice
    const firstName = (user.first_name || localStorage.getItem('userFirstName') || 'USER').toUpperCase().slice(0, 4);
    const idSlice = (user.id || Date.now().toString()).toString().replace(/-/g, '').slice(0, 6).toUpperCase();
    return firstName + '-' + idSlice;
}


// ================================================================
// FETCH REFERRAL STATS FROM SUPABASE
// Looks up all users in the DB whose referral_code matches ours.
// referral_code in the users table = the code someone ENTERED at signup.
// ================================================================

async function fetchReferralStats() {
    if (typeof db === 'undefined') return;

    try {
        const { data, error } = await db
            .from('users')
            .select('id, full_name, first_name, last_name, created_at, balance')
            .eq('referral_code', referralCode);

        if (error || !data) return;

        referralHistory = data;

        // Stats
        referralStats.total = data.length;
        referralStats.pending = data.filter(u => (u.balance || 0) === 0).length;
        // Bonus amount from site_settings (falls back to $10)
        let bonusAmount = 10;
        try {
            const { data: sd } = await db.from('site_settings').select('referral_bonus').eq('id', 1).single();
            if (sd) bonusAmount = parseFloat(sd.referral_bonus) || 10;
        } catch (e) {}
        const activeCount = data.filter(u => (u.balance || 0) > 0).length;
        referralStats.earnings = activeCount * bonusAmount;

    } catch (err) {
        console.error('Refer fetch error:', err);
    }
}


// ================================================================
// RENDER STATS
// ================================================================

function renderStats() {
    const referralsEl = document.getElementById('statReferrals');
    const earningsEl = document.getElementById('statEarnings');
    const pendingEl = document.getElementById('statPending');

    if (referralsEl) referralsEl.textContent = referralStats.total;
    if (earningsEl) earningsEl.textContent = '$' + referralStats.earnings.toFixed(2);
    if (pendingEl) pendingEl.textContent = referralStats.pending;
}


// ================================================================
// RENDER HISTORY LIST
// ================================================================

function renderHistory() {
    const emptyEl = document.getElementById('referEmptyState');
    const listEl = document.getElementById('referHistoryList');
    if (!emptyEl || !listEl) return;

    if (referralHistory.length === 0) {
        emptyEl.style.display = 'flex';
        listEl.style.display = 'none';
        return;
    }

    emptyEl.style.display = 'none';
    listEl.style.display = 'flex';
    listEl.innerHTML = '';

    referralHistory.forEach(user => {
        const initials = getInitials(user);
        const isActive = (user.balance || 0) > 0;
        const date = formatDate(user.created_at);

        const li = document.createElement('li');
        li.className = 'refer-history-item';
        li.innerHTML = `
            <div class="history-avatar">${initials}</div>
            <div class="history-info">
                <div class="history-name">${escapeHtml(user.full_name || user.first_name || 'Unknown')}</div>
                <div class="history-date">Joined ${date}</div>
            </div>
            <span class="history-status ${isActive ? 'active' : 'pending'}">
                ${isActive ? 'Active' : 'Pending'}
            </span>
        `;
        listEl.appendChild(li);
    });
}


// ================================================================
// COPY TO CLIPBOARD
// ================================================================

function copyToClipboard(text, btnEl, feedbackId) {
    const feedbackEl = document.getElementById(feedbackId);

    const original = btnEl.innerHTML;
    const doSuccess = () => {
        btnEl.classList.add('copied');
        btnEl.innerHTML = '<i class="uil uil-check"></i> Copied!';
        if (feedbackEl) feedbackEl.textContent = '✓ Copied to clipboard.';
        setTimeout(() => {
            btnEl.classList.remove('copied');
            btnEl.innerHTML = original;
            if (feedbackEl) feedbackEl.textContent = '';
        }, 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(doSuccess).catch(() => fallbackCopy(text, doSuccess));
    } else {
        fallbackCopy(text, doSuccess);
    }
}

function fallbackCopy(text, onSuccess) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); onSuccess(); } catch (e) { console.warn('Copy failed', e); }
    ta.remove();
}


// ================================================================
// SHARE BUTTONS
// ================================================================

function initShareButtons() {
    const msg = 'Join me on SyncProfitPath and grow your investments. Use my referral link: ' + referralLink;

    const copyCodeBtn = document.getElementById('copyCodeBtn');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const whatsappBtn = document.getElementById('whatsappShare');
    const twitterBtn = document.getElementById('twitterShare');
    const emailBtn = document.getElementById('emailShare');

    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', () => {
            copyToClipboard(referralCode, copyCodeBtn, 'copyCodeMsg');
        });
    }

    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => {
            copyToClipboard(referralLink, copyLinkBtn, 'copyLinkMsg');
        });
    }

    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', () => {
            window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(msg), '_blank', 'noopener');
        });
    }

    if (twitterBtn) {
        twitterBtn.addEventListener('click', () => {
            window.open(
                'https://twitter.com/intent/tweet?text=' + encodeURIComponent(msg),
                '_blank', 'noopener'
            );
        });
    }

    if (emailBtn) {
        emailBtn.addEventListener('click', () => {
            const subject = encodeURIComponent('Join me on SyncProfitPath');
            const body = encodeURIComponent(msg);
            window.location.href = 'mailto:?subject=' + subject + '&body=' + body;
        });
    }
}

// Run share button init immediately (doesn't need async data)
initShareButtons();


// ================================================================
// UTILITIES
// ================================================================

function getInitials(user) {
    const first = (user.first_name || '').trim();
    const last = (user.last_name || '').trim();
    if (first && last) return (first[0] + last[0]).toUpperCase();
    if (first) return first.slice(0, 2).toUpperCase();
    return 'U';
}

function formatDate(isoString) {
    if (!isoString) return '—';
    try {
        return new Date(isoString).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return '—';
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}