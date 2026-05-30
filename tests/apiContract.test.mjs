import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadApi() {
  const source = readFileSync(join(process.cwd(), "src", "api.ts"), "utf8");
  const patched = source.replace(
    "const API_BASE = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE;",
    "const API_BASE = DEFAULT_API_BASE;"
  );
  const compiled = ts.transpileModule(patched, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const module = { exports: {} };
  const storage = new Map();
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  };
  vm.runInNewContext(compiled, {
    exports: module.exports,
    module,
    Headers,
    FormData,
    Blob,
    URL,
    document: { createElement: () => ({ click() {} }) },
    localStorage,
    setTimeout,
    clearTimeout,
    Date
  });
  return { apiModule: module.exports, storage };
}

test("strict review detail parser rejects missing required response fields", () => {
  const { apiModule } = loadApi();

  assert.equal(typeof apiModule.parseReviewDetail, "function");
  assert.throws(
    () => apiModule.parseReviewDetail({ risk_points: [] }),
    /task/
  );
  assert.throws(
    () =>
      apiModule.parseReviewDetail({
        task: { id: "task-1", file_name: "contract.docx", file_type: "docx", status: "completed" }
      }),
    /risk_points/
  );
});

test("strict parsers reject unknown task status and risk level", () => {
  const { apiModule } = loadApi();

  assert.equal(typeof apiModule.parseReviewDetail, "function");
  assert.throws(
    () =>
      apiModule.parseReviewDetail({
        task: { id: "task-1", file_name: "contract.docx", file_type: "docx", status: "cancelled", suggest_deep_review: false },
        risk_points: []
      }),
    /status/
  );
  assert.throws(
    () =>
      apiModule.parseReviewDetail({
        task: { id: "task-1", file_name: "contract.docx", file_type: "docx", status: "completed", suggest_deep_review: false },
        risk_points: [{ id: "risk-1", title: "风险", level: "critical", status: "pending" }]
      }),
    /level/
  );
});

test("strict parsers accept valid cloud contract response shapes", () => {
  const { apiModule } = loadApi();

  const review = apiModule.parseReviewDetail({
    task: {
      id: "task-1",
      file_name: "contract.docx",
      file_type: "docx",
      status: "completed",
      suggest_deep_review: false,
      risk_count: 1,
      paragraphs: []
    },
    risk_points: [{ id: "risk-1", title: "风险", level: "high", status: "pending" }]
  });
  assert.equal(review.task.status, "completed");
  assert.equal(review.risk_points[0].level, "high");

  const rules = apiModule.parseRuleListResponse({
    rules: [
      {
        id: "rule-1",
        version_id: "version-1",
        rule_code: "COM-001",
        contract_type: "通用",
        review_module: "法务",
        risk_name: "风险名称",
        default_risk_level: "中",
        enabled: true
      }
    ],
    total: 1,
    skip: 0,
    limit: 20
  });
  assert.equal(rules.rules[0].rule_code, "COM-001");

  const versions = apiModule.parseRuleVersions([
    { id: "version-1", version_no: 1, name: "默认版本", status: "active", rule_count: 1 }
  ]);
  assert.equal(versions[0].status, "active");
});

test("api module keeps the cloud backend as the default base url", () => {
  const { apiModule } = loadApi();

  assert.equal(apiModule.DEFAULT_API_BASE, "http://82.156.132.43:8080");
});

test("session storage keeps token in memory and clears it after expires_in", () => {
  const { apiModule, storage } = loadApi();

  assert.equal(typeof apiModule.__setSessionClockForTests, "function");
  apiModule.storeSession({
    access_token: "secret-token",
    expires_in: 1,
    token_type: "bearer",
    user: { id: "user-1", email: "u@example.com", nickname: "U", is_active: true, is_verified: false }
  });

  assert.equal(apiModule.getStoredToken(), "secret-token");
  assert.equal(storage.get("complass_access_token"), undefined);
  assert.ok(storage.get("complass_session_expires_at"));

  apiModule.__setSessionClockForTests(() => Date.now() + 2000);
  assert.equal(apiModule.getStoredToken(), null);
});
