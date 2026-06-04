// invest.js — All interactivity for the invest page


// ── STORE SELECTED PLAN FOR MODAL ──
let activePlan = {
    name: '',
    rate: 0,
    roi:  0,
    min:  0,
    max:  0
};

// ── STORE SELECTED CALCULATOR PLAN ──
let calcPlan = {
    name: '',
    rate: 0,
    roi:  0
};

// ── STORE SELECTED COIN IN MODAL ──
let selectedModalCoin = null;


// ================================================================
// LOAD PLANS FROM SUPABASE
// ================================================================

async function loadPlans() {
    const grid = document.getElementById('plansGrid');

    try {
        const { data, error } = await db
            .from('investment_plans')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) throw error;

        const plans = data || [];

        // ── Render plan cards ──
        grid.innerHTML = plans.map(p => {
            const tierClass  = p.tier_class  || 'plan-basic';
            const name       = p.name        || 'Plan';
            const slug       = p.slug        || name.toLowerCase().replace(/\s+/g, '-');
            const dailyRate  = p.daily_rate  != null ? p.daily_rate  : 0;
            const roi        = p.roi_multiplier != null ? p.roi_multiplier : 0;
            const minAmt     = p.min_amount  != null ? p.min_amount  : 0;
            const maxAmt     = p.max_amount  != null ? p.max_amount  : 0;
            const returnType = p.return_type || '—';
            const cancelTime = p.cancel_time || '—';
            const withdraw   = p.withdraw    || '—';
            const badge      = p.badge_label || `Daily ${dailyRate}%`;

            return `
            <article class="plan-card ${tierClass}">
                <div class="plan-card_header">
                    <h2>${escapeHtml(name)}</h2>
                    <div class="plan-card_indicator"></div>
                </div>
                <span class="plan-badge">${escapeHtml(badge)}</span>
                <div class="plan-details">
                    <div class="plan-row">
                        <h3>Investment</h3>
                        <p>$${formatNum(minAmt)} – $${formatNum(maxAmt)}</p>
                    </div>
                    <div class="plan-row">
                        <h3>Return type</h3>
                        <p>${escapeHtml(returnType)}</p>
                    </div>
                    <div class="plan-row">
                        <h3>ROI</h3>
                        <p>${roi}×</p>
                    </div>
                    <div class="plan-row">
                        <h3>Maturity Period</h3>
                        <p>${escapeHtml(withdraw)}</p>
                    </div>
                    <div class="plan-row">
                        <h3>Cancel time</h3>
                        <p>${escapeHtml(cancelTime)}</p>
                    </div>
                </div>
                <button class="invest-now-btn"
                    data-plan="${escapeHtml(slug)}"
                    data-planname="${escapeHtml(name)}"
                    data-min="${minAmt}"
                    data-max="${maxAmt}"
                    data-rate="${dailyRate}"
                    data-roi="${roi}">
                    Invest Now
                </button>
            </article>`;
        }).join('');

        // ── Re-attach invest button listeners ──
        grid.querySelectorAll('.invest-now-btn').forEach(btn => {
            btn.addEventListener('click', () => openInvestModal(btn));
        });

        // ── Populate calculator dropdown ──
        const dropdown = document.getElementById('calcDropdown');
        dropdown.innerHTML = plans.map(p => {
            const name      = p.name || 'Plan';
            const dailyRate = p.daily_rate != null ? p.daily_rate : 0;
            const roi       = p.roi_multiplier != null ? p.roi_multiplier : 0;
            return `<div class="calc-dropdown-item"
                        onclick="selectCalcPlan('${escapeHtml(name)}', ${dailyRate}, ${roi})">
                        ${escapeHtml(name)} <span>Daily ${dailyRate}%</span>
                    </div>`;
        }).join('');

    } catch (err) {
        console.error('Failed to load investment plans:', err.message);
        grid.innerHTML = '<p style="padding:1rem;color:var(--color-danger)">Failed to load plans. Please refresh.</p>';
    }
}

// ── Simple HTML escaper (mirrors admin.js utility) ──
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


// ================================================================
// INVEST NOW MODAL
// ================================================================

function openInvestModal(btn) {
    activePlan.name = btn.dataset.planname || capitalise(btn.dataset.plan);
    activePlan.rate = parseFloat(btn.dataset.rate);
    activePlan.roi  = parseFloat(btn.dataset.roi);
    activePlan.min  = parseFloat(btn.dataset.min);
    activePlan.max  = parseFloat(btn.dataset.max);

    document.getElementById('modalTitle').textContent =
        `Invest in ${activePlan.name}`;
    document.getElementById('modalSubtitle').textContent =
        `Daily ${activePlan.rate}% · ROI ${activePlan.roi}×`;
    document.getElementById('modalRangeHint').textContent =
        `Min $${formatNum(activePlan.min)} – Max $${formatNum(activePlan.max)}`;

    resetModal();

    document.getElementById('modalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeInvestModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    document.body.style.overflow = '';
}

function closeModal(event) {
    if (event.target === document.getElementById('modalOverlay')) {
        closeInvestModal();
    }
}

function resetModal() {
    document.getElementById('modalAmount').value    = '';
    document.getElementById('modalAmount').disabled = true;
    document.getElementById('modalError').textContent = '';

    document.getElementById('modalInputWrapper').classList.add('locked');

    selectedModalCoin = null;
    document.querySelectorAll('.modal-coin').forEach(c => c.classList.remove('selected'));

    const hint = document.getElementById('modalCoinHint');
    hint.textContent = 'Select a coin to continue';
    hint.classList.remove('coin-chosen');

    document.getElementById('modalSuccess').classList.remove('show');
    document.getElementById('modalFooter').style.display      = 'flex';
    document.getElementById('modalConfirmBtn').disabled       = true;
    document.getElementById('modalConfirmBtn').textContent    = 'Confirm Investment';
    document.querySelector('.modal-field').style.display      = 'block';
}


// ================================================================
// COIN SELECTOR
// ================================================================

function selectModalCoin(btn) {
    document.querySelectorAll('.modal-coin').forEach(c => c.classList.remove('selected'));

    btn.classList.add('selected');
    selectedModalCoin = btn.dataset.coin;

    const coinName = btn.getAttribute('title');
    const hint     = document.getElementById('modalCoinHint');
    hint.textContent = `✓ ${coinName} selected`;
    hint.classList.add('coin-chosen');

    const amountInput   = document.getElementById('modalAmount');
    const inputWrapper  = document.getElementById('modalInputWrapper');
    amountInput.disabled = false;
    inputWrapper.classList.remove('locked');
    amountInput.focus();

    validateModalAmount();
}


// ================================================================
// AMOUNT VALIDATION
// ================================================================

function validateModalAmount() {
    const input  = document.getElementById('modalAmount');
    const error  = document.getElementById('modalError');
    const btn    = document.getElementById('modalConfirmBtn');
    const amount = parseFloat(input.value);

    error.textContent = '';
    btn.disabled      = true;

    if (!selectedModalCoin) return;
    if (!input.value)        return;

    if (isNaN(amount) || amount <= 0) {
        error.textContent = 'Please enter a valid amount.';
        return;
    }

    if (amount < activePlan.min) {
        error.textContent = `Minimum investment for this plan is $${formatNum(activePlan.min)}.`;
        return;
    }

    if (amount > activePlan.max) {
        error.textContent = `Maximum investment for this plan is $${formatNum(activePlan.max)}.`;
        return;
    }

    btn.disabled = false;
}


// ================================================================
// CONFIRM INVESTMENT — writes to Supabase transactions table
// ================================================================

async function confirmInvestment() {
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const errorEl    = document.getElementById('modalError');

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const amount      = parseFloat(document.getElementById('modalAmount').value);

    // ── BALANCE CHECK — fetch live balance from Supabase ──
    const { data: userData, error: balanceError } = await db
        .from('users')
        .select('balance')
        .eq('id', currentUser.id)
        .single();

    if (balanceError || !userData) {
        errorEl.textContent = 'Could not verify your balance. Please try again.';
        return;
    }

    const availableBalance = parseFloat(userData.balance || 0);

    if (amount > availableBalance) {
        errorEl.textContent = `Insufficient balance. Your available balance is $${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`;
        return;
    }

    confirmBtn.textContent = 'Submitting...';
    confirmBtn.disabled    = true;
    const reference   = 'INV-' + Date.now().toString(36).toUpperCase();

    const { error } = await db
        .from('transactions')
        .insert([{
            user_id:   currentUser.id,
            type:      'investment',
            amount:    amount,
            coin:      selectedModalCoin,
            status:    'pending',
            note:      `${capitalise(activePlan.name)} plan — ${activePlan.rate}% daily`,
            method:    activePlan.name,
            reference: reference,
        }]);

    if (error) {
        console.error('Investment insert error:', error.message);
        confirmBtn.textContent = 'Confirm Investment';
        confirmBtn.disabled    = false;
        document.getElementById('modalError').textContent = 'Something went wrong. Please try again.';
        return;
    }

    // Show the modal's built-in success state
    document.querySelector('.modal-field').style.display   = 'none';
    document.getElementById('modalFooter').style.display  = 'none';
    // Send pending notification
    const invUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    sendNotification({
        type:   'investment_pending',
        email:  currentUser.email || '',
        name:   currentUser.full_name || currentUser.first_name || 'there',
        amount: amount,
        plan:   activePlan?.name || '',
        coin:   selectedModalCoin || '',
        ref:    reference,
    });

    document.getElementById('modalSuccess').classList.add('show');
}


// ================================================================
// PROFIT CALCULATOR
// ================================================================

function toggleCalcDropdown() {
    document.getElementById('calcDropdown').classList.toggle('open');
    document.getElementById('calcChevron').classList.toggle('open');
}

function selectCalcPlan(name, rate, roi) {
    calcPlan.name = name;
    calcPlan.rate = rate;
    calcPlan.roi  = roi;

    document.getElementById('calcPlanLabel').textContent    = name;
    document.getElementById('calcPlanLabel').style.color    = 'var(--color-dark)';

    document.getElementById('calcDropdown').classList.remove('open');
    document.getElementById('calcChevron').classList.remove('open');

    calculateProfit();
    checkCalculatorReady();
}

function calculateProfit() {
    const amountInput   = document.getElementById('calcAmount');
    const profitDisplay = document.getElementById('calcProfit');
    const amountDisplay = document.getElementById('calcAmountDisplay');
    const error         = document.getElementById('calcError');
    const amount        = parseFloat(amountInput.value);

    amountDisplay.textContent = amountInput.value ? `$${formatNum(amount)}` : '$0.00';
    error.textContent         = '';

    if (!calcPlan.name || !amountInput.value) {
        profitDisplay.textContent = '$0.00';
        checkCalculatorReady();
        return;
    }

    if (isNaN(amount) || amount <= 0) {
        error.textContent         = 'Please enter a valid amount.';
        profitDisplay.textContent = '$0.00';
        return;
    }

    const profit          = amount * (calcPlan.rate / 100) * 30;  // daily_rate × 30 days
    profitDisplay.textContent = `$${formatNum(profit)}`;

    checkCalculatorReady();
}

function checkCalculatorReady() {
    const amount = parseFloat(document.getElementById('calcAmount').value);
    document.getElementById('calculateBtn').disabled = !(calcPlan.name && amount > 0);
}


// ================================================================
// ATTACH INVEST NOW BUTTONS
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadPlans();
});


// ================================================================
// UTILITY FUNCTIONS
// ================================================================

function capitalise(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatNum(num) {
    return Number(num).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// ================================================================
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

// ── Run on page load ──
document.addEventListener('DOMContentLoaded', () => {
    loadActiveInvestments();
});
