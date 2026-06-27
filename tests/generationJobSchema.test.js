import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRACT_VIOLATION_TYPES } from "../worker/src/json.js";

const wranglerConfig = readFileSync("worker/wrangler.toml", "utf8");
const wranglerExample = readFileSync("worker/wrangler.toml.example", "utf8");
const migration = readFileSync("worker/migrations/0001_generation_jobs.sql", "utf8");
const diagnosticsMigration = readFileSync("worker/migrations/0002_batch_safe_diagnostics.sql", "utf8");
const upstreamDiagnosticsMigration = readFileSync("worker/migrations/0003_batch_upstream_status.sql", "utf8");
const contractViolationDiagnosticsMigration = readFileSync("worker/migrations/0004_contract_violation_diagnostics.sql", "utf8");
const partialStatusMigration = readFileSync("worker/migrations/0005_allow_partial_generation_job_status.sql", "utf8");
const contractViolationAllowlistMigration = readFileSync("worker/migrations/0006_expand_contract_violation_type_allowlist.sql", "utf8");
const sqliteModule = await import("node:sqlite").catch(() => null);
const DatabaseSync = sqliteModule?.DatabaseSync;
const sqliteIt = DatabaseSync ? it : it.skip;

const expectedContractViolationFields = [
  "questionType",
  "options",
  "answer",
  "correctAnswer",
  "acceptedAnswers",
  "groupId",
  "stimulus",
  "qualityMeta.distractorDesign",
  "misconceptionTag",
  "misconceptionDescription",
  "whyStudentsMayChooseIt",
  "whyItIsWrong",
  "revisionNote",
];

const typedContractViolationFieldByType = {
  [CONTRACT_VIOLATION_TYPES.QUESTION_TYPE_MISSING]: "questionType",
  [CONTRACT_VIOLATION_TYPES.QUESTION_TYPE_MISMATCH]: "questionType",
  [CONTRACT_VIOLATION_TYPES.TRUE_FALSE_OPTIONS_INVALID]: "options",
  [CONTRACT_VIOLATION_TYPES.TRUE_FALSE_ANSWER_INVALID]: "answer",
  [CONTRACT_VIOLATION_TYPES.FILL_IN_OPTIONS_INVALID]: "options",
  [CONTRACT_VIOLATION_TYPES.FILL_IN_ANSWER_INVALID]: "answer",
  [CONTRACT_VIOLATION_TYPES.ACCEPTED_ANSWERS_INVALID]: "acceptedAnswers",
  [CONTRACT_VIOLATION_TYPES.GROUP_STIMULUS_INVALID]: "stimulus",
};

function applyGenerationJobMigrations(db) {
  db.exec(migration);
  db.exec(diagnosticsMigration);
  db.exec(upstreamDiagnosticsMigration);
  db.exec(contractViolationDiagnosticsMigration);
  db.exec(partialStatusMigration);
  db.exec(contractViolationAllowlistMigration);
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
    const normalized = `${migration}\n${diagnosticsMigration}\n${upstreamDiagnosticsMigration}\n${contractViolationDiagnosticsMigration}\n${partialStatusMigration}\n${contractViolationAllowlistMigration}`.toLowerCase();

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

  it("expands batch contract violation diagnostics in a follow-up migration", () => {
    expect(contractViolationAllowlistMigration).toContain("CREATE TABLE generation_job_batches_new");
    expect(contractViolationAllowlistMigration).toContain("INSERT INTO generation_job_batches_new");
    expect(contractViolationAllowlistMigration).toContain("FROM generation_job_batches");
    expect(contractViolationAllowlistMigration).toContain("DROP TABLE generation_job_batches");
    expect(contractViolationAllowlistMigration).toContain("ALTER TABLE generation_job_batches_new RENAME TO generation_job_batches");
    expect(contractViolationAllowlistMigration).toContain("CREATE INDEX IF NOT EXISTS idx_generation_job_batches_status");
    expect(contractViolationAllowlistMigration).toContain("FOREIGN KEY (job_id) REFERENCES generation_jobs(job_id) ON DELETE CASCADE");
    expect(contractViolationAllowlistMigration).not.toContain("SELECT *");
    expect(contractViolationAllowlistMigration).not.toContain("writable_schema");

    for (const type of Object.values(CONTRACT_VIOLATION_TYPES)) {
      expect(contractViolationAllowlistMigration).toContain(`'${type}'`);
    }
    for (const field of expectedContractViolationFields) {
      expect(contractViolationAllowlistMigration).toContain(`'${field}'`);
    }
  });

  it("does not define generation job triggers or views that the partial status rebuild would need to recreate", () => {
    const normalized = `${migration}\n${diagnosticsMigration}\n${upstreamDiagnosticsMigration}\n${contractViolationDiagnosticsMigration}\n${partialStatusMigration}\n${contractViolationAllowlistMigration}`.toLowerCase();

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

  sqliteIt("expands contract violation type checks while preserving batch rows", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("PRAGMA foreign_keys = ON");
      db.exec(migration);
      db.exec(diagnosticsMigration);
      db.exec(upstreamDiagnosticsMigration);
      db.exec(contractViolationDiagnosticsMigration);
      db.exec(partialStatusMigration);
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
          'gen_contract_violation_schema_12345678',
          'running',
          15,
          4,
          15,
          0,
          0,
          '2026-06-27T00:00:00.000Z'
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
          output_length,
          json_candidate_length,
          json_classification_source,
          upstream_status,
          contract_violation_type,
          contract_violation_types,
          contract_violation_item_index,
          contract_violation_field,
          contract_violation_option_code
        ) VALUES (
          'gen_contract_violation_schema_12345678',
          1,
          'failed_terminal',
          4,
          0,
          0,
          'STOP',
          120,
          96,
          'none',
          200,
          'OPTIONS_COUNT_INVALID',
          '["OPTIONS_COUNT_INVALID"]',
          1,
          'options',
          'E'
        )
      `);

      db.exec(contractViolationAllowlistMigration);

      const preserved = db.prepare(`
        SELECT
          status,
          finish_reason,
          output_length,
          json_candidate_length,
          json_classification_source,
          upstream_status,
          contract_violation_type,
          contract_violation_types,
          contract_violation_item_index,
          contract_violation_field,
          contract_violation_option_code
        FROM generation_job_batches
        WHERE job_id = 'gen_contract_violation_schema_12345678'
          AND batch_number = 1
      `).get();
      expect(preserved).toEqual({
        status: "failed_terminal",
        finish_reason: "STOP",
        output_length: 120,
        json_candidate_length: 96,
        json_classification_source: "none",
        upstream_status: 200,
        contract_violation_type: "OPTIONS_COUNT_INVALID",
        contract_violation_types: "[\"OPTIONS_COUNT_INVALID\"]",
        contract_violation_item_index: 1,
        contract_violation_field: "options",
        contract_violation_option_code: "E",
      });

      const insertBatch = db.prepare(`
        INSERT INTO generation_job_batches (
          job_id,
          batch_number,
          status,
          expected_item_count,
          completed_item_count,
          retry_count,
          contract_violation_type,
          contract_violation_field
        ) VALUES (
          'gen_contract_violation_schema_12345678',
          ?,
          'failed_terminal',
          4,
          0,
          0,
          ?,
          ?
        )
      `);
      for (const [index, type] of Object.values(CONTRACT_VIOLATION_TYPES).entries()) {
        insertBatch.run(index + 2, type, typedContractViolationFieldByType[type] || "options");
      }

      db.prepare(`
        INSERT INTO generation_job_batches (
          job_id,
          batch_number,
          status,
          expected_item_count,
          completed_item_count,
          retry_count,
          contract_violation_type
        ) VALUES (
          'gen_contract_violation_schema_12345678',
          99,
          'failed_terminal',
          4,
          0,
          0,
          NULL
        )
      `).run();

      db.prepare(`
        INSERT INTO generation_job_batches (
          job_id,
          batch_number,
          status,
          expected_item_count,
          completed_item_count,
          retry_count,
          contract_violation_type,
          contract_violation_field
        ) VALUES (
          'gen_contract_violation_schema_12345678',
          98,
          'failed_terminal',
          4,
          0,
          0,
          'QUESTION_TYPE_MISMATCH',
          NULL
        )
      `).run();

      expect(() => {
        db.prepare(`
          INSERT INTO generation_job_batches (
            job_id,
            batch_number,
            status,
            expected_item_count,
            completed_item_count,
            retry_count,
            contract_violation_type
          ) VALUES (
            'gen_contract_violation_schema_12345678',
            100,
            'failed_terminal',
            4,
            0,
            0,
            'UNSUPPORTED_TYPED_CODE'
          )
        `).run();
      }).toThrow();

      expect(() => {
        db.prepare(`
          INSERT INTO generation_job_batches (
            job_id,
            batch_number,
            status,
            expected_item_count,
            completed_item_count,
            retry_count,
            contract_violation_type,
            contract_violation_field
          ) VALUES (
            'gen_contract_violation_schema_12345678',
            101,
            'failed_terminal',
            4,
            0,
            0,
            'QUESTION_TYPE_MISMATCH',
            'rawOutput'
          )
        `).run();
      }).toThrow();

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
          AND tbl_name = 'generation_job_batches'
        ORDER BY name
      `).all();
      expect(indexes.map((entry) => entry.name)).toEqual([
        "idx_generation_job_batches_status",
        "sqlite_autoindex_generation_job_batches_1",
      ]);

      const tempTables = db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE name IN (
          'generation_job_batches_new',
          'generation_job_batches_0006_backup'
        )
      `).all();
      expect(tempTables).toEqual([]);

      const typeCount = db.prepare(`
        SELECT COUNT(*) AS count
        FROM generation_job_batches
        WHERE job_id = 'gen_contract_violation_schema_12345678'
          AND contract_violation_type IS NOT NULL
      `).get();
      expect(typeCount.count).toBe(Object.values(CONTRACT_VIOLATION_TYPES).length + 2);
    } finally {
      db.close();
    }
  });
});
