// ================================================================
// MAIN.JS — Runs on every user-facing page
// Handles: theme, sidebar, nav name, greeting, logout
// Balance cards are handled by dashboard.js on the dashboard only
// ================================================================


// ========================= THEME TOGGLE =========================
const themeBtn = document.querySelector('.nav_theme-btn');

themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    if (document.body.classList.contains('dark-theme')) {
        themeBtn.innerHTML = '<i class="uil uil-sun"></i>';
        localStorage.setItem('currrentTheme', 'dark-theme');
    } else {
        themeBtn.innerHTML = '<i class="uil uil-moon"></i>';
        localStorage.setItem('currrentTheme', '');
    }
});

document.body.className = localStorage.getItem('currrentTheme') || '';
if (document.body.classList.contains('dark-theme')) {
    themeBtn.innerHTML = '<i class="uil uil-sun"></i>';
} else {
    themeBtn.innerHTML = '<i class="uil uil-moon"></i>';
}


// ========================= SIDEBAR TOGGLE =========================
const sidebar         = document.querySelector('.sidebar');
const closeSidebarBtn = document.querySelector('.sidebar_close-btn');
const openSidebarBtn  = document.querySelector('.nav_menu-btn');

if (openSidebarBtn) {
    openSidebarBtn.addEventListener('click', () => {
        sidebar.style.display = 'flex';
    });
}

if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener('click', () => {
        sidebar.style.display = 'none';
    });
}


// ========================= NAV PROFILE PHOTO =========================
const _photoUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
const _photoKey  = _photoUser.id ? `profilePhoto_${_photoUser.id}` : null;
const _navPhoto  = document.querySelector('.nav_profile-photo img');

// Show cached photo instantly to avoid flash of dummy image
if (_photoKey && _navPhoto) {
    const _cached = localStorage.getItem(_photoKey);
    if (_cached) { _navPhoto.src = _cached; _navPhoto.style.display = ''; }
    else         { _navPhoto.removeAttribute('src'); _navPhoto.style.display = 'none'; }
}

// Confirm against Supabase — catches admin/user switches and cross-device logins
if (_photoUser.id && _navPhoto) {
    db.from('users')
      .select('avatar_url')
      .eq('id', _photoUser.id)
      .maybeSingle()
      .then(({ data }) => {
          const _dbUrl = data && data.avatar_url ? data.avatar_url : null;
          if (_dbUrl) {
              _navPhoto.src = _dbUrl;
              _navPhoto.style.display = '';
              if (_photoKey) localStorage.setItem(_photoKey, _dbUrl);
          } else {
              _navPhoto.removeAttribute('src');
              _navPhoto.style.display = 'none';
              if (_photoKey) localStorage.removeItem(_photoKey);
          }
      });
}


// ========================= NAV PROFILE → SETTINGS =========================
const navProfile = document.querySelector('.nav_profile');
if (navProfile) {
    navProfile.style.cursor = 'pointer';
    navProfile.addEventListener('click', () => {
        const parts  = window.location.pathname.split('/').filter(Boolean);
        // parts = segments of the path excluding empty strings
        // last part is the filename, everything before it is directories
        const depth  = parts.length - 1;   // number of folder levels below root
        const prefix = '../'.repeat(depth); // go up one level per folder
        window.location.href = prefix + 'settings/settings.html';
    });
}


// ========================= NAV NAME =========================
const navNameEl = document.getElementById('navName');
if (navNameEl) {
    const savedName = localStorage.getItem('userFullName');
    if (savedName) navNameEl.textContent = savedName;
}


// ========================= GREETING =========================
const greetingEl = document.getElementById('greeting-name');
if (greetingEl) {
    const firstName = localStorage.getItem('userFirstName') || 'Trader';
    greetingEl.textContent = firstName;
}


// ========================= LOGOUT =========================
// Called by logout button on all pages
// Clears session but keeps theme preference and remembered accounts
function logout() {
    const theme      = localStorage.getItem('currrentTheme');
    const remembered = localStorage.getItem('rememberedAccounts');
    const remEmail   = localStorage.getItem('rememberedEmail');

    localStorage.clear();

    if (theme)      localStorage.setItem('currrentTheme', theme);
    if (remembered) localStorage.setItem('rememberedAccounts', remembered);
    if (remEmail)   localStorage.setItem('rememberedEmail', remEmail);

    const parts  = window.location.pathname.split('/').filter(Boolean);
    const depth  = parts.length - 1;
    const prefix = '../'.repeat(depth);
    window.location.href = prefix + 'auth/login.html';
}