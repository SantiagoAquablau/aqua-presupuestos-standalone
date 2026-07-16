// Compute driving distance in km between provider address and destination address.
// Uses Nominatim (OSM geocoding) + OSRM public routing API. No API key required.
// deno-lint-ignore-file no-explicit-any

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UA = "aquablau-pressupostos/1.0 (contact@aquablau.com)";

async function geocodeOnce(q: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=es,ad,fr&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ca,es,en" } });
  if (!res.ok) return null;
  const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!arr.length) return null;
  return { lat: Number(arr[0].lat), lon: Number(arr[0].lon) };
}

function variants(address: string): string[] {
  const a = address.trim();
  const out = new Set<string>();
  out.add(a);
  // Strip leading street/number, keep from first comma
  const commaParts = a.split(",").map((s) => s.trim()).filter(Boolean);
  if (commaParts.length > 1) {
    out.add(commaParts.slice(1).join(", "));
    out.add(commaParts[commaParts.length - 1]);
    if (commaParts.length >= 2) {
      out.add(commaParts.slice(-2).join(", "));
    }
  }
  // Extract postal code + rest
  const cp = a.match(/\b\d{5}\b[^,]*/);
  if (cp) out.add(cp[0]);
  return Array.from(out);
}

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  for (const q of variants(address)) {
    const r = await geocodeOnce(q);
    if (r) return r;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { provider_address, destination_address } = await req.json();
    if (!provider_address || !destination_address) {
      return new Response(JSON.stringify({ error: "Missing addresses" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [origin, dest] = await Promise.all([
      geocode(provider_address),
      geocode(destination_address),
    ]);
    if (!origin || !dest) {
      return new Response(
        JSON.stringify({ error: "Could not geocode addresses", origin, dest }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${dest.lon},${dest.lat}?overview=false`;
    const routeRes = await fetch(osrmUrl, { headers: { "User-Agent": UA } });
    if (!routeRes.ok) {
      const body = await routeRes.text();
      return new Response(
        JSON.stringify({ error: "Routing failed", status: routeRes.status, body }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const json: any = await routeRes.json();
    const meters = json?.routes?.[0]?.distance;
    if (typeof meters !== "number") {
      return new Response(JSON.stringify({ error: "No route found" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const km = Math.ceil(meters / 1000);
    return new Response(
      JSON.stringify({ km, meters, origin, destination: dest }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});