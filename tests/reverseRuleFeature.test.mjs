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

test("reverse rule API no longer exposes the frontend mock switch or mock data", () => {
  const api = source("api.ts");

  assert.equal(exists("src", "reverseRuleMock.ts"), false, "reverseRuleMock.ts should be removed");
  assert.doesNotMatch(api, /VITE_USE_REVERSE_RULE_MOCK/);
  assert.doesNotMatch(api, /reverseRuleMock/);
  assert.doesNotMatch(api, /USE_REVERSE_RULE_MOCK/);
  assert.doesNotMatch(api, /mock-rule/);
  assert.doesNotMatch(api, /mock-task/);
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
  ].filter((hook) => !hook.includes("stats.included"))) {
    assert.match(page, new RegExp(hook.replace(/[(){}]/g, "\\$&")));
  }
  assert.match(page, /checkedCandidateIds\.length/);

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
  assert.match(css, /\.reverse-list-table-card/);
  assert.match(css, /\.reverse-list-pagination/);
  assert.match(css, /\.reverse-date-range-control/);
});

test("pending confirmation tasks route through progress instead of skipping to confirm", () => {
  const ui = source("reverseRuleUi.ts");
  const listPage = source("pages", "ReverseTaskListPage.tsx");

  assert.match(ui, /reverseTaskNeedsConfirmation/);
  assert.match(ui, /if \(task\.status === "pending_confirm"\) return true/);
  assert.match(ui, /if \(reverseTaskNeedsConfirmation\(task\)\) return `\/rules\/reverse-tasks\/\$\{task\.id\}\/progress`/);
  assert.match(listPage, /status === "pending_confirm".*查看候选规则/s);
  assert.match(listPage, /status === "completed".*查看入库结果/s);
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

test("reverse pages avoid fixed-height hidden containers that cut off page content", () => {
  const css = source("styles.css");
  const constrainedSelectors = [
    "reverse-list-page",
    "reverse-progress-page",
    "reverse-create-page",
    "reverse-confirm-page"
  ];

  for (const selector of constrainedSelectors) {
    const block = css.match(new RegExp(`\\.${selector}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0] ?? "";
    assert.notEqual(block, "", `${selector} should have a CSS block`);
    assert.doesNotMatch(block, /^\s*height:\s*calc\(100vh/m);
    assert.doesNotMatch(block, /overflow:\s*hidden/);
  }

  const reverseEntryBlock = css.match(/\.rules-page \.reverse-task-entry\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.notEqual(reverseEntryBlock, "", "rules reverse task entry should have a CSS block");
  assert.doesNotMatch(reverseEntryBlock, /max-height:\s*250px/);
  assert.doesNotMatch(reverseEntryBlock, /overflow:\s*hidden/);
});

test("candidate confirmation page localizes detail labels and has a zero-candidate empty branch", () => {
  const page = source("pages", "ReverseCandidateConfirmPage.tsx");

  for (const label of ["风险名称", "检查点", "触发条件", "修改建议", "示例条款"]) {
    assert.match(page, new RegExp(label));
  }

  for (const fieldName of ["risk_name", "check_point", "trigger_condition", "suggestion_template", "example_clause"]) {
    assert.doesNotMatch(page, new RegExp(`<span>${fieldName}<\\/span>`));
  }

  assert.match(page, /candidates\.length === 0/);
  assert.match(page, /candidates\.length > 0/);
  assert.match(page, /disabled=\{checkedCandidateIds\.length === 0 \|\| busy === "confirm"\}/);
});

test("candidate confirmation actions only import checked rules through the backend", () => {
  const page = source("pages", "ReverseCandidateConfirmPage.tsx");

  assert.match(page, /confirmReverseRuleImport\(taskId, checkedCandidateIds\)/);
  assert.match(page, /setDecision\(candidate, candidate\.decision === "included" \? "pending" : "included"\)/);
  assert.doesNotMatch(page, /candidate\.decision === "ignored" \? "pending" : "ignored"/);
  assert.doesNotMatch(page, /candidate\.decision === "ignored" \? "撤回" : "忽略"/);
  assert.doesNotMatch(page, /setDecision\(selected,/);
  assert.doesNotMatch(page, /CheckCircle2|XCircle|撤回忽略/);
});
