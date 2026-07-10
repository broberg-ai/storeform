import { Database } from "bun:sqlite";

/**
 * Per-field checkpoint state (F001.4) in bun:sqlite. A run persists each
 * completed field so an interrupted run RESUMES from the first unfinished field
 * instead of restarting — and NEVER re-submits an already-completed field.
 * Granularity = the flattened field index (each schema field = one flow step).
 */
export interface StepRecord {
  index: number;
  name: string;
  value: string | null;
  resolved_via: string | null;
  screenshot_url: string | null;
  status: string; // "ok" | "failed"
}

interface CheckpointRow {
  field_index: number;
  status: string;
}

export function openCheckpointDb(path = process.env.STOREFORM_CHECKPOINT_DB ?? ".storeform-checkpoints.db"): Database {
  const db = new Database(path);
  db.run(
    `CREATE TABLE IF NOT EXISTS checkpoints (
       form TEXT NOT NULL,
       field_index INTEGER NOT NULL,
       name TEXT NOT NULL,
       value TEXT,
       resolved_via TEXT,
       screenshot_url TEXT,
       status TEXT NOT NULL,
       ts INTEGER NOT NULL,
       PRIMARY KEY (form, field_index)
     )`,
  );
  return db;
}

/** Persist one field's outcome (idempotent per form+index). */
export function recordStep(db: Database, form: string, r: StepRecord): void {
  db.run(
    `INSERT INTO checkpoints (form, field_index, name, value, resolved_via, screenshot_url, status, ts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(form, field_index) DO UPDATE SET
       name = excluded.name, value = excluded.value, resolved_via = excluded.resolved_via,
       screenshot_url = excluded.screenshot_url, status = excluded.status, ts = excluded.ts`,
    [form, r.index, r.name, r.value, r.resolved_via, r.screenshot_url, r.status, Date.now()],
  );
}

/**
 * The resume point: the first field index NOT yet completed — i.e. the length of
 * the leading run of consecutively-'ok' fields from index 0. A failed/missing
 * field stops the run, so resume re-does exactly that field and everything after.
 */
export function resumePoint(db: Database, form: string): number {
  const rows = db
    .query<CheckpointRow, [string]>(`SELECT field_index, status FROM checkpoints WHERE form = ? ORDER BY field_index ASC`)
    .all(form);
  let n = 0;
  for (const row of rows) {
    if (row.field_index === n && row.status === "ok") n++;
    else break;
  }
  return n;
}

/** Drop a form's checkpoint (used when starting a fresh, non-resumed run). */
export function clearCheckpoint(db: Database, form: string): void {
  db.run(`DELETE FROM checkpoints WHERE form = ?`, [form]);
}
