// invest.js — Investment Plans (Crypto / Stocks / Real Estate)
// Shared across all three asset pages

// ── STATE ──
let activePlan = { name: '', rate: 0, roi: 0, min: 0, max: 0, duration: '' };
let allPlansCache    = [];
// Read asset class from body data attribute set by each page
const activeAssetClass = document.body.dataset.asset || 'crypto';

function escapeHtml(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function formatNum(num) {
    return Number(num).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function capitalise(str) { return String(str).charAt(0).toUpperCase()+String(str).slice(1); }


// ================================================================
// LOAD PLANS
// ================================================================
async function loadPlans() {
    const grid   = document.getElementById('plansGrid');
    const skelEl = document.getElementById('plansLoading');
    if (skelEl) skelEl.style.display = '';
    if (grid)   grid.style.display   = 'none';

    try {
        const { data, error } = await db
            .from('investment_plans').select('*')
            .eq('is_active', true).eq('asset_class', activeAssetClass)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        allPlansCache = data || [];
        renderPlans();
    } catch (err) {
        console.error('loadPlans error:', err.message);
        if (skelEl) skelEl.style.display = 'none';
        if (grid) { grid.style.display=''; grid.innerHTML='<p style="padding:1rem;color:var(--color-danger)">Failed to load plans. Please refresh.</p>'; }
    }
}


// ================================================================
// RENDER PLAN CARDS
// ================================================================
function renderPlans() {
    const grid   = document.getElementById('plansGrid');
    const skelEl = document.getElementById('plansLoading');
    if (skelEl) skelEl.style.display = 'none';
    if (!grid) return;

    if (allPlansCache.length === 0) {
        grid.style.display = '';
        grid.innerHTML = '<div class="inv-empty"><i class="uil uil-chart"></i><p>No plans available yet.</p></div>';
        return;
    }

    const headerClass = {'crypto':'inv-card-header--crypto','stocks':'inv-card-header--stocks','real-estate':'inv-card-header--realestate'}[activeAssetClass] || 'inv-card-header--crypto';
    const assetIcon   = {'crypto':'₿','stocks':'≡','real-estate':'⌂'}[activeAssetClass] || '◆';
    const btnLabel    = {'crypto':'Invest in Crypto','stocks':'Invest in Stocks','real-estate':'Invest in Real Estate'}[activeAssetClass] || 'Invest Now';
    const badgeLabels = ['Hot','Popular','Premium'];

    grid.innerHTML = allPlansCache.map((p, i) => {
        const name          = p.name || 'Plan';
        const slug          = p.slug || 'plan-'+i;
        const dailyRate     = p.daily_rate ?? 0;
        const roi           = p.roi_multiplier ?? 0;
        const minAmt        = p.min_amount ?? 0;
        const maxAmt        = p.max_amount ?? 0;
        const withdraw      = p.withdraw || '30 days';
        const returnType    = p.return_type || 'Daily';
        const badgeLabel    = badgeLabels[i] || badgeLabels[badgeLabels.length-1];
        const durationDays  = parseInt(withdraw) || 30;
        const initReturn    = (minAmt * dailyRate / 100).toFixed(2);
        const initTotal     = (minAmt * dailyRate / 100 * durationDays).toFixed(2);

        return `<article class="inv-card" id="invCard-${slug}">
            <div class="inv-card-header ${headerClass}">
                <span class="inv-badge-label">${badgeLabel}</span>
                <div class="inv-card-icon">${assetIcon}</div>
                <p class="inv-card-header-type">${escapeHtml(name)}</p>
                <div class="inv-roi-badge"><span>${dailyRate}%</span><small>${returnType} ROI</small></div>
            </div>
            <div class="inv-card-body">
                <h3 class="inv-card-name">${escapeHtml(name)}</h3>
                <div class="inv-card-meta">
                    <span>$${formatNum(minAmt)} <small>minimum</small></span>
                    <span class="inv-meta-duration">Duration <strong>${escapeHtml(withdraw)}</strong></span>
                </div>
                <div class="inv-card-details">
                    <div class="inv-detail-row"><span>Investment Range</span><span>$${formatNum(minAmt)} – $${formatNum(maxAmt)}</span></div>
                    <div class="inv-detail-row"><span>Return Rate</span><span class="inv-rate">${dailyRate}% ${returnType}</span></div>
                    <div class="inv-detail-row"><span>ROI</span><span>${roi}×</span></div>
                </div>
                <div class="inv-amount-section">
                    <label class="inv-amount-label">Investment Amount ($)</label>
                    <div class="inv-amount-input-wrap">
                        <span>$</span>
                        <input type="number" class="inv-amount-input" id="amountInput-${slug}"
                            value="${minAmt}" min="${minAmt}" max="${maxAmt}" step="1"
                            oninput="onAmountInput('${slug}',${minAmt},${maxAmt},${dailyRate},${durationDays})">
                    </div>
                    <input type="range" class="inv-slider" id="slider-${slug}"
                        min="${minAmt}" max="${maxAmt}" value="${minAmt}" step="1"
                        oninput="onSliderInput('${slug}',${minAmt},${maxAmt},${dailyRate},${durationDays})">
                    <div class="inv-slider-labels"><span>$${formatNum(minAmt)}</span><span>$${formatNum(maxAmt)}</span></div>
                </div>
                <div class="inv-return-preview">
                    <div class="inv-return-row">
                        <span>1 Return:</span>
                        <span class="inv-return-val" id="returnSingle-${slug}">$${initReturn}</span>
                    </div>
                    <div class="inv-return-row">
                        <span>Total Return (${escapeHtml(withdraw)}):</span>
                        <span class="inv-return-val" id="returnTotal-${slug}">$${initTotal}</span>
                    </div>
                </div>
                <button class="inv-btn"
                    data-slug="${escapeHtml(slug)}" data-planname="${escapeHtml(name)}"
                    data-min="${minAmt}" data-max="${maxAmt}" data-rate="${dailyRate}"
                    data-roi="${roi}" data-duration="${escapeHtml(withdraw)}"
                    onclick="openInvestModal(this)">
                    ${btnLabel}
                </button>
            </div>
        </article>`;
    }).join('');

    grid.style.display = '';
}


// ================================================================
// SLIDER + INPUT SYNC
// ================================================================
function onSliderInput(slug, min, max, rate, days) {
    const slider = document.getElementById('slider-'+slug);
    const input  = document.getElementById('amountInput-'+slug);
    if (!slider||!input) return;
    input.value = slider.value;
    updateReturnPreview(slug, parseFloat(slider.value), rate, days);
}

function onAmountInput(slug, min, max, rate, days) {
    const input  = document.getElementById('amountInput-'+slug);
    const slider = document.getElementById('slider-'+slug);
    if (!input||!slider) return;
    let val = Math.min(Math.max(parseFloat(input.value)||min, min), max);
    slider.value = val;
    updateReturnPreview(slug, val, rate, days);
}

function updateReturnPreview(slug, amount, rate, days) {
    const sEl = document.getElementById('returnSingle-'+slug);
    const tEl = document.getElementById('returnTotal-'+slug);
    if (!sEl||!tEl) return;
    sEl.textContent = '$'+formatNum(amount*rate/100);
    tEl.textContent = '$'+formatNum(amount*rate/100*days);
}


// ================================================================
// MODAL — no coin selector
// ================================================================
function openInvestModal(btn) {
    activePlan.name     = btn.dataset.planname || capitalise(btn.dataset.slug);
    activePlan.rate     = parseFloat(btn.dataset.rate);
    activePlan.roi      = parseFloat(btn.dataset.roi);
    activePlan.min      = parseFloat(btn.dataset.min);
    activePlan.max      = parseFloat(btn.dataset.max);
    activePlan.duration = btn.dataset.duration || '';

    const sliderEl  = document.getElementById('slider-'+btn.dataset.slug);
    const prefilled = sliderEl ? parseFloat(sliderEl.value) : activePlan.min;

    document.getElementById('modalTitle').textContent    = `Invest in ${activePlan.name}`;
    document.getElementById('modalSubtitle').textContent = `${activePlan.rate}% Daily · ROI ${activePlan.roi}×`;
    document.getElementById('modalRangeHint').textContent= `Min $${formatNum(activePlan.min)} – Max $${formatNum(activePlan.max)}`;

    const amountInput    = document.getElementById('modalAmount');
    amountInput.value    = prefilled;
    amountInput.min      = activePlan.min;
    amountInput.max      = activePlan.max;
    amountInput.disabled = false;

    document.getElementById('modalError').textContent   = '';
    document.getElementById('modalSuccess').classList.remove('show');
    document.getElementById('modalFooter').style.display= 'flex';

    updateModalReturnPreview(prefilled);
    validateModalAmount();

    document.getElementById('modalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeInvestModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    document.body.style.overflow = '';
}

function closeModal(event) {
    if (event.target === document.getElementById('modalOverlay')) closeInvestModal();
}

function validateModalAmount() {
    const input  = document.getElementById('modalAmount');
    const error  = document.getElementById('modalError');
    const btn    = document.getElementById('modalConfirmBtn');
    const amount = parseFloat(input.value);
    error.textContent = '';
    btn.disabled = true;
    if (!input.value||isNaN(amount)||amount<=0) return;
    if (amount < activePlan.min) { error.textContent=`Minimum is $${formatNum(activePlan.min)}.`; return; }
    if (amount > activePlan.max) { error.textContent=`Maximum is $${formatNum(activePlan.max)}.`; return; }
    btn.disabled = false;
    updateModalReturnPreview(amount);
}

function updateModalReturnPreview(amount) {
    const sEl = document.getElementById('modalReturnSingle');
    const tEl = document.getElementById('modalReturnTotal');
    if (!sEl||!tEl) return;
    const days = parseInt(activePlan.duration)||30;
    sEl.textContent = '$'+formatNum(amount*activePlan.rate/100);
    tEl.textContent = '$'+formatNum(amount*activePlan.rate/100*days);
}


// ================================================================
// CONFIRM INVESTMENT
// ================================================================
async function confirmInvestment() {
    const confirmBtn  = document.getElementById('modalConfirmBtn');
    const errorEl     = document.getElementById('modalError');
    const amount      = parseFloat(document.getElementById('modalAmount').value);
    const currentUser = JSON.parse(localStorage.getItem('currentUser')||'{}');

    errorEl.textContent    = '';
    confirmBtn.disabled    = true;
    confirmBtn.textContent = 'Checking…';

    const { data: userData, error: balErr } = await db
        .from('users').select('balance').eq('id', currentUser.id).single();

    if (balErr||!userData) {
        errorEl.textContent    = 'Could not verify balance. Please try again.';
        confirmBtn.disabled    = false;
        confirmBtn.textContent = 'Confirm Investment';
        return;
    }

    if (amount > parseFloat(userData.balance||0)) {
        errorEl.textContent    = `Insufficient balance. Available: $${formatNum(userData.balance||0)}`;
        confirmBtn.disabled    = false;
        confirmBtn.textContent = 'Confirm Investment';
        return;
    }

    confirmBtn.textContent = 'Submitting…';
    const reference = 'INV-'+Date.now().toString(36).toUpperCase();

    const { error } = await db.from('transactions').insert([{
        user_id: currentUser.id, type: 'investment', amount,
        coin: activeAssetClass, status: 'pending',
        note: `${activePlan.name} — ${activePlan.rate}% daily`,
        method: activePlan.name, reference,
    }]);

    if (error) {
        console.error('Investment error:', error.message);
        errorEl.textContent    = 'Something went wrong. Please try again.';
        confirmBtn.disabled    = false;
        confirmBtn.textContent = 'Confirm Investment';
        return;
    }

    sendNotification({
        type: 'investment_pending', email: currentUser.email||'',
        name: currentUser.full_name||currentUser.first_name||'there',
        amount, plan: activePlan.name, coin: activeAssetClass, ref: reference,
    });

    document.getElementById('modalFooter').style.display = 'none';
    document.getElementById('modalSuccess').classList.add('show');
}

document.addEventListener('DOMContentLoaded', () => { loadPlans(); });
