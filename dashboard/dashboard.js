// ================================================================
// DASHBOARD.JS
// Handles: greeting, balances from Supabase, recent transactions,
// crypto price tickers, KYC alert
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
    checkKycAlert();
    loadCryptoPrices();
});


// ================================================================
// LOAD USER BALANCES FROM SUPABASE
// Fetches the real balance, profit, and pending from the users table
// Falls back to localStorage if not logged in or fetch fails
// ================================================================

async function loadUserBalances() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id;

    const balanceEl = document.getElementById('dashBalance');
    const pendingEl = document.getElementById('dashPending');
    const profitEl  = document.getElementById('dashProfit');

    if (!userId) {
        // Not logged in — show localStorage fallback values
        setBalances(
            parseFloat(localStorage.getItem('userBalance'))  || 0,
            parseFloat(localStorage.getItem('userPending'))  || 0,
            parseFloat(localStorage.getItem('userProfit'))   || 0
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

        // Update localStorage so other pages stay in sync
        localStorage.setItem('userBalance', String(data.balance || 0));
        localStorage.setItem('userProfit',  String(data.profit  || 0));
        localStorage.setItem('userPending', String(data.pending || 0));

        setBalances(data.balance || 0, data.pending || 0, data.profit || 0);

    } catch (err) {
        console.error('Balance fetch error:', err.message);
        // Fall back to last known values from localStorage
        setBalances(
            parseFloat(localStorage.getItem('userBalance'))  || 0,
            parseFloat(localStorage.getItem('userPending'))  || 0,
            parseFloat(localStorage.getItem('userProfit'))   || 0
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
// Shows a warning if user's KYC is not verified
// ================================================================

function checkKycAlert() {
    const kycStatus = localStorage.getItem('kycStatus') || 'unsubmitted';
    const alertEl   = document.getElementById('kycAlert');
    if (!alertEl) return;

    if (kycStatus !== 'verified') {
        alertEl.style.display = 'flex';
    }
}


// ================================================================
// CRYPTO PRICE TICKERS
// Uses CoinGecko public API — free, no key needed
// Updates every 60 seconds
// ================================================================

async function loadCryptoPrices() {
    try {
        const res  = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,solana&vs_currencies=usd&include_24hr_change=true'
        );
        const data = await res.json();

        setCryptoTicker('btc', data.bitcoin?.usd, data.bitcoin?.usd_24h_change);
        setCryptoTicker('eth', data.ethereum?.usd, data.ethereum?.usd_24h_change);
        setCryptoTicker('bnb', data.binancecoin?.usd, data.binancecoin?.usd_24h_change);
        setCryptoTicker('sol', data.solana?.usd, data.solana?.usd_24h_change);

    } catch (err) {
        // API failed silently — tickers stay as dashes
        console.log('Crypto prices unavailable:', err.message);
    }
}

function setCryptoTicker(coin, price, change) {
    const priceEl  = document.getElementById(coin + 'Price');
    const changeEl = document.getElementById(coin + 'Change');
    if (!priceEl || !changeEl) return;

    if (price) {
        priceEl.textContent = '$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }

    if (change !== undefined) {
        const isPositive = change >= 0;
        changeEl.textContent = (isPositive ? '+' : '') + change.toFixed(2) + '%';
        changeEl.className   = isPositive ? 'success' : 'danger';
    }
}

// Refresh prices every 60 seconds
setInterval(loadCryptoPrices, 60000);


// ================================================================
// CHART — BTC & ETH price history (static demo data)
// Replace with real historical data from CoinGecko when ready
// ================================================================

const chartCanvas = document.getElementById('chart');
if (chartCanvas) {
    new Chart(chartCanvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [
                {
                    label: 'BTC',
                    data: [29374, 33537, 49631, 59095, 57828, 36684, 33572, 39972, 39974, 48847, 48116, 61004],
                    borderColor: '#f7931a',
                    backgroundColor: 'rgba(247,147,26,0.05)',
                    borderWidth: 2.5,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                },
                {
                    label: 'ETH',
                    data: [1500, 2700, 3800, 2600, 3100, 1800, 1200, 1600, 1900, 2200, 2800, 2400],
                    borderColor: '#627eea',
                    backgroundColor: 'rgba(98,126,234,0.05)',
                    borderWidth: 2.5,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                }
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { usePointStyle: true, padding: 20 }
                },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: {
                        callback: val => '$' + val.toLocaleString()
                    }
                }
            }
        }
    });
}

// ACTIVE INVESTMENTS — loads user's running investments and renders
// cards with progress bar + daily profit
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
        grid.innerHTML        = investments.map(inv => buildActiveInvCard(inv)).join('');

    } catch (err) {
        console.error('Active investments error:', err.message);
    }
}

// ── Coin icon map — matches the modal and dashboard ticker styles ──
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
    const coinData = COIN_ICONS[coinKey] || { symbol: coinKey.toUpperCase().slice(0,2) || '?', bg: 'rgba(0,226,123,0.12)', color: 'var(--color-primary)', label: coinKey.toUpperCase() };

    const plan     = escapeHtml(inv.method || 'Investment');
    const ref      = escapeHtml(inv.reference || inv.id.slice(0, 8).toUpperCase());
    const startFmt = new Date(inv.start_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    const endFmt   = new Date(inv.end_date).toLocaleDateString('en-US',   { day: '2-digit', month: 'short', year: 'numeric' });

    const isMatured    = daysLeft === 0;
    const statusLabel  = isMatured ? 'Matured' : 'Active';
    const statusClass  = isMatured ? 'status-matured' : 'status-active';
    const barColor     = isMatured ? 'var(--color-gray-light)' : 'var(--color-primary)';

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
