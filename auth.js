// ================================================================
// auth.js — Route Protection
// Add this script to EVERY protected page (user and admin)
// It must load BEFORE main.js or any page-specific JS
//
// How it works:
// - Reads currentUser from localStorage
// - If no user → redirects to login
// - If user is on an admin page but role is not 'admin' → redirects to dashboard
// - If user is on a user page but role is 'admin' → redirects to admin dashboard
// ================================================================

(function () {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const path        = window.location.pathname;

    // Detect which type of page we're on
    const isAdminPage = path.includes('/admin/');
    const isAuthPage  = path.includes('/auth/');

    // ── NOT LOGGED IN ──
    // If there's no current user and this isn't the login/signup page,
    // redirect to login immediately before the page renders
    if (!currentUser) {
        if (!isAuthPage) {
            // Calculate relative path to login page
            const parts  = path.split('/').filter(Boolean);
            const depth  = parts.length - 1;
            const prefix = '../'.repeat(depth);
            window.location.replace(prefix + 'auth/login.html');
        }
        return;
    }

    const role = currentUser.role || 'user';

    // ── LOGGED IN AS REGULAR USER TRYING TO ACCESS ADMIN ──
    if (isAdminPage && role !== 'admin') {
        window.location.replace('../index.html');
        return;
    }

    // ── LOGGED IN AS ADMIN TRYING TO ACCESS USER PAGES ──
    // Admins are allowed to view user pages for support purposes
    // so we don't redirect them — just let them through

})();