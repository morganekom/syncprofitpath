// ================================================================
// DEPOSIT.JS — Redesigned for new two-column layout
// ================================================================

// ── STATE ──
let selectedCurrency = null;
let amountEntered    = false;
let fileUploaded     = false;
let localCurrency    = 'USD';
let localSymbol      = '$';
let exchangeRates    = null;
let usdAmount        = 0;
let currentQRCode    = null;

// ── WALLET ADDRESSES ──
const WALLETS = {
    btc:  { address: 'bc1qcm25upgkwqtf4cl7hus4srhgqt0jc4afhepd3c',     name: 'Bitcoin',  ticker: 'BTC',  icon: '₿', color: '#f7931a', bg: '#f7931a18', network: null },
    eth:  { address: '0x45F0530a1C4e449dF5669AdCe86424b290a37BCe',      name: 'Ethereum', ticker: 'ETH',  icon: 'Ξ', color: '#627eea', bg: '#627eea18', network: 'ERC-20 network only' },
    usdt: { address: '0x45F0530a1C4e449dF5669AdCe86424b290a37BCe',      name: 'Tether',   ticker: 'USDT', icon: '₮', color: '#26a17b', bg: '#26a17b18', network: 'TRC-20 (Tron) network only' },
    usdc: { address: '0x45F0530a1C4e449dF5669AdCe86424b290a37BCe',      name: 'USDC',     ticker: 'USDC', icon: 'Ⓤ', color: '#2775ca', bg: '#2775ca18', network: 'TRC-20 (Tron) network only' },
    sol:  { address: 'F6irucMuC6YejoZshgJH8x1XPEXN3bgzE9KgB8H5LwBU',   name: 'Solana',   ticker: 'SOL',  icon: '◎', color: '#9945ff', bg: '#9945ff18', network: 'Solana network only' },
    ltc:  { address: 'ltc1qv4r5nvyzx8m2t7h3l7c3s3tnyejm3svg0dap8j',    name: 'Litecoin', ticker: 'LTC',  icon: 'Ł', color: '#888888', bg: '#bfbbbb18', network: null },
};

// ── DOM REFS (after DOMContentLoaded) ──
let submitBtn, amountInput, fieldError;

document.addEventListener('DOMContentLoaded', () => {
    submitBtn   = document.getElementById('submitBtn');
    amountInput = document.getElementById('amountInput');
    fieldError  = document.getElementById('amountError');

    amountInput.addEventListener('input', onAmountInput);
    submitBtn.addEventListener('click', onSubmitClick);

    fetchRates();
    updateSteps();
});


// ================================================================
// EXCHANGE RATES
// ================================================================

async function fetchRates() {
    const statusEl = document.getElementById('rateStatus');
    statusEl.textContent = 'Fetching rates…';
    statusEl.style.color = 'var(--color-gray-light)';

    try {
        const res  = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        if (data.result !== 'success') throw new Error('Bad response');
        exchangeRates = data.rates;
        statusEl.textContent = '✓ Live rate';
        statusEl.style.color = 'var(--color-success)';
        onCurrencyChange();
    } catch {
        exchangeRates = { USD: 1 };
        statusEl.textContent = 'Rate unavailable';
        statusEl.style.color = 'var(--color-warning)';
        onCurrencyChange();
    }
}

function onCurrencyChange() {
    const select    = document.getElementById('localCurrencySelect');
    const option    = select.options[select.selectedIndex];
    localCurrency   = option.value;
    localSymbol     = option.dataset.symbol || option.value;
    document.getElementById('currencySymbol').textContent = localSymbol;
    if (amountInput && amountInput.value) updateUsdPreview();
}

function toUSD(localAmount) {
    if (!exchangeRates || localCurrency === 'USD') return localAmount;
    const rate = exchangeRates[localCurrency];
    return (!rate || rate === 0) ? localAmount : localAmount / rate;
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
// CRYPTO SELECTION
// ================================================================

function selectCrypto(btn) {
    // Deselect all
    document.querySelectorAll('.crypto-btn').forEach(b => b.classList.remove('selected'));

    const coin = btn.dataset.currency;

    // Toggle off if clicking same one
    if (selectedCurrency === coin) {
        selectedCurrency = null;
        hideWalletDetails();
        checkFormReady();
        updateSteps();
        return;
    }

    btn.classList.add('selected');
    selectedCurrency = coin;
    showWalletDetails(coin);
    checkFormReady();
    updateSteps();
}

function showWalletDetails(coin) {
    const w = WALLETS[coin];
    if (!w) return;

    document.getElementById('walletPlaceholder').style.display = 'none';
    document.getElementById('walletDetails').classList.add('visible');

    // Coin header
    const iconEl = document.getElementById('walletCoinIcon');
    iconEl.textContent       = w.icon;
    iconEl.style.background  = w.bg;
    iconEl.style.color       = w.color;
    document.getElementById('walletCoinName').textContent   = w.name;
    document.getElementById('walletCoinTicker').textContent = w.ticker;

    // Address
    document.getElementById('walletAddressText').textContent = w.address;

    // Network badge
    const badge     = document.getElementById('networkBadge');
    const badgeText = document.getElementById('networkBadgeText');
    if (w.network) {
        badge.style.display  = 'flex';
        badgeText.textContent = '⚠ ' + w.network;
    } else {
        badge.style.display  = 'none';
    }

    // QR Code
    const container = document.getElementById('qrContainer');
    container.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
        currentQRCode = new QRCode(container, {
            text:         w.address,
            width:        160,
            height:       160,
            colorDark:    '#000000',
            colorLight:   '#ffffff',
            correctLevel: QRCode.CorrectLevel.M,
        });
    }

    // Reset copy button
    const copyBtn = document.getElementById('copyBtn');
    copyBtn.innerHTML = '<i class="uil uil-copy"></i>';
    copyBtn.classList.remove('copied');
}

function hideWalletDetails() {
    document.getElementById('walletPlaceholder').style.display = 'flex';
    document.getElementById('walletDetails').classList.remove('visible');
    document.getElementById('qrContainer').innerHTML = '';
}


// ================================================================
// COPY ADDRESS
// ================================================================

function copyWalletAddress() {
    if (!selectedCurrency) return;
    const address = WALLETS[selectedCurrency].address;
    const copyBtn = document.getElementById('copyBtn');

    navigator.clipboard.writeText(address).then(() => {
        copyBtn.innerHTML = '<i class="uil uil-check"></i>';
        copyBtn.classList.add('copied');
        setTimeout(() => {
            copyBtn.innerHTML = '<i class="uil uil-copy"></i>';
            copyBtn.classList.remove('copied');
        }, 2500);
    });
}


// ================================================================
// AMOUNT INPUT
// ================================================================

function onAmountInput() {
    const val = parseFloat(amountInput.value);
    amountInput.classList.remove('input-error');
    fieldError.textContent = '';
    amountEntered = false;

    if (!amountInput.value) {
        document.getElementById('usdPreview').style.display = 'none';
        usdAmount = 0;
        checkFormReady();
        updateSteps();
        return;
    }

    if (isNaN(val) || val <= 0) {
        amountInput.classList.add('input-error');
        fieldError.textContent = 'Please enter a valid amount greater than 0.';
        checkFormReady();
        updateSteps();
        return;
    }

    const usdVal = toUSD(val);
    if (usdVal < 10) {
        amountInput.classList.add('input-error');
        fieldError.textContent = 'Minimum deposit is $10 USD.';
        checkFormReady();
        updateSteps();
        return;
    }

    updateUsdPreview();
    amountEntered = true;
    checkFormReady();
    updateSteps();
}


// ================================================================
// FILE UPLOAD
// ================================================================

function showFileName(input) {
    const label   = document.querySelector('.file-upload-label');
    const display = document.getElementById('fileNameDisplay');

    if (input.files[0]) {
        const name = input.files[0].name;
        display.textContent = '✓ ' + (name.length > 45 ? name.slice(0, 42) + '…' : name);
        display.style.color = 'var(--color-success)';
        label.classList.remove('upload-error');
        label.classList.add('file-chosen');
        fileUploaded = true;
    } else {
        display.textContent = '';
        label.classList.remove('file-chosen');
        fileUploaded = false;
    }

    checkFormReady();
    updateSteps();
}


// ================================================================
// STEP INDICATOR
// ================================================================

function updateSteps() {
    const s1 = document.getElementById('step1');
    const s2 = document.getElementById('step2');
    const s3 = document.getElementById('step3');

    // Step 1
    s1.className = 'deposit-step ' + (selectedCurrency ? 'done' : 'active');
    s1.querySelector('.step-num').textContent = selectedCurrency ? '✓' : '1';

    // Step 2
    if (!selectedCurrency) {
        s2.className = 'deposit-step';
    } else if (amountEntered) {
        s2.className = 'deposit-step done';
        s2.querySelector('.step-num').textContent = '✓';
    } else {
        s2.className = 'deposit-step active';
        s2.querySelector('.step-num').textContent = '2';
    }

    // Step 3
    if (!amountEntered) {
        s3.className = 'deposit-step';
        s3.querySelector('.step-num').textContent = '3';
    } else if (fileUploaded) {
        s3.className = 'deposit-step done';
        s3.querySelector('.step-num').textContent = '✓';
    } else {
        s3.className = 'deposit-step active';
        s3.querySelector('.step-num').textContent = '3';
    }
}


// ================================================================
// FORM READY CHECK
// ================================================================

function checkFormReady() {
    if (submitBtn) {
        submitBtn.disabled = !(selectedCurrency && amountEntered && fileUploaded);
    }
}


// ================================================================
// SUBMIT — opens confirmation modal
// ================================================================

function onSubmitClick() {
    if (!selectedCurrency || !amountEntered || !fileUploaded) return;

    const localVal  = parseFloat(amountInput.value);
    const usdVal    = toUSD(localVal);
    const fileName  = document.getElementById('proofFile').files[0]?.name || '';
    const coin      = WALLETS[selectedCurrency];

    const localFormatted = localSymbol + localVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const usdFormatted   = '$' + usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    document.getElementById('confirmCoin').textContent   = `${coin.name} (${coin.ticker})`;
    document.getElementById('confirmAmount').textContent =
        localCurrency === 'USD' ? usdFormatted : `${localFormatted} ≈ ${usdFormatted}`;
    document.getElementById('confirmFile').textContent   = fileName.length > 30 ? fileName.slice(0,27)+'…' : fileName;

    document.getElementById('modalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}


// ================================================================
// MODAL
// ================================================================

function closeModal(event) {
    if (event.target === document.getElementById('modalOverlay')) closeDepositModal();
}

function closeDepositModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    document.body.style.overflow = '';
}

async function confirmDeposit() {
    const confirmBtn       = document.getElementById('modalConfirmBtn');
    confirmBtn.textContent = 'Submitting…';
    confirmBtn.disabled    = true;

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const localVal    = parseFloat(amountInput.value);
    const usdVal      = parseFloat(toUSD(localVal).toFixed(2));
    const reference   = 'DEP-' + Date.now().toString(36).toUpperCase();
    const proofFile   = document.getElementById('proofFile').files[0];
    const coin        = WALLETS[selectedCurrency];

    // ── Upload proof ──
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
            fieldError.textContent = 'Failed to upload proof. Please try again.';
            confirmBtn.textContent = 'Confirm & Submit';
            confirmBtn.disabled    = false;
            closeDepositModal();
            return;
        }

        const { data: urlData } = db.storage.from('deposit-proofs').getPublicUrl(filePath);
        proofUrl = urlData?.publicUrl || null;
    }

    // ── Insert transaction ──
    const { error: txError } = await db
        .from('transactions')
        .insert([{
            user_id:   currentUser.id,
            type:      'deposit',
            amount:    usdVal,
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
        console.error('TX error:', txError.message);
        fieldError.textContent = 'Something went wrong. Please try again.';
        confirmBtn.textContent = 'Confirm & Submit';
        confirmBtn.disabled    = false;
        closeDepositModal();
        return;
    }

    // ── Update pending balance ──
    const currentPending = parseFloat(localStorage.getItem('userPending')) || 0;
    const newPending     = currentPending + usdVal;

    const { error: userError } = await db
        .from('users')
        .update({ pending: newPending })
        .eq('id', currentUser.id);

    if (!userError) localStorage.setItem('userPending', String(newPending));

    closeDepositModal();
    document.getElementById('depositForm').style.display  = 'none';
    document.getElementById('depositSuccess').classList.add('show');
}


// ================================================================
// RESET
// ================================================================

function resetDeposit() {
    selectedCurrency = null;
    amountEntered    = false;
    fileUploaded     = false;
    usdAmount        = 0;

    document.querySelectorAll('.crypto-btn').forEach(b => b.classList.remove('selected'));
    hideWalletDetails();

    amountInput.value = '';
    amountInput.classList.remove('input-error');
    fieldError.textContent = '';
    document.getElementById('usdPreview').style.display = 'none';

    document.getElementById('proofFile').value      = '';
    document.getElementById('fileNameDisplay').textContent = '';
    document.querySelector('.file-upload-label').classList.remove('upload-error', 'file-chosen');

    document.getElementById('localCurrencySelect').value = 'USD';
    onCurrencyChange();

    document.getElementById('modalConfirmBtn').textContent = 'Confirm & Submit';
    document.getElementById('modalConfirmBtn').disabled    = false;

    submitBtn.disabled = true;

    document.getElementById('depositSuccess').classList.remove('show');
    document.getElementById('depositForm').style.display = '';

    updateSteps();
}
