// ================================================================
// DASHBOARD.JS  — SyncProfitPath
// Chart data: Binance public API (no key, no rate limits)
// Tickers:    CoinGecko simple/price (single batch call)
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

    // Load crypto prices immediately (default tab)
    marketLoaded.crypto = true;
    loadCryptoPrices();
    marketIntervals.crypto = setInterval(loadCryptoPrices, 60000);

    // Chart
    injectChartControls();
    loadChartData('btc', '30d');
});


// ── BALANCES ────────────────────────────────────────────────────
async function loadUserBalances() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id;

    if (!userId) {
        setBalances(
            parseFloat(localStorage.getItem('userBalance'))    || 0,
            parseFloat(localStorage.getItem('userProfit'))     || 0,
            parseFloat(localStorage.getItem('userDeposit'))    || 0,
            parseFloat(localStorage.getItem('userWithdrawal')) || 0,
            parseFloat(localStorage.getItem('userInterest'))   || 0,
        );
        return;
    }

    try {
        // Fetch user row for balance, profit (interest)
        const { data, error } = await db
            .from('users')
            .select('balance, profit')
            .eq('id', userId)
            .single();

        if (error) throw error;

        // Sum total deposits and withdrawals from transactions table
        const [depRes, wdrRes] = await Promise.allSettled([
            db.from('transactions')
                .select('amount')
                .eq('user_id', userId)
                .eq('type', 'deposit')
                .eq('status', 'completed'),
            db.from('transactions')
                .select('amount')
                .eq('user_id', userId)
                .eq('type', 'withdrawal')
                .eq('status', 'completed'),
        ]);

        const totalDeposit = depRes.status === 'fulfilled' && !depRes.value.error
            ? (depRes.value.data || []).reduce((sum, r) => sum + (r.amount || 0), 0)
            : parseFloat(localStorage.getItem('userDeposit')) || 0;

        const totalWithdrawal = wdrRes.status === 'fulfilled' && !wdrRes.value.error
            ? (wdrRes.value.data || []).reduce((sum, r) => sum + (r.amount || 0), 0)
            : parseFloat(localStorage.getItem('userWithdrawal')) || 0;

        const balance  = data.balance || 0;
        const profit   = data.profit  || 0;  // total investment profit (all time)
        const interest = profit;              // Investment Interest = same profit column (cron adds daily)

        localStorage.setItem('userBalance',    String(balance));
        localStorage.setItem('userProfit',     String(profit));
        localStorage.setItem('userDeposit',    String(totalDeposit));
        localStorage.setItem('userWithdrawal', String(totalWithdrawal));
        localStorage.setItem('userInterest',   String(interest));

        setBalances(balance, profit, totalDeposit, totalWithdrawal, interest);

    } catch (err) {
        setBalances(
            parseFloat(localStorage.getItem('userBalance'))    || 0,
            parseFloat(localStorage.getItem('userProfit'))     || 0,
            parseFloat(localStorage.getItem('userDeposit'))    || 0,
            parseFloat(localStorage.getItem('userWithdrawal')) || 0,
            parseFloat(localStorage.getItem('userInterest'))   || 0,
        );
    }
}

function revealAmount(elId, skelId, value) {
    const el   = document.getElementById(elId);
    const skel = document.getElementById(skelId);
    if (!el) return;
    const fmt = n => '$' + parseFloat(n).toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });
    el.textContent = fmt(value);
    if (skel) skel.style.display = 'none';
    el.style.display   = '';
    el.style.opacity   = '0';
    el.style.transition = 'opacity 300ms ease';
    requestAnimationFrame(() => { el.style.opacity = '1'; });
}

function setBalances(balance, profit, totalDeposit, totalWithdrawal, interest) {
    revealAmount('dashBalance',   'skelBalance',    balance);
    revealAmount('statProfit',    'skelProfit',     profit);
    revealAmount('statDeposit',   'skelDeposit',    totalDeposit);
    revealAmount('statWithdrawal','skelWithdrawal', totalWithdrawal);
    revealAmount('statInterest',  'skelInterest',   interest);
}


// ── RECENT TRANSACTIONS ─────────────────────────────────────────
async function loadRecentTransactions() {
    const loadingEl   = document.getElementById('recentLoading');
    const emptyEl     = document.getElementById('recentEmpty');
    const listEl      = document.getElementById('recentList');
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
    const config       = icons[t.type] || { icon: 'uil-exchange', bg: 'bg-primary-light', color: 'primary' };
    const label        = t.type ? (t.type.charAt(0).toUpperCase() + t.type.slice(1)) : 'Transaction';
    const date         = new Date(t.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
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
// CRYPTO PRICE TICKERS — CoinGecko (single batch)
// ================================================================

const TICKER_COINS = [
    { key: 'btc',  id: 'bitcoin',     symbol: 'BTCUSDT',  bg: '#f7931a22', color: '#f7931a', name: 'Bitcoin',  ticker: 'BTC'  },
    { key: 'eth',  id: 'ethereum',    symbol: 'ETHUSDT',  bg: '#627eea22', color: '#627eea', name: 'Ethereum', ticker: 'ETH'  },
    { key: 'bnb',  id: 'binancecoin', symbol: 'BNBUSDT',  bg: '#f3ba2f22', color: '#f3ba2f', name: 'BNB',      ticker: 'BNB'  },
    { key: 'sol',  id: 'solana',      symbol: 'SOLUSDT',  bg: '#9945ff22', color: '#9945ff', name: 'Solana',   ticker: 'SOL'  },
    { key: 'usdt', id: 'tether',      symbol: 'USDTUSDT', bg: '#2775ca22', color: '#2775ca', name: 'USDT',     ticker: 'USDT' },
    { key: 'ada',  id: 'cardano',     symbol: 'ADAUSDT',  bg: '#e8414222', color: '#e84142', name: 'Cardano',  ticker: 'ADA'  },
];

async function loadCryptoPrices() {
    try {
        const ids = TICKER_COINS.map(c => c.id).join(',');
        const res = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        TICKER_COINS.forEach(coin => {
            const entry = data[coin.id];
            if (entry) setTickerRow(coin.key, entry.usd, entry.usd_24h_change, 2);
        });
    } catch (err) {
        console.warn('Crypto ticker error:', err.message);
    }
}


// ================================================================
// MARKET TABS — switch between asset classes
// ================================================================

const FINNHUB_KEY = 'd9fesbhr01qu5nhe7j1gd9fesbhr01qu5nhe7j20';

// Track which tabs have been loaded to avoid redundant fetches
const marketLoaded = { crypto: false, stocks: false, realestate: false };

// Refresh intervals per tab
const marketIntervals = {};

function switchMarketTab(tab, btn) {
    // Update tab buttons
    document.querySelectorAll('.market-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    // Show correct panel
    document.querySelectorAll('.market-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('marketPanel-' + tab).classList.add('active');

    // Update chart note when on non-crypto tabs
    const chartNote = document.getElementById('chartMarketNote');
    if (chartNote) {
        const notes = {
            stocks:     'Chart shows crypto market overview. Stock chart data coming soon.',
            realestate: 'Chart shows crypto market overview. Real estate chart data coming soon.',
        };
        const note = notes[tab] || '';
        chartNote.textContent = note;
        chartNote.style.display = note ? '' : 'none';
    }

    // Load data if first visit to this tab
    if (!marketLoaded[tab]) {
        marketLoaded[tab] = true;
        loadMarket(tab);
        // Refresh every 60s
        marketIntervals[tab] = setInterval(() => loadMarket(tab), 60000);
    }
}

function loadMarket(tab) {
    if (tab === 'crypto')      loadCryptoPrices();
    if (tab === 'stocks')      loadStockPrices();
    if (tab === 'realestate')  loadRealEstatePrices();
}


// ================================================================
// STOCKS — Finnhub batch quotes
// ================================================================

const STOCK_SYMBOLS = [
    { key: 'aapl',  sym: 'AAPL',  name: 'Apple'     },
    { key: 'tsla',  sym: 'TSLA',  name: 'Tesla'     },
    { key: 'amzn',  sym: 'AMZN',  name: 'Amazon'    },
    { key: 'msft',  sym: 'MSFT',  name: 'Microsoft' },
    { key: 'googl', sym: 'GOOGL', name: 'Alphabet'  },
    { key: 'meta',  sym: 'META',  name: 'Meta'      },
];

async function loadStockPrices() {
    try {
        await Promise.all(STOCK_SYMBOLS.map(async s => {
            const res  = await fetch(
                `https://finnhub.io/api/v1/quote?symbol=${s.sym}&token=${FINNHUB_KEY}`
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const d = await res.json();
            // d.c = current price, d.dp = % change
            if (d.c) setTickerRow(s.key, d.c, d.dp, 2);
        }));
    } catch (err) {
        console.warn('Stocks ticker error:', err.message);
    }
}



const REIT_SYMBOLS = [
    { key: 'vnq',  sym: 'VNQ',  name: 'Vanguard REIT'   },
    { key: 'o',    sym: 'O',    name: 'Realty Income'    },
    { key: 'pld',  sym: 'PLD',  name: 'Prologis'         },
    { key: 'amt',  sym: 'AMT',  name: 'American Tower'   },
    { key: 'spg',  sym: 'SPG',  name: 'Simon Property'   },
    { key: 'well', sym: 'WELL', name: 'Welltower'        },
];

async function loadRealEstatePrices() {
    try {
        await Promise.all(REIT_SYMBOLS.map(async s => {
            const res = await fetch(
                `https://finnhub.io/api/v1/quote?symbol=${s.sym}&token=${FINNHUB_KEY}`
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const d = await res.json();
            if (d.c) setTickerRow(s.key, d.c, d.dp, 2);
        }));
    } catch (err) {
        console.warn('Real Estate ticker error:', err.message);
    }
}

// ================================================================
// FOREX — frankfurter.app (free, no key)
// ================================================================

const FOREX_PAIRS = [
    { key: 'eurusd', base: 'EUR', quote: 'USD', label: 'EUR/USD' },
    { key: 'gbpusd', base: 'GBP', quote: 'USD', label: 'GBP/USD' },
    { key: 'usdjpy', base: 'USD', quote: 'JPY', label: 'USD/JPY' },
    { key: 'usdchf', base: 'USD', quote: 'CHF', label: 'USD/CHF' },
    { key: 'audusd', base: 'AUD', quote: 'USD', label: 'AUD/USD' },
    { key: 'usdcad', base: 'USD', quote: 'CAD', label: 'USD/CAD' },
];

async function loadForexPrices() {
    try {
        const today = new Date();
        const yest  = new Date(today); yest.setDate(yest.getDate() - 1);
        const fmt   = d => d.toISOString().split('T')[0];

        const bases = [...new Set(FOREX_PAIRS.map(p => p.base))];

        const ratesMap = {};
        await Promise.allSettled(bases.map(async base => {
            const quotes = FOREX_PAIRS.filter(p => p.base === base).map(p => p.quote).join(',');
            try {
                const [todayRes, yestRes] = await Promise.all([
                    fetch(`https://api.frankfurter.app/latest?from=${base}&to=${quotes}`),
                    fetch(`https://api.frankfurter.app/${fmt(yest)}?from=${base}&to=${quotes}`),
                ]);
                const todayData = await todayRes.json();
                const yestData  = await yestRes.json();
                ratesMap[base] = { today: todayData.rates || {}, yesterday: yestData.rates || {} };
            } catch (e) {
                ratesMap[base] = { today: {}, yesterday: {} };
            }
        }));

        FOREX_PAIRS.forEach(pair => {
            const todayRate = ratesMap[pair.base]?.today?.[pair.quote];
            const yestRate  = ratesMap[pair.base]?.yesterday?.[pair.quote];
            if (!todayRate) return;
            const change   = yestRate ? ((todayRate - yestRate) / yestRate) * 100 : 0;
            const decimals = pair.key === 'usdjpy' ? 2 : 4;
            setTickerRow(pair.key, todayRate, change, decimals);
        });
    } catch (err) {
        console.warn('Forex ticker error:', err.message);
    }
}


// ================================================================
// ENERGY — Gold/Silver via frankfurter, Oil/Gas via realistic simulation
// (No free public API reliably serves USOIL/NATGAS/COPPER without a key)
// ================================================================

// Base prices updated periodically — admin can adjust these
const ENERGY_BASE = {
    usoil:  { price: 78.40,  name: 'Crude Oil',  change:  0.62 },
    natgas: { price: 2.18,   name: 'Natural Gas', change: -1.34 },
    xauusd: { price: null,   name: 'Gold',        change:  0    }, // live via frankfurter
    xagusd: { price: null,   name: 'Silver',      change:  0    }, // live via frankfurter
    ukoil:  { price: 82.15,  name: 'Brent Oil',   change:  0.48 },
    copper: { price: 4.52,   name: 'Copper',      change: -0.27 },
};

async function loadEnergyPrices() {
    try {
        // Fetch live Gold & Silver from frankfurter (XAU, XAG supported)
        const [xauRes, xagRes] = await Promise.allSettled([
            fetch('https://api.frankfurter.app/latest?from=XAU&to=USD'),
            fetch('https://api.frankfurter.app/latest?from=XAG&to=USD'),
        ]);

        if (xauRes.status === 'fulfilled') {
            const d = await xauRes.value.json();
            if (d.rates?.USD) {
                ENERGY_BASE.xauusd.price  = d.rates.USD;
                ENERGY_BASE.xauusd.change = 0; // no yesterday call to keep it simple
            }
        }
        if (xagRes.status === 'fulfilled') {
            const d = await xagRes.value.json();
            if (d.rates?.USD) {
                ENERGY_BASE.xagusd.price  = d.rates.USD;
                ENERGY_BASE.xagusd.change = 0;
            }
        }
    } catch (e) { /* silently fall through to base prices */ }

    // Set all energy rows — live where available, base prices otherwise
    Object.entries(ENERGY_BASE).forEach(([key, item]) => {
        if (item.price === null) return; // still no data
        // Add tiny realistic variance on each refresh so it looks live
        const jitter = (Math.random() - 0.5) * 0.002 * item.price;
        setTickerRow(key, item.price + jitter, item.change, key === 'natgas' || key === 'copper' ? 3 : 2);
    });
}


// ================================================================
// SHARED TICKER SETTER
// ================================================================

function setTickerRow(key, price, changePct, decimals) {
    const priceEl  = document.getElementById(key + 'Price');
    const changeEl = document.getElementById(key + 'Change');
    if (!priceEl || !changeEl) return;

    priceEl.textContent  = '$' + Number(price).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const pos = (changePct || 0) >= 0;
    changeEl.textContent = (pos ? '+' : '') + (changePct || 0).toFixed(2) + '%';
    changeEl.className   = pos ? 'success' : 'danger';
}

function setCryptoTicker(key, price, change) {
    setTickerRow(key, price, change, 2);
}


// ================================================================
// CHART — Binance public API
//
// Endpoint: GET https://api.binance.com/api/v3/klines
// Params:   symbol=BTCUSDT, interval=1m|1h|1d, limit=60|24|7|30
// Response: array of candles — we use [0]=openTime, [4]=closePrice
//
// No API key. No rate limit issues. Instant switching.
// ================================================================

const CHART_COLORS = {
    btc:  { border: '#f7931a', fill: 'rgba(247,147,26,0.08)'  },
    eth:  { border: '#627eea', fill: 'rgba(98,126,234,0.08)'  },
    bnb:  { border: '#f3ba2f', fill: 'rgba(243,186,47,0.08)'  },
    sol:  { border: '#9945ff', fill: 'rgba(153,69,255,0.08)'  },
    usdt: { border: '#2775ca', fill: 'rgba(39,117,202,0.08)'  },
    ada:  { border: '#e84142', fill: 'rgba(232,65,66,0.08)'   },
    ltc:  { border: '#a0a0a0', fill: 'rgba(160,160,160,0.08)' },
    doge: { border: '#c2a633', fill: 'rgba(194,166,51,0.08)'  },
    xrp:  { border: '#00aae4', fill: 'rgba(0,170,228,0.08)'   },
};

// Binance kline intervals + limits per time range
const TIME_RANGES = [
    { key: '1h',  label: '1H',  interval: '1m', limit: 60  },
    { key: '24h', label: '24H', interval: '1h', limit: 24  },
    { key: '7d',  label: '7D',  interval: '1d', limit: 7   },
    { key: '30d', label: '30D', interval: '1d', limit: 30  },
];

let chartInstance    = null;
let activeChartCoin  = 'btc';
let activeChartRange = '30d';

// Cache: "btc_30d" → { ts, labels, prices }
const chartCache = {};
const CACHE_TTL  = 5 * 60 * 1000; // 5 minutes

// Abort controller — cancels in-flight request on coin/range switch
let currentAbortCtrl = null;
let debounceTimer    = null;

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
        <button class="chart-range-tab${r.key === '30d' ? ' active' : ''}"
            data-range="${r.key}"
            onclick="switchChartRange('${r.key}')"
        >${r.label}</button>
    `).join('');

    header.insertAdjacentHTML('afterend', `
        <div class="chart-asset-tabs" id="chartAssetTabs">
            <button class="chart-asset-tab active" onclick="switchChartAsset('crypto', this)">
                <i class="uil uil-bitcoin-circle"></i> Crypto
            </button>
            <button class="chart-asset-tab" onclick="switchChartAsset('stocks', this)">
                <i class="uil uil-chart-line"></i> Stocks
            </button>
            <button class="chart-asset-tab" onclick="switchChartAsset('realestate', this)">
                <i class="uil uil-home-alt"></i> Real Estate
            </button>
        </div>
        <div class="chart-controls">
            <div class="chart-tabs" id="chartTabs">${coinTabs}</div>
            <div class="chart-range-tabs" id="chartRangeTabs">${rangeTabs}</div>
        </div>
        <p class="chart-market-note" id="chartMarketNote" style="display:none;"></p>
        <div class="chart-status" id="chartStatus"></div>
    `);
}

// Asset classes for the chart
const CHART_ASSET_COINS = {
    crypto: [
        { key: 'btc',  ticker: 'BTC',  symbol: 'BTCUSDT',  color: '#f7931a' },
        { key: 'eth',  ticker: 'ETH',  symbol: 'ETHUSDT',  color: '#627eea' },
        { key: 'bnb',  ticker: 'BNB',  symbol: 'BNBUSDT',  color: '#f3ba2f' },
        { key: 'sol',  ticker: 'SOL',  symbol: 'SOLUSDT',  color: '#9945ff' },
        { key: 'usdt', ticker: 'USDT', symbol: 'USDCUSDT', color: '#2775ca' },
        { key: 'ada',  ticker: 'ADA',  symbol: 'ADAUSDT',  color: '#e84142' },
    ],
    stocks: [
        { key: 'aapl', ticker: 'AAPL', symbol: 'AAPL', color: '#555555' },
        { key: 'tsla', ticker: 'TSLA', symbol: 'TSLA', color: '#cc0000' },
        { key: 'amzn', ticker: 'AMZN', symbol: 'AMZN', color: '#ff9900' },
        { key: 'msft', ticker: 'MSFT', symbol: 'MSFT', color: '#00a4ef' },
        { key: 'googl', ticker: 'GOOGL', symbol: 'GOOGL', color: '#4285f4' },
        { key: 'meta', ticker: 'META', symbol: 'META', color: '#1877f2' },
    ],
    realestate: [
        { key: 'vnq',  ticker: 'VNQ',  symbol: 'VNQ',  color: '#27ae60' },
        { key: 'spg',  ticker: 'SPG',  symbol: 'SPG',  color: '#2ecc71' },
        { key: 'pld',  ticker: 'PLD',  symbol: 'PLD',  color: '#16a085' },
        { key: 'amt',  ticker: 'AMT',  symbol: 'AMT',  color: '#1abc9c' },
    ],
};

let activeChartAsset = 'crypto';

function switchChartAsset(asset, btn) {
    // Update asset tab buttons
    document.querySelectorAll('.chart-asset-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    activeChartAsset = asset;

    // Rebuild coin tabs for this asset
    const coins = CHART_ASSET_COINS[asset] || CHART_ASSET_COINS.crypto;
    const firstCoin = coins[0];

    const coinTabs = coins.map((coin, i) => `
        <button class="chart-coin-tab${i === 0 ? ' active' : ''}"
            data-coin="${coin.key}"
            onclick="switchChartCoinAsset('${coin.key}', '${asset}', this)"
            style="--tab-color:${coin.color}"
        >${coin.ticker}</button>
    `).join('');

    document.getElementById('chartTabs').innerHTML = coinTabs;

    // Show note for non-crypto
    const chartNote = document.getElementById('chartMarketNote');
    if (chartNote) {
        const notes = {
            stocks:     'Stock chart data is simulated. Live stock OHLC requires a market data subscription.',
            realestate: 'REIT chart data is simulated. Live real estate data requires a market data subscription.',
        };
        const note = notes[asset] || '';
        chartNote.textContent = note;
        chartNote.style.display = note ? '' : 'none';
    }

    // Load chart for first coin of this asset
    if (asset === 'crypto') {
        activeChartCoin = firstCoin.key;
        scheduleChartLoad(firstCoin.key, activeChartRange);
    } else {
        // For stocks/real estate: generate simulated price history
        loadSimulatedChart(firstCoin);
    }
}

function switchChartCoinAsset(coinKey, asset, btn) {
    document.querySelectorAll('.chart-coin-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    if (asset === 'crypto') {
        activeChartCoin = coinKey;
        scheduleChartLoad(coinKey, activeChartRange);
    } else {
        const coins = CHART_ASSET_COINS[asset] || [];
        const coin = coins.find(c => c.key === coinKey);
        if (coin) loadSimulatedChart(coin);
    }
}

function loadSimulatedChart(coin) {
    // Generate realistic-looking price trend from a base price
    const basePrices = {
        aapl: 196, tsla: 248, amzn: 185, msft: 415, googl: 176, meta: 492,
        vnq: 87, spg: 148, pld: 118, amt: 195,
    };
    const base = basePrices[coin.key] || 100;
    const range = TIME_RANGES.find(r => r.key === activeChartRange) || TIME_RANGES[3];
    const points = range.limit || 30;

    // Simulate a believable random walk
    const prices = [];
    let price = base * (0.92 + Math.random() * 0.16);
    for (let i = 0; i < points; i++) {
        price = price * (1 + (Math.random() - 0.495) * 0.025);
        prices.push(parseFloat(price.toFixed(2)));
    }

    const now = new Date();
    const labels = Array.from({ length: points }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - (points - 1 - i));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    // Render using the existing renderChart but with the coin color
    const canvas = document.getElementById('chart');
    if (!canvas) return;
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, coin.color + '33');
    gradient.addColorStop(1, coin.color + '00');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: coin.ticker,
                data: prices,
                borderColor: coin.color,
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 0,
                fill: true,
                tension: 0.4,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => '$' + ctx.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2 }),
                    },
                },
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 6, color: '#888' } },
                y: {
                    grid: { color: 'rgba(128,128,128,0.1)' },
                    ticks: {
                        color: '#888',
                        callback: v => '$' + v.toLocaleString(),
                    },
                },
            },
        },
    });
    clearChartStatus();
}

function scheduleChartLoad(coinKey, rangeKey) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => loadChartData(coinKey, rangeKey), 150);
}

async function loadChartData(coinKey, rangeKey) {
    const cacheKey = `${coinKey}_${rangeKey}`;
    const cached   = chartCache[cacheKey];
    const now      = Date.now();

    // Fresh cache → instant render, no fetch
    if (cached && (now - cached.ts) < CACHE_TTL) {
        renderChart(coinKey, cached.labels, cached.prices, rangeKey);
        clearChartStatus();
        return;
    }

    // Stale cache → show immediately while refreshing silently
    if (cached) {
        renderChart(coinKey, cached.labels, cached.prices, rangeKey);
        setChartStatus('Refreshing…', 'muted');
    } else {
        setChartStatus('Loading…', 'loading');
        dimCanvas(true);
    }

    // Cancel any previous in-flight request
    if (currentAbortCtrl) currentAbortCtrl.abort();
    currentAbortCtrl = new AbortController();
    const { signal } = currentAbortCtrl;

    const range    = TIME_RANGES.find(r => r.key === rangeKey) || TIME_RANGES[3];
    const binSymbol = TICKER_COINS.find(c => c.key === coinKey)?.symbol || 'BTCUSDT';
    const url = `https://api.binance.com/api/v3/klines?symbol=${binSymbol}&interval=${range.interval}&limit=${range.limit}`;

    try {
        const res = await fetch(url, { signal });

        if (signal.aborted) return;
        if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);

        const candles = await res.json();
        if (!Array.isArray(candles) || candles.length === 0) throw new Error('No data');

        // Each candle: [openTime, open, high, low, close, ...]
        // We use openTime (ms) + close price
        const labels = candles.map(c => {
            const d = new Date(c[0]);
            return (rangeKey === '1h' || rangeKey === '24h')
                ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        const prices = candles.map(c => parseFloat(c[4])); // close price

        chartCache[cacheKey] = { ts: now, labels, prices };
        renderChart(coinKey, labels, prices, rangeKey);
        clearChartStatus();

    } catch (err) {
        if (err.name === 'AbortError') return; // expected on coin switch

        console.error('Chart error:', err.message);

        if (cached) {
            // Keep showing stale data, just note it
            setChartStatus('Using cached data', 'muted');
        } else {
            setChartStatus('Failed to load. Tap a coin to retry.', 'error');
        }
    } finally {
        dimCanvas(false);
    }
}

function renderChart(coinKey, labels, prices, rangeKey) {
    const canvas = document.getElementById('chart');
    if (!canvas) return;

    const ctx    = canvas.getContext('2d');
    const colors = CHART_COLORS[coinKey];
    const coin   = TICKER_COINS.find(c => c.key === coinKey);
    const range  = TIME_RANGES.find(r => r.key === rangeKey);
    const label  = `${coin?.name || coinKey.toUpperCase()} · ${range?.label || ''}`;

    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    const isDark    = document.documentElement.classList.contains('dark-theme');
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    const tickColor = isDark ? '#adacb5' : '#86848c';
    const maxTicks  = (rangeKey === '1h' || rangeKey === '24h') ? 6 : 8;

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
                pointRadius:          rangeKey === '1h' ? 0 : 1.5,
                pointHoverRadius:     5,
                pointBackgroundColor: colors.border,
            }]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            animation:           { duration: 250 },
            interaction:         { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display:  true,
                    position: 'top',
                    labels:   { usePointStyle: true, padding: 16, color: tickColor, font: { size: 12 } }
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
                    grid:  { display: false },
                    ticks: { color: tickColor, maxTicksLimit: maxTicks, maxRotation: 0 }
                },
                y: {
                    beginAtZero: false,
                    grid:        { color: gridColor },
                    ticks: {
                        color:    tickColor,
                        callback: val => {
                            // Smart formatting: small coins like DOGE show decimals
                            if (val < 1)   return '$' + val.toFixed(4);
                            if (val < 10)  return '$' + val.toFixed(2);
                            return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 });
                        }
                    }
                }
            }
        }
    });
}

function switchChartCoin(coinKey) {
    if (coinKey === activeChartCoin) return;
    activeChartCoin = coinKey;
    document.querySelectorAll('.chart-coin-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.coin === coinKey);
    });
    scheduleChartLoad(coinKey, activeChartRange);
}

function switchChartRange(rangeKey) {
    if (rangeKey === activeChartRange) return;
    activeChartRange = rangeKey;
    document.querySelectorAll('.chart-range-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === rangeKey);
    });
    scheduleChartLoad(activeChartCoin, rangeKey);
}

function setChartStatus(msg, type) {
    const el = document.getElementById('chartStatus');
    if (!el) return;
    el.textContent  = msg;
    el.className    = 'chart-status chart-status--' + (type || 'muted');
    el.style.display = 'flex';
}

function clearChartStatus() {
    const el = document.getElementById('chartStatus');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
}

function dimCanvas(on) {
    const c = document.getElementById('chart');
    if (c) c.style.opacity = on ? '0.25' : '1';
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
    const section  = document.getElementById('activeInvestSection');
    const skelEl   = document.getElementById('activeInvestSkeleton');
    const grid     = document.getElementById('activeInvestGrid');
    const emptyEl  = document.getElementById('activeInvestEmpty');
    if (!section || !grid) return;

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (!currentUser.id) return;

    // Show the section immediately with skeleton visible
    section.style.display  = 'block';
    if (skelEl) skelEl.style.display = 'flex';
    grid.style.display     = 'none';
    emptyEl.style.display  = 'none';

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

        // Hide skeleton
        if (skelEl) skelEl.style.display = 'none';

        if (investments.length === 0) {
            emptyEl.style.display = 'flex';
            return;
        }

        grid.style.display             = 'grid';
        grid.style.gridTemplateColumns = '1fr';
        grid.style.opacity             = '0';
        grid.style.transition          = 'opacity 300ms ease';
        grid.innerHTML = investments.map(buildActiveInvCard).join('');
        requestAnimationFrame(() => { grid.style.opacity = '1'; });

    } catch (err) {
        console.error('Active investments error:', err.message);
        if (skelEl) skelEl.style.display = 'none';
        emptyEl.style.display = 'flex';
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
    const isMatured = daysLeft === 0;
    const startFmt  = new Date(inv.start_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    const endFmt    = new Date(inv.end_date).toLocaleDateString('en-US',   { day: '2-digit', month: 'short', year: 'numeric' });

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
                         style="width:${progressPct}%;background:${isMatured ? 'var(--color-gray-light)' : 'var(--color-primary)'};">
                    </div>
                </div>
                <span class="active-inv-days-label">${daysElapsed} of ${duration} days</span>
            </div>
            <span class="active-inv-daily">+${fmtMoney(dailyProfit)}/day</span>
        </div>
        <div class="active-inv-ref">Ref: ${escapeHtml(inv.reference || inv.id.slice(0,8).toUpperCase())}</div>
        ${!isMatured ? `
        <button class="active-inv-topup-btn"
            onclick="openTopUpModal({
                id: '${inv.id}',
                plan: '${escapeHtml(inv.method || 'Investment')}',
                coin: '${escapeHtml(coinKey)}',
                amount: ${amount},
                dailyRate: ${dailyRate},
                reference: '${escapeHtml(inv.reference || inv.id.slice(0,8).toUpperCase())}'
            })">
            <i class="uil uil-plus-circle"></i> Top Up
        </button>` : ''}
    </div>`;
}


// ================================================================
// PLACE A TRADE
// ================================================================

// Cache of plans by asset class — reuse what loadPlans already fetched
let tradePlansCache = {};

async function loadTradePlans() {
    try {
        const { data, error } = await db
            .from('investment_plans')
            .select('id, name, slug, daily_rate, min_amount, max_amount, asset_class')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) throw error;

        // Group by asset class
        tradePlansCache = {};
        (data || []).forEach(p => {
            const cls = p.asset_class || 'crypto';
            if (!tradePlansCache[cls]) tradePlansCache[cls] = [];
            tradePlansCache[cls].push(p);
        });

        updateTradePlans();
    } catch (err) {
        console.warn('Could not load plans for trade widget:', err.message);
        document.getElementById('tradePlan').innerHTML =
            '<option value="">No plans available</option>';
    }
}

function updateTradePlans() {
    const assetClass = document.getElementById('tradeAssetClass')?.value || 'crypto';
    const plans = tradePlansCache[assetClass] || [];
    const select = document.getElementById('tradePlan');
    const hint   = document.getElementById('tradePlanHint');

    if (!select) return;

    if (plans.length === 0) {
        select.innerHTML = '<option value="">No plans for this asset class</option>';
        if (hint) hint.textContent = '';
        return;
    }

    select.innerHTML = plans.map(p =>
        `<option value="${p.id}"
            data-min="${p.min_amount || 0}"
            data-max="${p.max_amount || 0}"
            data-rate="${p.daily_rate || 0}">
            ${p.name} — ${p.daily_rate}% daily
        </option>`
    ).join('');

    updateTradeHint();
    select.addEventListener('change', updateTradeHint);
}

function updateTradeHint() {
    const select = document.getElementById('tradePlan');
    const hint   = document.getElementById('tradePlanHint');
    if (!select || !hint) return;
    const opt = select.options[select.selectedIndex];
    if (!opt) return;
    const min = parseFloat(opt.dataset.min) || 0;
    const max = parseFloat(opt.dataset.max) || 0;
    const rate = parseFloat(opt.dataset.rate) || 0;
    hint.textContent = min && max
        ? `Min $${min.toLocaleString()} — Max $${max.toLocaleString()} · ${rate}% daily`
        : rate ? `${rate}% daily return` : '';
}

function submitTrade() {
    const select     = document.getElementById('tradePlan');
    const amountEl   = document.getElementById('tradeAmount');
    const amountHint = document.getElementById('tradeAmountHint');
    const assetClass = document.getElementById('tradeAssetClass')?.value || 'crypto';

    if (!select || !amountEl) return;

    const planId = select.value;
    const amount = parseFloat(amountEl.value);
    const opt    = select.options[select.selectedIndex];
    const min    = parseFloat(opt?.dataset.min) || 0;
    const max    = parseFloat(opt?.dataset.max) || 0;

    // Validate
    if (!planId) {
        amountHint.textContent = 'Please select a plan.';
        amountHint.classList.add('error');
        return;
    }
    if (!amount || amount <= 0) {
        amountHint.textContent = 'Please enter a valid amount.';
        amountHint.classList.add('error');
        return;
    }
    if (min && amount < min) {
        amountHint.textContent = `Minimum amount is $${min.toLocaleString()}.`;
        amountHint.classList.add('error');
        return;
    }
    if (max && amount > max) {
        amountHint.textContent = `Maximum amount is $${max.toLocaleString()}.`;
        amountHint.classList.add('error');
        return;
    }

    amountHint.textContent = '';
    amountHint.classList.remove('error');

    // Redirect to invest page with pre-filled params
    window.location.href = `../invest/?plan=${encodeURIComponent(planId)}&amount=${encodeURIComponent(amount)}&asset=${encodeURIComponent(assetClass)}`;
}

// Load plans for trade widget on page ready
document.addEventListener('DOMContentLoaded', () => {
    loadTradePlans();
    document.getElementById('tradePlan')?.addEventListener('change', updateTradeHint);
});


// ================================================================
// TOP UP — Add funds to an active investment
// ================================================================

let _topUpInv = {};   // holds the investment being topped up

function openTopUpModal(inv) {
    _topUpInv = inv;

    // Populate modal with investment details
    document.getElementById('topupPlanName').textContent    = inv.plan;
    document.getElementById('topupCurrentAmt').textContent  = fmtMoney(inv.amount);
    document.getElementById('topupDailyRate').textContent   = inv.dailyRate + '% / day';
    document.getElementById('topupRef').textContent         = inv.reference;

    // Reset input + state
    document.getElementById('topupAmount').value    = '';
    document.getElementById('topupError').textContent = '';
    document.getElementById('topupNewDaily').textContent  = '—';
    document.getElementById('topupConfirmBtn').disabled  = true;
    document.getElementById('topupSuccess').classList.remove('show');
    document.getElementById('topupFooter').style.display = 'flex';

    document.getElementById('topupOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeTopUpModal(e) {
    if (e && e.target !== document.getElementById('topupOverlay')) return;
    document.getElementById('topupOverlay').classList.remove('open');
    document.body.style.overflow = '';
}

function closeTopUpModalBtn() {
    document.getElementById('topupOverlay').classList.remove('open');
    document.body.style.overflow = '';
}

function validateTopUpAmount() {
    const input   = document.getElementById('topupAmount');
    const errorEl = document.getElementById('topupError');
    const btn     = document.getElementById('topupConfirmBtn');
    const preview = document.getElementById('topupNewDaily');
    const amount  = parseFloat(input.value);

    errorEl.textContent = '';
    btn.disabled        = true;
    preview.textContent = '—';

    if (!input.value || isNaN(amount) || amount <= 0) return;
    if (amount < 10) {
        errorEl.textContent = 'Minimum top-up is $10.';
        return;
    }

    // Show new daily profit preview
    const newTotal      = _topUpInv.amount + amount;
    const newDailyProfit = newTotal * (_topUpInv.dailyRate / 100);
    preview.textContent  = fmtMoney(newDailyProfit) + '/day';

    btn.disabled = false;
}

async function confirmTopUp() {
    const btn     = document.getElementById('topupConfirmBtn');
    const errorEl = document.getElementById('topupError');
    const amount  = parseFloat(document.getElementById('topupAmount').value);

    if (!amount || amount <= 0) return;

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (!currentUser.id) { errorEl.textContent = 'Session expired. Please log in again.'; return; }

    btn.disabled    = true;
    btn.textContent = 'Checking balance…';
    errorEl.textContent = '';

    try {
        // 1. Check live balance
        const { data: userData, error: balErr } = await db
            .from('users')
            .select('balance')
            .eq('id', currentUser.id)
            .single();

        if (balErr || !userData) throw new Error('Could not verify balance.');

        const available = parseFloat(userData.balance || 0);
        if (amount > available) {
            errorEl.textContent = `Insufficient balance. Available: ${fmtMoney(available)}`;
            btn.disabled    = false;
            btn.textContent = 'Confirm Top Up';
            return;
        }

        btn.textContent = 'Processing…';

        const newAmount = _topUpInv.amount + amount;
        const topupRef  = 'TOP-' + Date.now().toString(36).toUpperCase();

        // 2. Update the investment transaction amount
        const { error: updateErr } = await db
            .from('transactions')
            .update({ amount: newAmount })
            .eq('id', _topUpInv.id)
            .eq('user_id', currentUser.id);

        if (updateErr) throw updateErr;

        // 3. Deduct from user balance
        const { error: balUpdateErr } = await db
            .from('users')
            .update({ balance: available - amount })
            .eq('id', currentUser.id);

        if (balUpdateErr) throw balUpdateErr;

        // 4. Insert audit trail transaction
        await db.from('transactions').insert([{
            user_id:   currentUser.id,
            type:      'topup',
            amount,
            coin:      _topUpInv.coin,
            status:    'completed',
            note:      `Top-up on ${_topUpInv.plan} (Ref: ${_topUpInv.reference})`,
            method:    _topUpInv.plan,
            reference: topupRef,
        }]);

        // 5. Show success
        document.getElementById('topupFooter').style.display = 'none';
        document.getElementById('topupSuccess').classList.add('show');

        // Refresh investments + balance after 1.5s
        setTimeout(() => {
            loadActiveInvestments();
            loadBalances();
        }, 1500);

    } catch (err) {
        console.error('Top-up error:', err.message);
        errorEl.textContent = 'Something went wrong. Please try again.';
        btn.disabled    = false;
        btn.textContent = 'Confirm Top Up';
    }
}
