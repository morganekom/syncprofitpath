// ── THEME — follow OS / user preference (mirrors main.js logic) ──────────────
(function () {
    var PREF_KEY  = 'themePreference';
    var SAVED_KEY = 'currrentTheme'; // intentional typo matches main.js
    var osMq = window.matchMedia('(prefers-color-scheme: dark)');

    function isDark() {
        var pref  = localStorage.getItem(PREF_KEY);
        var saved = localStorage.getItem(SAVED_KEY);
        if (pref === 'dark')   return true;
        if (pref === 'light')  return false;
        if (pref === 'system') return osMq.matches;
        if (saved === 'dark-theme') return true;
        if (saved === '')           return false;
        return osMq.matches; // default: follow OS
    }

    function apply(dark) {
        document.documentElement.classList.toggle('dark-theme', dark);
    }

    apply(isDark());

    osMq.addEventListener('change', function (e) {
        var pref  = localStorage.getItem(PREF_KEY);
        var saved = localStorage.getItem(SAVED_KEY);
        if (pref === 'system' || (pref == null && saved == null)) apply(e.matches);
    });
})();

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

// ========================= THEME SYNC =========================
// Landing page has no toggle UI of its own, but should match the
// app pages: respect a stored preference (shared via localStorage
// across the whole site) or fall back to the OS setting, and follow
// live OS changes while the page is open.
const LAND_THEME_KEY      = 'currrentTheme';
const LAND_THEME_PREF_KEY = 'themePreference';
const landSystemDark      = window.matchMedia('(prefers-color-scheme: dark)');

function applyLandTheme(isDark) {
    document.documentElement.classList.toggle('dark-theme', isDark);
    document.body.classList.toggle('dark-theme', isDark);
    document.dispatchEvent(new Event('themechange'));
}

function resolveLandTheme() {
    const pref = localStorage.getItem(LAND_THEME_PREF_KEY);
    if (pref === 'dark')   return true;
    if (pref === 'light')  return false;
    if (pref === 'system') return landSystemDark.matches;
    const saved = localStorage.getItem(LAND_THEME_KEY);
    if (saved === 'dark-theme') return true;
    if (saved === '')           return false;
    return landSystemDark.matches;
}

applyLandTheme(resolveLandTheme());

landSystemDark.addEventListener('change', e => {
    const pref  = localStorage.getItem(LAND_THEME_PREF_KEY);
    const saved = localStorage.getItem(LAND_THEME_KEY);
    if (pref === 'system' || (pref === null && saved === null)) {
        applyLandTheme(e.matches);
    }
});


document.addEventListener('DOMContentLoaded', loadLandingPlans);
document.addEventListener('DOMContentLoaded', loadLandingFaqs);
document.addEventListener('DOMContentLoaded', loadLandingFooter);
document.addEventListener('DOMContentLoaded', loadLandingHero);


// ── LOAD FOOTER CONTENT FROM SUPABASE ──
// Updates tagline, social links, support links, copyright and disclaimer text.
// Static HTML values remain as fallback if the row is missing or a field is empty.
async function loadLandingHero() {
    try {
        const { data, error } = await db
            .from('landing_hero')
            .select('*')
            .eq('id', 1)
            .single();

        if (error || !data) return;

        setLandText('heroEyebrow',          data.eyebrow_text);
        setLandText('heroHeadlineBefore',    data.headline_before);
        setLandText('heroHeadlineHighlight', data.headline_highlight);
        setLandText('heroHeadlineAfter',     data.headline_after);
        setLandText('heroSub',               data.subheadline_text);
        setLandText('heroPrimaryBtn',        data.primary_btn_text);
        setLandText('heroSecondaryBtn',      data.secondary_btn_text);
        setLandText('heroStat1Value', data.stat1_value); setLandText('heroStat1Label', data.stat1_label);
        setLandText('heroStat2Value', data.stat2_value); setLandText('heroStat2Label', data.stat2_label);
        setLandText('heroStat3Value', data.stat3_value); setLandText('heroStat3Label', data.stat3_label);
        setLandText('heroStat4Value', data.stat4_value); setLandText('heroStat4Label', data.stat4_label);

    } catch (err) {
        console.warn('Landing hero fetch failed:', err.message);
    }
}

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


// ================================================================
// LIVE MARKETS — Landing Page
// ================================================================

const LAND_FINNHUB_KEY  = 'd9fesbhr01qu5nhe7j1gd9fesbhr01qu5nhe7j20';
const landMarketLoaded  = { crypto: false, stocks: false, realestate: false };
const landMarketTimers  = {};

document.addEventListener('DOMContentLoaded', () => {
    // Load crypto immediately (default tab)
    landMarketLoaded.crypto = true;
    loadLandCryptoPrices();
    landMarketTimers.crypto = setInterval(loadLandCryptoPrices, 60000);
});

function switchLandMarketTab(tab, btn) {
    document.querySelectorAll('.land-market-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.land-market-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('landMarket-' + tab).classList.add('active');

    if (!landMarketLoaded[tab]) {
        landMarketLoaded[tab] = true;
        loadLandMarket(tab);
        landMarketTimers[tab] = setInterval(() => loadLandMarket(tab), 60000);
    }
}

function loadLandMarket(tab) {
    if (tab === 'crypto')     loadLandCryptoPrices();
    if (tab === 'stocks')     loadLandStockPrices();
    if (tab === 'realestate') loadLandRealEstatePrices();
}

// ── Crypto ──
async function loadLandCryptoPrices() {
    const coins = [
        { id: 'bitcoin', key: 'lBtc' }, { id: 'ethereum', key: 'lEth' },
        { id: 'binancecoin', key: 'lBnb' }, { id: 'solana', key: 'lSol' },
        { id: 'tether', key: 'lUsdt' }, { id: 'cardano', key: 'lAda' },
    ];
    try {
        const ids = coins.map(c => c.id).join(',');
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        coins.forEach(c => {
            const e = data[c.id];
            if (e) setLandTicker(c.key, e.usd, e.usd_24h_change, 2);
        });
    } catch (err) { console.warn('Land crypto error:', err.message); }
}

// ── Stocks ──
async function loadLandStockPrices() {
    const stocks = [
        { sym: 'AAPL', key: 'lAapl' }, { sym: 'TSLA', key: 'lTsla' },
        { sym: 'AMZN', key: 'lAmzn' }, { sym: 'MSFT', key: 'lMsft' },
        { sym: 'GOOGL', key: 'lGoogl' }, { sym: 'META', key: 'lMeta' },
    ];
    try {
        await Promise.all(stocks.map(async s => {
            const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${s.sym}&token=${LAND_FINNHUB_KEY}`);
            const d   = await res.json();
            if (d.c) setLandTicker(s.key, d.c, d.dp, 2);
        }));
    } catch (err) { console.warn('Land stocks error:', err.message); }
}

// ── Real Estate (REITs — same tickers as the dashboard's Real Estate chart) ──
async function loadLandRealEstatePrices() {
    const reits = [
        { sym: 'VNQ', key: 'lVnq' }, { sym: 'SPG', key: 'lSpg' },
        { sym: 'PLD', key: 'lPld' }, { sym: 'AMT', key: 'lAmt' },
    ];
    try {
        await Promise.all(reits.map(async s => {
            const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${s.sym}&token=${LAND_FINNHUB_KEY}`);
            const d   = await res.json();
            if (d.c) setLandTicker(s.key, d.c, d.dp, 2);
        }));
    } catch (err) { console.warn('Land real estate error:', err.message); }
}

// ── Shared setter ──
function setLandTicker(key, price, changePct, decimals) {
    const priceEl  = document.getElementById(key + 'Price');
    const changeEl = document.getElementById(key + 'Change');
    if (!priceEl || !changeEl) return;
    priceEl.textContent  = '$' + Number(price).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const pos = (changePct || 0) >= 0;
    changeEl.textContent = (pos ? '+' : '') + Number(changePct || 0).toFixed(2) + '%';
    changeEl.className   = 'land-mkt-change ' + (pos ? 'land-mkt-up' : 'land-mkt-down');
}


// ================================================================
// LIVE MARKET OVERVIEW — chart widget (mirrors the dashboard chart:
// real Binance data for crypto, simulated trend for stocks/real estate,
// since those need a paid market-data subscription to be truly live)
// ================================================================

const LAND_CHART_ASSETS = {
    crypto: [
        { key: 'btc',  ticker: 'BTC',  symbol: 'BTCUSDT',  color: '#f7931a' },
        { key: 'eth',  ticker: 'ETH',  symbol: 'ETHUSDT',  color: '#627eea' },
        { key: 'bnb',  ticker: 'BNB',  symbol: 'BNBUSDT',  color: '#f3ba2f' },
        { key: 'sol',  ticker: 'SOL',  symbol: 'SOLUSDT',  color: '#9945ff' },
        { key: 'usdt', ticker: 'USDT', symbol: 'USDCUSDT', color: '#2775ca' },
        { key: 'ada',  ticker: 'ADA',  symbol: 'ADAUSDT',  color: '#e84142' },
    ],
    stocks: [
        { key: 'aapl',  ticker: 'AAPL',  color: '#555555', base: 196 },
        { key: 'tsla',  ticker: 'TSLA',  color: '#cc0000', base: 248 },
        { key: 'amzn',  ticker: 'AMZN',  color: '#ff9900', base: 185 },
        { key: 'msft',  ticker: 'MSFT',  color: '#00a4ef', base: 415 },
        { key: 'googl', ticker: 'GOOGL', color: '#4285f4', base: 176 },
        { key: 'meta',  ticker: 'META',  color: '#1877f2', base: 492 },
    ],
    realestate: [
        { key: 'vnq', ticker: 'VNQ', color: '#27ae60', base: 87  },
        { key: 'spg', ticker: 'SPG', color: '#2ecc71', base: 148 },
        { key: 'pld', ticker: 'PLD', color: '#16a085', base: 118 },
        { key: 'amt', ticker: 'AMT', color: '#1abc9c', base: 195 },
    ],
};

const LAND_TIME_RANGES = [
    { key: '1h',  label: '1H',  interval: '1m', limit: 60 },
    { key: '24h', label: '24H', interval: '1h', limit: 24 },
    { key: '7d',  label: '7D',  interval: '1d', limit: 7  },
    { key: '30d', label: '30D', interval: '1d', limit: 30 },
];

let activeLandAsset = 'crypto';
let activeLandCoin  = 'btc';
let activeLandRange = '30d';
let landChartInstance = null;

const landChartCache = {};
const LAND_CACHE_TTL = 5 * 60 * 1000;
let landAbortCtrl  = null;
let landDebounce   = null;

function initLandChart() {
    renderLandCoinTabs('crypto');
    renderLandRangeTabs();
    scheduleLandChartLoad();
}

function renderLandCoinTabs(asset) {
    const coins = LAND_CHART_ASSETS[asset] || LAND_CHART_ASSETS.crypto;
    const tabsEl = document.getElementById('landChartTabs');
    if (!tabsEl) return;
    tabsEl.innerHTML = coins.map((c, i) => `
        <button class="land-chart-tab${i === 0 ? ' active' : ''}"
            data-coin="${c.key}"
            style="--tab-color:${c.color}"
            onclick="switchLandChartCoin('${c.key}', this)"
        >${c.ticker}</button>
    `).join('');
}

function renderLandRangeTabs() {
    const tabsEl = document.getElementById('landChartRangeTabs');
    if (!tabsEl) return;
    tabsEl.innerHTML = LAND_TIME_RANGES.map(r => `
        <button class="land-chart-range-tab${r.key === activeLandRange ? ' active' : ''}"
            data-range="${r.key}"
            onclick="switchLandChartRange('${r.key}', this)"
        >${r.label}</button>
    `).join('');
}

function switchLandChartAsset(asset, btn) {
    document.querySelectorAll('.land-chart-asset-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    activeLandAsset = asset;

    const coins = LAND_CHART_ASSETS[asset] || LAND_CHART_ASSETS.crypto;
    activeLandCoin = coins[0].key;
    renderLandCoinTabs(asset);

    const noteEl = document.getElementById('landChartNote');
    if (noteEl) {
        const notes = {
            stocks:     'Stock chart data is simulated. Live stock data requires a market data subscription.',
            realestate: 'REIT chart data is simulated. Live real estate data requires a market data subscription.',
        };
        const note = notes[asset] || '';
        noteEl.textContent  = note;
        noteEl.style.display = note ? '' : 'none';
    }

    scheduleLandChartLoad();
}

function switchLandChartCoin(coinKey, btn) {
    document.querySelectorAll('.land-chart-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    activeLandCoin = coinKey;
    scheduleLandChartLoad();
}

function switchLandChartRange(rangeKey, btn) {
    document.querySelectorAll('.land-chart-range-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    activeLandRange = rangeKey;
    scheduleLandChartLoad();
}

function scheduleLandChartLoad() {
    clearTimeout(landDebounce);
    landDebounce = setTimeout(() => {
        if (activeLandAsset === 'crypto') {
            loadLandChartData(activeLandCoin, activeLandRange);
        } else {
            loadLandSimulatedChart(activeLandAsset, activeLandCoin, activeLandRange);
        }
    }, 150);
}

async function loadLandChartData(coinKey, rangeKey) {
    const cacheKey = `${coinKey}_${rangeKey}`;
    const cached   = landChartCache[cacheKey];
    const now      = Date.now();

    if (cached && (now - cached.ts) < LAND_CACHE_TTL) {
        renderLandChart(coinKey, cached.labels, cached.prices, rangeKey);
        clearLandChartStatus();
        return;
    }
    if (cached) {
        renderLandChart(coinKey, cached.labels, cached.prices, rangeKey);
        setLandChartStatus('Refreshing…', 'muted');
    } else {
        setLandChartStatus('Loading…', 'loading');
        dimLandCanvas(true);
    }

    if (landAbortCtrl) landAbortCtrl.abort();
    landAbortCtrl = new AbortController();
    const { signal } = landAbortCtrl;

    const range = LAND_TIME_RANGES.find(r => r.key === rangeKey) || LAND_TIME_RANGES[3];
    const coin  = LAND_CHART_ASSETS.crypto.find(c => c.key === coinKey) || LAND_CHART_ASSETS.crypto[0];
    const url   = `https://api.binance.com/api/v3/klines?symbol=${coin.symbol}&interval=${range.interval}&limit=${range.limit}`;

    try {
        const res = await fetch(url, { signal });
        if (signal.aborted) return;
        if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);

        const candles = await res.json();
        if (!Array.isArray(candles) || candles.length === 0) throw new Error('No data');

        const labels = candles.map(c => {
            const d = new Date(c[0]);
            return (rangeKey === '1h' || rangeKey === '24h')
                ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        const prices = candles.map(c => parseFloat(c[4]));

        landChartCache[cacheKey] = { ts: now, labels, prices };
        renderLandChart(coinKey, labels, prices, rangeKey);
        clearLandChartStatus();

    } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('Land chart error:', err.message);
        if (cached) {
            setLandChartStatus('Using cached data', 'muted');
        } else {
            setLandChartStatus('Failed to load. Tap a coin to retry.', 'error');
        }
    } finally {
        dimLandCanvas(false);
    }
}

function loadLandSimulatedChart(asset, coinKey, rangeKey) {
    const coins = LAND_CHART_ASSETS[asset] || LAND_CHART_ASSETS.stocks;
    const coin  = coins.find(c => c.key === coinKey) || coins[0];
    const range = LAND_TIME_RANGES.find(r => r.key === rangeKey) || LAND_TIME_RANGES[3];
    const points = range.limit || 30;

    const prices = [];
    let price = coin.base * (0.92 + Math.random() * 0.16);
    for (let i = 0; i < points; i++) {
        price = price * (1 + (Math.random() - 0.495) * 0.025);
        prices.push(parseFloat(price.toFixed(2)));
    }

    const now = new Date();
    const labels = Array.from({ length: points }, (_, i) => {
        const d = new Date(now);
        if (rangeKey === '1h' || rangeKey === '24h') {
            d.setHours(d.getHours() - (points - 1 - i));
            return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }
        d.setDate(d.getDate() - (points - 1 - i));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    renderLandChart(coinKey, labels, prices, rangeKey, coin.color);
    clearLandChartStatus();
}

function renderLandChart(coinKey, labels, prices, rangeKey, colorOverride) {
    const canvas = document.getElementById('landChart');
    if (!canvas) return;

    const coins  = LAND_CHART_ASSETS[activeLandAsset] || LAND_CHART_ASSETS.crypto;
    const coin   = coins.find(c => c.key === coinKey) || coins[0];
    const color  = colorOverride || coin.color;
    const range  = LAND_TIME_RANGES.find(r => r.key === rangeKey);
    const label  = `${coin.ticker} · ${range?.label || ''}`;
    const maxTicks = (rangeKey === '1h' || rangeKey === '24h') ? 6 : 8;

    if (landChartInstance) { landChartInstance.destroy(); landChartInstance = null; }

    const isDark    = document.documentElement.classList.contains('dark-theme');
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    const tickColor = isDark ? '#adacb5' : '#86848c';
    const legendColor = isDark ? '#ddd' : '#56555e';

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, color + '33');
    gradient.addColorStop(1, color + '00');

    landChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label,
                data:                 prices,
                borderColor:          color,
                backgroundColor:      gradient,
                borderWidth:          2,
                tension:              0.35,
                fill:                 true,
                pointRadius:          rangeKey === '1h' ? 0 : 1.5,
                pointHoverRadius:     5,
                pointBackgroundColor: color,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 250 },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { usePointStyle: true, padding: 16, color: legendColor, font: { size: 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ' $' + ctx.parsed.y.toLocaleString('en-US', {
                            minimumFractionDigits: 2, maximumFractionDigits: 4
                        })
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: tickColor, maxTicksLimit: maxTicks, maxRotation: 0 }
                },
                y: {
                    beginAtZero: false,
                    grid: { color: gridColor },
                    ticks: {
                        color: tickColor,
                        callback: val => {
                            if (val < 1)  return '$' + val.toFixed(4);
                            if (val < 10) return '$' + val.toFixed(2);
                            return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 });
                        }
                    }
                }
            }
        }
    });
}

function setLandChartStatus(msg, type) {
    const el = document.getElementById('landChartStatus');
    if (!el) return;
    el.textContent = msg;
    el.className   = 'land-chart-status land-chart-status--' + (type || 'muted');
}

function clearLandChartStatus() {
    const el = document.getElementById('landChartStatus');
    if (el) { el.textContent = ''; el.className = 'land-chart-status'; }
}

function dimLandCanvas(on) {
    const wrap = document.getElementById('landChartCanvasWrap');
    if (wrap) wrap.classList.toggle('dimmed', on);
}

document.addEventListener('DOMContentLoaded', initLandChart);

// Re-render on theme change so chart tick/legend colors stay correct
document.addEventListener('themechange', () => {
    const cacheKey = `${activeLandCoin}_${activeLandRange}`;
    const cached   = landChartCache[cacheKey];
    if (activeLandAsset === 'crypto' && cached) {
        renderLandChart(activeLandCoin, cached.labels, cached.prices, activeLandRange);
    } else if (activeLandAsset !== 'crypto' && landChartInstance) {
        loadLandSimulatedChart(activeLandAsset, activeLandCoin, activeLandRange);
    }
});


// ════════════════════════════════
// LIVE TRADING ACTIVITY TOAST
// ════════════════════════════════
(function () {
    const SHOW_DELAY   = 3500;   // ms before first toast
    const VISIBLE_TIME = 6000;   // ms toast stays visible
    const BETWEEN_TIME = 12000;  // ms gap between toasts
    const DURATION_CSS = '6s';   // must match VISIBLE_TIME

    const activities = [
        { loc: 'London',       action: 'invested',  amt: '$1,250',  asset: 'Bitcoin'   },
        { loc: 'New York',     action: 'invested',  amt: '$3,500',  asset: 'Ethereum'  },
        { loc: 'Dubai',        action: 'invested',  amt: '$5,000',  asset: 'the Premium Plan' },
        { loc: 'Toronto',      action: 'deposited', amt: '$800',    asset: 'Standard Plan' },
        { loc: 'Lagos',        action: 'invested',  amt: '$2,200',  asset: 'Forex'     },
        { loc: 'Singapore',    action: 'invested',  amt: '$10,000', asset: 'Gold'      },
        { loc: 'Sydney',       action: 'deposited', amt: '$600',    asset: 'Basic Plan'},
        { loc: 'Johannesburg', action: 'invested',  amt: '$4,750',  asset: 'Silver'    },
        { loc: 'Berlin',       action: 'invested',  amt: '$1,800',  asset: 'Bitcoin'   },
        { loc: 'Mumbai',       action: 'deposited', amt: '$950',    asset: 'Ethereum'  },
        { loc: 'Paris',        action: 'invested',  amt: '$3,000',  asset: 'the Premium Plan' },
        { loc: 'Nairobi',      action: 'invested',  amt: '$500',    asset: 'Basic Plan'},
        { loc: 'Tokyo',        action: 'invested',  amt: '$7,500',  asset: 'Forex'     },
        { loc: 'São Paulo',    action: 'deposited', amt: '$1,100',  asset: 'Standard Plan' },
        { loc: 'Cairo',        action: 'invested',  amt: '$2,600',  asset: 'Gold'      },
    ];

    const toast   = document.getElementById('ltaToast');
    const closeBtn= document.getElementById('ltaClose');
    const bodyEl  = document.getElementById('ltaBody');
    const locEl   = document.getElementById('ltaLoc');
    const amtEl   = document.getElementById('ltaAmt');
    const assetEl = document.getElementById('ltaAsset');
    const timeEl  = document.getElementById('ltaTime');
    const barEl   = document.getElementById('ltaBar');

    if (!toast) return;

    let lastIndex = -1;
    let hideTimer, nextTimer;
    let dismissed = false;

    function pick() {
        let idx;
        do { idx = Math.floor(Math.random() * activities.length); } while (idx === lastIndex);
        lastIndex = idx;
        return activities[idx];
    }

    function timeAgo() {
        const mins = Math.floor(Math.random() * 4);
        return mins === 0 ? 'just now' : `${mins} min ago`;
    }

    function showToast() {
        if (dismissed) return;
        const a = pick();

        locEl.textContent   = a.loc;
        amtEl.textContent   = `${a.action} ${a.amt}`;
        assetEl.textContent = a.asset;
        timeEl.textContent  = timeAgo();

        // Restart progress bar animation
        toast.style.setProperty('--lta-duration', DURATION_CSS);
        barEl.style.animation = 'none';
        void barEl.offsetWidth; // reflow
        barEl.style.animation = '';

        toast.classList.add('lta-visible');

        clearTimeout(hideTimer);
        hideTimer = setTimeout(hideToast, VISIBLE_TIME);
    }

    function hideToast() {
        toast.classList.remove('lta-visible');
        if (!dismissed) {
            nextTimer = setTimeout(showToast, BETWEEN_TIME);
        }
    }

    closeBtn.addEventListener('click', () => {
        dismissed = true;
        clearTimeout(hideTimer);
        clearTimeout(nextTimer);
        toast.classList.remove('lta-visible');
    });

    // Pause on hover
    toast.addEventListener('mouseenter', () => { clearTimeout(hideTimer); });
    toast.addEventListener('mouseleave', () => {
        if (!dismissed) hideTimer = setTimeout(hideToast, 2000);
    });

    setTimeout(showToast, SHOW_DELAY);
})();
