import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const wranglerConfig = readFileSync("worker/wrangler.toml", "utf8");
const wranglerExample = readFileSync("worker/wrangler.toml.example", "utf8");
const migration = readFileSync("worker/migrations/0001_generation_jobs.sql", "utf8");
const diagnosticsMigration = readFileSync("worker/migrations/0002_batch_safe_diagnostics.sql", "utf8");
const upstreamDiagnosticsMigration = readFileSync("worker/migrations/0003_batch_upstream_status.sql", "utf8");

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
    const normalized = `${migration}\n${diagnosticsMigration}\n${upstreamDiagnosticsMigration}`.toLowerCase();

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
});
