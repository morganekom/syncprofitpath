// ================================================================
// DEPOSIT.JS — All form states and interactions
// ================================================================


// ── TRACK FORM COMPLETION ──
let selectedCurrency = null;   // crypto selected (btc, eth, etc)
let amountEntered    = false;  // local currency amount is valid
let fileUploaded     = false;  // proof file picked

// ── CURRENCY STATE ──
let localCurrency    = 'USD';  // user's chosen local currency
let localSymbol      = '$';    // display symbol
let exchangeRates    = null;   // rates relative to USD (fetched once)
let usdAmount        = 0;      // converted USD amount to store in DB

const submitBtn   = document.getElementById('submitBtn');
const amountInput = document.getElementById('amountInput');
const fieldError  = document.getElementById('amountError');


// ================================================================
// FETCH EXCHANGE RATES ON PAGE LOAD
// ================================================================

async function fetchRates() {
    const statusEl = document.getElementById('rateStatus');
    statusEl.textContent = 'Fetching rates…';
    statusEl.style.color = 'var(--color-gray-light)';

    try {
        // Free API — no key needed, updates daily
        const res  = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();

        if (data.result !== 'success') throw new Error('Bad response');

        exchangeRates = data.rates;
        statusEl.textContent = '✓ Live rate';
        statusEl.style.color = 'var(--color-success)';

        // Auto-select USD as default
        onCurrencyChange();

    } catch (err) {
        console.warn('Rate fetch failed:', err.message);
        // Fallback — treat everything as USD
        exchangeRates = { USD: 1 };
        statusEl.textContent = 'Rate unavailable — using USD';
        statusEl.style.color = 'var(--color-warning)';
        onCurrencyChange();
    }
}

document.addEventListener('DOMContentLoaded', fetchRates);


// ================================================================
// CURRENCY SELECTOR CHANGE
// ================================================================

function onCurrencyChange() {
    const select    = document.getElementById('localCurrencySelect');
    const selected  = select.options[select.selectedIndex];

    localCurrency   = selected.value;
    localSymbol     = selected.dataset.symbol || selected.value;

    // Update the $ symbol next to the input
    const symbolEl  = document.getElementById('currencySymbol');
    if (symbolEl) symbolEl.textContent = localSymbol;

    // Re-validate amount with new currency
    if (amountInput.value) updateUsdPreview();
}


// ================================================================
// CONVERT LOCAL → USD
// ================================================================

function toUSD(localAmount) {
    if (!exchangeRates || localCurrency === 'USD') return localAmount;
    const rate = exchangeRates[localCurrency];
    if (!rate || rate === 0) return localAmount; // fallback
    return localAmount / rate;
}

function updateUsdPreview() {
    const val       = parseFloat(amountInput.value);
    const previewEl = document.getElementById('usdPreview');
    const usdEl     = document.getElementById('usdEquivalent');

    if (!val || isNaN(val) || val <= 0) {
        previewEl.style.display = 'none';
        usdAmount = 0;
        return;
    }

    usdAmount = toUSD(val);

    if (localCurrency === 'USD') {
        previewEl.style.display = 'none';
    } else {
        previewEl.style.display = 'flex';
        usdEl.textContent = '$' + usdAmount.toLocaleString('en-US', {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        });
    }
}


// ================================================================
// CURRENCY TOGGLE (crypto payment method)
// ================================================================

function toggleCurrency(headerEl) {
    const option    = headerEl.closest('.currency-option');
    const wasActive = option.classList.contains('active');

    document.querySelectorAll('.currency-option.active').forEach(el => {
        el.classList.remove('active');
    });

    if (!wasActive) {
        option.classList.add('active');
        selectedCurrency = option.dataset.currency;
    } else {
        selectedCurrency = null;
    }

    checkFormReady();
}


// ================================================================
// COPY WALLET ADDRESS
// ================================================================

function copyAddress(btn) {
    const address = btn.closest('.wallet-row').querySelector('.wallet-address').textContent;
    navigator.clipboard.writeText(address).then(() => {
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 2000);
    });
}


// ================================================================
// AMOUNT INPUT — live validation
// ================================================================

amountInput.addEventListener('input', () => {
    const val = parseFloat(amountInput.value);

    amountInput.classList.remove('input-error');
    fieldError.textContent = '';
    amountEntered = false;

    if (amountInput.value === '') {
        document.getElementById('usdPreview').style.display = 'none';
        usdAmount = 0;
        checkFormReady();
        return;
    }

    if (isNaN(val) || val <= 0) {
        amountInput.classList.add('input-error');
        fieldError.textContent = 'Please enter a valid amount greater than 0.';
        checkFormReady();
        return;
    }

    // Convert to USD for minimum check
    const usdVal = toUSD(val);

    if (usdVal < 10) {
        amountInput.classList.add('input-error');
        fieldError.textContent = `Minimum deposit is $10 USD. Please enter a higher amount.`;
        checkFormReady();
        return;
    }

    updateUsdPreview();
    amountEntered = true;
    checkFormReady();
});


// ================================================================
// FILE UPLOAD
// ================================================================

function showFileName(input) {
    const uploadLabel     = document.querySelector('.file-upload-label');
    const labelStrong     = uploadLabel.querySelector('strong');
    const labelSub        = uploadLabel.querySelector('div');
    const fileNameDisplay = document.getElementById('fileNameDisplay');

    if (input.files[0]) {
        const name = input.files[0].name;
        labelStrong.textContent     = name.length > 32 ? name.slice(0, 29) + '…' : name;
        labelSub.textContent        = 'File selected — click to change';
        fileNameDisplay.textContent = '✓ Ready to upload';
        fileNameDisplay.style.color = 'var(--color-success)';
        uploadLabel.classList.remove('upload-error');
        uploadLabel.classList.add('file-chosen');
        fileUploaded = true;
    } else {
        labelStrong.textContent     = 'Choose file';
        labelSub.textContent        = 'No file chosen';
        fileNameDisplay.textContent = '';
        fileNameDisplay.style.color = '';
        uploadLabel.classList.remove('file-chosen');
        fileUploaded = false;
    }

    checkFormReady();
}


// ================================================================
// CHECK FORM READY
// ================================================================

function checkFormReady() {
    submitBtn.disabled = !(selectedCurrency && amountEntered && fileUploaded);
}


// ================================================================
// SUBMIT — shows confirmation modal
// ================================================================

submitBtn.addEventListener('click', () => {
    let hasError = false;

    if (!selectedCurrency) hasError = true;

    if (!amountEntered) {
        amountInput.classList.add('input-error');
        fieldError.textContent = 'Please enter a deposit amount.';
        hasError = true;
    }

    if (!fileUploaded) {
        document.querySelector('.file-upload-label').classList.add('upload-error');
        hasError = true;
    }

    if (hasError) return;

    const localVal  = parseFloat(amountInput.value);
    const usdVal    = toUSD(localVal);
    const fileName  = document.getElementById('proofFile').files[0]?.name || '';

    // Show local amount + USD equivalent in modal
    const localFormatted = localSymbol + localVal.toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });
    const usdFormatted = '$' + usdVal.toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });

    document.getElementById('confirmCoin').textContent   = selectedCurrency.toUpperCase();
    document.getElementById('confirmAmount').textContent =
        localCurrency === 'USD'
            ? usdFormatted
            : `${localFormatted} (${usdFormatted} USD)`;
    document.getElementById('confirmFile').textContent   = fileName;

    document.getElementById('modalOverlay').classList.add('open');
});


// ================================================================
// CONFIRMATION MODAL
// ================================================================

function closeModal(event) {
    if (event.target === document.getElementById('modalOverlay')) {
        closeDepositModal();
    }
}

function closeDepositModal() {
    document.getElementById('modalOverlay').classList.remove('open');
}

async function confirmDeposit() {
    const confirmBtn       = document.getElementById('modalConfirmBtn');
    confirmBtn.textContent = 'Submitting...';
    confirmBtn.disabled    = true;

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const localVal    = parseFloat(amountInput.value);
    const usdVal      = parseFloat(toUSD(localVal).toFixed(2)); // stored in DB as USD
    const reference   = 'DEP-' + Date.now().toString(36).toUpperCase();
    const proofFile   = document.getElementById('proofFile').files[0];


    // ── STEP 1: Upload proof of payment ──
    let proofUrl = null;

    if (proofFile) {
        const ext      = proofFile.name.split('.').pop();
        const filePath = `${currentUser.id}/${reference}.${ext}`;

        const { error: uploadError } = await db
            .storage
            .from('deposit-proofs')
            .upload(filePath, proofFile, { upsert: false });

        if (uploadError) {
            console.error('Upload error:', uploadError.message);
            confirmBtn.textContent = 'Confirm Deposit';
            confirmBtn.disabled    = false;
            document.getElementById('amountError').textContent =
                'Failed to upload proof. Please try again.';
            closeDepositModal();
            return;
        }

        const { data: urlData } = db
            .storage
            .from('deposit-proofs')
            .getPublicUrl(filePath);

        proofUrl = urlData?.publicUrl || null;
    }


    // ── STEP 2: Insert transaction — amount stored as USD ──
    const { error: txError } = await db
        .from('transactions')
        .insert([{
            user_id:   currentUser.id,
            type:      'deposit',
            amount:    usdVal,                       // always USD in DB
            coin:      selectedCurrency,
            status:    'pending',
            note:      localCurrency !== 'USD'
                ? `Deposited ${localSymbol}${localVal.toFixed(2)} ${localCurrency} → $${usdVal.toFixed(2)} USD`
                : 'Awaiting confirmation',
            method:    selectedCurrency,
            reference: reference,
            proof_url: proofUrl,
        }]);

    if (txError) {
        console.error('Transaction insert error:', txError.message);
        confirmBtn.textContent = 'Confirm Deposit';
        confirmBtn.disabled    = false;
        document.getElementById('amountError').textContent =
            'Something went wrong saving your deposit. Please try again.';
        closeDepositModal();
        return;
    }


    // ── STEP 3: Increment user's pending balance (in USD) ──
    const currentPending = parseFloat(localStorage.getItem('userPending')) || 0;
    const newPending     = currentPending + usdVal;

    const { error: userError } = await db
        .from('users')
        .update({ pending: newPending })
        .eq('id', currentUser.id);

    if (userError) {
        console.warn('Pending balance update failed:', userError.message);
    } else {
        localStorage.setItem('userPending', String(newPending));
    }


    closeDepositModal();
    showSuccessState();
}


// ================================================================
// SUCCESS STATE
// ================================================================

function showSuccessState() {
    document.getElementById('depositForm').style.display = 'none';
    document.getElementById('depositSuccess').classList.add('show');
}

function resetDeposit() {
    selectedCurrency = null;
    amountEntered    = false;
    fileUploaded     = false;
    usdAmount        = 0;

    amountInput.value = '';
    amountInput.classList.remove('input-error');
    fieldError.textContent = '';

    document.getElementById('usdPreview').style.display = 'none';

    const uploadLabel     = document.querySelector('.file-upload-label');
    const labelStrong     = uploadLabel.querySelector('strong');
    const labelSub        = uploadLabel.querySelector('div');
    const fileNameDisplay = document.getElementById('fileNameDisplay');

    document.getElementById('proofFile').value = '';
    labelStrong.textContent     = 'Choose file';
    labelSub.textContent        = 'No file chosen';
    fileNameDisplay.textContent = '';
    fileNameDisplay.style.color = '';
    uploadLabel.classList.remove('upload-error', 'file-chosen');

    document.querySelectorAll('.currency-option.active').forEach(el => {
        el.classList.remove('active');
    });

    // Reset local currency selector to USD
    const select = document.getElementById('localCurrencySelect');
    if (select) {
        select.value = 'USD';
        onCurrencyChange();
    }

    document.getElementById('modalConfirmBtn').textContent = 'Confirm Deposit';
    document.getElementById('modalConfirmBtn').disabled    = false;

    submitBtn.disabled = true;

    document.getElementById('depositSuccess').classList.remove('show');
    document.getElementById('depositForm').style.display = 'block';
}
