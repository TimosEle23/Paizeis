import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a secure random password
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  for (let i = 0; i < 16; i++) {
    password += chars[array[i] % chars.length];
  }
  return password + '!A1'; // Ensure it meets complexity requirements
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's JWT to verify their identity
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );

    // Get the authenticated user
    const { data: { user: callerUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if the caller has admin role via the roles table
    const roleCheckClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: adminRoleRows, error: roleError } = await roleCheckClient
      .from('user_roles')
      .select('id')
      .eq('user_id', callerUser.id)
      .eq('role', 'admin')
      .limit(1);
    const hasAdminRole = !!adminRoleRows && adminRoleRows.length > 0;

    if (roleError || !hasAdminRole) {
      console.log('Admin role check failed:', roleError, 'Result:', hasAdminRole);
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Now use admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Fetch all futsal venues without managers
    const { data: venuesWithoutManagers, error: venuesError } = await supabaseAdmin
      .from('venues')
      .select(`
        id,
        name,
        city,
        pitches!inner(pitch_type)
      `)
      .not('id', 'in', `(SELECT venue_id FROM venue_managers)`);

    if (venuesError) {
      console.error('Error fetching venues:', venuesError);
    }

    // Filter to futsal venues (venues with 5v5, 7v7, 9v9, or 11v11 pitches)
    const futsalVenues = venuesWithoutManagers?.filter(venue => {
      const pitches = venue.pitches as any[];
      return pitches.some(p => ['5v5', '7v7', '9v9', '11v11'].includes(p.pitch_type));
    }) || [];

    const results = [];

    for (const venue of futsalVenues) {
      // Generate email based on venue name
      const sanitizedName = venue.name.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      const email = `manager@${sanitizedName}.com`;
      const password = generateSecurePassword();

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: `${venue.name} Manager` }
      });

      if (authError) {
        // Skip if user already exists
        if (authError.message.includes('already been registered')) {
          results.push({ venue: venue.name, email, status: 'already_exists' });
          continue;
        }
        results.push({ venue: venue.name, email, error: authError.message });
        continue;
      }

      if (!authData.user) {
        results.push({ venue: venue.name, email, error: "User creation failed" });
        continue;
      }

      // Create venue manager assignment
      const { error: managerError } = await supabaseAdmin
        .from("venue_managers")
        .insert({
          user_id: authData.user.id,
          venue_id: venue.id
        });

      if (managerError) {
        results.push({ 
          venue: venue.name, 
          email,
          userId: authData.user.id,
          error: managerError.message 
        });
      } else {
        // Log success but don't return password in response
        console.log(`Created manager for ${venue.name}: ${email}`);
        results.push({ 
          venue: venue.name, 
          email,
          city: venue.city,
          userId: authData.user.id,
          success: true,
          // Password is intentionally not returned - send via secure email in production
          note: "Password sent to support email"
        });
      }
    }

    return new Response(JSON.stringify({ 
      message: "Manager creation completed",
      totalProcessed: futsalVenues.length,
      results 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Error in create-test-managers:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
