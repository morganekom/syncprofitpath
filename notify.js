// ================================================================
// NOTIFY.JS — Calls send-notification Edge Function
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
//
// Email templates live in Supabase → Edge Functions → send-notification
// Brand constants below are kept here as the single source of truth.
// When updating email styling, change here first then mirror in send-notification.ts
// ================================================================

// ── Brand constants (mirrored in send-notification.ts) ───────────
const BRAND_COLOR  = '#00e27b';
const BRAND_DARK   = '#27282f';
const BRAND_BG     = '#f0eff5';
const FROM_EMAIL   = 'SyncProfitPath <noreply@verify.syncprofitpath.com>';
const LOGO_URL     = 'https://syncprofitpath.com/assets/logo.png';
const SITE_URL     = 'https://syncprofitpath.com';

// ── Supabase Edge Function endpoint ─────────────────────────────
const NOTIFY_URL = 'https://syqdwottzrhpclnvzdmz.supabase.co/functions/v1/send-notification';
const NOTIFY_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5cWR3b3R0enJocGNsbnZ6ZG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MzQyMzAsImV4cCI6MjA5MzIxMDIzMH0.YCVOAparA-_MxBrn-O_pXdZgdeFpPXGUeWdu1TkeMz0';

// ── Main function ────────────────────────────────────────────────
async function sendNotification({ type, email, name, amount, coin, ref, method, plan }) {
    try {
        const res = await fetch(NOTIFY_URL, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':        NOTIFY_KEY,
                'Authorization': `Bearer ${NOTIFY_KEY}`,
            },
            body: JSON.stringify({ type, email, name, amount, coin, ref, method, plan }),
        });

        const data = await res.json();

        if (!res.ok) {
            console.warn('Notification failed:', data);
        } else {
            console.log('Notification sent:', type, '→', email);
        }
    } catch (err) {
        // Never block the main flow
        console.warn('Notification error:', err.message);
    }
}
