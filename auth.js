// ================================================================
// auth.js — Route Protection
// ================================================================

(function () {
    document.documentElement.style.visibility = 'hidden';

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const path        = window.location.pathname;

    const isAdminPage = path.includes('/admin/');
    const isAuthPage  = path.includes('/auth/');

    if (!currentUser) {
        if (!isAuthPage) {
            const parts  = path.split('/').filter(Boolean);
            const depth  = parts.length - 1;
            const prefix = '../'.repeat(depth);
            window.location.replace(prefix + 'auth/login.html');
        } else {
            document.documentElement.style.visibility = '';
        }
        return;
    }

    const role = currentUser.role || 'user';

    if (isAdminPage && role !== 'admin') {
        window.location.replace('../dashboard/');
        return;
    }

    document.documentElement.style.visibility = '';

})();
