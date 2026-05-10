// ================================================================
// NOTIFY.JS — Shared email notification helper
// Loaded on all pages that trigger emails.
// Place in root folder alongside supabase.js.
// Load it AFTER supabase.js on any page that needs it.
//
// NOTE: This app uses custom auth (users table), not Supabase Auth.
// So there is never a Supabase session. The anon key is used with
// both required headers so the Edge Function accepts the request.
// ================================================================

const NOTIFY_URL     = 'https://syqdwottzrhpclnvzdmz.supabase.co/functions/v1/send-notification';
const NOTIFY_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5cWR3b3R0enJocGNsbnZ6ZG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MzQyMzAsImV4cCI6MjA5MzIxMDIzMH0.YCVOAparA-_MxBrn-O_pXdZgdeFpPXGUeWdu1TkeMz0';

async function sendNotification({ type, email, name, amount, coin, ref, method, plan }) {
    try {
        const res = await fetch(NOTIFY_URL, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                // Both headers are required to invoke a Supabase Edge Function
                'apikey':        NOTIFY_ANON_KEY,
                'Authorization': `Bearer ${NOTIFY_ANON_KEY}`,
            },
            body: JSON.stringify({ type, email, name, amount, coin, ref, method, plan }),
        });

        const data = await res.json();
        if (!res.ok) {
            console.warn('Notification failed:', data.error || data);
        } else {
            console.log('Notification sent:', type, '→', email);
        }
    } catch (err) {
        // Never block the main flow — notifications are non-critical
        console.warn('Notification error:', err.message);
    }
}
