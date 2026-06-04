import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (file) => readFileSync(join(process.cwd(), "src", file), "utf8");

test("rules workspace is reachable from the app shell", () => {
  const app = source("App.tsx");

  assert.match(app, /type View = .*"rules"/);
  assert.match(app, /规则处理/);
  assert.match(app, /规则库/);
  assert.match(app, /逆向解析规则/);
  assert.match(app, /rules-subnav/);
  assert.match(app, /renderRules/);
  assert.match(app, /BookOpenCheck/);
});

test("rules workspace no longer embeds reverse parsing tasks", () => {
  const app = source("App.tsx");

  assert.doesNotMatch(app, /reverseRuleTasks/);
  assert.doesNotMatch(app, /loadReverseRuleTaskPreview/);
  assert.doesNotMatch(app, /reverse-task-entry/);
  assert.doesNotMatch(app, /逆向生成规则/);
});

test("rules workspace uses a compact operations layout", () => {
  const app = source("App.tsx");
  const css = source("styles.css");

  assert.match(app, /rules-toolbar/);
  assert.match(app, /rule-import-result/);
  assert.match(app, /rules-table-footer/);
  assert.doesNotMatch(app, /rules-head/);
  assert.doesNotMatch(app, /维护合同审查规则和 CSV 导入结果/);
  assert.doesNotMatch(css, /\.rules-page \.page-head/);
  assert.match(css, /\.rules-toolbar/);
  assert.match(css, /\.rule-import-result/);
  assert.match(css, /\.rules-table-scroll/);
  assert.match(css, /\.rules-table-footer/);
});

test("rules table header owns create and import actions", () => {
  const app = source("App.tsx");
  const tableHeader = app.match(/<section className="rules-table panel-surface">[\s\S]*?<div className="rules-table-scroll">/)?.[0] ?? "";

  assert.match(tableHeader, /导入规则[\s\S]*新建规则/);
  assert.match(tableHeader, /ruleImportInputRef/);
  assert.match(tableHeader, /FileUp/);
  assert.match(tableHeader, /Plus/);
});

test("rules pagination displays the real fixed page size", () => {
  const app = source("App.tsx");

  assert.match(app, /每页展示：/);
  assert.match(app, /<span className="rules-page-size">\{RULE_PAGE_SIZE\} 条\/页<\/span>/);
  assert.doesNotMatch(app, /<select value=\{RULE_PAGE_SIZE\} disabled>/);
});

test("rules table panel is pinned to the viewport bottom", () => {
  const css = source("styles.css");
  const rulesPageBlock = css.match(/\.rules-page \{[\s\S]*?\n\}/)?.[0] ?? "";
  const rulesTableBlock = css.match(/\.rules-table \{[\s\S]*?\n\}/)?.[0] ?? "";
  const tableScrollBlock = css.match(/\.rules-table-scroll \{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(rulesPageBlock, /height: calc\(100vh - 48px\);/);
  assert.match(rulesPageBlock, /min-height: 0;/);
  assert.match(rulesPageBlock, /grid-template-rows: auto minmax\(0, 1fr\);/);
  assert.match(rulesPageBlock, /overflow: hidden;/);
  assert.match(rulesTableBlock, /overflow: hidden;/);
  assert.match(tableScrollBlock, /overflow-y: auto;/);
});

test("rules workspace hides unclear version-management surfaces", () => {
  const app = source("App.tsx");

  assert.doesNotMatch(app, /当前筛选/);
  assert.doesNotMatch(app, /当前激活版本/);
  assert.doesNotMatch(app, /版本管理/);
  assert.doesNotMatch(app, /新建版本/);
  assert.doesNotMatch(app, /版本列表/);
});

test("rules api covers CRUD, CSV import, and version management", () => {
  const api = source("api.ts");

  for (const method of [
    "listRules",
    "createRule",
    "updateRule",
    "deleteRule",
    "setRuleEnabled",
    "importRulesCsv",
    "listRuleVersions",
    "createRuleVersion",
    "activateRuleVersion"
  ]) {
    assert.match(api, new RegExp(`${method}\\(`));
  }

  assert.match(api, /\/api\/v1\/rules/);
  assert.match(api, /\/api\/v1\/rules\/import-csv/);
  assert.match(api, /\/api\/v1\/rule-versions/);
});

test("rules types and form fields match the documented interface", () => {
  const types = source("types.ts");
  const app = source("App.tsx");

  assert.match(types, /interface Rule\b/);
  assert.match(types, /interface RuleVersion\b/);
  assert.match(types, /interface RuleImportResponse\b/);

  for (const field of [
    "rule_code",
    "contract_type",
    "review_module",
    "risk_name",
    "check_point",
    "trigger_condition",
    "default_risk_level",
    "suggestion_template",
    "example_clause",
    "enabled"
  ]) {
    assert.match(app, new RegExp(field));
  }

  assert.match(app, /value="高"/);
  assert.match(app, /value="中"/);
  assert.match(app, /value="低"/);
});
