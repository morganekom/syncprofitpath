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
document.addEventListener('DOMContentLoaded', loadLandingFaqs);
document.addEventListener('DOMContentLoaded', loadLandingFooter);


// ── LOAD FOOTER CONTENT FROM SUPABASE ──
// Updates tagline, social links, support links, copyright and disclaimer text.
// Static HTML values remain as fallback if the row is missing or a field is empty.
async function loadLandingFooter() {
    try {
        const { data, error } = await db
            .from('landing_footer')
            .select('*')
            .eq('id', 1)
            .single();

        if (error || !data) return;

        setLandText('footerTagline',    data.brand_tagline);
        setLandHtml('footerCopyright',  data.copyright_text);
        setLandText('footerDisclaimer', data.disclaimer_text);

        setLandHref('footerTwitter',   data.social_twitter_url);
        setLandHref('footerTelegram',  data.social_telegram_url);
        setLandHref('footerWhatsapp',  data.social_whatsapp_url);
        setLandHref('footerInstagram', data.social_instagram_url);
        setLandHref('footerContact',   data.contact_url);
        setLandHref('footerPrivacy',   data.privacy_policy_url);
        setLandHref('footerTerms',     data.terms_url);

    } catch (err) {
        console.warn('Landing footer fetch failed:', err.message);
    }
}

function setLandText(id, value) {
    if (value == null || value === '') return;
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setLandHtml(id, value) {
    if (value == null || value === '') return;
    const el = document.getElementById(id);
    if (el) el.textContent = value; // copyright_text from DB should already include © character, not &copy;
}

function setLandHref(id, value) {
    if (!value) return;
    const el = document.getElementById(id);
    if (el) {
        el.href = value;
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
    }
}


// ── LOAD FAQ FROM SUPABASE ──
// Fetches active FAQ items and renders the accordion in the FAQ section.
async function loadLandingFaqs() {
    const container = document.getElementById('landFaqs');
    if (!container) return;

    try {
        const { data, error } = await db
            .from('landing_faqs')
            .select('question, answer')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error || !data || data.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = data.map(faq => `
            <div class="land-faq" onclick="toggleFaq(this)">
                <div class="land-faq__q">
                    <span>${escapeLandHtml(faq.question)}</span>
                    <i class="uil uil-angle-down"></i>
                </div>
                <div class="land-faq__a">${escapeLandHtml(faq.answer)}</div>
            </div>
        `).join('');

    } catch (err) {
        console.warn('Landing FAQ fetch failed:', err.message);
        container.innerHTML = '';
    }
}

function escapeLandHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

// ── IF ALREADY LOGGED IN → redirect to dashboard ──
const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
if (currentUser) {
    const role = currentUser.role || 'user';
    window.location.replace(role === 'admin' ? './admin/' : './dashboard/');
}
