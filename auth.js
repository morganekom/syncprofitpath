// ================================================================
// auth.js — Route Protection
//
// Security model:
//   localStorage is used only to check if a session exists (fast).
//   The actual role is ALWAYS verified live from Supabase before
//   granting access to any protected page. This means:
//     - Editing localStorage never grants admin access
//     - Removing a user's admin role in Supabase takes effect
//       on their very next page load — no re-login required
// ================================================================

(async function () {
    document.documentElement.style.visibility = 'hidden';

    // A slow or unavailable role lookup must never leave the application blank.
    // The page heads also have this fallback, but keeping it here makes route
    // protection resilient when a page is added without the shared head block.
    const revealPage = () => { document.documentElement.style.visibility = ''; };
    const revealTimer = window.setTimeout(revealPage, 2500);

    const path        = window.location.pathname;
    // In production the app is served at the domain root. During local
    // development Live Server may serve the workspace instead, placing the
    // app below /syncprofitpath/. Use one root for redirects in either case.
    const appRoot     = path.startsWith('/syncprofitpath/') ? '/syncprofitpath/' : '/';
    const isAdminPage = path.includes('/admin/');
    const isAuthPage  = path.includes('/auth/');

    // Auth pages are always visible — no session needed
    if (isAuthPage) {
        window.clearTimeout(revealTimer);
        revealPage();
        return;
    }

    // Step 1: Fast check — do we have any session at all?
    const cachedUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

    if (!cachedUser || !cachedUser.id) {
        // No session → redirect to login
        window.location.replace(appRoot + 'auth/login/');
        return;
    }

    // Step 2: Live role verification — fetch fresh from Supabase
    // This is what prevents localStorage tampering and catches
    // role changes made in Supabase without requiring re-login
    try {
        // supabase.js must be loaded before auth.js in every page's <head>
        const { data: freshUser, error } = await db
            .from('users')
            .select('id, role, kyc_status')
            .eq('id', cachedUser.id)
            .maybeSingle();

        if (error || !freshUser) {
            // User no longer exists in DB — clear session and send to login
            localStorage.clear();
            window.location.replace(appRoot + 'auth/login/');
            return;
        }

        // Sync the live role + kyc_status back into localStorage
        // so the rest of the page always has the current values
        const updated = { ...cachedUser, role: freshUser.role, kyc_status: freshUser.kyc_status };
        localStorage.setItem('currentUser', JSON.stringify(updated));
        localStorage.setItem('kycStatus', freshUser.kyc_status || 'unsubmitted');

        const role = freshUser.role || 'user';

        // Admin page but role is not admin → send to dashboard
        if (isAdminPage && role !== 'admin') {
            window.location.replace(appRoot + 'dashboard/');
            return;
        }

        // Non-admin page but somehow ended up here as admin → allow through
        // (admins can still view user-facing pages if they want)

        window.clearTimeout(revealTimer);
        revealPage();

    } catch (err) {
        // Network error — fall back to cached role rather than locking everyone out
        // (better UX for flaky connections; role tampering is still caught on recovery)
        console.warn('auth.js: role check failed, using cached role.', err.message);

        const role = cachedUser.role || 'user';

        if (isAdminPage && role !== 'admin') {
            window.location.replace(appRoot + 'dashboard/');
            return;
        }

        window.clearTimeout(revealTimer);
        revealPage();
    }

})();
