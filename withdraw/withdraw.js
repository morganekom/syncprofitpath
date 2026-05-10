// ================================================================
// WITHDRAW.JS — All states and interactions for the withdrawal page
// ================================================================


// ── AVAILABLE BALANCE ──
// Reads from localStorage (set by login.js from Supabase)
const AVAILABLE_BALANCE = parseFloat(localStorage.getItem('userBalance')) || 0;

// ── TRACK FORM STATE ──
let selectedMethod    = null;   // 'bank' or 'crypto'
let withdrawalDetails = {};     // holds saved details from settings


const submitBtn   = document.getElementById('submitBtn');
const amountInput = document.getElementById('withdrawAmount');


// ================================================================
// ON PAGE LOAD
// ================================================================

document.addEventListener('DOMContentLoaded', () => {

    // Update balance display
    document.getElementById('availableBalance').textContent = '$' + formatNum(AVAILABLE_BALANCE);
    document.getElementById('amountMax').textContent        = 'Max: $' + formatNum(AVAILABLE_BALANCE);

    // Read saved withdrawal details from localStorage
    // (written by settings.js when user saves their withdrawal details)
    const savedBank   = JSON.parse(localStorage.getItem('withdrawalBank')   || 'null');
    const savedCrypto = JSON.parse(localStorage.getItem('withdrawalCrypto') || 'null');

    withdrawalDetails.bank   = savedBank;
    withdrawalDetails.crypto = savedCrypto;

    const hasAnyDetails = savedBank || savedCrypto;

    if (!hasAnyDetails) {
        document.getElementById('withdrawEmpty').style.display = 'flex';
        document.getElementById('withdrawForm').style.display  = 'none';
        return;
    }

    document.getElementById('withdrawEmpty').style.display = 'none';
    document.getElementById('withdrawForm').style.display  = 'block';

    // Populate method cards with saved details
    if (savedBank) {
        document.getElementById('bankDetail').textContent =
            `${savedBank.bankName} • ****${savedBank.accountNumber.slice(-4)}`;
    } else {
        document.getElementById('methodBank').classList.add('disabled');
        document.getElementById('bankDetail').textContent = 'Not set up — go to Settings';
    }

    if (savedCrypto) {
        document.getElementById('cryptoDetail').textContent =
            `${savedCrypto.coinName} • ${savedCrypto.walletAddress.slice(0, 8)}...${savedCrypto.walletAddress.slice(-6)}`;
    } else {
        document.getElementById('methodCrypto').classList.add('disabled');
        document.getElementById('cryptoDetail').textContent = 'Not set up — go to Settings';
    }

    amountInput.addEventListener('input', validateAmount);
});


// ================================================================
// METHOD SELECTION
// ================================================================

function selectMethod(type) {
    document.getElementById('methodBank').classList.remove('selected');
    document.getElementById('methodCrypto').classList.remove('selected');
    document.getElementById('methodWarning').textContent = '';

    selectedMethod = type;

    document.getElementById(type === 'bank' ? 'methodBank' : 'methodCrypto')
        .classList.add('selected');

    if (type === 'bank' && !withdrawalDetails.bank) {
        document.getElementById('methodWarning').innerHTML =
            '<i class="uil uil-exclamation-triangle"></i> No bank details found. <a href="../settings/settings.html#withdrawal" style="color:var(--color-primary);font-weight:600;">Add in Settings →</a>';
        selectedMethod = null;
    }

    if (type === 'crypto' && !withdrawalDetails.crypto) {
        document.getElementById('methodWarning').innerHTML =
            '<i class="uil uil-exclamation-triangle"></i> No crypto details found. <a href="../settings/settings.html#withdrawal" style="color:var(--color-primary);font-weight:600;">Add in Settings →</a>';
        selectedMethod = null;
    }

    checkFormReady();
}


// ================================================================
// AMOUNT VALIDATION
// ================================================================

function validateAmount() {
    const val   = parseFloat(amountInput.value);
    const error = document.getElementById('amountError');

    amountInput.classList.remove('input-error');
    error.textContent = '';

    if (!amountInput.value) { checkFormReady(); return; }

    if (isNaN(val) || val <= 0) {
        amountInput.classList.add('input-error');
        error.textContent = 'Please enter a valid amount.';
        checkFormReady();
        return;
    }

    if (val < 10) {
        amountInput.classList.add('input-error');
        error.textContent = 'Minimum withdrawal amount is $10.';
        checkFormReady();
        return;
    }

    if (val > AVAILABLE_BALANCE) {
        amountInput.classList.add('input-error');
        error.textContent = `Amount exceeds your available balance of $${formatNum(AVAILABLE_BALANCE)}.`;
        checkFormReady();
        return;
    }

    checkFormReady();
}


// ================================================================
// CHECK FORM READY
// ================================================================

function checkFormReady() {
    const val       = parseFloat(amountInput.value);
    const hasMethod = selectedMethod !== null;
    const hasAmount = !isNaN(val) && val >= 10 && val <= AVAILABLE_BALANCE;
    const noError   = !document.getElementById('amountError').textContent;

    submitBtn.disabled = !(hasMethod && hasAmount && noError);
}


// ================================================================
// SUBMIT — open confirmation modal
// ================================================================

submitBtn.addEventListener('click', () => {
    const val    = parseFloat(amountInput.value);
    const method = selectedMethod;

    let destination = '';
    if (method === 'bank' && withdrawalDetails.bank) {
        const b     = withdrawalDetails.bank;
        destination = `${b.bankName} • ****${b.accountNumber.slice(-4)}`;
    } else if (method === 'crypto' && withdrawalDetails.crypto) {
        const c     = withdrawalDetails.crypto;
        destination = `${c.coinName} • ${c.walletAddress.slice(0, 8)}...${c.walletAddress.slice(-6)}`;
    }

    document.getElementById('confirmMethod').textContent      = method === 'bank' ? 'Bank Account' : 'Crypto Wallet';
    document.getElementById('confirmDestination').textContent = destination;
    document.getElementById('confirmAmount').textContent      = '$' + formatNum(val);

    document.getElementById('modalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
});


// ================================================================
// CONFIRMATION MODAL
// ================================================================

function closeModal(event) {
    if (event.target === document.getElementById('modalOverlay')) {
        closeWithdrawModal();
    }
}

function closeWithdrawModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    document.body.style.overflow = '';
}

async function confirmWithdrawal() {
    const confirmBtn = document.getElementById('modalConfirmBtn');
    confirmBtn.textContent = 'Submitting...';
    confirmBtn.disabled    = true;

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const amount      = parseFloat(amountInput.value);

    // Build method label for the record
    let methodLabel = selectedMethod;
    let coinLabel   = null;
    if (selectedMethod === 'bank' && withdrawalDetails.bank) {
        methodLabel = withdrawalDetails.bank.bankName;
    } else if (selectedMethod === 'crypto' && withdrawalDetails.crypto) {
        methodLabel = withdrawalDetails.crypto.coinName;
        coinLabel   = withdrawalDetails.crypto.coinValue;
    }

    const reference = 'WDR-' + Date.now().toString(36).toUpperCase();

    const { error } = await db
        .from('transactions')
        .insert([{
            user_id:   currentUser.id,
            type:      'withdrawal',
            amount:    amount,
            coin:      coinLabel,
            status:    'pending',
            note:      'Withdrawal request submitted',
            method:    methodLabel,
            reference: reference,
        }]);

    if (error) {
        console.error('Withdrawal insert error:', error.message);
        confirmBtn.textContent = 'Confirm';
        confirmBtn.disabled    = false;
        document.getElementById('amountError').textContent = 'Something went wrong. Please try again.';
        closeWithdrawModal();
        return;
    }

    closeWithdrawModal();
    showSuccessState();
}


// ================================================================
// SUCCESS STATE
// ================================================================

function showSuccessState() {
    document.getElementById('withdrawForm').style.display = 'none';
    document.getElementById('withdrawSuccess').classList.add('show');
}

function resetWithdraw() {
    selectedMethod = null;

    document.getElementById('methodBank').classList.remove('selected');
    document.getElementById('methodCrypto').classList.remove('selected');
    document.getElementById('methodWarning').textContent = '';

    amountInput.value = '';
    amountInput.classList.remove('input-error');
    document.getElementById('amountError').textContent = '';

    document.getElementById('modalConfirmBtn').textContent = 'Confirm';
    document.getElementById('modalConfirmBtn').disabled    = false;

    submitBtn.disabled = true;

    document.getElementById('withdrawSuccess').classList.remove('show');
    document.getElementById('withdrawForm').style.display = 'block';
}


// ================================================================
// UTILITY
// ================================================================

function formatNum(num) {
    return Number(num).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}