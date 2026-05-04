// ================================================================
// DEPOSIT.JS — All form states and interactions
// ================================================================


// ── TRACK FORM COMPLETION ──
let selectedCurrency = null;   // set when user opens a currency
let amountEntered    = false;  // set when user types a valid amount
let fileUploaded     = false;  // set when user picks a file

const submitBtn  = document.getElementById('submitBtn');
const amountInput = document.getElementById('amountInput');
const fieldError  = document.getElementById('amountError');


// ================================================================
// CURRENCY TOGGLE
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

    if (amountInput.value === '') { checkFormReady(); return; }

    if (isNaN(val) || val <= 0) {
        amountInput.classList.add('input-error');
        fieldError.textContent = 'Please enter a valid amount greater than $0.';
        checkFormReady();
        return;
    }

    if (val < 10) {
        amountInput.classList.add('input-error');
        fieldError.textContent = 'Minimum deposit amount is $10.';
        checkFormReady();
        return;
    }

    amountEntered = true;
    checkFormReady();
});


// ================================================================
// FILE UPLOAD
// ================================================================

function showFileName(input) {
    const uploadLabel    = document.querySelector('.file-upload-label');
    const labelStrong    = uploadLabel.querySelector('strong');
    const labelSub       = uploadLabel.querySelector('div');
    const fileNameDisplay = document.getElementById('fileNameDisplay');

    if (input.files[0]) {
        const name = input.files[0].name;

        // Update the label itself to show the chosen filename
        labelStrong.textContent = name.length > 32 ? name.slice(0, 29) + '…' : name;
        labelSub.textContent    = 'File selected — click to change';

        // Green confirmation below
        fileNameDisplay.textContent = '✓ Ready to upload';
        fileNameDisplay.style.color = 'var(--color-success)';

        uploadLabel.classList.remove('upload-error');
        uploadLabel.classList.add('file-chosen');
        fileUploaded = true;

    } else {
        // Reset label
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

    const coinLabel = selectedCurrency.toUpperCase();
    const amount    = parseFloat(amountInput.value).toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });
    const fileName  = document.getElementById('proofFile').files[0]?.name || '';

    document.getElementById('confirmCoin').textContent   = coinLabel;
    document.getElementById('confirmAmount').textContent = '$' + amount;
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
    const confirmBtn     = document.getElementById('modalConfirmBtn');
    confirmBtn.textContent = 'Submitting...';
    confirmBtn.disabled    = true;

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const amount      = parseFloat(amountInput.value);
    const reference   = 'DEP-' + Date.now().toString(36).toUpperCase();
    const proofFile   = document.getElementById('proofFile').files[0];


    // ── STEP 1: Upload proof of payment to Supabase Storage ──
    let proofUrl = null;

    if (proofFile) {
        // Use a unique file path: userId/reference.ext
        const ext      = proofFile.name.split('.').pop();
        const filePath = `${currentUser.id}/${reference}.${ext}`;

        const { data: uploadData, error: uploadError } = await db
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

        // Get the public URL of the uploaded file
        const { data: urlData } = db
            .storage
            .from('deposit-proofs')
            .getPublicUrl(filePath);

        proofUrl = urlData?.publicUrl || null;
    }


    // ── STEP 2: Insert transaction record ──
    const { error: txError } = await db
        .from('transactions')
        .insert([{
            user_id:   currentUser.id,
            type:      'deposit',
            amount:    amount,
            coin:      selectedCurrency,
            status:    'pending',
            note:      'Awaiting confirmation',
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


    // ── STEP 3: Increment user's pending balance in users table ──
    const currentPending = parseFloat(localStorage.getItem('userPending')) || 0;
    const newPending      = currentPending + amount;

    const { error: userError } = await db
        .from('users')
        .update({ pending: newPending })
        .eq('id', currentUser.id);

    if (userError) {
        // Transaction saved — this is non-fatal, just log it
        console.warn('Pending balance update failed:', userError.message);
    } else {
        // Keep localStorage in sync so dashboard shows immediately
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
    // Reset state
    selectedCurrency = null;
    amountEntered    = false;
    fileUploaded     = false;

    // Reset amount
    amountInput.value = '';
    amountInput.classList.remove('input-error');
    fieldError.textContent = '';

    // Reset file upload label back to default
    const uploadLabel = document.querySelector('.file-upload-label');
    const labelStrong = uploadLabel.querySelector('strong');
    const labelSub    = uploadLabel.querySelector('div');
    const fileNameDisplay = document.getElementById('fileNameDisplay');

    document.getElementById('proofFile').value = '';
    labelStrong.textContent     = 'Choose file';
    labelSub.textContent        = 'No file chosen';
    fileNameDisplay.textContent = '';
    fileNameDisplay.style.color = '';
    uploadLabel.classList.remove('upload-error', 'file-chosen');

    // Close all open currency dropdowns
    document.querySelectorAll('.currency-option.active').forEach(el => {
        el.classList.remove('active');
    });

    // Reset confirm button
    document.getElementById('modalConfirmBtn').textContent = 'Confirm Deposit';
    document.getElementById('modalConfirmBtn').disabled    = false;

    submitBtn.disabled = true;

    document.getElementById('depositSuccess').classList.remove('show');
    document.getElementById('depositForm').style.display = 'block';
}