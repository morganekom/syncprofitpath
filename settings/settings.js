// ================================================================
// SETTINGS.JS — Connected to Supabase
// ================================================================


// ================================================================
// GLOBAL NAV PHOTO LOADER
// Call this on every page's DOMContentLoaded to populate the nav
// avatar for whichever user is logged in (admin or regular user).
// It reads from localStorage cache first (instant), then confirms
// against Supabase (authoritative). Hidden when no photo is set.
// ================================================================

window.loadNavPhoto = function () {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (!currentUser.id) return;

    const photoKey   = `profilePhoto_${currentUser.id}`;
    const cached     = localStorage.getItem(photoKey);
    const navPhotos  = document.querySelectorAll('.nav_profile-photo img');

    function setNav(url) {
        navPhotos.forEach(img => {
            img.src = url || img.dataset.fallback || '';
            img.style.display = '';
        });
    }

    // Instant: use cache
    setNav(cached || null);

    // Authoritative: fetch from Supabase
    db.from('users')
      .select('avatar_url')
      .eq('id', currentUser.id)
      .maybeSingle()
      .then(({ data }) => {
          const dbUrl = data && data.avatar_url ? data.avatar_url : null;
          setNav(dbUrl);
          if (dbUrl) localStorage.setItem(photoKey, dbUrl);
          else       localStorage.removeItem(photoKey);
      });
};


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
    loadNavPhoto();
    updateKycStatus();
    initAppearanceTab();
    init2FAState();
    // Capture original values after data loads (slight delay for async profile load)
    setTimeout(captureOriginalProfile, 600);
});


// ================================================================
// LOAD ALL SAVED DATA INTO FORMS ON PAGE LOAD
// ================================================================

function loadAllSavedData() {

    // ── Profile photo ──
    // Fetched from Supabase on load so it's always correct for the active user
    // (localStorage is used only as an instant-display cache while the DB call resolves)
    const _currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

    // Helper: apply a photo URL (or clear to blank avatar) everywhere on this page
    function applyPhoto(url) {
        const preview  = document.getElementById('profilePhotoPreview');
        const navPhoto = document.querySelector('.nav_profile-photo img');
        const fallback = '../assets/profile-1.jpg';
        const src      = url || fallback;

        if (preview)  { preview.src  = src; preview.style.display  = ''; }
        if (navPhoto) { navPhoto.src = src; navPhoto.style.display = ''; }
    }

    // Helper: reveal real profile section, hide skeleton
    function revealProfileSection() {
        const skelEl = document.getElementById('profilePhotoSkeleton');
        const realEl = document.getElementById('profilePhotoReal');
        if (skelEl) skelEl.style.display = 'none';
        if (realEl) realEl.style.display = '';
    }

    const _photoKey   = _currentUser.id ? `profilePhoto_${_currentUser.id}` : null;
    const cachedPhoto = _photoKey ? localStorage.getItem(_photoKey) : null;

    if (cachedPhoto) {
        applyPhoto(cachedPhoto);
        revealProfileSection();
    }

    if (_currentUser.id) {
        db.from('users')
          .select('avatar_url, totp_enabled, totp_secret')
          .eq('id', _currentUser.id)
          .maybeSingle()
          .then(({ data }) => {
              if (!data) { revealProfileSection(); return; }

              // Photo
              const dbPhoto = data.avatar_url || null;
              applyPhoto(dbPhoto);
              if (dbPhoto && _photoKey) localStorage.setItem(_photoKey, dbPhoto);
              else if (_photoKey)       localStorage.removeItem(_photoKey);
              revealProfileSection();

              // 2FA — sync latest values from DB into currentUser then re-render state
              const fresh = JSON.parse(localStorage.getItem('currentUser') || '{}');
              fresh.totp_enabled = data.totp_enabled || false;
              fresh.totp_secret  = data.totp_secret  || null;
              localStorage.setItem('currentUser', JSON.stringify(fresh));
              init2FAState();
          })
          .catch(() => revealProfileSection());
    } else {
        revealProfileSection();
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
    captureOriginalProfile();   // reset dirty baseline so button disables
    checkProfileDirty();
    setTimeout(() => successEl.textContent = '', 3000);
}


// ================================================================
// DIRTY TRACKING — Save Changes button only active when form changed
// ================================================================

let _originalProfile = {};

function captureOriginalProfile() {
    _originalProfile = {
        firstName: document.getElementById('firstName').value,
        lastName:  document.getElementById('lastName').value,
        email:     document.getElementById('profileEmail').value,
        phone:     document.getElementById('profilePhone').value,
        country:   document.getElementById('profileCountry').value,
    };
}

function checkProfileDirty() {
    const btn = document.getElementById('saveProfileBtn');
    const isDirty =
        document.getElementById('firstName').value      !== _originalProfile.firstName ||
        document.getElementById('lastName').value       !== _originalProfile.lastName  ||
        document.getElementById('profilePhone').value   !== _originalProfile.phone     ||
        document.getElementById('profileCountry').value !== _originalProfile.country;
    btn.disabled = !isDirty;
}

['firstName','lastName','profilePhone','profileCountry'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', checkProfileDirty);
});


// ================================================================
// PROFILE PHOTO — drag-to-position crop modal
// ================================================================

let _cropObjectUrl = null;

document.getElementById('profilePhotoInput').addEventListener('change', function () {
    if (!this.files[0]) return;
    if (_cropObjectUrl) { URL.revokeObjectURL(_cropObjectUrl); _cropObjectUrl = null; }
    _cropObjectUrl = URL.createObjectURL(this.files[0]);
    openCropModal(_cropObjectUrl);
    this.value = '';
});

let _cropImgW = 0, _cropImgH = 0;
let _cropX = 0, _cropY = 0;
let _cropDragging = false;
let _cropStartX = 0, _cropStartY = 0;
const CROP_SIZE = 240;

function openCropModal(src) {
    const overlay  = document.getElementById('cropOverlay');
    const img      = document.getElementById('cropImg');
    const viewport = document.getElementById('cropViewport');

    // Clear previous state
    img.style.width = img.style.height = img.style.transform = '';
    _cropX = 0; _cropY = 0;

    img.onload = () => {
        const scale = CROP_SIZE / Math.min(img.naturalWidth, img.naturalHeight);
        _cropImgW = Math.round(img.naturalWidth  * scale);
        _cropImgH = Math.round(img.naturalHeight * scale);
        img.style.width  = _cropImgW + 'px';
        img.style.height = _cropImgH + 'px';
        // Centre the image in the viewport to start
        _cropX = Math.round((CROP_SIZE - _cropImgW) / 2);
        _cropY = Math.round((CROP_SIZE - _cropImgH) / 2);
        applyCropPosition();
    };

    // Set src AFTER onload is attached (avoids race on cached images)
    img.src = '';
    img.src = src;

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Remove any stale listener before adding a fresh one
    viewport.removeEventListener('pointerdown', onCropPointerDown);
    viewport.addEventListener('pointerdown', onCropPointerDown);
}

function applyCropPosition() {
    const img = document.getElementById('cropImg');
    _cropX = Math.min(0, Math.max(CROP_SIZE - _cropImgW, _cropX));
    _cropY = Math.min(0, Math.max(CROP_SIZE - _cropImgH, _cropY));
    img.style.transform = `translate(${_cropX}px, ${_cropY}px)`;
}

function onCropPointerDown(e) {
    _cropDragging = true;
    _cropStartX = e.clientX - _cropX;
    _cropStartY = e.clientY - _cropY;
    document.addEventListener('pointermove', onCropPointerMove);
    document.addEventListener('pointerup',   onCropPointerUp);
    e.preventDefault();
}

function onCropPointerMove(e) {
    if (!_cropDragging) return;
    _cropX = e.clientX - _cropStartX;
    _cropY = e.clientY - _cropStartY;
    applyCropPosition();
}

function onCropPointerUp() {
    _cropDragging = false;
    document.removeEventListener('pointermove', onCropPointerMove);
    document.removeEventListener('pointerup',   onCropPointerUp);
}

function cancelCrop() {
    document.getElementById('cropOverlay').classList.remove('open');
    document.body.style.overflow = '';
    if (_cropObjectUrl) { URL.revokeObjectURL(_cropObjectUrl); _cropObjectUrl = null; }
}

async function saveCrop() {
    const img    = document.getElementById('cropImg');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = CROP_SIZE;
    const ctx    = canvas.getContext('2d');

    const scaleX = img.naturalWidth  / _cropImgW;
    const scaleY = img.naturalHeight / _cropImgH;
    const srcX   = (-_cropX) * scaleX;
    const srcY   = (-_cropY) * scaleY;
    const srcW   = CROP_SIZE * scaleX;
    const srcH   = CROP_SIZE * scaleY;

    ctx.beginPath();
    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, CROP_SIZE, CROP_SIZE);

    const dataUrl     = canvas.toDataURL('image/jpeg', 0.88);
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const photoKey    = currentUser.id ? `profilePhoto_${currentUser.id}` : null;

    // Update UI immediately
    const preview  = document.getElementById('profilePhotoPreview');
    const navPhoto = document.querySelector('.nav_profile-photo img');
    if (preview)  preview.src  = dataUrl;
    if (navPhoto) navPhoto.src = dataUrl;
    if (photoKey) localStorage.setItem(photoKey, dataUrl);

    // Close modal
    document.getElementById('cropOverlay').classList.remove('open');
    document.body.style.overflow = '';
    if (_cropObjectUrl) { URL.revokeObjectURL(_cropObjectUrl); _cropObjectUrl = null; }

    // Persist to Supabase
    if (currentUser.id) {
        const { error } = await db
            .from('users')
            .update({ avatar_url: dataUrl })
            .eq('id', currentUser.id);
        if (error) console.error('Photo save error:', error.message);
        else {
            localStorage.setItem('currentUser', JSON.stringify({ ...currentUser, avatar_url: dataUrl }));
        }
    }
}


// ================================================================
// APPEARANCE — system / light / dark
// ================================================================
// Note: THEME_KEY and THEME_PREF_KEY are declared in main.js which
// loads before this file — do NOT redeclare them here.

function initAppearanceTab() {
    let pref = localStorage.getItem(THEME_PREF_KEY);
    if (!pref) {
        const old = localStorage.getItem(THEME_KEY);
        if (old === 'dark-theme') pref = 'dark';
        else if (old === '')      pref = 'light';
        else                      pref = 'system';
        localStorage.setItem(THEME_PREF_KEY, pref);
    }
    const radio = document.querySelector(`input[name="themeChoice"][value="${pref}"]`);
    if (radio) radio.checked = true;
    highlightAppearanceOption(pref);

    document.querySelectorAll('input[name="themeChoice"]').forEach(r => {
        r.addEventListener('change', () => applyAppearancePref(r.value));
    });
}

function highlightAppearanceOption(val) {
    document.querySelectorAll('.appearance-option').forEach(el => {
        el.classList.toggle('appearance-option--active',
            el.querySelector('input').value === val);
    });
}

function applyAppearancePref(pref) {
    localStorage.setItem(THEME_PREF_KEY, pref);
    highlightAppearanceOption(pref);
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let isDark;
    if      (pref === 'dark')  { isDark = true;       localStorage.setItem(THEME_KEY, 'dark-theme'); }
    else if (pref === 'light') { isDark = false;       localStorage.setItem(THEME_KEY, ''); }
    else                       { isDark = systemDark; localStorage.removeItem(THEME_KEY); }
    document.documentElement.classList.toggle('dark-theme', isDark);
    document.body.classList.toggle('dark-theme', isDark);
    if (typeof applyTheme === 'function') applyTheme(isDark);
}


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
// 2FA — TOTP enrollment and verification
// Uses OTPAuth (TOTP RFC 6238) + QRCode.js, both loaded via CDN
// Secret stored in Supabase users table column: totp_secret
// Enabled flag stored in column: totp_enabled (boolean)
// ================================================================

let _pendingTotpSecret = null;   // holds secret during setup, cleared after

function init2FAState() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const enabled = currentUser.totp_enabled === true || currentUser.totp_enabled === 'true';
    document.getElementById('twoFA-off').style.display   = enabled ? 'none'  : 'block';
    document.getElementById('twoFA-on').style.display    = enabled ? 'block' : 'none';
    document.getElementById('twoFA-setup').style.display = 'none';
}

async function start2FASetup() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (!currentUser.id) {
        alert('Session error — please refresh and try again.');
        return;
    }

    // Check CDN libraries loaded
    if (typeof OTPAuth === 'undefined') {
        alert('Required library failed to load. Please check your internet connection and refresh the page.');
        return;
    }

    // Generate a random 20-byte base32 secret
    const array  = new Uint8Array(20);
    crypto.getRandomValues(array);
    const base32 = uint8ToBase32(array);
    _pendingTotpSecret = base32;

    // Display formatted key (groups of 4 for readability)
    const formatted = base32.match(/.{1,4}/g).join(' ');
    document.getElementById('twoFAKeyDisplay').textContent = formatted;

    // Switch to setup state first so user sees something immediately
    document.getElementById('twoFA-off').style.display   = 'none';
    document.getElementById('twoFA-setup').style.display = 'block';
    document.getElementById('twoFAConfirmCode').value    = '';
    document.getElementById('twoFASetupError').textContent = '';

    // Build otpauth:// URI for QR code
    const totp = new OTPAuth.TOTP({
        issuer:    'SyncProfitPath',
        label:     currentUser.email || 'user',
        algorithm: 'SHA1',
        digits:    6,
        period:    30,
        secret:    OTPAuth.Secret.fromBase32(base32),
    });
    const uri = totp.toString();

    // Render QR code onto canvas
    try {
        if (typeof QRCode !== 'undefined') {
            const canvas = document.getElementById('twoFAQrCanvas');
            await QRCode.toCanvas(canvas, uri, {
                width:  220,
                margin: 2,
                color:  { dark: '#27282f', light: '#ffffff' }
            });
        } else {
            // QRCode library failed — hide canvas, user can still use the key
            document.getElementById('twoFAQrCanvas').style.display = 'none';
        }
    } catch (err) {
        console.error('QR render error:', err);
        document.getElementById('twoFAQrCanvas').style.display = 'none';
    }
}

function cancel2FASetup() {
    _pendingTotpSecret = null;
    document.getElementById('twoFA-setup').style.display = 'none';
    document.getElementById('twoFA-off').style.display   = 'block';
}

async function verify2FASetup() {
    const code    = document.getElementById('twoFAConfirmCode').value.trim().replace(/\s/g, '');
    const errorEl = document.getElementById('twoFASetupError');
    errorEl.textContent = '';

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
        errorEl.textContent = 'Please enter the 6-digit code from your app.';
        return;
    }

    if (!_pendingTotpSecret) {
        errorEl.textContent = 'Setup session expired. Please start again.';
        cancel2FASetup();
        return;
    }

    const totp = new OTPAuth.TOTP({
        algorithm: 'SHA1',
        digits:    6,
        period:    30,
        secret:    OTPAuth.Secret.fromBase32(_pendingTotpSecret),
    });

    const delta = totp.validate({ token: code, window: 1 });

    if (delta === null) {
        errorEl.textContent = 'Code is incorrect or has expired. Check your app and try again.';
        return;
    }

    // Code verified — save secret and enabled flag to Supabase
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const { error } = await db
        .from('users')
        .update({ totp_secret: _pendingTotpSecret, totp_enabled: true })
        .eq('id', currentUser.id);

    if (error) {
        errorEl.textContent = 'Failed to save. Please try again.';
        return;
    }

    // Update local session
    currentUser.totp_secret  = _pendingTotpSecret;
    currentUser.totp_enabled = true;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    _pendingTotpSecret = null;

    document.getElementById('twoFA-setup').style.display = 'none';
    document.getElementById('twoFA-on').style.display    = 'block';
}

async function disable2FA() {
    if (!confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) return;

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const { error } = await db
        .from('users')
        .update({ totp_secret: null, totp_enabled: false })
        .eq('id', currentUser.id);

    if (error) { alert('Failed to disable 2FA. Please try again.'); return; }

    currentUser.totp_secret  = null;
    currentUser.totp_enabled = false;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));

    document.getElementById('twoFA-on').style.display  = 'none';
    document.getElementById('twoFA-off').style.display = 'block';
}

function copySetupKey() {
    const key = (_pendingTotpSecret || '').match(/.{1,4}/g)?.join(' ') || '';
    if (!key) return;
    navigator.clipboard.writeText(key).then(() => {
        const msg = document.getElementById('twoFACopyMsg');
        msg.textContent = '✓ Copied to clipboard';
        setTimeout(() => msg.textContent = '', 2500);
    });
}

// ── Base32 encoder (RFC 4648, no padding) ──
function uint8ToBase32(bytes) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0, value = 0, output = '';
    for (let i = 0; i < bytes.length; i++) {
        value = (value << 8) | bytes[i];
        bits += 8;
        while (bits >= 5) {
            output += alphabet[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
    return output;
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
        // Send KYC pending notification
        const kycUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        sendNotification({
            type:  'kyc_pending',
            email: kycUser.email || '',
            name:  kycUser.full_name || kycUser.first_name || 'there',
        });
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