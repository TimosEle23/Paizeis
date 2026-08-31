#!/usr/bin/env node
/**
 * Enforces the client/server split.
 *
 *   HARD RULE  — database drivers (mongoose, mongodb) may only be imported by
 *                server-side code: apps/api and tools/migrate. A *client*
 *                importing them means the split has broken and credentials are
 *                heading for a bundle someone can read.
 *
 *   MIGRATION  — @supabase/supabase-js is still allowed in apps/web while the
 *                Phase 4 cutover is in progress. This prints the remaining
 *                files so the burn-down is visible, and flips to a hard failure
 *                once the count reaches zero (see FAIL_ON_SUPABASE below).
 *
 * Run: node tools/check/boundaries.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** Set to true the moment apps/web no longer imports Supabase. */
const FAIL_ON_SUPABASE = false;

const DB_DRIVERS = ["mongoose", "mongodb"];
const SUPABASE = "@supabase/supabase-js";

const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", ".expo", "supabase"]);
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (SOURCE_EXT.test(entry)) yield full;
  }
}

function importsOf(source) {
  const specifiers = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

const violations = [];
const supabaseFiles = [];

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  if (rel.startsWith("tools/check/")) continue;
  // The wrapper and generated types are the migration's last files to go.
  if (rel.startsWith("apps/web/src/integrations/supabase/")) continue;

  const specifiers = importsOf(readFileSync(file, "utf8"));
  // tools/migrate is an operational script that writes to Mongo directly; it
  // never ships to a user, so it is server-side for the purposes of this rule.
  const isServerSide = rel.startsWith("apps/api/") || rel.startsWith("tools/migrate/");

  for (const spec of specifiers) {
    const bare = spec.split("/")[0].startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];

    if (DB_DRIVERS.includes(bare) && !isServerSide) {
      violations.push(
        `${rel} imports "${spec}" — database drivers belong in apps/api (or tools/migrate) only`,
      );
    }
    // Both the SDK itself and the app's local wrapper around it count —
    // the wrapper is what most pages actually import.
    const isSupabase = bare === SUPABASE || /(^|\/)integrations\/supabase(\/|$)/.test(spec);
    if (isSupabase && !supabaseFiles.includes(rel)) {
      supabaseFiles.push(rel);
    }
  }
}

let failed = false;

if (violations.length > 0) {
  failed = true;
  console.error("\nBoundary violations:\n");
  for (const v of violations) console.error(`  ✗ ${v}`);
}

if (supabaseFiles.length > 0) {
  const label = FAIL_ON_SUPABASE ? "✗" : "•";
  const stream = FAIL_ON_SUPABASE ? console.error : console.log;
  if (FAIL_ON_SUPABASE) failed = true;
  stream(`\nSupabase still imported in ${supabaseFiles.length} file(s) — Phase 4 burn-down:\n`);
  for (const f of supabaseFiles.sort()) stream(`  ${label} ${f}`);
  if (!FAIL_ON_SUPABASE) {
    stream("\n  (allowed until the web cutover completes; set FAIL_ON_SUPABASE=true then)");
  }
}

if (!failed) {
  console.log("\n✓ Boundaries hold. Database drivers stay server-side.\n");
}

process.exit(failed ? 1 : 0);
