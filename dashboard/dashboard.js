// ================================================================
// DASHBOARD.JS  — SyncProfitPath
// Tickers: BTC/ETH/BNB/SOL/LTC/DOGE/XRP (live, refresh 60s)
// Chart:   Live price history, coin tabs + 1H/24H/7D/30D ranges
// ================================================================


// ── GREETING DATE ───────────────────────────────────────────────
const dateEl = document.getElementById('greetingDate');
if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}


// ── INIT ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserBalances();
    await loadRecentTransactions();
    loadActiveInvestments();
    checkKycAlert();

    // Build tickers first (injects DOM elements), then fetch prices
    buildTickerRows();
    loadCryptoPrices();
    setInterval(loadCryptoPrices, 60000);

    // Chart (independent — doesn't block tickers)
    injectChartControls();
    loadChartData('btc', '30');
});


// ── BALANCES ────────────────────────────────────────────────────
async function loadUserBalances() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id;

    if (!userId) {
        setBalances(
            parseFloat(localStorage.getItem('userBalance')) || 0,
            parseFloat(localStorage.getItem('userPending')) || 0,
            parseFloat(localStorage.getItem('userProfit'))  || 0
        );
        return;
    }

    try {
        const { data, error } = await db
            .from('users')
            .select('balance, profit, pending')
            .eq('id', userId)
            .single();

        if (error) throw error;

        localStorage.setItem('userBalance', String(data.balance || 0));
        localStorage.setItem('userProfit',  String(data.profit  || 0));
        localStorage.setItem('userPending', String(data.pending || 0));

        setBalances(data.balance || 0, data.pending || 0, data.profit || 0);
    } catch (err) {
        console.error('Balance fetch error:', err.message);
        setBalances(
            parseFloat(localStorage.getItem('userBalance')) || 0,
            parseFloat(localStorage.getItem('userPending')) || 0,
            parseFloat(localStorage.getItem('userProfit'))  || 0
        );
    }
}

function setBalances(balance, pending, profit) {
    const fmt = n => '$' + parseFloat(n).toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });
    const el = id => document.getElementById(id);
    if (el('dashBalance')) el('dashBalance').textContent = fmt(balance);
    if (el('dashPending')) el('dashPending').textContent = fmt(pending);
    if (el('dashProfit'))  el('dashProfit').textContent  = fmt(profit);
}


// ── RECENT TRANSACTIONS ─────────────────────────────────────────
async function loadRecentTransactions() {
    const loadingEl = document.getElementById('recentLoading');
    const emptyEl   = document.getElementById('recentEmpty');
    const listEl    = document.getElementById('recentList');
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

    if (!currentUser.id) {
        loadingEl.style.display = 'none';
        emptyEl.style.display   = 'flex';
        return;
    }

    try {
        const { data, error } = await db
            .from('transactions')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;
        loadingEl.style.display = 'none';

        if (!data || data.length === 0) { emptyEl.style.display = 'flex'; return; }

        listEl.style.display = 'block';
        listEl.innerHTML = data.map(buildRecentRow).join('');
    } catch (err) {
        console.error('Recent tx error:', err.message);
        loadingEl.style.display = 'none';
        emptyEl.style.display   = 'flex';
    }
}

function buildRecentRow(t) {
    const icons = {
        deposit:    { icon: 'uil-arrow-circle-down', bg: 'bg-primary-light', color: 'primary' },
        withdrawal: { icon: 'uil-arrow-circle-up',   bg: 'bg-danger-light',  color: 'danger'  },
        investment: { icon: 'uil-diamond',            bg: 'bg-purple-light', color: 'purple'  },
    };
    const config = icons[t.type] || { icon: 'uil-exchange', bg: 'bg-primary-light', color: 'primary' };
    const label  = t.type ? (t.type.charAt(0).toUpperCase() + t.type.slice(1)) : 'Transaction';
    const date   = new Date(t.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    const amountClass  = t.type === 'deposit' ? 'success' : t.type === 'withdrawal' ? 'danger' : 'purple';
    const amountPrefix = t.type === 'deposit' ? '+' : t.type === 'withdrawal' ? '-' : '';
    const amount       = parseFloat(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const statusColor  = t.status === 'completed' ? 'success' : t.status === 'pending' ? 'warning' : 'danger';

    return `
        <div class="recent-tx-row">
            <div class="recent-tx-left">
                <div class="recent-tx-icon ${config.bg}">
                    <i class="uil ${config.icon} ${config.color}"></i>
                </div>
                <div>
                    <div class="recent-tx-label">${label}${t.coin ? ' · ' + t.coin : ''}</div>
                    <div class="recent-tx-date">${date}</div>
                </div>
            </div>
            <div class="recent-tx-right">
                <div class="recent-tx-amount ${amountClass}">${amountPrefix}$${amount}</div>
                <div class="recent-tx-status ${statusColor}">${t.status || '—'}</div>
            </div>
        </div>`;
}


// ── KYC ALERT ───────────────────────────────────────────────────
function checkKycAlert() {
    const alertEl = document.getElementById('kycAlert');
    if (!alertEl) return;
    if ((localStorage.getItem('kycStatus') || 'unsubmitted') !== 'verified') {
        alertEl.style.display = 'flex';
    }
}


// ================================================================
// CRYPTO PRICE TICKERS
// ================================================================

const TICKER_COINS = [
    { key: 'btc',  id: 'bitcoin',     symbol: '₿', bg: '#f7931a22', color: '#f7931a', name: 'Bitcoin',  ticker: 'BTC'  },
    { key: 'eth',  id: 'ethereum',    symbol: 'Ξ', bg: '#627eea22', color: '#627eea', name: 'Ethereum', ticker: 'ETH'  },
    { key: 'bnb',  id: 'binancecoin', symbol: 'B', bg: '#f3ba2f22', color: '#f3ba2f', name: 'BNB',      ticker: 'BNB'  },
    { key: 'sol',  id: 'solana',      symbol: '◎', bg: '#9945ff22', color: '#9945ff', name: 'Solana',   ticker: 'SOL'  },
    { key: 'ltc',  id: 'litecoin',    symbol: 'Ł', bg: '#bfbbbb22', color: '#a0a0a0', name: 'Litecoin', ticker: 'LTC'  },
    { key: 'doge', id: 'dogecoin',    symbol: 'Ð', bg: '#c2a63322', color: '#c2a633', name: 'Dogecoin', ticker: 'DOGE' },
    { key: 'xrp',  id: 'ripple',      symbol: '✕', bg: '#00aae422', color: '#00aae4', name: 'XRP',      ticker: 'XRP'  },
];

// Build ticker DOM rows BEFORE fetching prices
function buildTickerRows() {
    const container = document.querySelector('.market-tickers');
    if (!container) return;

    container.innerHTML = TICKER_COINS.map(coin => `
        <div class="ticker-row">
            <div class="ticker-left">
                <div class="ticker-icon" style="background:${coin.bg};color:${coin.color};">${coin.symbol}</div>
                <div><h4>${coin.name}</h4><small class="text-muted">${coin.ticker}</small></div>
            </div>
            <div class="ticker-right">
                <h4 id="${coin.key}Price"><span class="ticker-skeleton"></span></h4>
                <small id="${coin.key}Change" class="text-muted">—</small>
            </div>
        </div>
    `).join('');
}

async function loadCryptoPrices() {
    try {
        const ids = TICKER_COINS.map(c => c.id).join(',');
        const res  = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
            { cache: 'no-store' }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        TICKER_COINS.forEach(coin => {
            const entry = data[coin.id];
            if (entry) setCryptoTicker(coin.key, entry.usd, entry.usd_24h_change);
        });

    } catch (err) {
        console.warn('Ticker fetch failed, retrying in 15s:', err.message);
        setTimeout(loadCryptoPrices, 15000);
    }
}

function setCryptoTicker(key, price, change) {
    const priceEl  = document.getElementById(key + 'Price');
    const changeEl = document.getElementById(key + 'Change');
    if (!priceEl || !changeEl) return;

    priceEl.textContent  = '$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    const pos = change >= 0;
    changeEl.textContent = (pos ? '+' : '') + change.toFixed(2) + '%';
    changeEl.className   = pos ? 'success' : 'danger';
}


// ================================================================
// CHART — live price history with coin + time range tabs
// ================================================================

const CHART_COLORS = {
    btc:  { border: '#f7931a', fill: 'rgba(247,147,26,0.08)'  },
    eth:  { border: '#627eea', fill: 'rgba(98,126,234,0.08)'  },
    bnb:  { border: '#f3ba2f', fill: 'rgba(243,186,47,0.08)'  },
    sol:  { border: '#9945ff', fill: 'rgba(153,69,255,0.08)'  },
    ltc:  { border: '#a0a0a0', fill: 'rgba(160,160,160,0.08)' },
    doge: { border: '#c2a633', fill: 'rgba(194,166,51,0.08)'  },
    xrp:  { border: '#00aae4', fill: 'rgba(0,170,228,0.08)'   },
};

// Time range config: label, CoinGecko days param, interval hint
const TIME_RANGES = [
    { key: '1',   label: '1H',  days: '1',   interval: 'minutely' },
    { key: '24h', label: '24H', days: '1',   interval: 'hourly'   },
    { key: '7',   label: '7D',  days: '7',   interval: 'daily'    },
    { key: '30',  label: '30D', days: '30',  interval: 'daily'    },
];

let chartInstance    = null;
let activeChartCoin  = 'btc';
let activeChartRange = '30';

// In-memory cache: key = "coinKey_rangeKey" → { ts, labels, prices }
const chartCache = {};
const CACHE_TTL  = 5 * 60 * 1000; // 5 minutes

function injectChartControls() {
    const section = document.querySelector('.dash-chart-section');
    if (!section) return;
    const header = section.querySelector('.dash-chart-header');
    if (!header) return;

    const coinTabs = TICKER_COINS.map(coin => `
        <button class="chart-coin-tab${coin.key === 'btc' ? ' active' : ''}"
            data-coin="${coin.key}"
            onclick="switchChartCoin('${coin.key}')"
            style="--tab-color:${CHART_COLORS[coin.key].border}"
        >${coin.ticker}</button>
    `).join('');

    const rangeTabs = TIME_RANGES.map(r => `
        <button class="chart-range-tab${r.key === '30' ? ' active' : ''}"
            data-range="${r.key}"
            onclick="switchChartRange('${r.key}')"
        >${r.label}</button>
    `).join('');

    header.insertAdjacentHTML('afterend', `
        <div class="chart-controls">
            <div class="chart-tabs" id="chartTabs">${coinTabs}</div>
            <div class="chart-range-tabs" id="chartRangeTabs">${rangeTabs}</div>
        </div>
        <div class="chart-loading" id="chartLoading">
            <span class="chart-loading-dot"></span>
            <span>Loading chart…</span>
        </div>
    `);
}

async function loadChartData(coinKey, rangeKey) {
    const cacheKey  = `${coinKey}_${rangeKey}`;
    const now       = Date.now();
    const cached    = chartCache[cacheKey];

    // Use cache if fresh
    if (cached && (now - cached.ts) < CACHE_TTL) {
        renderChart(coinKey, cached.labels, cached.prices, rangeKey);
        return;
    }

    const loadingEl = document.getElementById('chartLoading');
    const canvas    = document.getElementById('chart');
    if (!canvas) return;

    if (loadingEl) loadingEl.style.display = 'flex';
    if (canvas)    canvas.style.opacity    = '0.25';

    const range   = TIME_RANGES.find(r => r.key === rangeKey) || TIME_RANGES[3];
    const geckoId = TICKER_COINS.find(c => c.key === coinKey)?.id || 'bitcoin';

    // 1H = last 2 hours at minutely to get ~60 points; others use days param
    const url = rangeKey === '1'
        ? `https://api.coingecko.com/api/v3/coins/${geckoId}/market_chart?vs_currency=usd&days=0.1`
        : `https://api.coingecko.com/api/v3/coins/${geckoId}/market_chart?vs_currency=usd&days=${range.days}`;

    try {
        const res  = await fetchWithRetry(url, 2);
        const data = await res.json();

        if (!data.prices?.length) throw new Error('Empty response');

        // For 1H: keep last 60 points; for 24H: keep last 24 hourly points
        let raw = data.prices;
        if (rangeKey === '1')   raw = raw.slice(-60);
        if (rangeKey === '24h') raw = raw.slice(-24);

        const labels = raw.map(p => {
            const d = new Date(p[0]);
            if (rangeKey === '1')   return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            if (rangeKey === '24h') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        const prices = raw.map(p => p[1]);

        // Store in cache
        chartCache[cacheKey] = { ts: now, labels, prices };

        renderChart(coinKey, labels, prices, rangeKey);

    } catch (err) {
        console.error('Chart error:', err.message);
        showChartError();
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
        if (canvas)    canvas.style.opacity    = '1';
    }
}

// Retry helper — waits 1.2s between attempts (CoinGecko rate limit)
async function fetchWithRetry(url, attempts) {
    for (let i = 0; i < attempts; i++) {
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (res.status === 429) {
                // Rate limited — wait longer before retry
                await new Promise(r => setTimeout(r, 2000 * (i + 1)));
                continue;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res;
        } catch (err) {
            if (i === attempts - 1) throw err;
            await new Promise(r => setTimeout(r, 1200));
        }
    }
}

function renderChart(coinKey, labels, prices, rangeKey) {
    const canvas = document.getElementById('chart');
    if (!canvas) return;

    const ctx    = canvas.getContext('2d');
    const colors = CHART_COLORS[coinKey];
    const coin   = TICKER_COINS.find(c => c.key === coinKey);
    const range  = TIME_RANGES.find(r => r.key === rangeKey);
    const label  = `${coin?.name || coinKey.toUpperCase()} (${range?.label || ''})`;

    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    const isDark    = document.documentElement.classList.contains('dark-theme');
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    const tickColor = isDark ? '#adacb5' : '#86848c';

    // Fewer tick labels for 1H/24H (many data points)
    const maxTicks = (rangeKey === '1' || rangeKey === '24h') ? 6 : 8;

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label,
                data:                 prices,
                borderColor:          colors.border,
                backgroundColor:      colors.fill,
                borderWidth:          2,
                tension:              0.35,
                fill:                 true,
                pointRadius:          rangeKey === '1' ? 0 : 1.5,
                pointHoverRadius:     5,
                pointBackgroundColor: colors.border,
            }]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: true,
            animation:           { duration: 300 },
            interaction:         { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display:  true,
                    position: 'top',
                    labels:   { usePointStyle: true, padding: 16, color: tickColor, font: { size: 12 } }
                },
                tooltip: {
                    mode:      'index',
                    intersect: false,
                    callbacks: {
                        label: ctx => ' $' + ctx.parsed.y.toLocaleString('en-US', {
                            minimumFractionDigits: 2, maximumFractionDigits: 2
                        })
                    }
                }
            },
            scales: {
                x: {
                    grid:  { display: false },
                    ticks: { color: tickColor, maxTicksLimit: maxTicks, maxRotation: 0 }
                },
                y: {
                    beginAtZero: false,
                    grid:        { color: gridColor },
                    ticks: {
                        color:    tickColor,
                        callback: val => '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 })
                    }
                }
            }
        }
    });
}

function showChartError() {
    const canvas = document.getElementById('chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#999';
    ctx.font = '14px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Unable to load chart data. Tap a coin tab to retry.', canvas.width / 2, canvas.height / 2);
}

function switchChartCoin(coinKey) {
    if (coinKey === activeChartCoin) return;
    activeChartCoin = coinKey;
    document.querySelectorAll('.chart-coin-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.coin === coinKey);
    });
    loadChartData(coinKey, activeChartRange);
}

function switchChartRange(rangeKey) {
    if (rangeKey === activeChartRange) return;
    activeChartRange = rangeKey;
    document.querySelectorAll('.chart-range-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === rangeKey);
    });
    loadChartData(activeChartCoin, rangeKey);
}

// Re-render on theme toggle
document.addEventListener('themechange', () => {
    const cached = chartCache[`${activeChartCoin}_${activeChartRange}`];
    if (cached) renderChart(activeChartCoin, cached.labels, cached.prices, activeChartRange);
});


// ================================================================
// ACTIVE INVESTMENTS
// ================================================================

async function loadActiveInvestments() {
    const section = document.getElementById('activeInvestSection');
    const grid    = document.getElementById('activeInvestGrid');
    const emptyEl = document.getElementById('activeInvestEmpty');
    if (!section || !grid) return;

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (!currentUser.id) return;

    try {
        const { data, error } = await db
            .from('transactions')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('type', 'investment')
            .eq('inv_active', true)
            .order('start_date', { ascending: true });

        if (error) throw error;

        const investments = (data || []).filter(inv => inv.start_date && inv.end_date);
        section.style.display = 'block';

        if (investments.length === 0) {
            grid.style.display    = 'none';
            emptyEl.style.display = 'flex';
            return;
        }

        emptyEl.style.display          = 'none';
        grid.style.display             = 'grid';
        grid.style.gridTemplateColumns = '1fr';
        grid.innerHTML = investments.map(buildActiveInvCard).join('');
    } catch (err) {
        console.error('Active investments error:', err.message);
    }
}

const COIN_ICONS = {
    btc:  { symbol: '₿', bg: '#f7931a22', color: '#f7931a', label: 'Bitcoin'  },
    eth:  { symbol: 'Ξ', bg: '#627eea22', color: '#627eea', label: 'Ethereum' },
    usdt: { symbol: '₮', bg: '#26a17b22', color: '#26a17b', label: 'Tether'   },
    bnb:  { symbol: 'B', bg: '#f3ba2f22', color: '#f3ba2f', label: 'BNB'      },
    sol:  { symbol: '◎', bg: '#9945ff22', color: '#9945ff', label: 'Solana'   },
    ltc:  { symbol: 'Ł', bg: '#bfbbbb22', color: '#bfbbbb', label: 'Litecoin' },
    doge: { symbol: 'Ð', bg: '#c2a63322', color: '#c2a633', label: 'Dogecoin' },
    xrp:  { symbol: '✕', bg: '#00aae422', color: '#00aae4', label: 'XRP'      },
};

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtMoney(n) {
    return '$' + parseFloat(n).toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });
}

function buildActiveInvCard(inv) {
    const today     = new Date(); today.setHours(0,0,0,0);
    const startDate = new Date(inv.start_date); startDate.setHours(0,0,0,0);
    const duration    = inv.duration_days || 30;
    const daysElapsed = Math.min(Math.max(Math.floor((today - startDate) / 86400000), 0), duration);
    const daysLeft    = Math.max(duration - daysElapsed, 0);
    const progressPct = Math.min(Math.round((daysElapsed / duration) * 100), 100);
    const amount      = parseFloat(inv.amount) || 0;
    const dailyRate   = parseFloat(inv.daily_rate) || 0;
    const dailyProfit = amount * (dailyRate / 100);
    const totalProfit = dailyProfit * daysElapsed;
    const totalReturn = amount + (dailyProfit * duration);
    const coinKey     = (inv.coin || '').toLowerCase();
    const coinData    = COIN_ICONS[coinKey] || {
        symbol: coinKey.toUpperCase().slice(0,2) || '?',
        bg: 'rgba(0,226,123,0.12)', color: 'var(--color-primary)',
        label: coinKey.toUpperCase()
    };
    const isMatured   = daysLeft === 0;
    const startFmt    = new Date(inv.start_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    const endFmt      = new Date(inv.end_date).toLocaleDateString('en-US',   { day: '2-digit', month: 'short', year: 'numeric' });

    return `
    <div class="active-inv-card">
        <div class="active-inv-top">
            <div class="active-inv-coin-icon" style="background:${coinData.bg};color:${coinData.color};">${coinData.symbol}</div>
            <div class="active-inv-top-info">
                <div class="active-inv-plan">${escapeHtml(inv.method || 'Investment')}</div>
                <div class="active-inv-coin-label">${escapeHtml(coinData.label)} · ${startFmt} → ${endFmt}</div>
            </div>
            <span class="active-inv-status ${isMatured ? 'status-matured' : 'status-active'}">${isMatured ? 'Matured' : 'Active'}</span>
        </div>
        <div class="active-inv-amounts">
            <div class="active-inv-amount-row">
                <span class="active-inv-label">Invested</span>
                <span class="active-inv-value">${fmtMoney(amount)}</span>
            </div>
            <div class="active-inv-amount-row">
                <span class="active-inv-label">Profit so far</span>
                <span class="active-inv-value profit-green">${fmtMoney(totalProfit)}</span>
            </div>
            <div class="active-inv-amount-row">
                <span class="active-inv-label">Expected total</span>
                <span class="active-inv-value">${fmtMoney(totalReturn)}</span>
            </div>
        </div>
        <div class="active-inv-footer">
            <div class="active-inv-progress-wrap">
                <div class="active-inv-progress-track">
                    <div class="active-inv-progress-fill"
                         style="width:${progressPct}%;background:${isMatured ? 'var(--color-gray-light)' : 'var(--color-primary)'};"></div>
                </div>
                <span class="active-inv-days-label">${daysElapsed} of ${duration} days</span>
            </div>
            <span class="active-inv-daily">+${fmtMoney(dailyProfit)}/day</span>
        </div>
        <div class="active-inv-ref">Ref: ${escapeHtml(inv.reference || inv.id.slice(0,8).toUpperCase())}</div>
    </div>`;
}
