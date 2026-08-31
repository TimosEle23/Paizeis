// Client-side rate limiting utility for authentication endpoints
// This provides a first line of defense against brute force attacks
// Uses localStorage for persistence across page refreshes

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  blockedUntil: number | null;
}

interface RateLimitStore {
  [key: string]: RateLimitEntry;
}

// Configuration
const MAX_ATTEMPTS = 5; // Maximum login attempts
const WINDOW_MS = 15 * 60 * 1000; // 15 minute window
const BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minute block after exceeding attempts
const STORAGE_KEY = 'paizeis_rate_limit';

function getStore(): RateLimitStore {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveStore(store: RateLimitStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Silently fail if localStorage is not available
  }
}

export function checkRateLimit(identifier: string): { allowed: boolean; remainingAttempts: number; blockedUntil: Date | null } {
  const now = Date.now();
  const store = getStore();
  const entry = store[identifier];

  // No previous attempts
  if (!entry) {
    store[identifier] = {
      attempts: 1,
      firstAttempt: now,
      blockedUntil: null,
    };
    saveStore(store);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1, blockedUntil: null };
  }

  // Check if currently blocked
  if (entry.blockedUntil && now < entry.blockedUntil) {
    return { 
      allowed: false, 
      remainingAttempts: 0, 
      blockedUntil: new Date(entry.blockedUntil) 
    };
  }

  // Reset if blocked period has passed or window expired
  if ((entry.blockedUntil && now >= entry.blockedUntil) || (now - entry.firstAttempt > WINDOW_MS)) {
    store[identifier] = {
      attempts: 1,
      firstAttempt: now,
      blockedUntil: null,
    };
    saveStore(store);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1, blockedUntil: null };
  }

  // Increment attempts
  const newAttempts = entry.attempts + 1;

  // Check if should block
  if (newAttempts > MAX_ATTEMPTS) {
    const blockedUntil = now + BLOCK_DURATION_MS;
    store[identifier] = {
      ...entry,
      attempts: newAttempts,
      blockedUntil,
    };
    saveStore(store);
    return { allowed: false, remainingAttempts: 0, blockedUntil: new Date(blockedUntil) };
  }

  // Update attempts
  store[identifier] = {
    ...entry,
    attempts: newAttempts,
  };
  saveStore(store);

  return { 
    allowed: true, 
    remainingAttempts: MAX_ATTEMPTS - newAttempts, 
    blockedUntil: null 
  };
}

export function resetRateLimit(identifier: string): void {
  const store = getStore();
  delete store[identifier];
  saveStore(store);
}

// Clean up old entries periodically (call this occasionally)
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  const store = getStore();
  let modified = false;
  
  for (const key of Object.keys(store)) {
    const entry = store[key];
    // Remove entries that are expired and not blocked
    if (!entry.blockedUntil && now - entry.firstAttempt > WINDOW_MS) {
      delete store[key];
      modified = true;
    }
    // Remove entries whose block has expired
    if (entry.blockedUntil && now > entry.blockedUntil + WINDOW_MS) {
      delete store[key];
      modified = true;
    }
  }
  
  if (modified) {
    saveStore(store);
  }
}
