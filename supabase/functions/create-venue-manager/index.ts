import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('No authorization header');
      return new Response(
        JSON.stringify({ error: "Unauthorized - No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract the JWT token from the header
    const token = authHeader.replace('Bearer ', '');
    console.log('Token received, length:', token.length);

    // Create admin client to verify the user via the token
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

    // Get user from token
    const { data: { user: callerUser }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !callerUser) {
      console.log('Invalid token error:', userError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Caller user:', callerUser.id, callerUser.email);

    // Check if the caller has admin role using the admin client
    const { data: adminRoleRows, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', callerUser.id)
      .eq('role', 'admin')
      .limit(1);
    const hasAdminRole = !!adminRoleRows && adminRoleRows.length > 0;

    console.log('Admin role check:', hasAdminRole, 'Error:', roleError);

    if (roleError || !hasAdminRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { email, fullName, venueId, password } = await req.json();

    if (!email || !fullName || !venueId || !password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, fullName, venueId, password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // supabaseAdmin is already created above for auth verification

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: "User creation failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Created user:', authData.user.id, email);

    // Create venue manager assignment
    const { error: managerError } = await supabaseAdmin
      .from("venue_managers")
      .insert({
        user_id: authData.user.id,
        venue_id: venueId
      });

    if (managerError) {
      console.error('Manager assignment error:', managerError);
      return new Response(
        JSON.stringify({ error: managerError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Created venue manager:', email, 'for venue:', venueId);

    return new Response(JSON.stringify({ 
      success: true,
      message: "Venue manager created successfully",
      userId: authData.user.id,
      email: email
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Error in create-venue-manager:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
