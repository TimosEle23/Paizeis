/**
 * Validates an export before anything is written to MongoDB.
 *
 *   npm run export:check --workspace @paizeis/migrate
 *
 * Cheap to run, and catches the failures that would otherwise surface halfway
 * through a migration: a truncated download, a missing table, password hashes
 * that did not survive the round trip.
 */
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadExportFile } from "./loadExport.js";

/** Tables the migration needs. A missing one means an incomplete export. */
const REQUIRED = [
  "users", "profiles", "user_roles", "venues", "pitches", "venue_managers",
  "teams", "team_roster", "team_members", "bookings", "player_stats",
  "match_stats", "player_listings", "substitute_players", "tournaments",
  "tournament_teams", "tournament_matches", "email_invitations",
];

const BCRYPT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

/** Accepts the CSV download or the JSON; defaults to whichever is present. */
function defaultPath(): string {
  for (const candidate of ["data/export.json", "data/export.csv"]) {
    if (existsSync(resolve(candidate))) return candidate;
  }
  return "data/export.json";
}

const path = resolve(process.argv[2] ?? defaultPath());
const { data, wasCsv } = loadExportFile(path);

/**
 * Everything downstream reads JSON. A .csv input is converted to a sibling
 * .json rather than overwritten, so the original download stays untouched;
 * a .json that turned out to be CSV inside is fixed in place.
 */
let jsonPath = path;
if (wasCsv) {
  jsonPath = path.endsWith(".csv") ? path.replace(/\.csv$/, ".json") : path;
  writeFileSync(jsonPath, JSON.stringify(data, null, 2) + "\n");
  console.log(`converted CSV → ${jsonPath}\n`);
}

console.log(`export      ${jsonPath}`);
console.log(`taken at    ${data.exported_at ?? "unknown"}\n`);

let problems = 0;

console.log("table                    rows");
for (const table of REQUIRED) {
  const rows = data[table];
  if (!Array.isArray(rows)) {
    console.log(`  ${table.padEnd(22)} MISSING`);
    problems++;
    continue;
  }
  console.log(`  ${table.padEnd(22)} ${String(rows.length).padStart(4)}`);
}

const users = (data.users ?? []) as Array<{ email?: string; encrypted_password?: string | null }>;
const hashed = users.filter((u) => typeof u.encrypted_password === "string" && u.encrypted_password.length > 0);
const validHashes = hashed.filter((u) => BCRYPT.test(u.encrypted_password as string));
const oauthOnly = users.length - hashed.length;

console.log(`\npasswords`);
console.log(`  accounts             ${users.length}`);
console.log(`  with a password      ${hashed.length}`);
console.log(`  valid bcrypt hashes  ${validHashes.length}`);
console.log(`  oauth only (Google)  ${oauthOnly}`);

if (validHashes.length !== hashed.length) {
  console.log(`\n  ${hashed.length - validHashes.length} hash(es) are not valid bcrypt — those users would be locked out.`);
  problems++;
}

const withoutEmail = users.filter((u) => !u.email).length;
if (withoutEmail > 0) {
  console.log(`\n  ${withoutEmail} account(s) have no email address — they cannot sign in after migration.`);
  problems++;
}

console.log(problems === 0 ? "\n✓ export is complete and usable\n" : `\n✗ ${problems} problem(s) found\n`);
process.exit(problems === 0 ? 0 : 1);
