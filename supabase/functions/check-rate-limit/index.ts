import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;
const BLOCK_DURATION_MINUTES = 30;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, identifier, attemptType = 'login' } = await req.json();
    
    // Get client IP from headers as fallback identifier
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    // Use provided identifier (email) or fall back to IP
    const rateLimitKey = identifier || clientIp;

    if (!rateLimitKey) {
      return new Response(
        JSON.stringify({ error: 'Identifier required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean up old attempts first
    await supabase.rpc('cleanup_old_rate_limit_attempts');

    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
    const blockWindowStart = new Date(Date.now() - BLOCK_DURATION_MINUTES * 60 * 1000).toISOString();

    if (action === 'check') {
      // Check if blocked (exceeded attempts in the block window)
      const { data: recentAttempts, error: countError } = await supabase
        .from('rate_limit_attempts')
        .select('attempted_at')
        .eq('identifier', rateLimitKey)
        .eq('attempt_type', attemptType)
        .gte('attempted_at', blockWindowStart)
        .order('attempted_at', { ascending: false });

      if (countError) {
        console.error('Error checking rate limit:', countError);
        // Fail open - allow the attempt if we can't check
        return new Response(
          JSON.stringify({ allowed: true, remainingAttempts: MAX_ATTEMPTS }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const attemptCount = recentAttempts?.length || 0;
      const isBlocked = attemptCount >= MAX_ATTEMPTS;
      
      // Calculate when the block expires
      let blockExpiresAt = null;
      if (isBlocked && recentAttempts && recentAttempts.length > 0) {
        const oldestAttemptInWindow = recentAttempts[recentAttempts.length - 1];
        const oldestTime = new Date(oldestAttemptInWindow.attempted_at).getTime();
        blockExpiresAt = new Date(oldestTime + BLOCK_DURATION_MINUTES * 60 * 1000).toISOString();
      }

      return new Response(
        JSON.stringify({
          allowed: !isBlocked,
          remainingAttempts: Math.max(0, MAX_ATTEMPTS - attemptCount),
          blockExpiresAt,
          attemptCount
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'record') {
      // Record a failed attempt
      const { error: insertError } = await supabase
        .from('rate_limit_attempts')
        .insert({
          identifier: rateLimitKey,
          attempt_type: attemptType,
          attempted_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error recording attempt:', insertError);
      }

      // Return updated status
      const { data: updatedAttempts } = await supabase
        .from('rate_limit_attempts')
        .select('id')
        .eq('identifier', rateLimitKey)
        .eq('attempt_type', attemptType)
        .gte('attempted_at', blockWindowStart);

      const newCount = updatedAttempts?.length || 0;

      return new Response(
        JSON.stringify({
          recorded: true,
          remainingAttempts: Math.max(0, MAX_ATTEMPTS - newCount),
          isBlocked: newCount >= MAX_ATTEMPTS
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'reset') {
      // Clear attempts for this identifier (on successful login)
      const { error: deleteError } = await supabase
        .from('rate_limit_attempts')
        .delete()
        .eq('identifier', rateLimitKey)
        .eq('attempt_type', attemptType);

      if (deleteError) {
        console.error('Error resetting rate limit:', deleteError);
      }

      return new Response(
        JSON.stringify({ reset: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: check, record, or reset' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Rate limit error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
