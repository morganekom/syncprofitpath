const AUTH_FUNCTION_URL = 'https://syqdwottzrhpclnvzdmz.supabase.co/functions/v1/auth-handler';

// ================================================================
// SIGNUP.JS — Connected to Supabase
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
// PRE-FILL REFERRAL CODE FROM URL
// If someone clicks a referral link like signup.html?ref=DIVI-ABC123
// the referral code field gets filled in automatically
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
// GENERATE THIS USER'S OWN REFERRAL CODE
// Stored as my_referral_code in the users table.
// This is the code they share with others to earn rewards.
// Format: first 4 letters of first name + dash + 6 random chars
// e.g. DIVI-X7K2QP
// ================================================================

function generateMyReferralCode(firstName) {
    const prefix = firstName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    return prefix + '-' + suffix;
}


// ================================================================
// SUBMIT — saves to Supabase
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

    // ── CHECK DUPLICATE EMAIL ──
    const { data: existing } = await db
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle();

    if (existing) {
        showError('emailErr', 'An account with this email already exists.');
        goToStep(1);
        submitBtn.innerHTML = 'Create Account <i class="uil uil-check"></i>';
        submitBtn.disabled  = false;
        return;
    }

    // ── GENERATE THIS USER'S OWN REFERRAL CODE ──
    // my_referral_code = the code they share with others
    // referral_code    = the code they typed in at signup (someone else's code)
    const myReferralCode = generateMyReferralCode(firstName);

    // Hash password via Edge Function
    const hashRes = await fetch(AUTH_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signup', password })
    });
    const hashData = await hashRes.json();
    if (!hashRes.ok || !hashData.hashedPassword) {
           document.getElementById('signupError').textContent = 'Could not process your account. Please try again.';
        submitBtn.innerHTML = 'Create Account <i class="uil uil-check"></i>';
        submitBtn.disabled = false;
        return;
    }
    const hashedPassword = hashData.hashedPassword;

    // ── INSERT INTO SUPABASE ──
    const { data, error } = await db
        .from('users')
        .insert([{
            first_name:       firstName,
            last_name:        lastName,
            full_name:        fullName,
            email:            email.toLowerCase(),
            phone:            val('phone'),
            dob:              val('dob'),
            country:          val('country'),
            state:            val('state'),
            city:             val('city'),
            postal_code:      val('postalCode'),
            password: hashedPassword,
            referral_code:    val('referralCode'),  // code they USED to sign up
            my_referral_code: myReferralCode,        // code they SHARE with others
            role:             'user',
            kyc_status:       'unsubmitted',
            balance:          0,
            profit:           0,
            pending:          0,
        }])
        .select()
        .single();

    if (error) {
        // Handle rare case where generated code already exists (UNIQUE constraint clash)
        if (error.code === '23505' && error.message.includes('my_referral_code')) {
            document.getElementById('signupError').textContent = 'Please try again.';
        } else {
            document.getElementById('signupError').textContent = 'Something went wrong. Please try again.';
        }
        console.error('Supabase signup error:', error.message);
        submitBtn.innerHTML = 'Create Account <i class="uil uil-check"></i>';
        submitBtn.disabled  = false;
        return;
    }

    saveSession(data);
    showSuccess();
}


// ================================================================
// SAVE SESSION TO LOCALSTORAGE
// All pages read from here for the current logged-in user.
// Also saves myReferralCode so refer.js can read it immediately.
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


// ================================================================
// SUCCESS + REDIRECT
// ================================================================

function showSuccess() {
    document.getElementById('step3').classList.remove('active');
    document.getElementById('stepSuccess').classList.add('active');
    document.getElementById('progressBar').style.width = '100%';
    setTimeout(() => { document.getElementById('redirectBar').style.width = '100%'; }, 100);
    let count  = 3;
    const countEl  = document.getElementById('countdownNum');
    const interval = setInterval(() => {
        count--;
        if (countEl) countEl.textContent = count;
        if (count <= 0) { clearInterval(interval); window.location.href = '../index.html'; }
    }, 1000);
}