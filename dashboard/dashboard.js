// ================================================================
// DASHBOARD.JS
// Handles: greeting, balances from Supabase, recent transactions,
// crypto price tickers (BTC/ETH/BNB/SOL/LTC/DOGE/XRP),
// live 30-day chart from CoinGecko, KYC alert
// ================================================================


// ================================================================
// GREETING DATE
// ================================================================

const dateEl = document.getElementById('greetingDate');
if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}


// ================================================================
// INIT — runs on page load
// ================================================================

document.addEventListener('DOMContentLoaded', async () => {
    await loadUserBalances();
    await loadRecentTransactions();
    loadActiveInvestments();
    checkKycAlert();
    await loadCryptoPrices();
    initChart();
});


// ================================================================
// LOAD USER BALANCES FROM SUPABASE
// ================================================================

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

    const balanceEl = document.getElementById('dashBalance');
    const pendingEl = document.getElementById('dashPending');
    const profitEl  = document.getElementById('dashProfit');

    if (balanceEl) balanceEl.textContent = fmt(balance);
    if (pendingEl) pendingEl.textContent = fmt(pending);
    if (profitEl)  profitEl.textContent  = fmt(profit);
}


// ================================================================
// LOAD RECENT TRANSACTIONS (last 5)
// ================================================================

async function loadRecentTransactions() {
    const loadingEl = document.getElementById('recentLoading');
    const emptyEl   = document.getElementById('recentEmpty');
    const listEl    = document.getElementById('recentList');

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id;

    if (!userId) {
        loadingEl.style.display = 'none';
        emptyEl.style.display   = 'flex';
        return;
    }

    try {
        const { data, error } = await db
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        loadingEl.style.display = 'none';

        if (!data || data.length === 0) {
            emptyEl.style.display = 'flex';
            return;
        }

        listEl.style.display = 'block';
        listEl.innerHTML = data.map(t => buildRecentRow(t)).join('');

    } catch (err) {
        console.error('Recent transactions error:', err.message);
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

    const statusColor = t.status === 'completed' ? 'success' : t.status === 'pending' ? 'warning' : 'danger';

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
        </div>
    `;
}


// ================================================================
// KYC ALERT
// ================================================================

function checkKycAlert() {
    const kycStatus = localStorage.getItem('kycStatus') || 'unsubmitted';
    const alertEl   = document.getElementById('kycAlert');
    if (!alertEl) return;
    if (kycStatus !== 'verified') alertEl.style.display = 'flex';
}


// ================================================================
// CRYPTO PRICE TICKERS
// BTC, ETH, BNB, SOL, LTC, DOGE, XRP — updates every 60 seconds
// ================================================================

// Coin config: id = CoinGecko id, color = brand color
const TICKER_COINS = [
    { key: 'btc',  id: 'bitcoin',      symbol: '₿',  bg: '#f7931a22', color: '#f7931a', name: 'Bitcoin',  ticker: 'BTC'  },
    { key: 'eth',  id: 'ethereum',     symbol: 'Ξ',  bg: '#627eea22', color: '#627eea', name: 'Ethereum', ticker: 'ETH'  },
    { key: 'bnb',  id: 'binancecoin',  symbol: 'B',  bg: '#f3ba2f22', color: '#f3ba2f', name: 'BNB',      ticker: 'BNB'  },
    { key: 'sol',  id: 'solana',       symbol: '◎',  bg: '#9945ff22', color: '#9945ff', name: 'Solana',   ticker: 'SOL'  },
    { key: 'ltc',  id: 'litecoin',     symbol: 'Ł',  bg: '#bfbbbb22', color: '#a0a0a0', name: 'Litecoin', ticker: 'LTC'  },
    { key: 'doge', id: 'dogecoin',     symbol: 'Ð',  bg: '#c2a63322', color: '#c2a633', name: 'Dogecoin', ticker: 'DOGE' },
    { key: 'xrp',  id: 'ripple',       symbol: '✕',  bg: '#00aae422', color: '#00aae4', name: 'XRP',      ticker: 'XRP'  },
];

// Cache for latest prices (used by chart too)
const livePrices = {};

async function loadCryptoPrices() {
    try {
        const ids = TICKER_COINS.map(c => c.id).join(',');
        const res  = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
        );
        const data = await res.json();

        TICKER_COINS.forEach(coin => {
            const entry = data[coin.id];
            if (entry) {
                livePrices[coin.key] = { price: entry.usd, change: entry.usd_24h_change };
                setCryptoTicker(coin.key, entry.usd, entry.usd_24h_change);
            }
        });

    } catch (err) {
        console.log('Crypto prices unavailable:', err.message);
    }
}

function setCryptoTicker(key, price, change) {
    const priceEl  = document.getElementById(key + 'Price');
    const changeEl = document.getElementById(key + 'Change');
    if (!priceEl || !changeEl) return;

    if (price !== undefined) {
        priceEl.textContent = '$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    if (change !== undefined) {
        const pos = change >= 0;
        changeEl.textContent = (pos ? '+' : '') + change.toFixed(2) + '%';
        changeEl.className   = pos ? 'success' : 'danger';
    }
}

// Refresh tickers every 60 seconds
setInterval(loadCryptoPrices, 60000);


// ================================================================
// BUILD TICKER HTML (injected — replaces static HTML in right panel)
// Renders all 7 coins with proper ids so setCryptoTicker() works
// ================================================================

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
                <h4 id="${coin.key}Price">—</h4>
                <small id="${coin.key}Change" class="text-muted">—</small>
            </div>
        </div>
    `).join('');
}


// ================================================================
// CHART — Live 30-day price history from CoinGecko
// Coin selector tabs injected above the canvas
// ================================================================

let chartInstance = null;
let activeChartCoin = 'btc';

// Map coin key → CoinGecko market_chart id
const CHART_COIN_IDS = {
    btc:  'bitcoin',
    eth:  'ethereum',
    bnb:  'binancecoin',
    sol:  'solana',
    ltc:  'litecoin',
    doge: 'dogecoin',
    xrp:  'ripple',
};

// Brand colors per coin (border + fill)
const CHART_COLORS = {
    btc:  { border: '#f7931a', fill: 'rgba(247,147,26,0.08)' },
    eth:  { border: '#627eea', fill: 'rgba(98,126,234,0.08)'  },
    bnb:  { border: '#f3ba2f', fill: 'rgba(243,186,47,0.08)'  },
    sol:  { border: '#9945ff', fill: 'rgba(153,69,255,0.08)'  },
    ltc:  { border: '#a0a0a0', fill: 'rgba(160,160,160,0.08)' },
    doge: { border: '#c2a633', fill: 'rgba(194,166,51,0.08)'  },
    xrp:  { border: '#00aae4', fill: 'rgba(0,170,228,0.08)'   },
};

function initChart() {
    buildTickerRows();     // render all 7 ticker rows
    injectChartControls(); // inject coin tabs above canvas
    loadChartData('btc');  // load initial chart
}

function injectChartControls() {
    const section = document.querySelector('.dash-chart-section');
    if (!section) return;

    const header = section.querySelector('.dash-chart-header');
    if (!header) return;

    // Build tab strip
    const tabs = TICKER_COINS.map(coin => `
        <button
            class="chart-coin-tab${coin.key === 'btc' ? ' active' : ''}"
            data-coin="${coin.key}"
            onclick="switchChartCoin('${coin.key}')"
            style="--tab-color:${CHART_COLORS[coin.key].border}"
        >${coin.ticker}</button>
    `).join('');

    // Insert tabs + loading indicator
    header.insertAdjacentHTML('afterend', `
        <div class="chart-tabs" id="chartTabs">${tabs}</div>
        <div class="chart-loading" id="chartLoading">
            <span class="chart-loading-dot"></span>
            <span>Loading chart data…</span>
        </div>
    `);
}

async function loadChartData(coinKey) {
    const loadingEl = document.getElementById('chartLoading');
    const canvas    = document.getElementById('chart');
    if (!canvas) return;

    if (loadingEl) loadingEl.style.display = 'flex';
    if (canvas)    canvas.style.opacity    = '0.3';

    try {
        const geckoId = CHART_COIN_IDS[coinKey];
        const res = await fetch(
            `https://api.coingecko.com/api/v3/coins/${geckoId}/market_chart?vs_currency=usd&days=30&interval=daily`
        );
        const data = await res.json();

        if (!data.prices || data.prices.length === 0) throw new Error('No data');

        // data.prices = [[timestamp, price], ...]
        const labels = data.prices.map(p => {
            const d = new Date(p[0]);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        const prices = data.prices.map(p => p[1]);

        renderChart(coinKey, labels, prices);

    } catch (err) {
        console.error('Chart data error:', err.message);
        // Fallback: show a simple error state on canvas
        if (chartInstance) {
            chartInstance.data.labels = [];
            chartInstance.data.datasets[0].data = [];
            chartInstance.update();
        }
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
        if (canvas)    canvas.style.opacity    = '1';
    }
}

function renderChart(coinKey, labels, prices) {
    const canvas = document.getElementById('chart');
    if (!canvas) return;

    const ctx    = canvas.getContext('2d');
    const colors = CHART_COLORS[coinKey];
    const coin   = TICKER_COINS.find(c => c.key === coinKey);
    const label  = coin ? coin.name + ' (30d)' : coinKey.toUpperCase();

    // Destroy previous instance
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    // Detect dark theme for grid/tick colors
    const isDark    = document.documentElement.classList.contains('dark-theme');
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    const tickColor = isDark ? '#adacb5' : '#86848c';

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label,
                data:            prices,
                borderColor:     colors.border,
                backgroundColor: colors.fill,
                borderWidth:     2.5,
                tension:         0.4,
                fill:            true,
                pointRadius:     2,
                pointHoverRadius: 6,
                pointBackgroundColor: colors.border,
            }]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: true,
            animation:           { duration: 400, easing: 'easeInOutQuart' },
            interaction:         { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display:  true,
                    position: 'top',
                    labels:   { usePointStyle: true, padding: 20, color: tickColor }
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
                    ticks: {
                        color:       tickColor,
                        maxTicksLimit: 8,
                        maxRotation: 0,
                    }
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

function switchChartCoin(coinKey) {
    if (coinKey === activeChartCoin) return;
    activeChartCoin = coinKey;

    // Update active tab
    document.querySelectorAll('.chart-coin-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.coin === coinKey);
    });

    loadChartData(coinKey);
}

// Re-render chart on theme toggle to fix colors
document.addEventListener('themechange', () => {
    if (activeChartCoin) loadChartData(activeChartCoin);
});


// ================================================================
// ACTIVE INVESTMENTS
// ================================================================

async function loadActiveInvestments() {
    const section  = document.getElementById('activeInvestSection');
    const grid     = document.getElementById('activeInvestGrid');
    const emptyEl  = document.getElementById('activeInvestEmpty');
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

        emptyEl.style.display = 'none';
        grid.style.display    = 'grid';
        grid.style.gridTemplateColumns = '1fr';
        grid.innerHTML = investments.map(inv => buildActiveInvCard(inv)).join('');

    } catch (err) {
        console.error('Active investments error:', err.message);
    }
}

const COIN_ICONS = {
    btc:  { symbol: '₿',  bg: '#f7931a22', color: '#f7931a', label: 'Bitcoin'   },
    eth:  { symbol: 'Ξ',  bg: '#627eea22', color: '#627eea', label: 'Ethereum'  },
    usdt: { symbol: '₮',  bg: '#26a17b22', color: '#26a17b', label: 'Tether'    },
    bnb:  { symbol: 'B',  bg: '#f3ba2f22', color: '#f3ba2f', label: 'BNB'       },
    sol:  { symbol: '◎',  bg: '#9945ff22', color: '#9945ff', label: 'Solana'    },
    ltc:  { symbol: 'Ł',  bg: '#bfbbbb22', color: '#bfbbbb', label: 'Litecoin'  },
    doge: { symbol: 'Ð',  bg: '#c2a63322', color: '#c2a633', label: 'Dogecoin'  },
    xrp:  { symbol: '✕',  bg: '#00aae422', color: '#00aae4', label: 'XRP'       },
};

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildActiveInvCard(inv) {
    const today     = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(inv.start_date);
    startDate.setHours(0, 0, 0, 0);

    const duration    = inv.duration_days || 30;
    const daysElapsed = Math.min(Math.max(Math.floor((today - startDate) / 86400000), 0), duration);
    const daysLeft    = Math.max(duration - daysElapsed, 0);
    const progressPct = Math.min(Math.round((daysElapsed / duration) * 100), 100);

    const amount      = parseFloat(inv.amount)     || 0;
    const dailyRate   = parseFloat(inv.daily_rate)  || 0;
    const dailyProfit = amount * (dailyRate / 100);
    const totalProfit = dailyProfit * daysElapsed;
    const totalReturn = amount + (dailyProfit * duration);

    const coinKey  = (inv.coin || '').toLowerCase();
    const coinData = COIN_ICONS[coinKey] || {
        symbol: coinKey.toUpperCase().slice(0, 2) || '?',
        bg: 'rgba(0,226,123,0.12)', color: 'var(--color-primary)',
        label: coinKey.toUpperCase()
    };

    const plan     = escapeHtml(inv.method || 'Investment');
    const ref      = escapeHtml(inv.reference || inv.id.slice(0, 8).toUpperCase());
    const startFmt = new Date(inv.start_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    const endFmt   = new Date(inv.end_date).toLocaleDateString('en-US',   { day: '2-digit', month: 'short', year: 'numeric' });

    const isMatured   = daysLeft === 0;
    const statusLabel = isMatured ? 'Matured' : 'Active';
    const statusClass = isMatured ? 'status-matured' : 'status-active';
    const barColor    = isMatured ? 'var(--color-gray-light)' : 'var(--color-primary)';

    return `
    <div class="active-inv-card">
        <div class="active-inv-top">
            <div class="active-inv-coin-icon" style="background:${coinData.bg}; color:${coinData.color};">
                ${coinData.symbol}
            </div>
            <div class="active-inv-top-info">
                <div class="active-inv-plan">${plan}</div>
                <div class="active-inv-coin-label">${escapeHtml(coinData.label)} · ${startFmt} → ${endFmt}</div>
            </div>
            <span class="active-inv-status ${statusClass}">${statusLabel}</span>
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
                         style="width:${progressPct}%; background:${barColor};"></div>
                </div>
                <span class="active-inv-days-label">${daysElapsed} of ${duration} days</span>
            </div>
            <span class="active-inv-daily">+${fmtMoney(dailyProfit)}/day</span>
        </div>

        <div class="active-inv-ref">Ref: ${ref}</div>
    </div>`;
}

function fmtMoney(n) {
    return '$' + parseFloat(n).toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });
}
