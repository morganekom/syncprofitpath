// ================================================================
// LANDING.JS — Public page, no auth required
// ================================================================

// ── NAV SCROLL EFFECT ──
const nav = document.getElementById('landNav');
window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 30);
});

// ── MOBILE NAV ──
const burger   = document.getElementById('navBurger');
const drawer   = document.getElementById('navDrawer');
const backdrop = document.getElementById('navBackdrop');

burger.addEventListener('click', () => {
    drawer.classList.add('open');
    backdrop.classList.add('open');
    burger.innerHTML = '<i class="uil uil-multiply"></i>';
});

function closeDrawer() {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    burger.innerHTML = '<i class="uil uil-bars"></i>';
}

// ── SMOOTH SCROLL for anchor links ──
document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
        const target = document.querySelector(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        const offset = nav.offsetHeight + 16;
        window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
    });
});

// ── FAQ ACCORDION ──
function toggleFaq(el) {
    const isOpen = el.classList.contains('open');
    document.querySelectorAll('.land-faq.open').forEach(f => f.classList.remove('open'));
    if (!isOpen) el.classList.add('open');
}

// ── IF ALREADY LOGGED IN → redirect to dashboard ──
const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
if (currentUser) {
    const role = currentUser.role || 'user';
    window.location.replace(role === 'admin' ? './admin/index.html' : './dashboard.html');
}
