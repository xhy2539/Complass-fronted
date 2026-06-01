import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const source = (...parts) => readFileSync(join(root, "src", ...parts), "utf8");
const doc = (...parts) => readFileSync(join(root, "docs", ...parts), "utf8");
const exists = (...parts) => existsSync(join(root, ...parts));

test("reverse rule workflow exposes the planned routes and rule-library entry points", () => {
  const app = source("App.tsx");

  for (const route of [
    "/rules/reverse-tasks",
    "/rules/reverse-tasks/new",
    "/rules/reverse-tasks/:taskId/progress",
    "/rules/reverse-tasks/:taskId/confirm",
    "/rules/reverse-tasks/:taskId/failed",
    "/rules/reverse-tasks/:taskId/success"
  ]) {
    assert.match(app, new RegExp(`path="${route.replaceAll("/", "\\/")}"`));
  }

  assert.match(app, /ReverseTaskListPage/);
  assert.match(app, /ReverseTaskCreatePage/);
  assert.match(app, /逆向生成规则/);
  assert.match(app, /逆向解析任务/);
});

test("reverse rule pages are split into dedicated page modules", () => {
  for (const file of [
    "ReverseTaskListPage.tsx",
    "ReverseTaskCreatePage.tsx",
    "ReverseTaskProgressPage.tsx",
    "ReverseCandidateConfirmPage.tsx",
    "ReverseTaskFailedPage.tsx",
    "ReverseTaskSuccessPage.tsx"
  ]) {
    assert.equal(exists("src", "pages", file), true, `${file} should exist`);
  }
});

test("reverse rule API covers task, candidate, import, retry, and export operations", () => {
  const api = source("api.ts");

  for (const method of [
    "listReverseRuleTasks",
    "createReverseRuleTask",
    "getReverseRuleTask",
    "getReverseRuleCandidates",
    "updateReverseRuleCandidateDecision",
    "batchUpdateReverseRuleCandidates",
    "confirmReverseRuleImport",
    "retryReverseRuleTask",
    "exportReverseRuleResult"
  ]) {
    assert.match(api, new RegExp(`${method}\\(`));
  }

  assert.match(api, /\/api\/v1\/reverse-rule-tasks/);
  assert.match(api, /\/candidates/);
  assert.match(api, /\/confirm-import/);
  assert.match(api, /\/retry/);
  assert.match(api, /\/export/);
});

test("reverse rule types model task statuses, candidate decisions, traces, and import results", () => {
  const types = source("types.ts");

  for (const symbol of [
    "ReverseRuleTaskStatus",
    "ReverseRuleCandidateDecision",
    "ReverseRuleTask",
    "ReverseRulePair",
    "ReverseCandidateRule",
    "ReverseRuleTrace",
    "ReverseRuleImportResult"
  ]) {
    assert.match(types, new RegExp(symbol));
  }

  for (const status of ["draft", "parsing", "pending_confirm", "completed", "failed", "cancelled"]) {
    assert.match(types, new RegExp(`"${status}"`));
  }

  for (const decision of ["pending", "included", "ignored"]) {
    assert.match(types, new RegExp(`"${decision}"`));
  }
});

test("create page documents upload validation constraints in source", () => {
  const page = source("pages", "ReverseTaskCreatePage.tsx");

  assert.match(page, /MAX_REVERSE_RULE_PAIRS = 5/);
  assert.match(page, /MAX_REVERSE_RULE_FILE_SIZE = 50 \* 1024 \* 1024/);
  assert.match(page, /\.docx/);
  assert.match(page, /修改前合同/);
  assert.match(page, /修改后合同/);
  assert.match(page, /开始解析/);
});

test("create page exposes high-fidelity upload workspace hooks", () => {
  const page = source("pages", "ReverseTaskCreatePage.tsx");
  const css = source("styles.css");

  for (const phrase of ["解析偏好", "合同组上传", "预计分为", "建议 1-5 组", "返回任务列表", "开始解析"]) {
    assert.match(page, new RegExp(phrase));
  }

  for (const hook of [
    "reverse-create-preferences",
    "reverse-upload-summary",
    "reverse-pair-row",
    "reverse-file-chip",
    "reverse-create-footer"
  ]) {
    assert.match(page, new RegExp(hook));
    assert.match(css, new RegExp(`\\.${hook}`));
  }
});

test("backend handoff note lists the required reverse rule interfaces", () => {
  const handoff = doc("reverse-rule-backend-handoff.md");

  for (const phrase of [
    "任务创建接口",
    "任务列表接口",
    "任务详情/进度接口",
    "候选规则接口",
    "候选规则决策接口",
    "确认入库接口",
    "重试接口",
    "导出接口"
  ]) {
    assert.match(handoff, new RegExp(phrase));
  }
});

test("reverse rule API can switch to the lightweight frontend mock", () => {
  const api = source("api.ts");

  assert.match(api, /VITE_USE_REVERSE_RULE_MOCK/);
  assert.match(api, /reverseRuleMock/);
  assert.match(api, /USE_REVERSE_RULE_MOCK/);
});

test("reverse rule mock covers the full acceptance flow", () => {
  assert.equal(exists("src", "reverseRuleMock.ts"), true, "reverseRuleMock.ts should exist");
  const mock = source("reverseRuleMock.ts");

  for (const symbol of [
    "listTasks",
    "createTask",
    "getTask",
    "getCandidates",
    "updateCandidateDecision",
    "batchUpdateCandidates",
    "confirmImport",
    "retryTask",
    "exportResult"
  ]) {
    assert.match(mock, new RegExp(symbol));
  }

  for (const fixture of ["failed-task", "completed-task", "pending_confirm", "付款期限过长", "llm_generation_failed"]) {
    assert.match(mock, new RegExp(fixture));
  }
});

test("reverse rule pages expose visual hooks for prototype-style progress and status states", () => {
  const css = source("styles.css");
  const listPage = source("pages", "ReverseTaskListPage.tsx");

  assert.match(listPage, /reverse-mini-progress/);
  assert.match(css, /reverse-mini-progress/);
  assert.match(css, /reverse-status-pending_confirm/);
  assert.match(css, /decision-included/);
  assert.match(css, /decision-ignored/);
});

test("candidate confirmation page follows the table and detail prototype layout", () => {
  const page = source("pages", "ReverseCandidateConfirmPage.tsx");
  const css = source("styles.css");

  for (const hook of [
    "reverse-confirm-shell",
    "reverse-candidate-table",
    "reverse-candidate-row",
    "checkedCandidateIds",
    "确认入库（{stats.included} 条纳入）"
  ]) {
    assert.match(page, new RegExp(hook.replace(/[(){}]/g, "\\$&")));
  }

  for (const phrase of ["风险名称", "审核模块", "触发条件（摘要）", "来源合同组"]) {
    assert.match(page, new RegExp(phrase));
  }

  for (const hook of [
    "reverse-confirm-shell",
    "reverse-candidate-table-scroll",
    "reverse-detail-side",
    "reverse-summary-strip",
    "reverse-confirm-actions"
  ]) {
    assert.match(css, new RegExp(hook));
  }
});

test("reverse task list mirrors the high-fidelity task table controls", () => {
  const listPage = source("pages", "ReverseTaskListPage.tsx");
  const css = source("styles.css");

  assert.match(listPage, /REVERSE_TASK_PAGE_SIZE = 20/);
  assert.match(listPage, /setTotal/);
  assert.match(listPage, /setPage/);
  assert.match(listPage, /skip: \(nextPage - 1\) \* REVERSE_TASK_PAGE_SIZE/);
  assert.match(listPage, /limit: REVERSE_TASK_PAGE_SIZE/);
  assert.match(listPage, /reverse-date-range-control/);
  assert.match(listPage, /reverse-list-pagination/);
  assert.doesNotMatch(listPage, /contractType/);
  assert.doesNotMatch(listPage, /contract_type: contractType/);

  assert.match(css, /\.reverse-list-page/);
  assert.match(css, /overflow: hidden/);
  assert.match(css, /\.reverse-list-table-card/);
  assert.match(css, /\.reverse-list-pagination/);
  assert.match(css, /\.reverse-date-range-control/);
});

test("reverse rule mock paginates and filters task dates for the high-fidelity list", () => {
  const mock = source("reverseRuleMock.ts");

  assert.match(mock, /mockTask\(/);
  assert.match(mock, /created_from/);
  assert.match(mock, /created_to/);
  assert.match(mock, /slice\(skip, skip \+ limit\)/);
  assert.match(mock, /total: filtered.length/);
  assert.match(mock, /software-task/);
  assert.match(mock, /cancelled-task/);
});

test("reverse task progress page uses the prototype progress layout hooks", () => {
  const page = source("pages", "ReverseTaskProgressPage.tsx");
  const css = source("styles.css");

  for (const hook of [
    "reverse-progress-hero",
    "reverse-progress-status",
    "reverse-progress-summary-strip",
    "reverse-stepper",
    "reverse-step-node",
    "reverse-progress-table-card"
  ]) {
    assert.match(page, new RegExp(hook));
    assert.match(css, new RegExp(`\\.${hook}`));
  }
});
