// ================================================================
// CONFIRM.JS
// Supabase redirects here after user clicks the verification link.
// URL contains a token that confirms the session automatically.
// We then create the user's profile in the users table and redirect.
// ================================================================

async function handleConfirmation() {
    const stateEl = document.getElementById('confirmState');

    try {
        // Supabase automatically processes the token in the URL hash.
        // getSession() returns the confirmed session if the link is valid.
        const { data: { session }, error: sessionError } = await db.auth.getSession();

        if (sessionError || !session) {
            showError('Invalid or expired verification link. Please sign up again or request a new link.');
            return;
        }

        const authUser = session.user;

        // ── CHECK IF PROFILE ALREADY EXISTS ──
        // (handles edge case where user clicks the link twice)
        const { data: existingUser } = await db
            .from('users')
            .select('*')
            .eq('email', authUser.email)
            .maybeSingle();

        if (existingUser) {
            // Already confirmed — just log them in
            saveSession(existingUser);
            showSuccess('Account already verified. Redirecting to your dashboard…');
            setTimeout(() => window.location.href = '../../dashboard/', 1500);
            return;
        }

        // ── CREATE PROFILE IN USERS TABLE ──
        // Pull profile data from auth metadata (saved during signup)
        const meta = authUser.user_metadata || {};
        const firstName = meta.first_name || '';
        const lastName  = meta.last_name  || '';
        const fullName  = meta.full_name  || (firstName + ' ' + lastName).trim() || authUser.email;

        const myReferralCode = meta.my_referral_code
            || (firstName.toUpperCase().slice(0, 4) + '-' + Math.random().toString(36).slice(2, 8).toUpperCase());

        const { data: newUser, error: insertError } = await db
            .from('users')
            .insert([{
                first_name:       firstName,
                last_name:        lastName,
                full_name:        fullName,
                email:            authUser.email,
                phone:            meta.phone        || '',
                dob:              meta.dob          || null,
                country:          meta.country      || '',
                state:            meta.state        || '',
                city:             meta.city         || '',
                postal_code:      meta.postal_code  || '',
                referral_code:    meta.referral_code || '',
                my_referral_code: myReferralCode,
                role:             'user',
                kyc_status:       'unsubmitted',
                balance:          0,
                profit:           0,
                pending:          0,
            }])
            .select()
            .single();

        if (insertError) {
            console.error('Profile create error:', insertError.message);
            showError('Account verified but profile setup failed. Please contact support.');
            return;
        }

        saveSession(newUser);
        showSuccess('Account verified! Welcome to SyncProfitPath. Redirecting…');
        setTimeout(() => window.location.href = '../../dashboard/', 1800);

    } catch (err) {
        console.error('Confirmation error:', err.message);
        showError('Something went wrong. Please try again or contact support.');
    }
}


// ================================================================
// SAVE SESSION — same as login.js and signup.js
// ================================================================

function saveSession(user) {
    localStorage.setItem('currentUser',    JSON.stringify(user));
    localStorage.setItem('userFirstName',  user.first_name  || '');
    localStorage.setItem('userFullName',   user.full_name   || '');
    localStorage.setItem('userBalance',    String(user.balance  || 0));
    localStorage.setItem('userProfit',     String(user.profit   || 0));
    localStorage.setItem('userPending',    String(user.pending  || 0));
    localStorage.setItem('kycStatus',      user.kyc_status  || 'unsubmitted');
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


// ================================================================
// UI STATES
// ================================================================

function showSuccess(msg) {
    document.getElementById('confirmState').innerHTML = `
        <div class="success-ring">
            <i class="uil uil-check"></i>
        </div>
        <h2>Email Verified!</h2>
        <p style="color:var(--color-gray-light);font-size:1.2rem;">${msg}</p>
    `;
}

function showError(msg) {
    document.getElementById('confirmState').innerHTML = `
        <div class="success-ring" style="background:var(--color-danger-light);border-color:var(--color-danger)">
            <i class="uil uil-times-circle" style="color:var(--color-danger)"></i>
        </div>
        <h2>Verification Failed</h2>
        <p style="color:var(--color-gray-light);font-size:1.2rem;text-align:center;">${msg}</p>
        <div style="margin-top:2rem;display:flex;flex-direction:column;gap:1rem;width:100%">
            <a href="./signup.html" class="auth-btn" style="text-align:center;text-decoration:none;">
                Sign Up Again
            </a>
            <a href="./login.html" class="auth-btn-outline" style="text-align:center;text-decoration:none;">
                Go to Sign In
            </a>
        </div>
    `;
}


// ── Run on page load ──
handleConfirmation();
