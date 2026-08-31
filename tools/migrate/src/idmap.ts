import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { Types } from "mongoose";

/**
 * Maps Postgres UUIDs to the MongoDB ObjectIds they became, and persists the
 * mapping to disk.
 *
 * This is what makes the migration rerunnable. A migration that allocates fresh
 * ObjectIds on every run duplicates every document the second time it is used —
 * and it will be used more than once, because the rehearsal against a scratch
 * database is the whole point.
 */
export class IdMap {
  private readonly map = new Map<string, string>();

  constructor(private readonly path: string) {
    if (existsSync(path)) {
      const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
      for (const [key, value] of Object.entries(raw)) this.map.set(key, value);
    }
  }

  /**
   * The ObjectId for a source row, minted on first sight and stable thereafter.
   * Keyed by table so two tables sharing a UUID never collide.
   */
  objectIdFor(table: string, uuid: string): Types.ObjectId {
    const key = `${table}:${uuid}`;
    const existing = this.map.get(key);
    if (existing) return new Types.ObjectId(existing);

    const fresh = new Types.ObjectId();
    this.map.set(key, fresh.toHexString());
    return fresh;
  }

  /** Resolves a foreign key. Throws rather than silently writing a dangling reference. */
  require(table: string, uuid: string): Types.ObjectId {
    const key = `${table}:${uuid}`;
    const existing = this.map.get(key);
    if (!existing) {
      throw new Error(
        `No mapped id for ${key}. Migrate ${table} before the collection that references it.`,
      );
    }
    return new Types.ObjectId(existing);
  }

  /** Resolves an optional foreign key. */
  optional(table: string, uuid: string | null | undefined): Types.ObjectId | null {
    if (!uuid) return null;
    const existing = this.map.get(`${table}:${uuid}`);
    return existing ? new Types.ObjectId(existing) : null;
  }

  get size(): number {
    return this.map.size;
  }

  /** Written via a temp file so an interrupted run cannot leave a truncated map. */
  save(): void {
    const temp = `${this.path}.tmp`;
    writeFileSync(temp, JSON.stringify(Object.fromEntries(this.map), null, 2));
    renameSync(temp, this.path);
  }
}
