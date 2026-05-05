// ================================================================
// LOGIN.JS — Connected to Supabase
// ================================================================


// ================================================================
// THEME TOGGLE
// ================================================================

const themeBtn  = document.getElementById('themeBtn');
const themeIcon = document.getElementById('themeIcon');

const savedTheme = localStorage.getItem('currrentTheme');
if (savedTheme) {
    document.body.classList.add(savedTheme);
    themeIcon.className = savedTheme === 'dark-theme' ? 'uil uil-sun' : 'uil uil-moon';
}

themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    themeIcon.className = isDark ? 'uil uil-sun' : 'uil uil-moon';
    localStorage.setItem('currrentTheme', isDark ? 'dark-theme' : '');
});


// ================================================================
// ON LOAD
// ================================================================

document.addEventListener('DOMContentLoaded', () => {

    const remembered = JSON.parse(localStorage.getItem('rememberedAccounts') || '[]');
    if (remembered.length > 0) {
        renderSavedAccounts(remembered);
        document.getElementById('savedAccounts').style.display = 'block';
        document.getElementById('manualForm').style.display    = 'none';
    }

    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
        document.getElementById('loginEmail').value   = rememberedEmail;
        document.getElementById('rememberMe').checked = true;
    }

    document.addEventListener('keydown', e => {
        if (e.key === 'Enter') submitLogin();
    });
});


// ================================================================
// SAVED ACCOUNTS
// ================================================================

function renderSavedAccounts(accounts) {
    const list = document.getElementById('savedList');
    list.innerHTML = '';
    accounts.forEach(account => {
        const card      = document.createElement('div');
        card.className  = 'saved-account-card';
        const nameParts = (account.name || 'U U').split(' ');
        const initials  = ((nameParts[0]?.[0] || '') + (nameParts[1]?.[0] || '')).toUpperCase();
        card.innerHTML  = `
            <div class="saved-account-left">
                <div class="saved-avatar">${initials}</div>
                <div>
                    <div class="saved-account-name">${account.name}</div>
                    <div class="saved-account-email">${account.email}</div>
                </div>
            </div>
            <i class="uil uil-angle-right"></i>
        `;
        card.addEventListener('click', () => {
            document.getElementById('savedAccounts').style.display = 'none';
            document.getElementById('manualForm').style.display    = 'block';
            document.getElementById('loginEmail').value            = account.email;
            document.getElementById('loginPassword').focus();
        });
        list.appendChild(card);
    });
}

function showManualForm() {
    document.getElementById('savedAccounts').style.display = 'none';
    document.getElementById('manualForm').style.display    = 'block';
    document.getElementById('loginEmail').value            = '';
    document.getElementById('loginPassword').value         = '';
}

function togglePw(inputId, btn) {
    const input    = document.getElementById(inputId);
    const isHidden = input.type === 'password';
    input.type     = isHidden ? 'text' : 'password';
    btn.querySelector('i').className = isHidden ? 'uil uil-eye-slash' : 'uil uil-eye';
}

function showForgotMsg() {
    document.getElementById('manualForm').style.display = 'none';
    document.getElementById('forgotMsg').style.display  = 'flex';
}

function hideForgotMsg() {
    document.getElementById('forgotMsg').style.display  = 'none';
    document.getElementById('manualForm').style.display = 'block';
}

function clearErrors() {
    document.getElementById('emailErr').textContent    = '';
    document.getElementById('passwordErr').textContent = '';
    document.getElementById('loginError').textContent  = '';
    document.querySelectorAll('.input-wrap').forEach(el => el.classList.remove('input-error'));
}


// ================================================================
// SUBMIT LOGIN
// ================================================================

async function submitLogin() {
    clearErrors();

    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const remember = document.getElementById('rememberMe').checked;
    let valid      = true;

    if (!email || !email.includes('@')) {
        document.getElementById('emailErr').textContent = 'Please enter a valid email address.';
        document.getElementById('loginEmail').closest('.input-wrap').classList.add('input-error');
        valid = false;
    }
    if (!password) {
        document.getElementById('passwordErr').textContent = 'Please enter your password.';
        document.getElementById('loginPassword').closest('.input-wrap').classList.add('input-error');
        valid = false;
    }
    if (!valid) return;

    const btn     = document.getElementById('loginBtn');
    btn.innerHTML = 'Signing in... <i class="uil uil-spinner"></i>';
    btn.disabled  = true;

    const loginRes = await fetch(AUTH_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', email, password })
});
const loginData = await loginRes.json();

if (!loginRes.ok || !loginData.success) {
    document.getElementById('loginError').textContent = 'Incorrect email or password. Please try again.';
    document.getElementById('loginEmail').closest('.input-wrap').classList.add('input-error');
    document.getElementById('loginPassword').closest('.input-wrap').classList.add('input-error');
    btn.innerHTML = 'Sign In <i class="uil uil-arrow-right"></i>';
    btn.disabled  = false;
    return;
    }

const user = loginData.user;

    // Update last login timestamp
    await db
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

    saveSession(user);

    if (remember) {
        localStorage.setItem('rememberedEmail', email);
        const remembered = JSON.parse(localStorage.getItem('rememberedAccounts') || '[]');
        const exists = remembered.find(a => a.email === email);
        if (!exists) {
            remembered.push({ email: user.email, name: user.full_name });
            localStorage.setItem('rememberedAccounts', JSON.stringify(remembered));
        }
    } else {
        localStorage.removeItem('rememberedEmail');
    }

    btn.innerHTML = 'Welcome back! Redirecting...';

    // ── ROLE-BASED REDIRECT ──
    // admin → admin dashboard
    // user  → main dashboard
    setTimeout(() => {
        if (user.role === 'admin') {
            window.location.href = '../admin/index.html';
        } else {
            window.location.href = '../index.html';
        }
    }, 700);
}


// ================================================================
// SAVE SESSION
// ================================================================

function saveSession(user) {
    localStorage.setItem('currentUser',    JSON.stringify(user));
    localStorage.setItem('userFirstName',  user.first_name);
    localStorage.setItem('userFullName',   user.full_name);
    localStorage.setItem('userBalance',    String(user.balance  || 0));
    localStorage.setItem('userProfit',     String(user.profit   || 0));
    localStorage.setItem('userPending',    String(user.pending  || 0));
    localStorage.setItem('kycStatus',      user.kyc_status      || 'unsubmitted');
    localStorage.setItem('myReferralCode', user.my_referral_code || '');
    localStorage.setItem('userProfile', JSON.stringify({
        firstName:  user.first_name,
        lastName:   user.last_name,
        email:      user.email,
        phone:      user.phone,
        country:    user.country,
        state:      user.state,
        city:       user.city,
        postalCode: user.postal_code,
        dob:        user.dob,
    }));
}