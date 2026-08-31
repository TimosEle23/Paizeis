import bcrypt from "bcryptjs";

/**
 * bcrypt, matching what Supabase used. That is not incidental: hashes migrated
 * from Supabase verify directly here, which is the reason existing users keep
 * their passwords instead of being forced to reset.
 */
const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    // Google-only accounts have no hash. Still run a comparison so the response
    // time does not reveal which addresses have passwords.
    await bcrypt.compare(plain, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
    return false;
  }
  return bcrypt.compare(plain, hash);
}
