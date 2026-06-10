// ================================================================
// CALLBACK.JS
// Google redirects to Supabase, Supabase redirects here.
// We check if the Google user exists in our users table.
// If not, we create their profile automatically then redirect.
// ================================================================

async function handleGoogleCallback() {
    const stateEl = document.getElementById('callbackState');

    try {
        const { data: { session }, error: sessionError } = await db.auth.getSession();

        if (sessionError || !session) {
            showError('Google sign-in failed. Please try again.');
            return;
        }

        const authUser = session.user;

        // ── CHECK IF PROFILE EXISTS IN USERS TABLE ──
        const { data: existingUser } = await db
            .from('users')
            .select('*')
            .eq('email', authUser.email)
            .maybeSingle();

        if (existingUser) {
            // Returning Google user — update last login and redirect
            await db
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', existingUser.id);

            saveSession(existingUser);
            window.signInComplete && window.signInComplete();
            setTimeout(() => redirectAfterLogin(existingUser.role), 1200);
            return;
        }

        // ── NEW GOOGLE USER — create profile ──
        const meta      = authUser.user_metadata || {};
        const firstName = meta.given_name  || meta.name?.split(' ')[0] || '';
        const lastName  = meta.family_name || meta.name?.split(' ').slice(1).join(' ') || '';
        const fullName  = meta.full_name   || meta.name || authUser.email;
        const avatar    = meta.avatar_url  || meta.picture || '';

        const myReferralCode = firstName
            ? (firstName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) + '-' + Math.random().toString(36).slice(2, 8).toUpperCase())
            : ('USER-' + Math.random().toString(36).slice(2, 8).toUpperCase());

        const { data: newUser, error: insertError } = await db
            .from('users')
            .insert([{
                first_name:       firstName,
                last_name:        lastName,
                full_name:        fullName,
                email:            authUser.email,
                phone:            '',
                password:         null,   // Google users have no password
                role:             'user',
                kyc_status:       'unsubmitted',
                balance:          0,
                profit:           0,
                pending:          0,
                my_referral_code: myReferralCode,
                referral_code:    '',
            }])
            .select()
            .single();

        if (insertError) {
            console.error('Profile create error:', insertError.message);
            showError('Sign in failed: ' + insertError.message + '. Please contact support.');
            return;
        }

        saveSession(newUser);

        // New Google users go to dashboard directly — email already verified by Google
        window.signInComplete && window.signInComplete();
        setTimeout(() => redirectAfterLogin(newUser.role), 1200);

    } catch (err) {
        console.error('Callback error:', err.message);
        showError('Something went wrong. Please try again.');
    }
}


// ================================================================
// REDIRECT BASED ON ROLE
// ================================================================

function redirectAfterLogin(role) {
    if (role === 'admin') {
        window.location.href = '../../admin/';
    } else {
        window.location.href = '../../dashboard/';
    }
}


// ================================================================
// SAVE SESSION — identical to login.js
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
        phone:      user.phone    || '',
        country:    user.country  || '',
        state:      user.state    || '',
        city:       user.city     || '',
        postalCode: user.postal_code || '',
        dob:        user.dob      || '',
    }));
}


// ================================================================
// UI STATE
// ================================================================

function showError(msg) {
    document.getElementById('callbackState').innerHTML = `
        <div class="success-ring" style="background:var(--color-danger-light);border-color:var(--color-danger)">
            <i class="uil uil-times-circle" style="color:var(--color-danger)"></i>
        </div>
        <h2>Sign In Failed</h2>
        <p style="color:var(--color-gray-light);font-size:1.2rem;text-align:center;">${msg}</p>
        <div style="margin-top:2rem;display:flex;flex-direction:column;gap:1rem;width:100%">
            <a href="../login/" class="auth-btn" style="text-align:center;text-decoration:none;">
                Try Again
            </a>
        </div>
    `;
}


// ── Run on page load ──
handleGoogleCallback();
