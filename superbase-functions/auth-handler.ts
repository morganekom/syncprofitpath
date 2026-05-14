import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { action, email, password, userId } = await req.json()

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL'),
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        )

        // ── SIGNUP: hash the password ──
        if (action === 'signup') {
            const hashedPassword = await bcrypt.hash(password)
            return new Response(
                JSON.stringify({ hashedPassword }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ── LOGIN: verify the password ──
        if (action === 'login') {
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email.toLowerCase())
                .maybeSingle()

            if (error || !user) {
                return new Response(
                    JSON.stringify({ success: false, message: 'User not found' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
                )
            }

            const passwordMatch = await bcrypt.compare(password, user.password)

            if (!passwordMatch) {
                return new Response(
                    JSON.stringify({ success: false, message: 'Incorrect password' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
                )
            }

            // Update last login
            await supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', user.id)

            return new Response(
                JSON.stringify({ success: true, user }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ── VERIFY ADMIN: check role server-side ──
        if (action === 'verify_admin') {
            const { data: user, error } = await supabase
                .from('users')
                .select('role')
                .eq('id', userId)
                .single()

            if (error || !user || user.role !== 'admin') {
                return new Response(
                    JSON.stringify({ isAdmin: false }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
                )
            }

            return new Response(
                JSON.stringify({ isAdmin: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({ error: 'Unknown action' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )

    } catch (err) {
        return new Response(
            JSON.stringify({ error: err.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})