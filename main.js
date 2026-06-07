// ================================================================
// MAIN.JS — Runs on every user-facing page
// Handles: theme, sidebar, nav name, greeting, logout
// Balance cards are handled by dashboard.js on the dashboard only
// ================================================================



// ========================= MAINTENANCE MODE CHECK =========================
// Runs on every user-facing page (not admin).
// If maintenance_mode is on in site_settings, replaces the page content.
(async () => {
    // Skip for admin pages and auth pages
    const path = window.location.pathname;
    if (path.includes('/admin/') || path.includes('/auth/')) return;
    try {
        const { data: s } = await db.from('site_settings').select('maintenance_mode').eq('id', 1).single();
        if (s && s.maintenance_mode) {
            document.body.innerHTML = `
                <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                    font-family:'Poppins',sans-serif;text-align:center;padding:2rem;background:var(--color-background,#f0eff5);">
                    <div>
                        <div style="font-size:4rem;margin-bottom:1.5rem;">🔧</div>
                        <h2 style="font-size:2.4rem;font-weight:700;margin-bottom:1rem;color:var(--color-dark,#27282f);">
                            We'll be back soon
                        </h2>
                        <p style="font-size:1.2rem;color:#888;max-width:40rem;line-height:1.6;">
                            SyncProfitPath is currently undergoing maintenance.<br>
                            Your funds are safe. Please check back in a little while.
                        </p>
                    </div>
                </div>`;
        }
    } catch (e) {}
})();

// ========================= THEME TOGGLE =========================
// Priority: 1) user's manual override (localStorage)
//           2) OS/browser system preference (prefers-color-scheme)
//           3) default to light

const themeBtn     = document.querySelector('.nav_theme-btn');
const THEME_KEY    = 'currrentTheme';   // keeping existing key name (typo preserved intentionally)
const systemDark   = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(isDark) {
    // Apply to both documentElement (for early-script consistency) and body
    document.documentElement.classList.toggle('dark-theme', isDark);
    document.body.classList.toggle('dark-theme', isDark);
    themeBtn.innerHTML = isDark
        ? '<i class="uil uil-sun"></i>'
        : '<i class="uil uil-moon"></i>';
    // Notify chart to re-render with correct grid/tick colours
    document.dispatchEvent(new Event('themechange'));
}

function resolveTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark-theme') return true;
    if (saved === '')            return false;   // user explicitly chose light
    // No saved preference — follow the OS
    return systemDark.matches;
}

// Apply on load
applyTheme(resolveTheme());

// Manual toggle — saves override so OS changes don't override the user's choice
themeBtn.addEventListener('click', () => {
    const nowDark = !document.body.classList.contains('dark-theme');
    localStorage.setItem(THEME_KEY, nowDark ? 'dark-theme' : '');
    applyTheme(nowDark);
});

// Live OS theme changes — only apply if user hasn't manually overridden
systemDark.addEventListener('change', e => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === null) applyTheme(e.matches); // no override → follow OS
});


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

// ================================================================
// ADMIN BACK BUTTON — shows in sidebar only for admin users
// ================================================================

(function showAdminBackIfAdmin() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!currentUser || currentUser.role !== 'admin') return;

    // Show on DOMContentLoaded so the element exists
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('adminBackBtn');
        if (btn) btn.style.display = '';
    });
})();
