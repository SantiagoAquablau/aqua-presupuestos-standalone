import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Require authenticated admin caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub;
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    const { data: isAdministrativa } = await supabase.rpc('has_role', { _user_id: userId, _role: 'administrativa' });
    const { data: isComercial } = await supabase.rpc('has_role', { _user_id: userId, _role: 'comercial' });
    if (!isAdmin && !isAdministrativa && !isComercial) {
      return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = Deno.env.get('GESTIO_EDGE_FUNCTION_URL');
    const apiKey = Deno.env.get('PRESSUPOSTOS_API_KEY');
    console.log('[create-obra-external] env check', {
      GESTIO_EDGE_FUNCTION_URL_present: !!url,
      PRESSUPOSTOS_API_KEY_present: !!apiKey,
    });
    if (!url || !apiKey) {
      console.error('[create-obra-external] Missing config', {
        GESTIO_EDGE_FUNCTION_URL_present: !!url,
        PRESSUPOSTOS_API_KEY_present: !!apiKey,
      });
      return new Response(JSON.stringify({ success: false, error: 'Missing config' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let rawPayload: any;
    try {
      rawPayload = await req.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid payload' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isStr = (v: unknown, max = 500) => typeof v === 'string' && v.length > 0 && v.length <= max;
    const isOptStr = (v: unknown, max = 500) => v === undefined || v === null || (typeof v === 'string' && v.length <= max);
    const errors: string[] = [];
    if (!isStr(rawPayload.referencia, 100)) errors.push('referencia');
    if (!isStr(rawPayload.cliente, 255)) errors.push('cliente');
    if (!isOptStr(rawPayload.poblacion, 255)) errors.push('poblacion');
    if (!isOptStr(rawPayload.ubicacion, 255)) errors.push('ubicacion');
    if (!isOptStr(rawPayload.direccion_completa, 500)) errors.push('direccion_completa');
    if (!isStr(rawPayload.tipo_obra, 100)) errors.push('tipo_obra');
    if (!isStr(rawPayload.estado_obra, 50)) errors.push('estado_obra');
    if (!isStr(rawPayload.numero_presupuesto, 100)) errors.push('numero_presupuesto');
    if (typeof rawPayload.total_presupuesto !== 'number' || !isFinite(rawPayload.total_presupuesto) || rawPayload.total_presupuesto < 0) errors.push('total_presupuesto');
    if (!isOptStr(rawPayload.comercial_vendedor, 255)) errors.push('comercial_vendedor');
    if (!isOptStr(rawPayload.enlace_presupuesto_pdf, 1000)) errors.push('enlace_presupuesto_pdf');
    if (!isOptStr(rawPayload.enlace_presupuesto, 1000)) errors.push('enlace_presupuesto');
    if (rawPayload.tiene_dos_contratos !== undefined && typeof rawPayload.tiene_dos_contratos !== 'boolean') errors.push('tiene_dos_contratos');
    if (!isOptStr(rawPayload.fecha_creacion, 50)) errors.push('fecha_creacion');
    if (errors.length > 0) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid payload fields', fields: errors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Allowlist: rebuild a clean object, dropping any unexpected keys
    const payload = {
      referencia: rawPayload.referencia,
      cliente: rawPayload.cliente,
      poblacion: rawPayload.poblacion ?? '',
      ubicacion: rawPayload.ubicacion ?? '',
      direccion_completa: rawPayload.direccion_completa ?? '',
      tipo_obra: rawPayload.tipo_obra,
      estado_obra: rawPayload.estado_obra,
      numero_presupuesto: rawPayload.numero_presupuesto,
      total_presupuesto: rawPayload.total_presupuesto,
      comercial_vendedor: rawPayload.comercial_vendedor ?? '',
      enlace_presupuesto_pdf: rawPayload.enlace_presupuesto_pdf ?? '',
      enlace_presupuesto: rawPayload.enlace_presupuesto ?? '',
      tiene_dos_contratos: rawPayload.tiene_dos_contratos ?? false,
      fecha_creacion: rawPayload.fecha_creacion ?? new Date().toISOString(),
    };
    console.log('[create-obra-external] calling external URL', { numero_presupuesto: payload.numero_presupuesto });

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

    console.log('[create-obra-external] external response', {
      status: resp.status,
      ok: resp.ok,
      data,
    });

    return new Response(JSON.stringify({ success: resp.ok && data?.success !== false, status: resp.status, data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[create-obra-external] network/exception error', e?.message ?? e);
    return new Response(JSON.stringify({ success: false, error: e?.message ?? 'Network error' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});