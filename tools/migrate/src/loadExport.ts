import { readFileSync } from "node:fs";

/**
 * Reads the Lovable SQL-editor export in whichever shape it arrived.
 *
 * The editor's download button produces CSV: a header line `export`, then the
 * whole JSON value as one quoted field with every internal `"` doubled. Copying
 * the result cell by hand gives raw JSON. And a half-edited file may have had
 * the header deleted, leaving just the quoted field.
 *
 * All three turn up in practice, so this accepts all three rather than making
 * the operator diagnose CSV quoting rules mid-migration.
 */
export interface SupabaseExport {
  exported_at?: string;
  users?: unknown[];
  [table: string]: unknown;
}

export interface LoadedExport {
  data: SupabaseExport;
  /** True when the source was CSV and can be rewritten as real JSON. */
  wasCsv: boolean;
}

export function loadExport(path: string): SupabaseExport {
  return loadExportFile(path).data;
}

export function loadExportFile(path: string): LoadedExport {
  let text = readFileSync(path, "utf8").trim();

  // 1. Already JSON — the copy-the-cell path.
  if (text.startsWith("{")) {
    return { data: JSON.parse(text) as SupabaseExport, wasCsv: false };
  }

  // 2. Strip the CSV header line if it is still there.
  const newline = text.indexOf("\n");
  if (newline !== -1) {
    const header = text.slice(0, newline).trim().replaceAll('"', "");
    if (header === "export") text = text.slice(newline + 1).trim();
  }

  // 3. Unwrap the quoted CSV field and undouble its escaped quotes.
  if (text.startsWith('"') && text.endsWith('"')) {
    const unwrapped = text.slice(1, -1).replaceAll('""', '"');
    return { data: JSON.parse(unwrapped) as SupabaseExport, wasCsv: true };
  }

  throw new Error(
    `${path} is not a recognisable export.\n` +
      `Expected either JSON starting with "{", or the CSV download from the SQL editor.\n` +
      `Re-run tools/migrate/queries/export.sql and save the result unmodified.`,
  );
}
