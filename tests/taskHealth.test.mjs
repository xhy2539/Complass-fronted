import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadTaskHealth() {
  const source = readFileSync(join(process.cwd(), "src", "taskHealth.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { exports: module.exports, module, require: () => ({}) });
  return module.exports;
}

test("flags completed review when AI output is missing", () => {
  const { getReviewAiState } = loadTaskHealth();

  const state = getReviewAiState({
    task: {
      status: "completed",
      overall_conclusion: null,
      risk_summary: null,
      risk_count: 0
    },
    risk_points: []
  });

  assert.equal(state.kind, "warning");
  assert.match(state.title, /AI/);
});

test("treats completed review with conclusion as ready", () => {
  const { getReviewAiState } = loadTaskHealth();

  const state = getReviewAiState({
    task: {
      status: "completed",
      overall_conclusion: "合同审查完成",
      risk_summary: { high: 0, medium: 1, low: 0 },
      risk_count: 1
    },
    risk_points: []
  });

  assert.equal(state.kind, "ok");
});

test("flags comparison when diffs exist but AI enhancement is empty", () => {
  const { getComparisonAiState } = loadTaskHealth();

  const state = getComparisonAiState({
    success: true,
    task: {
      status: "completed",
      total_risks: 0
    },
    diff_details: [{ index: 0, change_type: "modified", old_text: "30天", new_text: "15天" }],
    risk_points: [],
    coze_enhanced: []
  });

  assert.equal(state.kind, "warning");
  assert.match(state.title, /AI/);
});
