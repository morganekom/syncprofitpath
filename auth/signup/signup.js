// ================================================================
// SIGNUP.JS — Connected to Supabase Auth (email confirmation)
// ================================================================

let currentStep = 1;
const TOTAL_STEPS = 3;


// ================================================================
// THEME TOGGLE
// ================================================================

const themeBtn  = document.getElementById('themeBtn');
const themeIcon = document.getElementById('themeIcon');

const savedTheme = localStorage.getItem('currrentTheme');
if (savedTheme) {
    document.documentElement.classList.add(savedTheme);
    themeIcon.className = savedTheme === 'dark-theme' ? 'uil uil-sun' : 'uil uil-moon';
}

themeBtn.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark-theme');
    const isDark = document.documentElement.classList.contains('dark-theme');
    themeIcon.className = isDark ? 'uil uil-sun' : 'uil uil-moon';
    localStorage.setItem('currrentTheme', isDark ? 'dark-theme' : '');
});


// ================================================================
// PRE-FILL REFERRAL CODE FROM URL
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    const params  = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    if (refCode) {
        const referralInput = document.getElementById('referralCode');
        if (referralInput) referralInput.value = refCode;
    }
});


// ================================================================
// STEP NAVIGATION
// ================================================================

function goToStep(targetStep) {
    if (targetStep > currentStep) {
        if (!validateStep(currentStep)) return;
    }
    document.getElementById('step' + currentStep).classList.remove('active');
    document.getElementById('step' + targetStep).classList.add('active');
    updateDots(targetStep);
    const progress = (targetStep / TOTAL_STEPS) * 100;
    document.getElementById('progressBar').style.width = progress + '%';
    currentStep = targetStep;
    document.querySelector('.signup-box').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateDots(activeStep) {
    for (let i = 1; i <= TOTAL_STEPS; i++) {
        const dot  = document.getElementById('dot' + i);
        const icon = dot.querySelector('i');
        dot.classList.remove('active', 'done');
        if (i < activeStep) {
            dot.classList.add('done');
            icon.className = 'uil uil-check';
        } else if (i === activeStep) {
            dot.classList.add('active');
            const icons = ['uil uil-user', 'uil uil-map-marker', 'uil uil-lock'];
            icon.className = icons[i - 1];
        } else {
            const icons = ['uil uil-user', 'uil uil-map-marker', 'uil uil-lock'];
            icon.className = icons[i - 1];
        }
    }
    document.querySelectorAll('.step-line').forEach((line, idx) => {
        line.classList.toggle('done', activeStep > idx + 1);
    });
}


// ================================================================
// VALIDATION
// ================================================================

function validateStep(step) {
    clearErrors();
    let valid = true;
    if (step === 1) {
        const firstName = val('firstName');
        const lastName  = val('lastName');
        const email     = val('email');
        const phone     = val('phone');
        if (!firstName) { showError('firstNameErr', 'First name is required.'); valid = false; }
        if (!lastName)  { showError('lastNameErr',  'Last name is required.');  valid = false; }
        if (!email || !email.includes('@') || !email.includes('.')) {
            showError('emailErr', 'Please enter a valid email address.'); valid = false;
        }
        if (!phone || phone.length < 7) {
            showError('phoneErr', 'Please enter a valid phone number.'); valid = false;
        }
    }
    if (step === 2) {
        if (!val('country')) { showError('countryErr', 'Please select your country.'); valid = false; }
    }
    return valid;
}

function clearErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.input-wrap').forEach(el => el.classList.remove('input-error'));
    const el = document.getElementById('signupError');
    if (el) el.textContent = '';
}

function showError(id, msg) {
    const errEl = document.getElementById(id);
    if (errEl) errEl.textContent = msg;
    const input = document.getElementById(id.replace('Err', ''));
    if (input) input.closest('.input-wrap')?.classList.add('input-error');
}

function val(id) {
    return document.getElementById(id)?.value.trim() || '';
}


// ================================================================
// PASSWORD STRENGTH
// ================================================================

function checkStrength(pw) {
    const fill  = document.getElementById('strengthFill');
    const label = document.getElementById('strengthText');
    if (!pw) { fill.style.width = '0%'; label.textContent = ''; return; }
    let score = 0;
    if (pw.length >= 8)           score++;
    if (/[A-Z]/.test(pw))         score++;
    if (/[0-9]/.test(pw))         score++;
    if (/[^A-Za-z0-9]/.test(pw))  score++;
    const levels = [
        { label: 'Weak',   color: 'var(--color-danger)',  width: '25%'  },
        { label: 'Fair',   color: 'var(--color-warning)', width: '50%'  },
        { label: 'Good',   color: 'var(--color-primary)', width: '75%'  },
        { label: 'Strong', color: 'var(--color-success)', width: '100%' },
    ];
    const level = levels[score - 1] || levels[0];
    fill.style.width      = level.width;
    fill.style.background = level.color;
    label.textContent     = level.label;
    label.style.color     = level.color;
}

function togglePw(inputId, btn) {
    const input    = document.getElementById(inputId);
    const isHidden = input.type === 'password';
    input.type     = isHidden ? 'text' : 'password';
    btn.querySelector('i').className = isHidden ? 'uil uil-eye-slash' : 'uil uil-eye';
}


// ================================================================
// GENERATE REFERRAL CODE
// ================================================================

function generateMyReferralCode(firstName) {
    const prefix = firstName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    return prefix + '-' + suffix;
}


// ================================================================
// SUBMIT — uses Supabase Auth signUp (triggers verification email)
// ================================================================

async function submitSignup() {
    clearErrors();

    const password        = val('password');
    const confirmPassword = val('confirmPassword');
    const termsChecked    = document.getElementById('termsCheck').checked;
    let valid             = true;

    if (password.length < 8) {
        showError('passwordErr', 'Password must be at least 8 characters.');
        valid = false;
    }
    if (password !== confirmPassword) {
        showError('confirmPasswordErr', 'Passwords do not match.');
        valid = false;
    }
    if (!termsChecked) {
        document.getElementById('termsErr').textContent = 'You must agree to the terms.';
        valid = false;
    }
    if (!valid) return;

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerHTML = 'Creating account... <i class="uil uil-spinner"></i>';
    submitBtn.disabled  = true;

    const firstName = val('firstName');
    const lastName  = val('lastName');
    const email     = val('email');
    const fullName  = firstName + ' ' + lastName;

    // ── STEP 1: Create user in Supabase Auth ──
    // This triggers the verification email to the user automatically.
    // The redirect URL tells Supabase where to send them after clicking Verify.
    const { data: authData, error: authError } = await db.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: 'https://syncprofitpath.com/auth/confirm/',
            data: {
                // Store profile data in auth metadata temporarily
                // confirm.html reads this when creating the users table row
                first_name:       firstName,
                last_name:        lastName,
                full_name:        fullName,
                phone:            val('phone'),
                dob:              val('dob'),
                country:          val('country'),
                state:            val('state'),
                city:             val('city'),
                postal_code:      val('postalCode'),
                referral_code:    val('referralCode'),
                my_referral_code: generateMyReferralCode(firstName),
            }
        }
    });

    if (authError) {
        if (authError.message.includes('already registered')) {
            showError('emailErr', 'An account with this email already exists.');
            goToStep(1);
        } else {
            document.getElementById('signupError').textContent = authError.message;
        }
        submitBtn.innerHTML = 'Create Account <i class="uil uil-check"></i>';
        submitBtn.disabled  = false;
        return;
    }

    // ── STEP 2: Show email confirmation screen ──
    // Do NOT save session or redirect to dashboard yet.
    // User must verify email first.
    showVerifyEmailScreen(email);
}


// ================================================================
// SHOW VERIFY EMAIL SCREEN
// ================================================================

function showVerifyEmailScreen(email) {
    document.getElementById('step3').classList.remove('active');
    document.getElementById('progressBar').style.width = '100%';

    // Replace stepSuccess content with email verification message
    const successEl = document.getElementById('stepSuccess');
    successEl.innerHTML = `
        <div class="signup-success">
            <div class="success-ring" style="background:rgba(0,226,123,0.1);border-color:rgba(0,226,123,0.3)">
                <i class="uil uil-envelope-check" style="color:var(--color-primary)"></i>
            </div>
            <h2>Check Your Email</h2>
            <p style="color:var(--color-gray-light);font-size:1.2rem;text-align:center;line-height:1.7;margin-bottom:1.4rem;">
                We sent a verification link to<br>
                <strong style="color:var(--color-dark)">${email}</strong>
            </p>
            <p style="color:var(--color-gray-light);font-size:1.1rem;text-align:center;line-height:1.7;">
                Click the <strong>Verify Account</strong> button in that email to activate your account.
                The link expires in 24 hours.
            </p>
            <div style="margin-top:2rem;display:flex;flex-direction:column;gap:1rem;width:100%">
                <a href="./login.html" class="auth-btn" style="text-align:center;text-decoration:none;">
                    Go to Sign In
                </a>
                <p style="text-align:center;font-size:1.1rem;color:var(--color-gray-light)">
                    Didn't receive it? Check your spam folder or
                    <a href="#" onclick="resendEmail('${email}')" style="color:var(--color-primary);font-weight:600">
                        resend email
                    </a>
                </p>
            </div>
        </div>
    `;
    successEl.classList.add('active');
}


// ================================================================
// RESEND VERIFICATION EMAIL
// ================================================================

async function resendEmail(email) {
    const { error } = await db.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: 'https://syncprofitpath.com/auth/confirm/' }
    });

    if (error) {
        alert('Could not resend. Please try again shortly.');
    } else {
        alert('Verification email resent. Please check your inbox.');
    }
}


// ================================================================
// GOOGLE SIGN UP
// Same flow as Google login — callback.html handles everything.
// ================================================================

async function signUpWithGoogle() {
    const btn = document.getElementById('googleSignupBtn');
    if (btn) {
        btn.innerHTML = '<i class="uil uil-spinner spin"></i> Redirecting to Google…';
        btn.disabled  = true;
    }

    const { error } = await db.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: 'https://syncprofitpath.com/auth/callback.html',
        }
    });

    if (error) {
        if (btn) {
            btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Continue with Google';
            btn.disabled = false;
        }
    }
}

// ── Spin style ──
const spinStyleEl = document.createElement('style');
spinStyleEl.textContent = '.spin{animation:spin 0.9s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}';
document.head.appendChild(spinStyleEl);
