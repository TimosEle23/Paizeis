import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
const MAX_BATCH = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      throw new Error("Missing Google Maps connector credentials");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: venues, error } = await admin
      .from("venues")
      .select("id, name, location, city")
      .is("latitude", null)
      .limit(MAX_BATCH);
    if (error) throw error;

    let updated = 0;
    for (const venue of venues ?? []) {
      const address = `${venue.name}, ${venue.location}, ${venue.city}, Cyprus`;
      const res = await fetch(
        `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=cy`,
        {
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
          },
        },
      );

      if (res.status === 403) {
        const details: Array<{ reason?: string }> = (await res.json())?.error?.details ?? [];
        const reason = details.find((d) => d.reason)?.reason;
        if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
          throw new Error(
            'Google Maps server key is referrer-restricted. In Google Cloud Console, set the server key\'s application restrictions to "None" or "IP addresses".',
          );
        }
        if (reason === "API_KEY_SERVICE_BLOCKED") {
          throw new Error(
            "Google Maps server key does not allow the Geocoding API. Add it to the server key's allowed-APIs list.",
          );
        }
        throw new Error("Google Maps request was denied (403).");
      }

      if (!res.ok) {
        const body = await res.text();
        console.error(`Geocode failed [${res.status}]: ${body}`);
        continue;
      }

      const json = await res.json();
      const loc = json?.results?.[0]?.geometry?.location;
      if (!loc) {
        console.warn(`No geocode result for ${address} (${json?.status})`);
        continue;
      }

      await admin
        .from("venues")
        .update({ latitude: loc.lat, longitude: loc.lng })
        .eq("id", venue.id);
      updated++;
    }

    return new Response(JSON.stringify({ updated, remaining: (venues?.length ?? 0) - updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("geocode-venues error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
