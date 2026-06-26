import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(repoRoot, "scripts", "run-async-observation.mjs");

function runObservation(args = [], options = {}) {
  const hasApiBaseUrl = args.some((arg) => String(arg).startsWith("--api-base-url="));
  const safeArgs = hasApiBaseUrl ? args : [...args, "--api-base-url=http://127.0.0.1:9"];
  return spawnSync(process.execPath, [scriptPath, ...safeArgs], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(options.env || {}),
    },
    timeout: 10000,
  });
}

function parseJson(text = "") {
  return JSON.parse(String(text || "").trim());
}

describe("run-async-observation paid API guard", () => {
  it("refuses to create a production job without --allow-paid-api", () => {
    const result = runObservation(["--count=1", "--case=choice", "--max-jobs=1"]);

    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    const error = parseJson(result.stderr);
    expect(error.stage).toBe("paid_api_guard");
    expect(error.paidApiCall).toBe(false);
    expect(error.missing).toContain("--allow-paid-api");
  });

  it("dry-run prints the blueprint summary without paid API confirmation", () => {
    const result = runObservation(["--dry-run", "--case=literacy-group4", "--count=4"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const summary = parseJson(result.stdout);
    expect(summary.ok).toBe(true);
    expect(summary.dryRun).toBe(true);
    expect(summary.paidApiCall).toBe(false);
    expect(summary.caseName).toBe("literacy-group4");
    expect(summary.parentSlotCount).toBe(4);
    expect(summary.expectedItemCount).toBe(8);
    expect(summary.groupChildCount).toBe(8);
  });

  it("requires --max-jobs for paid API execution", () => {
    const result = runObservation(["--allow-paid-api", "--case=choice"], {
      env: { ALLOW_PAID_API: "1" },
    });

    expect(result.status).toBe(2);
    const error = parseJson(result.stderr);
    expect(error.stage).toBe("paid_api_guard");
    expect(error.paidApiCall).toBe(false);
    expect(error.missing).toContain("--max-jobs");
  });

  it("requires ALLOW_PAID_API=1 in non-interactive execution", () => {
    const result = runObservation(["--allow-paid-api", "--max-jobs=1", "--case=choice"]);

    expect(result.status).toBe(2);
    const error = parseJson(result.stderr);
    expect(error.stage).toBe("paid_api_guard");
    expect(error.paidApiCall).toBe(false);
    expect(error.missing).toContain("ALLOW_PAID_API=1");
  });

  it("refuses mixed44-ui paid smoke without --allow-large-smoke", () => {
    const result = runObservation(["--allow-paid-api", "--max-jobs=1", "--case=mixed44-ui"], {
      env: { ALLOW_PAID_API: "1" },
    });

    expect(result.status).toBe(2);
    const error = parseJson(result.stderr);
    expect(error.stage).toBe("paid_api_guard");
    expect(error.paidApiCall).toBe(false);
    expect(error.missing).toContain("--allow-large-smoke");
    expect(error.parentSlotCount).toBe(44);
    expect(error.expectedItemCount).toBe(48);
  });
});
