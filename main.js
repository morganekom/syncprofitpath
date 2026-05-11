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
const sidebar      = document.querySelector('.sidebar');
const openSidebarBtn = document.querySelector('.nav_menu-btn');

// Create backdrop element once and append to body
const sidebarBackdrop = document.createElement('div');
sidebarBackdrop.className = 'sidebar-backdrop';
document.body.appendChild(sidebarBackdrop);

function openSidebar() {
    sidebar.style.display = 'flex';
    sidebar.style.left = '0';
    sidebarBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    sidebar.style.left = '-100%';
    sidebarBackdrop.classList.remove('open');
    document.body.style.overflow = '';
    // wait for transition before hiding
    setTimeout(() => { sidebar.style.display = 'none'; }, 300);
}

if (openSidebarBtn) {
    openSidebarBtn.addEventListener('click', openSidebar);
}

// Tap backdrop to close
sidebarBackdrop.addEventListener('click', closeSidebar);

// Also close when a sidebar link is tapped (navigating away)
if (sidebar) {
    sidebar.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', closeSidebar);
    });
}


// ========================= NAV PROFILE PHOTO =========================
const _photoUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
const _photoKey  = _photoUser.id ? `profilePhoto_${_photoUser.id}` : null;
const _navPhoto  = document.querySelector('.nav_profile-photo img');

// Show cached photo instantly to avoid flash of dummy image
if (_photoKey && _navPhoto) {
    const _cached = localStorage.getItem(_photoKey);
    if (_cached) { _navPhoto.src = _cached; }
    // no saved photo → leave the default src from HTML untouched
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
              if (_photoKey) localStorage.setItem(_photoKey, _dbUrl);
          } else {
              // No photo in DB — clear cache and let default HTML src show
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
        const depth  = parts.length;
        const prefix = '../'.repeat(depth);
        window.location.href = prefix + 'settings/';
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
    const depth  = parts.length;
    const prefix = '../'.repeat(depth);
    window.location.href = prefix + 'auth/login/';
}