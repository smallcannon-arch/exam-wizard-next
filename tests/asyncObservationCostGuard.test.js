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

function expectBlackholeNetworkAttempt(result) {
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain('"event": "paid_api_warning"');
  expect(result.stderr).toContain('"apiBaseUrl": "http://127.0.0.1:9"');
  expect(result.stderr).toContain('"stage": "script"');
  expect(result.stderr).toContain("fetch failed");
  expect(result.stderr).not.toContain("exam-wizard-next-proxy.smallcannon.workers.dev");
  expect(result.stderr).not.toContain('"stage": "paid_api_guard"');
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

  it("dry-run allows large choice blueprints without --allow-large-smoke or paid flags", () => {
    const result = runObservation(["--dry-run", "--case=choice", "--count=50"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const summary = parseJson(result.stdout);
    expect(summary.ok).toBe(true);
    expect(summary.dryRun).toBe(true);
    expect(summary.paidApiCall).toBe(false);
    expect(summary.caseName).toBe("choice");
    expect(summary.parentSlotCount).toBe(50);
    expect(summary.expectedItemCount).toBe(50);
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
    const result = runObservation(["--allow-paid-api", "--max-jobs=1", "--case=choice", "--count=4"]);

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
    expect(error.largeSmoke).toBe(true);
    expect(error.parentSlotCount).toBe(44);
    expect(error.expectedItemCount).toBe(48);
  });

  it("refuses choice count 50 without --allow-large-smoke", () => {
    const result = runObservation(["--allow-paid-api", "--max-jobs=1", "--case=choice", "--count=50"], {
      env: { ALLOW_PAID_API: "1" },
    });

    expect(result.status).toBe(2);
    const error = parseJson(result.stderr);
    expect(error.stage).toBe("paid_api_guard");
    expect(error.paidApiCall).toBe(false);
    expect(error.largeSmoke).toBe(true);
    expect(error.missing).toContain("--allow-large-smoke");
    expect(error.requestedParentItemCount).toBe(50);
    expect(error.expectedItemCount).toBe(50);
  });

  it("still requires paid API flags even when large smoke is acknowledged", () => {
    const result = runObservation(["--allow-large-smoke", "--case=choice", "--count=50", "--max-jobs=1"], {
      env: { ALLOW_PAID_API: "1" },
    });

    expect(result.status).toBe(2);
    const error = parseJson(result.stderr);
    expect(error.stage).toBe("paid_api_guard");
    expect(error.paidApiCall).toBe(false);
    expect(error.missing).toContain("--allow-paid-api");
  });

  it("lets a guarded choice count 50 run reach only the localhost blackhole", () => {
    const result = runObservation([
      "--allow-paid-api",
      "--allow-large-smoke",
      "--max-jobs=1",
      "--case=choice",
      "--count=50",
    ], {
      env: { ALLOW_PAID_API: "1" },
    });

    expectBlackholeNetworkAttempt(result);
  });

  it("lets a guarded small paid sample reach only the localhost blackhole", () => {
    const result = runObservation([
      "--allow-paid-api",
      "--max-jobs=1",
      "--case=choice",
      "--count=4",
    ], {
      env: { ALLOW_PAID_API: "1" },
    });

    expectBlackholeNetworkAttempt(result);
  });
});
