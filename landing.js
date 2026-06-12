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


// ── LOAD PLANS FROM SUPABASE ──
// Fetches live plan data and updates the three plan cards on the landing page.
// Matches plans by sort_order: 1 = Basic, 2 = Standard, 3 = Premium.
async function loadLandingPlans() {
    try {
        const { data, error } = await db
            .from('investment_plans')
            .select('name, daily_rate, roi_multiplier, min_amount, max_amount')
            .order('sort_order', { ascending: true });

        if (error || !data || data.length === 0) return;

        const cards = document.querySelectorAll('.land-plan');

        // Hero card mini plan list (Basic / Standard / Premium rates)
        const heroRateEls = document.querySelectorAll('.hero-plan-item strong');
        data.forEach((plan, i) => {
            const dailyRate = plan.daily_rate != null ? plan.daily_rate : 0;
            if (heroRateEls[i]) {
                heroRateEls[i].textContent = '+' + dailyRate + '%/day';
            }
        });

        data.forEach((plan, i) => {
            const card = cards[i];
            if (!card) return;

            const dailyRate = plan.daily_rate    != null ? plan.daily_rate    : 0;
            const roi       = plan.roi_multiplier != null ? plan.roi_multiplier : 0;
            const minAmt    = plan.min_amount    != null ? plan.min_amount    : 0;
            const maxAmt    = plan.max_amount    != null ? plan.max_amount    : 0;

            // Update rate number — keeps the <span>%</span> intact
            const rateEl = card.querySelector('.land-plan__rate');
            if (rateEl) {
                rateEl.innerHTML = dailyRate + '<span>%</span>';
            }

            // Update range
            const rangeEl = card.querySelector('.land-plan__range');
            if (rangeEl) {
                rangeEl.textContent = '$' + formatLandNum(minAmt) + ' — $' + formatLandNum(maxAmt);
            }

            // Update first two feature list items (daily % and ROI)
            const features = card.querySelectorAll('.land-plan__features li');
            if (features[0]) {
                features[0].innerHTML = '<i class="uil uil-check-circle"></i> Daily ' + dailyRate + '% profit';
            }
            if (features[1]) {
                features[1].innerHTML = '<i class="uil uil-check-circle"></i> ' + roi + '× ROI';
            }
        });

    } catch (err) {
        // Silent fail — static HTML fallback values remain visible
        console.warn('Landing plans fetch failed:', err.message);
    }
}

function formatLandNum(num) {
    return Number(num).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

document.addEventListener('DOMContentLoaded', loadLandingPlans);

// ── IF ALREADY LOGGED IN → redirect to dashboard ──
const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
if (currentUser) {
    const role = currentUser.role || 'user';
    window.location.replace(role === 'admin' ? './admin/' : './dashboard/');
}
