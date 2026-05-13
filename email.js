// ================================================================
// NOTIFICATIONS.JS — Direct Resend API calls for transactional emails
// Load this on any page that sends emails (after supabase.js).
//
// Usage:
//   await sendNotification('deposit_pending',  { name, email, amount, coin, ref })
//   await sendNotification('deposit_approved', { name, email, amount, coin, ref })
//   await sendNotification('deposit_rejected', { name, email, amount, coin, ref, note })
//   await sendNotification('withdraw_pending',  { name, email, amount, coin, ref })
//   await sendNotification('withdraw_approved', { name, email, amount, coin, ref })
//   await sendNotification('withdraw_rejected', { name, email, amount, coin, ref, note })
//   await sendNotification('invest_pending',    { name, email, amount, plan, ref })
//   await sendNotification('invest_approved',   { name, email, amount, plan, ref })
//   await sendNotification('invest_rejected',   { name, email, amount, plan, ref, note })
//   await sendNotification('kyc_pending',       { name, email })
//   await sendNotification('kyc_approved',      { name, email })
//   await sendNotification('kyc_rejected',      { name, email, note })
// ================================================================

const RESEND_API_KEY = 'YOUR_RESEND_API_KEY_HERE'; // ← paste your Resend API key
const FROM_EMAIL     = 'SyncProfitPath <noreply@verify.syncprofitpath.com>';
const BRAND_COLOR    = '#00e27b';
const LOGO_URL       = 'https://syncprofitpath.com/assets/logo.png';

// ── Shared email wrapper ──────────────────────────────────────────
function emailWrapper(content) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:0; background:#f0eff5; font-family:'Helvetica Neue',Arial,sans-serif; }
  .wrap { max-width:560px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
  .header { background:#0d1117; padding:28px 40px; text-align:center; }
  .header img { height:36px; }
  .body { padding:40px; }
  .badge { display:inline-block; padding:6px 14px; border-radius:999px; font-size:13px; font-weight:700; margin-bottom:20px; }
  .badge.green  { background:rgba(0,226,123,.15); color:#00c46a; }
  .badge.red    { background:rgba(255,67,54,.12);  color:#e03020; }
  .badge.yellow { background:rgba(234,181,7,.15);  color:#b58a00; }
  h1 { margin:0 0 8px; font-size:22px; color:#27282f; }
  p  { margin:0 0 16px; font-size:15px; color:#56555e; line-height:1.6; }
  .card { background:#f0eff5; border-radius:10px; padding:20px 24px; margin:20px 0; }
  .row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(0,0,0,.06); font-size:14px; }
  .row:last-child { border-bottom:none; }
  .row .label { color:#86848c; }
  .row .value { font-weight:600; color:#27282f; }
  .btn { display:block; width:100%; max-width:220px; margin:24px auto 0; padding:14px 0; background:${BRAND_COLOR}; color:#27282f; text-align:center; border-radius:10px; font-weight:700; font-size:15px; text-decoration:none; }
  .note-box { background:#fff8e6; border-left:4px solid #eab507; border-radius:0 8px 8px 0; padding:12px 16px; margin:16px 0; font-size:13px; color:#7a6200; }
  .footer { background:#f0eff5; padding:20px 40px; text-align:center; font-size:12px; color:#86848c; }
  .footer a { color:#86848c; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <img src="${LOGO_URL}" alt="SyncProfitPath">
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    &copy; ${new Date().getFullYear()} SyncProfitPath &nbsp;·&nbsp;
    <a href="https://syncprofitpath.com">syncprofitpath.com</a><br><br>
    This is an automated message. Please do not reply to this email.
  </div>
</div>
</body>
</html>`;
}

function fmtAmount(amount) {
    return '$' + parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Email templates ───────────────────────────────────────────────
const TEMPLATES = {

    // ── DEPOSIT ──────────────────────────────────────────────────
    deposit_pending: ({ name, amount, coin, ref }) => ({
        subject: 'Deposit Received — Under Review',
        html: emailWrapper(`
            <span class="badge yellow">Pending Review</span>
            <h1>We received your deposit</h1>
            <p>Hi ${name},<br>Your deposit has been received and is currently under review. You'll get another email once it's confirmed.</p>
            <div class="card">
                <div class="row"><span class="label">Amount</span><span class="value">${fmtAmount(amount)}</span></div>
                <div class="row"><span class="label">Cryptocurrency</span><span class="value">${(coin||'').toUpperCase()}</span></div>
                <div class="row"><span class="label">Reference</span><span class="value">${ref||'—'}</span></div>
                <div class="row"><span class="label">Status</span><span class="value" style="color:#b58a00">Pending</span></div>
            </div>
            <p>Review typically takes up to 24 hours. Thank you for your patience.</p>
            <a href="https://syncprofitpath.com/transactions/" class="btn">View Transaction</a>
        `)
    }),

    deposit_approved: ({ name, amount, coin, ref }) => ({
        subject: `Deposit Approved — ${fmtAmount(amount)} Added to Your Account`,
        html: emailWrapper(`
            <span class="badge green">Approved ✓</span>
            <h1>Your deposit has been approved!</h1>
            <p>Hi ${name},<br>Great news — your deposit has been reviewed and approved. The funds are now in your account and ready to invest.</p>
            <div class="card">
                <div class="row"><span class="label">Amount Credited</span><span class="value" style="color:#00c46a">${fmtAmount(amount)}</span></div>
                <div class="row"><span class="label">Cryptocurrency</span><span class="value">${(coin||'').toUpperCase()}</span></div>
                <div class="row"><span class="label">Reference</span><span class="value">${ref||'—'}</span></div>
                <div class="row"><span class="label">Status</span><span class="value" style="color:#00c46a">Completed</span></div>
            </div>
            <a href="https://syncprofitpath.com/invest/" class="btn">Start Investing</a>
        `)
    }),

    deposit_rejected: ({ name, amount, coin, ref, note }) => ({
        subject: 'Deposit Rejected — Action Required',
        html: emailWrapper(`
            <span class="badge red">Rejected</span>
            <h1>Your deposit could not be confirmed</h1>
            <p>Hi ${name},<br>Unfortunately we were unable to verify your deposit. Please check the details below and resubmit with the correct proof of payment.</p>
            <div class="card">
                <div class="row"><span class="label">Amount</span><span class="value">${fmtAmount(amount)}</span></div>
                <div class="row"><span class="label">Cryptocurrency</span><span class="value">${(coin||'').toUpperCase()}</span></div>
                <div class="row"><span class="label">Reference</span><span class="value">${ref||'—'}</span></div>
                <div class="row"><span class="label">Status</span><span class="value" style="color:#e03020">Rejected</span></div>
            </div>
            ${note ? `<div class="note-box"><strong>Reason:</strong> ${note}</div>` : ''}
            <a href="https://syncprofitpath.com/deposit/" class="btn">Resubmit Deposit</a>
        `)
    }),

    // ── WITHDRAWAL ───────────────────────────────────────────────
    withdraw_pending: ({ name, amount, coin, ref }) => ({
        subject: 'Withdrawal Request Received',
        html: emailWrapper(`
            <span class="badge yellow">Processing</span>
            <h1>Your withdrawal is being processed</h1>
            <p>Hi ${name},<br>We've received your withdrawal request. Our team will review and process it shortly.</p>
            <div class="card">
                <div class="row"><span class="label">Amount</span><span class="value">${fmtAmount(amount)}</span></div>
                <div class="row"><span class="label">Cryptocurrency</span><span class="value">${(coin||'').toUpperCase()}</span></div>
                <div class="row"><span class="label">Reference</span><span class="value">${ref||'—'}</span></div>
                <div class="row"><span class="label">Status</span><span class="value" style="color:#b58a00">Pending</span></div>
            </div>
            <a href="https://syncprofitpath.com/transactions/" class="btn">View Transaction</a>
        `)
    }),

    withdraw_approved: ({ name, amount, coin, ref }) => ({
        subject: `Withdrawal Approved — ${fmtAmount(amount)} Sent`,
        html: emailWrapper(`
            <span class="badge green">Sent ✓</span>
            <h1>Your withdrawal has been sent!</h1>
            <p>Hi ${name},<br>Your withdrawal request has been approved and the funds have been sent to your wallet. Please allow time for blockchain confirmation.</p>
            <div class="card">
                <div class="row"><span class="label">Amount Sent</span><span class="value" style="color:#00c46a">${fmtAmount(amount)}</span></div>
                <div class="row"><span class="label">Cryptocurrency</span><span class="value">${(coin||'').toUpperCase()}</span></div>
                <div class="row"><span class="label">Reference</span><span class="value">${ref||'—'}</span></div>
                <div class="row"><span class="label">Status</span><span class="value" style="color:#00c46a">Completed</span></div>
            </div>
            <a href="https://syncprofitpath.com/transactions/" class="btn">View Transaction</a>
        `)
    }),

    withdraw_rejected: ({ name, amount, coin, ref, note }) => ({
        subject: 'Withdrawal Request Rejected',
        html: emailWrapper(`
            <span class="badge red">Rejected</span>
            <h1>Your withdrawal could not be processed</h1>
            <p>Hi ${name},<br>Unfortunately your withdrawal request was rejected. Your funds have not been moved. Please see the reason below and contact support if you need help.</p>
            <div class="card">
                <div class="row"><span class="label">Amount</span><span class="value">${fmtAmount(amount)}</span></div>
                <div class="row"><span class="label">Cryptocurrency</span><span class="value">${(coin||'').toUpperCase()}</span></div>
                <div class="row"><span class="label">Reference</span><span class="value">${ref||'—'}</span></div>
                <div class="row"><span class="label">Status</span><span class="value" style="color:#e03020">Rejected</span></div>
            </div>
            ${note ? `<div class="note-box"><strong>Reason:</strong> ${note}</div>` : ''}
            <a href="https://syncprofitpath.com/withdraw/" class="btn">Try Again</a>
        `)
    }),

    // ── INVESTMENT ───────────────────────────────────────────────
    invest_pending: ({ name, amount, plan, ref }) => ({
        subject: 'Investment Request Received',
        html: emailWrapper(`
            <span class="badge yellow">Under Review</span>
            <h1>Your investment is being reviewed</h1>
            <p>Hi ${name},<br>We've received your investment request. Our team will activate your plan shortly.</p>
            <div class="card">
                <div class="row"><span class="label">Amount</span><span class="value">${fmtAmount(amount)}</span></div>
                <div class="row"><span class="label">Plan</span><span class="value">${plan||'—'}</span></div>
                <div class="row"><span class="label">Reference</span><span class="value">${ref||'—'}</span></div>
                <div class="row"><span class="label">Status</span><span class="value" style="color:#b58a00">Pending</span></div>
            </div>
            <a href="https://syncprofitpath.com/transactions/" class="btn">View Transaction</a>
        `)
    }),

    invest_approved: ({ name, amount, plan, ref }) => ({
        subject: `Investment Activated — ${plan} Plan`,
        html: emailWrapper(`
            <span class="badge green">Active ✓</span>
            <h1>Your investment is now active!</h1>
            <p>Hi ${name},<br>Your investment has been reviewed and activated. Returns will begin accruing according to your plan schedule.</p>
            <div class="card">
                <div class="row"><span class="label">Amount Invested</span><span class="value">${fmtAmount(amount)}</span></div>
                <div class="row"><span class="label">Plan</span><span class="value">${plan||'—'}</span></div>
                <div class="row"><span class="label">Reference</span><span class="value">${ref||'—'}</span></div>
                <div class="row"><span class="label">Status</span><span class="value" style="color:#00c46a">Active</span></div>
            </div>
            <a href="https://syncprofitpath.com/dashboard/" class="btn">View Portfolio</a>
        `)
    }),

    invest_rejected: ({ name, amount, plan, ref, note }) => ({
        subject: 'Investment Request Rejected',
        html: emailWrapper(`
            <span class="badge red">Rejected</span>
            <h1>Your investment could not be activated</h1>
            <p>Hi ${name},<br>Unfortunately your investment request was not approved. Your balance has not been charged. Please see the reason below.</p>
            <div class="card">
                <div class="row"><span class="label">Amount</span><span class="value">${fmtAmount(amount)}</span></div>
                <div class="row"><span class="label">Plan</span><span class="value">${plan||'—'}</span></div>
                <div class="row"><span class="label">Reference</span><span class="value">${ref||'—'}</span></div>
                <div class="row"><span class="label">Status</span><span class="value" style="color:#e03020">Rejected</span></div>
            </div>
            ${note ? `<div class="note-box"><strong>Reason:</strong> ${note}</div>` : ''}
            <a href="https://syncprofitpath.com/invest/" class="btn">Try Again</a>
        `)
    }),

    // ── KYC ──────────────────────────────────────────────────────
    kyc_pending: ({ name }) => ({
        subject: 'KYC Documents Received — Under Review',
        html: emailWrapper(`
            <span class="badge yellow">Under Review</span>
            <h1>We received your KYC documents</h1>
            <p>Hi ${name},<br>Thank you for submitting your identity documents. Our compliance team will review your submission and you'll hear back within 24–48 hours.</p>
            <div class="card">
                <div class="row"><span class="label">Submission</span><span class="value">Received</span></div>
                <div class="row"><span class="label">Status</span><span class="value" style="color:#b58a00">Pending Review</span></div>
                <div class="row"><span class="label">Estimated Time</span><span class="value">24–48 hours</span></div>
            </div>
            <a href="https://syncprofitpath.com/settings/" class="btn">View KYC Status</a>
        `)
    }),

    kyc_approved: ({ name }) => ({
        subject: 'KYC Verified — Your Account is Fully Verified ✓',
        html: emailWrapper(`
            <span class="badge green">Verified ✓</span>
            <h1>Your identity has been verified!</h1>
            <p>Hi ${name},<br>Congratulations! Your identity verification is complete. Your account is now fully verified and all features are unlocked.</p>
            <div class="card">
                <div class="row"><span class="label">KYC Status</span><span class="value" style="color:#00c46a">Verified</span></div>
                <div class="row"><span class="label">Account Level</span><span class="value">Fully Verified</span></div>
            </div>
            <a href="https://syncprofitpath.com/dashboard/" class="btn">Go to Dashboard</a>
        `)
    }),

    kyc_rejected: ({ name, note }) => ({
        subject: 'KYC Verification Failed — Resubmission Required',
        html: emailWrapper(`
            <span class="badge red">Rejected</span>
            <h1>Your KYC could not be verified</h1>
            <p>Hi ${name},<br>Unfortunately we could not verify your identity with the documents provided. Please resubmit with clearer or corrected documents.</p>
            <div class="card">
                <div class="row"><span class="label">KYC Status</span><span class="value" style="color:#e03020">Rejected</span></div>
            </div>
            ${note ? `<div class="note-box"><strong>Reason:</strong> ${note}</div>` : ''}
            <p>Common reasons: blurry image, expired document, name mismatch, or incomplete submission.</p>
            <a href="https://syncprofitpath.com/settings/" class="btn">Resubmit Documents</a>
        `)
    }),

};

// ── Main sendEmail function ───────────────────────────────────────
async function sendEmail(type, data) {
    const template = TEMPLATES[type];
    if (!template) {
        console.warn(`sendEmail: unknown type "${type}"`);
        return;
    }

    const { subject, html } = template(data);

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from:    FROM_EMAIL,
                to:      [data.email],
                subject: subject,
                html:    html,
            }),
        });

        const result = await res.json();

        if (!res.ok) {
            console.error(`sendEmail "${type}" failed:`, result);
        } else {
            console.log(`sendEmail "${type}" sent to ${data.email}`);
        }
    } catch (err) {
        // Never block the main action — email is non-critical
        console.warn(`sendEmail "${type}" error:`, err.message);
    }
}
