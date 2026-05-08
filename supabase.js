// supabase.js — shared client for all pages
const SUPABASE_URL = 'https://syqdwottzrhpclnvzdmz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5cWR3b3R0enJocGNsbnZ6ZG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MzQyMzAsImV4cCI6MjA5MzIxMDIzMH0.YCVOAparA-_MxBrn-O_pXdZgdeFpPXGUeWdu1TkeMz0';

// ── Public client — used everywhere for reads and user-scoped writes
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Admin client — uses the service role key so it bypasses RLS.
//    ONLY loaded on admin pages. Never expose this key to regular users.
//    Replace the placeholder below with your actual service_role key from:
//    Supabase → Project Settings → API → service_role (secret)
const SUPABASE_SERVICE_KEY = 'YOUR_SERVICE_ROLE_KEY_HERE';
const dbAdmin = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession:   false,
        detectSessionFromUrl: false
    }
});