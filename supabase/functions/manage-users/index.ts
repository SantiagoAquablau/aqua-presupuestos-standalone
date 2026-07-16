import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser } } = await supabaseAdmin.auth.getUser(token);

    if (!requestingUser) {
      return new Response(JSON.stringify({ error: 'No autenticat' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: roleCheck } = await supabaseAdmin.rpc('has_role', { _user_id: requestingUser.id, _role: 'admin' });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: 'No autoritzat' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { action, ...body } = await req.json();

    if (action === 'create') {
      const { email, password, full_name, role } = body;

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Insert role
      await supabaseAdmin.from('user_roles').insert({ user_id: newUser.user.id, role });

      // Update profile full_name
      await supabaseAdmin.from('profiles').update({ full_name }).eq('id', newUser.user.id);

      return new Response(JSON.stringify({ user: newUser.user }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'update') {
      const { user_id, full_name, role, active } = body;

      await supabaseAdmin.from('profiles').update({ full_name, active }).eq('id', user_id);

      if (role) {
        await supabaseAdmin.from('user_roles').upsert({ user_id, role }, { onConflict: 'user_id,role' });
        // Remove other roles
        await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id).neq('role', role);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'delete') {
      const { user_id } = body;
      await supabaseAdmin.from('profiles').update({ active: false }).eq('id', user_id);
      // Immediately revoke all active sessions so a deactivated user loses API access
      // without waiting for their JWT to expire.
      try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
        const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user_id}/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            apikey: SERVICE_ROLE_KEY,
          },
        });
      } catch (_e) {
        // Best-effort: profile is already deactivated and ProtectedRoute will block access.
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'delete_permanent') {
      const { user_id } = body;
      const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (delError) {
        return new Response(JSON.stringify({ error: delError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Acció no vàlida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
