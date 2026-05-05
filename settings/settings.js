// ================================================================
// SETTINGS.JS — Connected to Supabase
// ================================================================


// ================================================================
// TABS
// ================================================================

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById('tab-' + tab).classList.add('active');
    });
});

window.addEventListener('DOMContentLoaded', () => {
    if (window.location.hash === '#withdrawal') {
        document.querySelector('[data-tab="withdrawal"]').click();
    }
    loadAllSavedData();
    updateKycStatus();
});


// ================================================================
// LOAD ALL SAVED DATA INTO FORMS ON PAGE LOAD
// ================================================================

function loadAllSavedData() {

    // ── Profile photo ──
    const _currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const _photoKey    = _currentUser.id ? `profilePhoto_${_currentUser.id}` : null;
    const savedPhoto   = _photoKey ? localStorage.getItem(_photoKey) : null;
    if (savedPhoto) {
        document.getElementById('profilePhotoPreview').src = savedPhoto;
        const navPhoto = document.querySelector('.nav_profile-photo img');
        if (navPhoto) navPhoto.src = savedPhoto;
    }

    // ── Profile ──
    const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    if (profile.firstName) document.getElementById('firstName').value       = profile.firstName;
    if (profile.lastName)  document.getElementById('lastName').value        = profile.lastName;
    if (profile.email)     document.getElementById('profileEmail').value    = profile.email;
    if (profile.phone)     document.getElementById('profilePhone').value    = profile.phone;
    if (profile.country)   document.getElementById('profileCountry').value  = profile.country;

    const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
    if (fullName) {
        document.getElementById('profileDisplayName').textContent = fullName;
        document.getElementById('navName').textContent            = fullName;
    }
    if (profile.email) {
        document.getElementById('profileDisplayEmail').textContent = profile.email;
    }

    // ── Bank details ──
    const savedBank = JSON.parse(localStorage.getItem('withdrawalBank') || 'null');
    if (savedBank) {
        document.getElementById('bankAccountName').value   = savedBank.accountName   || '';
        document.getElementById('bankName').value          = savedBank.bankName      || '';
        document.getElementById('bankAccountNumber').value = savedBank.accountNumber || '';
        document.getElementById('bankRoutingCode').value   = savedBank.routingCode   || '';
        document.getElementById('bankSavedBadge').style.display = 'inline-flex';
    }

    // ── Crypto details ──
    const savedCrypto = JSON.parse(localStorage.getItem('withdrawalCrypto') || 'null');
    if (savedCrypto) {
        document.getElementById('withdrawCoin').value          = savedCrypto.coinValue     || '';
        document.getElementById('cryptoWalletAddress').value  = savedCrypto.walletAddress || '';
        document.getElementById('cryptoSavedBadge').style.display = 'inline-flex';
    }

    // ── 2FA ──
    const twoFA = localStorage.getItem('twoFAEnabled') === 'true';
    document.getElementById('twoFAToggle').checked = twoFA;
}


// ================================================================
// KYC STATUS
// ================================================================

function updateKycStatus() {
    const status    = localStorage.getItem('kycStatus') || 'unsubmitted';
    const banner    = document.getElementById('kycStatusBanner');
    const iconEl    = document.getElementById('kycStatusIconEl');
    const titleEl   = document.getElementById('kycStatusTitle');
    const descEl    = document.getElementById('kycStatusDesc');
    const badge     = document.getElementById('kycBadge');
    const badgeText = document.getElementById('kycBadgeText');
    const formCard  = document.getElementById('kycFormCard');
    const submitBtn = document.getElementById('kycSubmitBtn');

    banner.classList.remove('pending', 'verified', 'rejected');

    if (status === 'verified') {
        banner.classList.add('verified');
        iconEl.className  = 'uil uil-shield-check';
        titleEl.textContent = 'Identity Verified';
        descEl.textContent  = 'Your account has been fully verified.';
        badge.classList.add('verified');
        badgeText.textContent   = 'Verified';
        submitBtn.disabled      = true;
        submitBtn.textContent   = 'Already Verified';
        formCard.style.opacity  = '0.6';

    } else if (status === 'pending') {
        banner.classList.add('pending');
        iconEl.className    = 'uil uil-clock';
        titleEl.textContent = 'Verification Under Review';
        descEl.textContent  = 'Your documents have been submitted and are being reviewed.';
        submitBtn.disabled  = true;
        submitBtn.textContent = 'Submitted — Awaiting Review';

    } else if (status === 'rejected') {
        banner.classList.add('rejected');
        iconEl.className    = 'uil uil-times-circle';
        titleEl.textContent = 'Verification Rejected';
        descEl.textContent  = 'Your documents were rejected. Please resubmit with clearer images.';
        badge.classList.remove('verified');
        badgeText.textContent = 'Rejected';

    } else {
        iconEl.className    = 'uil uil-info-circle';
        titleEl.textContent = 'Not Verified';
        descEl.textContent  = 'Submit your documents below to verify your identity.';
    }
}


// ================================================================
// PROFILE SAVE — writes to Supabase users table
// ================================================================

async function saveProfile() {
    const btn       = document.getElementById('saveProfileBtn');
    const errorEl   = document.getElementById('profileError');
    const successEl = document.getElementById('profileSuccess');

    const firstName = document.getElementById('firstName').value.trim();
    const lastName  = document.getElementById('lastName').value.trim();
    const email     = document.getElementById('profileEmail').value.trim();
    const phone     = document.getElementById('profilePhone').value.trim();
    const country   = document.getElementById('profileCountry').value.trim();

    errorEl.textContent   = '';
    successEl.textContent = '';

    if (!firstName || !lastName) { errorEl.textContent = 'First and last name are required.'; return; }
    if (!email || !email.includes('@')) { errorEl.textContent = 'Please enter a valid email address.'; return; }

    btn.textContent = 'Saving...';
    btn.disabled    = true;
    btn.classList.add('loading');

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

    const { error } = await db
        .from('users')
        .update({
            first_name: firstName,
            last_name:  lastName,
            full_name:  firstName + ' ' + lastName,
            email:      email.toLowerCase(),
            phone:      phone,
            country:    country,
        })
        .eq('id', currentUser.id);

    btn.textContent = 'Save Changes';
    btn.disabled    = false;
    btn.classList.remove('loading');

    if (error) {
        console.error('Profile save error:', error.message);
        errorEl.textContent = 'Failed to save. Please try again.';
        return;
    }

    // Keep localStorage in sync with what's in the DB
    const profile = { firstName, lastName, email, phone, country };
    localStorage.setItem('userProfile',   JSON.stringify(profile));
    localStorage.setItem('userFirstName', firstName);
    localStorage.setItem('userFullName',  firstName + ' ' + lastName);

    // Update currentUser object too
    const updatedUser = { ...currentUser, first_name: firstName, last_name: lastName, full_name: firstName + ' ' + lastName, email, phone, country };
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));

    // Update display
    const fullName = firstName + ' ' + lastName;
    document.getElementById('profileDisplayName').textContent  = fullName;
    document.getElementById('profileDisplayEmail').textContent = email;
    document.getElementById('navName').textContent             = fullName;

    successEl.textContent = '✓ Profile updated successfully.';
    setTimeout(() => successEl.textContent = '', 3000);
}


// ================================================================
// PROFILE PHOTO PREVIEW
// ================================================================

document.getElementById('profilePhotoInput').addEventListener('change', function () {
    if (!this.files[0]) return;
    const reader  = new FileReader();
    reader.onload = e => {
        const dataUrl    = e.target.result;
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const photoKey   = currentUser.id ? `profilePhoto_${currentUser.id}` : null;

        // Update preview on this page immediately
        document.getElementById('profilePhotoPreview').src = dataUrl;

        // Update nav photo on this page immediately
        const navPhoto = document.querySelector('.nav_profile-photo img');
        if (navPhoto) navPhoto.src = dataUrl;

        // Persist under this user's own key
        if (photoKey) localStorage.setItem(photoKey, dataUrl);
    };
    reader.readAsDataURL(this.files[0]);
});


// ================================================================
// PASSWORD — updates in Supabase users table
// ================================================================

function togglePassword(inputId, btn) {
    const input    = document.getElementById(inputId);
    const isHidden = input.type === 'password';
    input.type     = isHidden ? 'text' : 'password';
    btn.querySelector('i').className = isHidden ? 'uil uil-eye-slash' : 'uil uil-eye';
}

document.getElementById('newPassword').addEventListener('input', function () {
    const val   = this.value;
    const bar   = document.getElementById('strengthBar');
    const label = document.getElementById('strengthLabel');

    if (!val) {
        bar.style.width    = '0%';
        label.textContent  = '';
        label.style.color  = '';
        return;
    }

    let score = 0;
    if (val.length >= 8)          score++;
    if (/[A-Z]/.test(val))        score++;
    if (/[0-9]/.test(val))        score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const levels = [
        { label: 'Too weak', color: 'var(--color-danger)',  width: '25%'  },
        { label: 'Weak',     color: 'var(--color-warning)', width: '50%'  },
        { label: 'Good',     color: 'var(--color-primary)', width: '75%'  },
        { label: 'Strong',   color: 'var(--color-success)', width: '100%' },
    ];

    const level       = levels[score - 1] || levels[0];
    bar.style.width   = level.width;
    bar.style.background = level.color;
    label.textContent = level.label;
    label.style.color = level.color;
});

async function savePassword() {
    const current   = document.getElementById('currentPassword').value;
    const newPw     = document.getElementById('newPassword').value;
    const confirm   = document.getElementById('confirmPassword').value;
    const errorEl   = document.getElementById('passwordError');
    const successEl = document.getElementById('passwordSuccess');
    const btn       = document.getElementById('savePasswordBtn');

    errorEl.textContent   = '';
    successEl.textContent = '';

    if (!current)             { errorEl.textContent = 'Please enter your current password.'; return; }
    if (newPw.length < 8)     { errorEl.textContent = 'New password must be at least 8 characters.'; return; }
    if (newPw !== confirm)    { errorEl.textContent = 'Passwords do not match.'; return; }

    // Verify current password against DB
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

    btn.textContent = 'Saving...';
    btn.disabled    = true;

    const { data: userCheck, error: checkError } = await db
        .from('users')
        .select('id')
        .eq('id', currentUser.id)
        .eq('password', current)
        .maybeSingle();

    if (checkError || !userCheck) {
        btn.textContent = 'Update Password';
        btn.disabled    = false;
        errorEl.textContent = 'Current password is incorrect.';
        return;
    }

    const { error } = await db
        .from('users')
        .update({ password: newPw })
        .eq('id', currentUser.id);

    btn.textContent = 'Update Password';
    btn.disabled    = false;

    if (error) {
        errorEl.textContent = 'Failed to update password. Please try again.';
        return;
    }

    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value     = '';
    document.getElementById('confirmPassword').value = '';

    successEl.textContent = '✓ Password updated successfully.';
    setTimeout(() => successEl.textContent = '', 3000);
}


// ================================================================
// 2FA TOGGLE — saves to localStorage only (no Supabase column for this yet)
// ================================================================

function toggle2FA(checkbox) {
    const msg = document.getElementById('twoFAMsg');
    localStorage.setItem('twoFAEnabled', checkbox.checked);
    msg.textContent = checkbox.checked
        ? '✓ Two-factor authentication enabled.'
        : 'Two-factor authentication disabled.';
    setTimeout(() => msg.textContent = '', 3000);
}


// ================================================================
// KYC SUBMISSION — saves status to Supabase users table
// ================================================================

function showKycFileName(input, displayId) {
    const display       = document.getElementById(displayId);
    display.textContent = input.files[0] ? '✓ ' + input.files[0].name : '';
}

async function submitKyc() {
    const idType    = document.getElementById('idType').value;
    const idFile    = document.getElementById('kycIdFile').files[0];
    const addrFile  = document.getElementById('kycAddressFile').files[0];
    const errorEl   = document.getElementById('kycError');
    const successEl = document.getElementById('kycFormSuccess');
    const btn       = document.getElementById('kycSubmitBtn');

    errorEl.textContent   = '';
    successEl.textContent = '';

    if (!idType)   { errorEl.textContent = 'Please select an ID type.'; return; }
    if (!idFile)   { errorEl.textContent = 'Please upload your government ID.'; return; }
    if (!addrFile) { errorEl.textContent = 'Please upload your proof of address.'; return; }

    btn.textContent = 'Submitting...';
    btn.disabled    = true;
    btn.classList.add('loading');

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

    const { error } = await db
        .from('users')
        .update({ kyc_status: 'pending' })
        .eq('id', currentUser.id);

    btn.classList.remove('loading');

    if (error) {
        btn.textContent = 'Submit Documents';
        btn.disabled    = false;
        errorEl.textContent = 'Submission failed. Please try again.';
        return;
    }

    // Sync localStorage
    localStorage.setItem('kycStatus', 'pending');
    const updatedUser = { ...currentUser, kyc_status: 'pending' };
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));

    successEl.textContent = '✓ Documents submitted. We will review within 24–48 hours.';
    updateKycStatus();
}


// ================================================================
// BANK DETAILS SAVE — saves to localStorage only
// (bank details are not stored in Supabase — only used on withdraw page)
// ================================================================

function saveBankDetails() {
    const accountName   = document.getElementById('bankAccountName').value.trim();
    const bankName      = document.getElementById('bankName').value.trim();
    const accountNumber = document.getElementById('bankAccountNumber').value.trim();
    const routingCode   = document.getElementById('bankRoutingCode').value.trim();
    const errorEl       = document.getElementById('bankError');
    const successEl     = document.getElementById('bankSuccess');
    const btn           = document.getElementById('saveBankBtn');

    errorEl.textContent   = '';
    successEl.textContent = '';

    if (!accountName)   { errorEl.textContent = 'Account name is required.'; return; }
    if (!bankName)       { errorEl.textContent = 'Bank name is required.'; return; }
    if (!accountNumber)  { errorEl.textContent = 'Account number is required.'; return; }

    btn.textContent = 'Saving...';
    btn.disabled    = true;

    setTimeout(() => {
        localStorage.setItem('withdrawalBank', JSON.stringify({
            accountName,
            bankName,
            accountNumber,
            routingCode
        }));

        document.getElementById('bankSavedBadge').style.display = 'inline-flex';

        btn.textContent       = 'Save Bank Details';
        btn.disabled          = false;
        successEl.textContent = '✓ Bank details saved.';
        setTimeout(() => successEl.textContent = '', 3000);
    }, 400);
}


// ================================================================
// CRYPTO DETAILS SAVE — saves to localStorage only
// ================================================================

const COIN_NAMES = {
    btc: 'Bitcoin', eth: 'Ethereum', usdt: 'Tether',
    bnb: 'BNB', sol: 'Solana', ltc: 'Litecoin'
};

function updateCoinName() { }  // reserved for future use

function saveCryptoDetails() {
    const coinValue     = document.getElementById('withdrawCoin').value;
    const walletAddress = document.getElementById('cryptoWalletAddress').value.trim();
    const errorEl       = document.getElementById('cryptoError');
    const successEl     = document.getElementById('cryptoSuccess');
    const btn           = document.getElementById('saveCryptoBtn');

    errorEl.textContent   = '';
    successEl.textContent = '';

    if (!coinValue)               { errorEl.textContent = 'Please select a coin.'; return; }
    if (!walletAddress)           { errorEl.textContent = 'Wallet address is required.'; return; }
    if (walletAddress.length < 10) { errorEl.textContent = 'Please enter a valid wallet address.'; return; }

    btn.textContent = 'Saving...';
    btn.disabled    = true;

    setTimeout(() => {
        localStorage.setItem('withdrawalCrypto', JSON.stringify({
            coinValue,
            coinName: COIN_NAMES[coinValue] || coinValue.toUpperCase(),
            walletAddress
        }));

        document.getElementById('cryptoSavedBadge').style.display = 'inline-flex';

        btn.textContent       = 'Save Crypto Details';
        btn.disabled          = false;
        successEl.textContent = '✓ Crypto details saved.';
        setTimeout(() => successEl.textContent = '', 3000);
    }, 400);
}