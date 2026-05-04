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
// INVEST NOW MODAL
// ================================================================

function openInvestModal(btn) {
    activePlan.name = btn.dataset.plan;
    activePlan.rate = parseFloat(btn.dataset.rate);
    activePlan.roi  = parseFloat(btn.dataset.roi);
    activePlan.min  = parseFloat(btn.dataset.min);
    activePlan.max  = parseFloat(btn.dataset.max);

    document.getElementById('modalTitle').textContent =
        `Invest in ${capitalise(activePlan.name)} Plan`;
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
    confirmBtn.textContent = 'Submitting...';
    confirmBtn.disabled    = true;

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const amount      = parseFloat(document.getElementById('modalAmount').value);
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

    const profit          = amount * (calcPlan.rate / 100) * calcPlan.roi;
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
    document.querySelectorAll('.invest-now-btn').forEach(btn => {
        btn.addEventListener('click', () => openInvestModal(btn));
    });
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