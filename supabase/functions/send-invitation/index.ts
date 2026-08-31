import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting (per user, per minute)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 10; // Max 10 invitations per minute per user
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or initialize the rate limit
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (userLimit.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  userLimit.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - userLimit.count };
}

interface InvitationRequest {
  inviteeEmail: string;
  inviteeName: string;
  teamName: string;
  inviterName: string;
  matchDate?: string;
  matchTime?: string;
  venueName?: string;
  tournamentName?: string;
  invitationType?: 'team' | 'booking' | 'tournament';
  isNewUser?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT and get user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized: No authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Authenticated user:", user.id);

    // Check rate limit for this user
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      console.warn("Rate limit exceeded for user:", user.id);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait before sending more invitations." }),
        { 
          status: 429, 
          headers: { 
            "Content-Type": "application/json", 
            "X-RateLimit-Remaining": "0",
            "Retry-After": "60",
            ...corsHeaders 
          } 
        }
      );
    }

    const { 
      inviteeEmail, 
      inviteeName, 
      teamName, 
      inviterName, 
      matchDate, 
      matchTime,
      venueName,
      tournamentName,
      invitationType = 'team',
      isNewUser = false
    }: InvitationRequest = await req.json();

    // Validate required fields
    if (!inviteeEmail || !inviteeName || !teamName || !inviterName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteeEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Sending invitation to:", inviteeEmail, "Type:", invitationType, "By user:", user.id, "Remaining:", rateLimit.remaining);

    // Determine the invitation context and redirect URL
    let subject = '';
    let heading = '';
    let message = '';
    let buttonText = 'Sign In to Accept Invitation';
    let redirectUrl = 'https://paizeiscy.com/teams'; // Default redirect
    let signupNote = '';
    
    // For new users, redirect to signup page
    if (isNewUser) {
      redirectUrl = 'https://paizeiscy.com/auth';
      signupNote = `<p style="font-size: 16px; line-height: 1.6; background-color: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb;">
        <strong>📝 New to Pezeis?</strong><br/>
        You'll need to create an account first. After signing up, you'll automatically see this team invitation waiting for you!
      </p>`;
    }
    
    if (invitationType === 'tournament') {
      subject = `You're invited to join ${teamName} for ${tournamentName}!`;
      heading = 'Tournament Invitation';
      message = `<strong>${inviterName}</strong> has invited you to join the team <strong>${teamName}</strong> for the tournament <strong>${tournamentName}</strong>!`;
      if (!isNewUser) redirectUrl = 'https://paizeiscy.com/tournaments';
      buttonText = isNewUser ? 'Sign Up & Join Tournament' : 'View Tournament & Accept';
    } else if (invitationType === 'booking') {
      subject = `You're invited to play with ${teamName}!`;
      heading = 'Match Invitation';
      message = `<strong>${inviterName}</strong> has invited you to join the team <strong>${teamName}</strong> for an upcoming match!`;
      if (!isNewUser) redirectUrl = 'https://paizeiscy.com/teams';
      buttonText = isNewUser ? 'Sign Up & Join Match' : 'Accept Match Invitation';
    } else {
      subject = `You're invited to join ${teamName}!`;
      heading = 'Team Invitation';
      message = `<strong>${inviterName}</strong> has invited you to join the team <strong>${teamName}</strong> on Pezeis!`;
      if (!isNewUser) redirectUrl = 'https://paizeiscy.com/teams';
      buttonText = isNewUser ? 'Sign Up & Join Team' : 'Accept Team Invitation';
    }

    const matchDetails = matchDate && matchTime && venueName 
      ? `
        <p><strong>Match Details:</strong></p>
        <ul style="list-style: none; padding-left: 0;">
          <li>📅 Date: ${matchDate}</li>
          <li>🕐 Time: ${matchTime}</li>
          <li>📍 Venue: ${venueName}</li>
        </ul>
      `
      : '';

    const emailResponse = await resend.emails.send({
      from: "Pezeis <pezeiscy@gmail.com>",
      to: [inviteeEmail],
      replyTo: "pezeiscy@gmail.com",
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; margin-bottom: 20px;">${heading}</h1>
          <p style="font-size: 16px; line-height: 1.6;">Hi ${inviteeName},</p>
          <p style="font-size: 16px; line-height: 1.6;">${message}</p>
          ${signupNote}
          ${matchDetails}
          <p style="font-size: 16px; line-height: 1.6; margin-top: 20px;">
            ${invitationType === 'booking' ? 'Accept the invitation to confirm your spot!' : 'Join your team and never miss a match!'}
          </p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${redirectUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              ${buttonText}
            </a>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px; text-align: center;">
            Pezeis - Your Football Booking Platform<br>
            This is an automated message, please do not reply.
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Remaining": rateLimit.remaining.toString(),
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
