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