// ================================================================
// LOGIN.JS — Connected to Supabase
// ================================================================


// ================================================================
// THEME — follows OS setting on auth pages, no manual toggle
// ================================================================

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
systemDark.addEventListener('change', e => {
    document.documentElement.classList.toggle('dark-theme', e.matches);
    document.body.classList.toggle('dark-theme', e.matches);
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

    // ── Step 1: Try Supabase Auth first (migrated + all new users) ──
    const { data: authData, error: authError } = await db.auth.signInWithPassword({
        email:    email.toLowerCase(),
        password: password,
    });

    // ── Step 2: Resolve the user profile ──
    let user = null;

    if (!authError && authData.user) {
        // Auth succeeded — fetch full profile by auth UID
        const { data: profile, error: profileError } = await db
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .maybeSingle();

        if (profileError || !profile) {
            document.getElementById('loginError').textContent = 'Account not found. Please contact support.';
            btn.innerHTML = 'Sign In <i class="uil uil-arrow-right"></i>';
            btn.disabled  = false;
            return;
        }
        user = profile;

    } else {
        // ── Fallback: check legacy users.password column ──
        // Catches email users who existed before the Auth migration.
        // If their plaintext password matches, log them in and silently
        // migrate them to Supabase Auth so this never triggers again.
        const { data: legacyUser } = await db
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase())
            .eq('password', password)
            .maybeSingle();

        if (!legacyUser) {
            // Neither Auth nor legacy password matched
            document.getElementById('loginError').textContent = 'Incorrect email or password. Please try again.';
            document.getElementById('loginEmail').closest('.input-wrap').classList.add('input-error');
            document.getElementById('loginPassword').closest('.input-wrap').classList.add('input-error');
            btn.innerHTML = 'Sign In <i class="uil uil-arrow-right"></i>';
            btn.disabled  = false;
            return;
        }

        // Legacy match — fire-and-forget migration to Supabase Auth.
        // Uses the migrate-password Edge Function (service role server-side).
        // If it fails, user just goes through fallback again next login.
        fetch('https://syqdwottzrhpclnvzdmz.supabase.co/functions/v1/migrate-password', {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':        SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ userId: legacyUser.id, password }),
        }).catch(e => console.warn('Silent migration failed — will retry on next login.', e.message));

        user = legacyUser;
    }

    // Update last login timestamp
    await db
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

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

    // ── 2FA CHECK ──
    // If user has TOTP enabled, show the code step instead of redirecting
    if (user.totp_enabled && user.totp_secret) {
        // Stash user temporarily — only complete session after code verified
        sessionStorage.setItem('pendingUser', JSON.stringify(user));
        btn.innerHTML = 'Sign In <i class="uil uil-arrow-right"></i>';
        btn.disabled  = false;
        show2FAStep(user.email);
        return;
    }

    // No 2FA — save session and redirect
    saveSession(user);

    // ── ROLE-BASED REDIRECT ──
    setTimeout(() => {
        if (user.role === 'admin') {
            window.location.href = '../../admin/';
        } else {
            window.location.href = '../../dashboard/';
        }
    }, 700);
}




// ================================================================
// GOOGLE SIGN IN
// ================================================================

async function signInWithGoogle() {
    const btn = document.getElementById('googleBtn');
    if (btn) {
        btn.innerHTML = '<i class="uil uil-spinner spin"></i> Redirecting to Google…';
        btn.disabled  = true;
    }

    const { error } = await db.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: 'https://syncprofitpath.com/auth/callback/',
        }
    });

    if (error) {
        if (btn) {
            btn.innerHTML = '<img src="https://www.google.com/favicon.ico" width="16"> Continue with Google';
            btn.disabled  = false;
        }
        document.getElementById('loginError').textContent = 'Google sign-in failed. Please try again.';
    }
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
// ── Spin style ──
const spinStyle = document.createElement('style');
spinStyle.textContent = '.spin{animation:spin 0.9s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}';
document.head.appendChild(spinStyle);


// ================================================================
// 2FA LOGIN STEP
// ================================================================

function show2FAStep(email) {
    document.getElementById('manualForm').style.display  = 'none';
    document.getElementById('twoFAStep').style.display   = 'block';
    document.getElementById('totpCode').value            = '';
    document.getElementById('totpError').textContent     = '';
    document.getElementById('totpCode').focus();

    // Pre-fill support email with context
    const subject = encodeURIComponent('2FA Access Issue — SyncProfitPath');
    const body    = encodeURIComponent(
        `Hi Support,\n\nI\'m unable to access my authenticator app and need help signing in.\n\nAccount email: ${email}\n\nPlease help me regain access.\n\nThank you.`
    );
    const link = document.getElementById('twoFASupportLink');
    if (link) link.href = `mailto:support@syncprofitpath.com?subject=${subject}&body=${body}`;

    // Allow Enter key on code input
    document.getElementById('totpCode').addEventListener('keydown', e => {
        if (e.key === 'Enter') submitTOTP();
    });
}

async function submitTOTP() {
    const code    = document.getElementById('totpCode').value.trim().replace(/\s/g, '');
    const errorEl = document.getElementById('totpError');
    const btn     = document.getElementById('totpBtn');
    errorEl.textContent = '';

    if (!/^\d{6}$/.test(code)) {
        errorEl.textContent = 'Please enter the 6-digit code from your authenticator app.';
        return;
    }

    const user = JSON.parse(sessionStorage.getItem('pendingUser') || 'null');
    if (!user || !user.totp_secret) {
        errorEl.textContent = 'Session expired. Please sign in again.';
        backToLogin();
        return;
    }

    btn.innerHTML = 'Verifying... <i class="uil uil-spinner spin"></i>';
    btn.disabled  = true;

    const totp  = new OTPAuth.TOTP({
        algorithm: 'SHA1',
        digits:    6,
        period:    30,
        secret:    OTPAuth.Secret.fromBase32(user.totp_secret),
    });
    const delta = totp.validate({ token: code, window: 1 });

    if (delta === null) {
        errorEl.textContent = 'Incorrect code. Check your app and try again — codes refresh every 30 seconds.';
        btn.innerHTML = 'Verify <i class="uil uil-arrow-right"></i>';
        btn.disabled  = false;
        return;
    }

    // Code correct — complete login
    sessionStorage.removeItem('pendingUser');

    await db.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);
    saveSession(user);

    btn.innerHTML = 'Verified! Redirecting...';
    setTimeout(() => {
        window.location.href = user.role === 'admin' ? '../../admin/' : '../../dashboard/';
    }, 600);
}

function backToLogin() {
    sessionStorage.removeItem('pendingUser');
    document.getElementById('twoFAStep').style.display  = 'none';
    document.getElementById('manualForm').style.display = 'block';
    document.getElementById('totpCode').value           = '';
    document.getElementById('totpError').textContent    = '';
}
