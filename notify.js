// ================================================================
// NOTIFY.JS — Calls send-notification Edge Function
// Place in root folder alongside supabase.js
// ================================================================

const NOTIFY_URL = 'https://syqdwottzrhpclnvzdmz.supabase.co/functions/v1/send-notification';
const NOTIFY_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5cWR3b3R0enJocGNsbnZ6ZG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MzQyMzAsImV4cCI6MjA5MzIxMDIzMH0.YCVOAparA-_MxBrn-O_pXdZgdeFpPXGUeWdu1TkeMz0';

async function sendNotification({ type, email, name, amount, coin, ref, method, plan }) {
    try {
        const res = await fetch(NOTIFY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': NOTIFY_KEY,
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
