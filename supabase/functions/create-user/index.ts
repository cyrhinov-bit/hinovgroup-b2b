// @ts-ignore
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

declare var Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Verify caller
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) throw new Error('Non autorisé')

    // Get caller role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const callerRole = profile?.role || 'Inconnu'

    interface CreateUserPayload {
      email: string;
      pin: string;
      name: string;
      role: string;
      serviceId?: string;
      posReturnsEnabled?: boolean;
      posCatalogueEnabled?: boolean;
      posSupplyEnabled?: boolean;
      posInventoryEnabled?: boolean;
      posStockEnabled?: boolean;
    }

    const { email, pin, name, role, serviceId, posReturnsEnabled, posCatalogueEnabled, posSupplyEnabled, posInventoryEnabled, posStockEnabled } = await req.json() as CreateUserPayload

    // Autorisations
    if (role === 'SuperAdmin') throw new Error('Impossible de créer un SuperAdmin')
    if (role === 'Directeur' && callerRole !== 'SuperAdmin') {
      throw new Error('Seul un SuperAdmin peut créer un Directeur')
    }
    if (callerRole === 'Gerant' && role !== 'Caissier') {
      throw new Error('Un Gérant ne peut créer que des Caissiers')
    }
    if (callerRole !== 'SuperAdmin' && callerRole !== 'Directeur' && callerRole !== 'Gerant') {
      throw new Error('Vous n\'avez pas les droits pour créer un utilisateur')
    }

    // 1. Create auth user
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: pin,
      email_confirm: true,
      user_metadata: { name, role }
    })

    if (createError) throw createError
    const newUserId = authData.user.id

    // 2. Insert into profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([{
        id: newUserId,
        email,
        name,
        role,
        pin,
        service_id: serviceId || null,
        active: true,
        pos_returns_enabled: posReturnsEnabled === true,
        pos_catalogue_enabled: posCatalogueEnabled === true,
        pos_supply_enabled: posSupplyEnabled === true,
        pos_inventory_enabled: posInventoryEnabled === true,
        pos_stock_enabled: posStockEnabled === true
      }])

    if (profileError) {
      // Rollback
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      throw profileError
    }

    return new Response(
      JSON.stringify({ id: newUserId, name, email, role, serviceId, posReturnsEnabled, posCatalogueEnabled, posSupplyEnabled, posInventoryEnabled, posStockEnabled }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
