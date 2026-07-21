// invest.js — All interactivity for the invest page


// ── STORE SELECTED PLAN FOR MODAL ──
let activePlan = {
    name: '',
    rate: 0,
    roi:  0,
    min:  0,
    max:  0
};

// ── ASSET CLASS STATE ──
let allPlansCache    = [];   // all plans fetched once
let activeAssetClass = 'crypto';

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
    const grid    = document.getElementById('plansGrid');
    const skelEl  = document.getElementById('plansLoading');

    // Show skeleton, hide grid until data is ready
    if (skelEl) skelEl.style.display = '';
    grid.style.display = 'none';

    try {
        const { data, error } = await db
            .from('investment_plans')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) throw error;

        allPlansCache = data || [];
        renderPlans();

    } catch (err) {
        console.error('Failed to load investment plans:', err.message);
        if (skelEl) skelEl.style.display = 'none';
        grid.style.display = '';
        grid.innerHTML = '<p style="padding:1rem;color:var(--color-danger)">Failed to load plans. Please refresh.</p>';
    }
}


// ── RENDER PLANS (filtered by active asset class) ──
function renderPlans() {
    const grid   = document.getElementById('plansGrid');
    const skelEl = document.getElementById('plansLoading');

    const plans = allPlansCache.filter(p =>
        (p.asset_class || 'crypto') === activeAssetClass
    );

    if (skelEl) skelEl.style.display = 'none';

    if (plans.length === 0) {
        grid.style.display = '';
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:4rem 1rem;color:var(--color-gray-light);">
                <i class="uil uil-chart" style="font-size:4rem;display:block;margin-bottom:1rem;opacity:0.4;"></i>
                <p style="font-size:1.3rem;">No ${activeAssetClass} plans available yet.</p>
            </div>`;

        // Reset calculator
        document.getElementById('calcDropdown').innerHTML = '';
        document.getElementById('calcPlanLabel').textContent = 'No plans available';
        return;
    }

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
            const assetClass = p.asset_class || 'crypto';

            const assetIcons = { crypto: 'uil-bitcoin-circle', stocks: 'uil-chart-line', forex: 'uil-dollar-sign', energy: 'uil-fire' };
            const assetLabels = { crypto: 'Crypto', stocks: 'Stocks', forex: 'Forex', energy: 'Energy' };
            const assetIcon  = assetIcons[assetClass]  || 'uil-chart';
            const assetLabel = assetLabels[assetClass] || assetClass;

            return `
            <article class="plan-card ${tierClass}">
                <div class="plan-card_header">
                    <h2>${escapeHtml(name)}</h2>
                    <div class="plan-card_indicator"></div>
                </div>
                <span class="plan-badge">${escapeHtml(badge)}</span>
                <span class="plan-asset-badge"><i class="uil ${assetIcon}"></i> ${assetLabel}</span>
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

        grid.style.display = '';

        // ── Populate calculator dropdown with current asset class plans ──
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
}


// ── ASSET CLASS TAB SWITCHING ──
function switchAssetTab(assetClass, btn) {
    activeAssetClass = assetClass;

    // Update tab buttons
    document.querySelectorAll('.asset-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    // Re-render with filter
    if (allPlansCache.length > 0) {
        renderPlans();
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
