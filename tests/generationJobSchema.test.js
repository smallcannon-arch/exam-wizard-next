import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const wranglerConfig = readFileSync("worker/wrangler.toml", "utf8");
const wranglerExample = readFileSync("worker/wrangler.toml.example", "utf8");
const migration = readFileSync("worker/migrations/0001_generation_jobs.sql", "utf8");
const diagnosticsMigration = readFileSync("worker/migrations/0002_batch_safe_diagnostics.sql", "utf8");
const upstreamDiagnosticsMigration = readFileSync("worker/migrations/0003_batch_upstream_status.sql", "utf8");
const contractViolationDiagnosticsMigration = readFileSync("worker/migrations/0004_contract_violation_diagnostics.sql", "utf8");
const partialStatusMigration = readFileSync("worker/migrations/0005_allow_partial_generation_job_status.sql", "utf8");
const sqliteModule = await import("node:sqlite").catch(() => null);
const DatabaseSync = sqliteModule?.DatabaseSync;
const sqliteIt = DatabaseSync ? it : it.skip;

function applyGenerationJobMigrations(db) {
  db.exec(migration);
  db.exec(diagnosticsMigration);
  db.exec(upstreamDiagnosticsMigration);
  db.exec(contractViolationDiagnosticsMigration);
  db.exec(partialStatusMigration);
}

describe("async generation D1 resource prep", () => {
  it("binds the generation jobs D1 database in wrangler config", () => {
    expect(wranglerConfig).toContain('binding = "GENERATION_JOBS_DB"');
    expect(wranglerConfig).toContain('database_name = "exam-wizard-generation-jobs"');
    expect(wranglerConfig).toContain('database_id = "6a96cdf9-2a8a-45ad-a6ee-9db303db5a9b"');
    expect(wranglerConfig).toContain('migrations_dir = "migrations"');
  });

  it("binds the generation Workflow in wrangler config", () => {
    expect(wranglerConfig).toContain('name = "exam-wizard-generation-workflow"');
    expect(wranglerConfig).toContain('binding = "GENERATION_WORKFLOW"');
    expect(wranglerConfig).toContain('class_name = "GenerationWorkflow"');
  });

  it("keeps the example config free of the real D1 database id", () => {
    expect(wranglerExample).toContain('binding = "GENERATION_JOBS_DB"');
    expect(wranglerExample).toContain('database_name = "exam-wizard-generation-jobs"');
    expect(wranglerExample).toContain('database_id = "<D1_DATABASE_ID>"');
    expect(wranglerExample).toContain('binding = "GENERATION_WORKFLOW"');
    expect(wranglerExample).toContain('class_name = "GenerationWorkflow"');
    expect(wranglerExample).not.toContain("6a96cdf9-2a8a-45ad-a6ee-9db303db5a9b");
  });

  it("defines job and batch metadata tables for async generation", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS generation_jobs");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS generation_job_batches");
    expect(migration).toContain("requested_item_count INTEGER NOT NULL CHECK (requested_item_count BETWEEN 1 AND 50)");
    expect(migration).toContain("result_json TEXT");
    expect(migration).toContain("FOREIGN KEY (job_id) REFERENCES generation_jobs(job_id) ON DELETE CASCADE");
  });

  it("does not define raw prompt, raw output, secret, header, or stack trace storage columns", () => {
    const normalized = `${migration}\n${diagnosticsMigration}\n${upstreamDiagnosticsMigration}\n${contractViolationDiagnosticsMigration}`.toLowerCase();

    expect(normalized).not.toMatch(/\braw_prompt\b/);
    expect(normalized).not.toMatch(/\braw_output\b/);
    expect(normalized).not.toMatch(/\bapi_key\b/);
    expect(normalized).not.toMatch(/\btoken\b\s+(text|varchar|blob)/);
    expect(normalized).not.toMatch(/\bheaders?\b\s+(text|varchar|blob)/);
    expect(normalized).not.toMatch(/\bstack_trace\b/);
  });

  it("adds nullable safe batch diagnostics in a follow-up migration", () => {
    expect(diagnosticsMigration).toContain("ALTER TABLE generation_job_batches");
    expect(diagnosticsMigration).toContain("ADD COLUMN finish_reason TEXT");
    expect(diagnosticsMigration).toContain("ADD COLUMN output_length INTEGER");
    expect(diagnosticsMigration).toContain("ADD COLUMN json_candidate_length INTEGER");
    expect(diagnosticsMigration).toContain("ADD COLUMN json_classification_source TEXT");
    expect(diagnosticsMigration).toContain("IN ('none', 'parser', 'finish_reason')");
  });

  it("adds nullable upstream HTTP status metadata in a follow-up migration", () => {
    expect(upstreamDiagnosticsMigration).toContain("ALTER TABLE generation_job_batches");
    expect(upstreamDiagnosticsMigration).toContain("ADD COLUMN upstream_status INTEGER");
    expect(upstreamDiagnosticsMigration).toContain("BETWEEN 100 AND 599");
  });

  it("adds nullable safe contract violation metadata in a follow-up migration", () => {
    expect(contractViolationDiagnosticsMigration).toContain("ALTER TABLE generation_job_batches");
    expect(contractViolationDiagnosticsMigration).toContain("ADD COLUMN contract_violation_type TEXT");
    expect(contractViolationDiagnosticsMigration).toContain("ADD COLUMN contract_violation_types TEXT");
    expect(contractViolationDiagnosticsMigration).toContain("ADD COLUMN contract_violation_item_index INTEGER");
    expect(contractViolationDiagnosticsMigration).toContain("ADD COLUMN contract_violation_field TEXT");
    expect(contractViolationDiagnosticsMigration).toContain("ADD COLUMN contract_violation_option_code TEXT");
    expect(contractViolationDiagnosticsMigration).toContain("OPTIONS_COUNT_INVALID");
    expect(contractViolationDiagnosticsMigration).toContain("DISTRACTOR_REQUIRED_FIELD_MISSING");
  });

  it("adds partial to the generation_jobs status allowlist in a follow-up migration", () => {
    expect(partialStatusMigration).toContain("CREATE TABLE generation_jobs_new");
    expect(partialStatusMigration).toContain("'partial'");
    expect(partialStatusMigration).toContain("INSERT INTO generation_jobs_new");
    expect(partialStatusMigration).toContain("FROM generation_jobs");
    expect(partialStatusMigration).toContain("CREATE INDEX IF NOT EXISTS idx_generation_jobs_status_created");
    expect(partialStatusMigration).toContain("CREATE INDEX IF NOT EXISTS idx_generation_jobs_expires_at");
    expect(partialStatusMigration).not.toContain("SELECT *");
  });

  it("does not define generation job triggers or views that the partial status rebuild would need to recreate", () => {
    const normalized = `${migration}\n${diagnosticsMigration}\n${upstreamDiagnosticsMigration}\n${contractViolationDiagnosticsMigration}\n${partialStatusMigration}`.toLowerCase();

    expect(normalized).not.toContain("create trigger");
    expect(normalized).not.toContain("create view");
  });

  sqliteIt("applies the partial status migration while preserving batch rows and enforcing status checks", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("PRAGMA foreign_keys = ON");
      db.exec(migration);
      db.exec(diagnosticsMigration);
      db.exec(upstreamDiagnosticsMigration);
      db.exec(contractViolationDiagnosticsMigration);
      db.exec(`
        INSERT INTO generation_jobs (
          job_id,
          status,
          requested_item_count,
          batch_size,
          batch_count,
          completed_batch_count,
          completed_item_count,
          expires_at
        ) VALUES (
          'gen_schema_partial_12345678',
          'running',
          44,
          4,
          11,
          10,
          40,
          '2026-06-26T00:00:00.000Z'
        )
      `);
      db.exec(`
        INSERT INTO generation_job_batches (
          job_id,
          batch_number,
          status,
          expected_item_count,
          completed_item_count,
          retry_count,
          finish_reason,
          contract_violation_type
        ) VALUES (
          'gen_schema_partial_12345678',
          11,
          'failed_terminal',
          4,
          0,
          0,
          'STOP',
          'OPTIONS_COUNT_INVALID'
        )
      `);

      db.exec(partialStatusMigration);
      db.exec("UPDATE generation_jobs SET status = 'partial' WHERE job_id = 'gen_schema_partial_12345678'");

      expect(() => {
        db.exec("UPDATE generation_jobs SET status = 'foo_status' WHERE job_id = 'gen_schema_partial_12345678'");
      }).toThrow();

      const row = db.prepare(`
        SELECT
          j.status,
          b.status AS batch_status,
          b.finish_reason,
          b.contract_violation_type
        FROM generation_jobs j
        JOIN generation_job_batches b ON b.job_id = j.job_id
        WHERE j.job_id = 'gen_schema_partial_12345678'
      `).get();
      expect(row).toEqual({
        status: "partial",
        batch_status: "failed_terminal",
        finish_reason: "STOP",
        contract_violation_type: "OPTIONS_COUNT_INVALID",
      });
      expect(() => {
        db.exec(`
          INSERT INTO generation_job_batches (
            job_id,
            batch_number,
            status,
            expected_item_count,
            completed_item_count,
            retry_count
          ) VALUES (
            'gen_missing_parent_12345678',
            1,
            'queued',
            4,
            0,
            0
          )
        `);
      }).toThrow();

      const indexes = db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'index'
          AND tbl_name = 'generation_jobs'
        ORDER BY name
      `).all();
      expect(indexes.map((entry) => entry.name)).toEqual([
        "idx_generation_jobs_expires_at",
        "idx_generation_jobs_status_created",
        "sqlite_autoindex_generation_jobs_1",
      ]);

      const backupTables = db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE name = 'generation_job_batches_0005_backup'
      `).all();
      expect(backupTables).toEqual([]);
    } finally {
      db.close();
    }
  });
});
