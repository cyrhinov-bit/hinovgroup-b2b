import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: authUsersData, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    if (authError) throw authError

    const users = authUsersData.users

    const { data: profiles, error: profilesError } = await supabaseAdmin.from('profiles').select('id')
    if (profilesError) throw profilesError

    const profileIds = new Set(profiles.map((p: any) => p.id))
    
    let recoveredCount = 0
    const recoveredUsers = []

    for (const user of users) {
      if (!profileIds.has(user.id)) {
        // Not in profiles, let's recover
        const name = user.user_metadata?.name || user.email.split('@')[0]
        const role = user.user_metadata?.role || 'Responsable'
        // For s.diallo we set 456987, else a default 000000 or the same 456987
        const pin = user.email.includes('s.diallo') ? '456987' : '456987'

        const { error: insertError } = await supabaseAdmin.from('profiles').insert([{
          id: user.id,
          email: user.email,
          name: name,
          role: role,
          pin: pin,
          active: true,
          last_login: 'Jamais'
        }])

        if (!insertError) {
          recoveredCount++
          recoveredUsers.push({ email: user.email, name, role, pin })
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, recoveredCount, recoveredUsers }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
