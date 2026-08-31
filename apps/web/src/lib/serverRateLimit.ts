import { supabase } from "@/integrations/supabase/client";

interface RateLimitCheckResult {
  allowed: boolean;
  remainingAttempts: number;
  blockExpiresAt?: string;
  attemptCount?: number;
}

interface RateLimitRecordResult {
  recorded: boolean;
  remainingAttempts: number;
  isBlocked: boolean;
}

/**
 * Server-side rate limiting using Supabase edge function.
 * This cannot be bypassed by clearing localStorage or cookies.
 */
export async function checkServerRateLimit(
  identifier: string,
  attemptType: string = 'login'
): Promise<RateLimitCheckResult> {
  try {
    const { data, error } = await supabase.functions.invoke('check-rate-limit', {
      body: { action: 'check', identifier, attemptType }
    });

    if (error) {
      console.error('Server rate limit check error:', error);
      // Fail open - allow attempt if server check fails
      return { allowed: true, remainingAttempts: 5 };
    }

    return data as RateLimitCheckResult;
  } catch (err) {
    console.error('Server rate limit check exception:', err);
    return { allowed: true, remainingAttempts: 5 };
  }
}

/**
 * Record a failed login attempt server-side.
 */
export async function recordFailedAttempt(
  identifier: string,
  attemptType: string = 'login'
): Promise<RateLimitRecordResult> {
  try {
    const { data, error } = await supabase.functions.invoke('check-rate-limit', {
      body: { action: 'record', identifier, attemptType }
    });

    if (error) {
      console.error('Record attempt error:', error);
      return { recorded: false, remainingAttempts: 0, isBlocked: false };
    }

    return data as RateLimitRecordResult;
  } catch (err) {
    console.error('Record attempt exception:', err);
    return { recorded: false, remainingAttempts: 0, isBlocked: false };
  }
}

/**
 * Reset rate limit on successful login.
 */
export async function resetServerRateLimit(
  identifier: string,
  attemptType: string = 'login'
): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('check-rate-limit', {
      body: { action: 'reset', identifier, attemptType }
    });

    if (error) {
      console.error('Reset rate limit error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Reset rate limit exception:', err);
    return false;
  }
}

/**
 * Format the block expiration time for display.
 */
export function formatBlockTimeRemaining(blockExpiresAt: string): string {
  const expiresAt = new Date(blockExpiresAt).getTime();
  const now = Date.now();
  const remainingMs = expiresAt - now;
  
  if (remainingMs <= 0) {
    return 'now';
  }
  
  const minutes = Math.ceil(remainingMs / (60 * 1000));
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}
