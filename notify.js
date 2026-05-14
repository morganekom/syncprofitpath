// ================================================================
// NOTIFY.JS — Calls Resend API directly from the browser
// Place in root folder alongside supabase.js
//
// Usage:
//   sendNotification({ type, email, name, amount, coin, ref, method, plan })
//
// Supported types:
//   deposit_pending      deposit_approved      deposit_rejected
//   withdrawal_pending   withdrawal_approved   withdrawal_rejected
//   investment_pending   investment_approved   investment_rejected   investment_matured
//   kyc_pending          kyc_approved          kyc_rejected
// ================================================================

// ── Brand constants ───────────────────────────────────────────────
const BRAND_COLOR  = '#00e27b';
const BRAND_DARK   = '#27282f';
const BRAND_BG     = '#f0eff5';
const FROM_EMAIL   = 'SyncProfitPath <noreply@verify.syncprofitpath.com>';
const LOGO_URL     = 'https://syncprofitpath.com/assets/logo.png';
const SITE_URL     = 'https://syncprofitpath.com';

// ── Resend direct API ─────────────────────────────────────────────
const RESEND_API_KEY = 're_CKjw3kk4_CGyvZCH9Z2oCnxVoX1DV4FEF';
const RESEND_URL     = 'https://api.resend.com/emails';

// ── Email shell ───────────────────────────────────────────────────
function _shell(content) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SyncProfitPath</title>
</head>
<body style="margin:0;padding:0;background:#f0eff5;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0eff5;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:${BRAND_DARK};padding:28px 32px;text-align:center;">
          <span style="font-size:22px;font-weight:800;color:#ffffff;">
            Sync<span style="color:${BRAND_COLOR};">ProfitPath</span>
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding:36px 32px;">
          ${content}
        </td>
      </tr>
      <tr>
        <td style="background:#f8f8f8;padding:20px 32px;text-align:center;border-top:1px solid #e8e8e8;">
          <p style="margin:0;font-size:12px;color:#86848c;">
            This is an automated message from SyncProfitPath.<br>
            &copy; ${new Date().getFullYear()} SyncProfitPath. All rights reserved.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function _badge(text, color, bg) {
    return `<span style="display:inline-block;background:${bg};color:${color};font-size:13px;font-weight:700;padding:5px 14px;border-radius:99px;">${text}</span>`;
}

function _row(label, value) {
    return `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0eff5;font-size:14px;color:#86848c;width:40%;">${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f0eff5;font-size:14px;color:#27282f;font-weight:600;">${value}</td>
    </tr>`;
}

function _cta(text, href) {
    return `<a href="${href}" style="display:inline-block;background:${BRAND_COLOR};color:${BRAND_DARK};font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;margin-top:24px;">${text}</a>`;
}

function _hi(name) {
    return `<p style="margin:0 0 20px;font-size:16px;color:#56555e;">Hi <strong style="color:${BRAND_DARK};">${name}</strong>,</p>`;
}

// ── Template builder ──────────────────────────────────────────────
function _getTemplate(type, { name, amount, coin, ref, method, plan }) {
    name   = name   || 'Valued Investor';
    amount = amount ? '$' + parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '';
    coin   = coin   ? coin.toUpperCase() : '';
    ref    = ref    || '';
    method = method || '';
    plan   = plan   || '';

    const url = SITE_URL;

    switch (type) {

        case 'deposit_pending':
            return {
                subject: 'Deposit Received — Under Review',
                html: _shell(`
                    ${_hi(name)}
                    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND_DARK};">We received your deposit</h2>
                    <p style="margin:0 0 24px;font-size:15px;color:#56555e;line-height:1.6;">Your deposit has been submitted and is currently under review. We'll notify you once it's confirmed.</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        ${_row('Amount', amount)}
                        ${_row('Coin', coin)}
                        ${_row('Reference', ref)}
                        ${_row('Status', _badge('Pending Review', '#b45309', '#fef3c7'))}
                    </table>
                    <p style="margin:24px 0 0;font-size:13px;color:#86848c;">Processing typically takes 1–24 hours.</p>
                    ${_cta('View Dashboard', url + '/dashboard/')}
                `),
            };

        case 'deposit_approved':
            return {
                subject: '✅ Deposit Approved — Balance Updated',
                html: _shell(`
                    ${_hi(name)}
                    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND_DARK};">Your deposit has been approved!</h2>
                    <p style="margin:0 0 24px;font-size:15px;color:#56555e;line-height:1.6;">Great news — your deposit has been verified and your account balance has been updated.</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        ${_row('Amount Credited', amount)}
                        ${_row('Coin', coin)}
                        ${_row('Reference', ref)}
                        ${_row('Status', _badge('Approved', '#065f46', '#d1fae5'))}
                    </table>
                    <p style="margin:24px 0 0;font-size:15px;color:#56555e;">Your funds are now available. Ready to start investing?</p>
                    ${_cta('Invest Now', url + '/invest/')}
                `),
            };

        case 'deposit_rejected':
            return {
                subject: 'Deposit Could Not Be Verified',
                html: _shell(`
                    ${_hi(name)}
                    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND_DARK};">Deposit verification failed</h2>
                    <p style="margin:0 0 24px;font-size:15px;color:#56555e;line-height:1.6;">We were unable to verify your deposit. This may be due to an unclear proof of payment or a mismatch in the transaction details.</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        ${_row('Amount', amount)}
                        ${_row('Reference', ref)}
                        ${_row('Status', _badge('Rejected', '#991b1b', '#fee2e2'))}
                    </table>
                    <p style="margin:24px 0 0;font-size:15px;color:#56555e;">Please try again with a clear screenshot of your transaction. Contact support if you need help.</p>
                    ${_cta('Try Again', url + '/deposit/')}
                `),
            };

        case 'withdrawal_pending':
            return {
                subject: 'Withdrawal Request Received',
                html: _shell(`
                    ${_hi(name)}
                    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND_DARK};">We received your withdrawal request</h2>
                    <p style="margin:0 0 24px;font-size:15px;color:#56555e;line-height:1.6;">Your withdrawal request has been submitted and is being processed by our team.</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        ${_row('Amount', amount)}
                        ${_row('Method', method)}
                        ${_row('Reference', ref)}
                        ${_row('Status', _badge('Processing', '#b45309', '#fef3c7'))}
                    </table>
                    <p style="margin:24px 0 0;font-size:13px;color:#86848c;">Withdrawals are typically processed within 24–48 hours.</p>
                    ${_cta('View Transactions', url + '/transactions/')}
                `),
            };

        case 'withdrawal_approved':
            return {
                subject: '✅ Withdrawal Approved — Funds Sent',
                html: _shell(`
                    ${_hi(name)}
                    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND_DARK};">Your withdrawal has been processed!</h2>
                    <p style="margin:0 0 24px;font-size:15px;color:#56555e;line-height:1.6;">Your withdrawal request has been approved and the funds have been sent to your wallet.</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        ${_row('Amount', amount)}
                        ${_row('Method', method)}
                        ${_row('Reference', ref)}
                        ${_row('Status', _badge('Approved', '#065f46', '#d1fae5'))}
                    </table>
                    <p style="margin:24px 0 0;font-size:13px;color:#86848c;">Please allow 1–3 business days for funds to arrive depending on your network.</p>
                    ${_cta('View Transactions', url + '/transactions/')}
                `),
            };

        case 'withdrawal_rejected':
            return {
                subject: 'Withdrawal Request Declined',
                html: _shell(`
                    ${_hi(name)}
                    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND_DARK};">Withdrawal could not be processed</h2>
                    <p style="margin:0 0 24px;font-size:15px;color:#56555e;line-height:1.6;">Unfortunately, your withdrawal request was declined. Your funds have been returned to your available balance.</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        ${_row('Amount', amount)}
                        ${_row('Method', method)}
                        ${_row('Reference', ref)}
                        ${_row('Status', _badge('Declined', '#991b1b', '#fee2e2'))}
                    </table>
                    <p style="margin:24px 0 0;font-size:15px;color:#56555e;">Please contact support if you have any questions.</p>
                    ${_cta('Contact Support', url + '/dashboard/')}
                `),
            };

        case 'investment_pending':
            return {
                subject: 'Investment Submitted — Under Review',
                html: _shell(`
                    ${_hi(name)}
                    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND_DARK};">Your investment is being reviewed</h2>
                    <p style="margin:0 0 24px;font-size:15px;color:#56555e;line-height:1.6;">Your investment request has been submitted and is currently under review. We'll activate it shortly.</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        ${_row('Amount', amount)}
                        ${_row('Plan', plan)}
                        ${_row('Reference', ref)}
                        ${_row('Status', _badge('Pending', '#b45309', '#fef3c7'))}
                    </table>
                    ${_cta('View Dashboard', url + '/dashboard/')}
                `),
            };

        case 'investment_approved':
            return {
                subject: '✅ Investment Activated',
                html: _shell(`
                    ${_hi(name)}
                    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND_DARK};">Your investment is now active!</h2>
                    <p style="margin:0 0 24px;font-size:15px;color:#56555e;line-height:1.6;">Your investment has been approved and is now earning daily returns.</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        ${_row('Amount', amount)}
                        ${_row('Plan', plan)}
                        ${_row('Reference', ref)}
                        ${_row('Status', _badge('Active', '#065f46', '#d1fae5'))}
                    </table>
                    ${_cta('View Portfolio', url + '/dashboard/')}
                `),
            };

        case 'investment_rejected':
            return {
                subject: 'Investment Request Declined',
                html: _shell(`
                    ${_hi(name)}
                    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND_DARK};">Investment could not be processed</h2>
                    <p style="margin:0 0 24px;font-size:15px;color:#56555e;line-height:1.6;">Your investment request was declined. Your funds have been returned to your available balance.</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        ${_row('Amount', amount)}
                        ${_row('Plan', plan)}
                        ${_row('Reference', ref)}
                        ${_row('Status', _badge('Declined', '#991b1b', '#fee2e2'))}
                    </table>
                    ${_cta('View Plans', url + '/invest/')}
                `),
            };

        case 'investment_matured':
            return {
                subject: '🎉 Investment Matured — Profits Credited',
                html: _shell(`
                    ${_hi(name)}
                    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND_DARK};">Your investment has matured!</h2>
                    <p style="margin:0 0 24px;font-size:15px;color:#56555e;line-height:1.6;">Congratulations! Your investment has reached its maturity date. Your principal and profits have been moved to your available balance.</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        ${_row('Amount + Profit', amount)}
                        ${_row('Plan', plan)}
                        ${_row('Reference', ref)}
                        ${_row('Status', _badge('Matured', '#065f46', '#d1fae5'))}
                    </table>
                    <p style="margin:24px 0 0;font-size:15px;color:#56555e;">Ready to reinvest and keep growing?</p>
                    ${_cta('Reinvest Now', url + '/invest/')}
                `),
            };

        case 'kyc_pending':
            return {
                subject: 'KYC Documents Received — Under Review',
                html: _shell(`
                    ${_hi(name)}
                    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND_DARK};">We received your documents</h2>
                    <p style="margin:0 0 24px;font-size:15px;color:#56555e;line-height:1.6;">Your identity verification documents have been submitted and are currently under review. This usually takes 1–2 business days.</p>
                    <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                        <p style="margin:0;font-size:14px;color:#92400e;font-weight:600;">⏳ Verification in progress</p>
                    </div>
                    ${_cta('View Account', url + '/settings/')}
                `),
            };

        case 'kyc_approved':
            return {
                subject: '✅ Identity Verified — Account Fully Unlocked',
                html: _shell(`
                    ${_hi(name)}
                    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND_DARK};">Your identity has been verified!</h2>
                    <p style="margin:0 0 24px;font-size:15px;color:#56555e;line-height:1.6;">Your KYC verification is complete. Your account is now fully unlocked including withdrawals.</p>
                    <div style="background:#d1fae5;border-left:4px solid ${BRAND_COLOR};border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                        <p style="margin:0;font-size:14px;color:#065f46;font-weight:600;">✓ Account fully verified</p>
                    </div>
                    ${_cta('Go to Dashboard', url + '/dashboard/')}
                `),
            };

        case 'kyc_rejected':
            return {
                subject: 'KYC Verification — Action Required',
                html: _shell(`
                    ${_hi(name)}
                    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND_DARK};">Verification could not be completed</h2>
                    <p style="margin:0 0 24px;font-size:15px;color:#56555e;line-height:1.6;">We were unable to verify your identity with the documents submitted. This is often due to blurry images, expired documents, or a name mismatch.</p>
                    <div style="background:#fee2e2;border-left:4px solid #ef4444;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                        <p style="margin:0;font-size:14px;color:#991b1b;font-weight:600;">Please resubmit with clear, valid documents</p>
                    </div>
                    <p style="font-size:15px;color:#56555e;">Accepted: National ID, Passport, or Driver's License. Proof of address must be dated within 3 months.</p>
                    ${_cta('Resubmit Documents', url + '/settings/')}
                `),
            };

        default:
            return null;
    }
}

// ── Main function ─────────────────────────────────────────────────
async function sendNotification({ type, email, name, amount, coin, ref, method, plan }) {
    try {
        const template = _getTemplate(type, { name, amount, coin, ref, method, plan });

        if (!template) {
            console.warn('sendNotification: unknown type:', type);
            return;
        }

        if (!email) {
            console.warn('sendNotification: no email address provided for type:', type);
            return;
        }

        const res = await fetch(RESEND_URL, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from:    FROM_EMAIL,
                to:      [email],
                subject: template.subject,
                html:    template.html,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            console.warn('sendNotification failed:', data);
        } else {
            console.log('Email sent:', type, '→', email, '| id:', data.id);
        }
    } catch (err) {
        // Never block the main flow
        console.warn('sendNotification error:', err.message);
    }
}
