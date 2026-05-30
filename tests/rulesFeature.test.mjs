import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (file) => readFileSync(join(process.cwd(), "src", file), "utf8");

test("rules workspace is reachable from the app shell", () => {
  const app = source("App.tsx");

  assert.match(app, /type View = .*"rules"/);
  assert.match(app, /规则库/);
  assert.match(app, /renderRules/);
  assert.match(app, /BookOpenCheck/);
});

test("rules workspace uses a compact operations layout", () => {
  const app = source("App.tsx");
  const css = source("styles.css");

  assert.match(app, /rules-toolbar/);
  assert.match(app, /rule-import-result/);
  assert.match(app, /rules-table-footer/);
  assert.match(css, /\.rules-page \.page-head/);
  assert.match(css, /\.rules-toolbar/);
  assert.match(css, /\.rule-import-result/);
  assert.match(css, /\.rules-table-scroll/);
  assert.match(css, /\.rules-table-footer/);
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
