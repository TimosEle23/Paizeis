/**
 * Test environment. Set before any module reads config/env.ts, which validates
 * on import and would otherwise refuse to load without real secrets.
 */
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-that-is-long-enough-to-pass-validation";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-that-is-long-enough-to-pass-validation";
