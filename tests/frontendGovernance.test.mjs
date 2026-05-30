import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (...parts) => readFileSync(join(process.cwd(), ...parts), "utf8");

test("package exposes npm test as the standard test entrypoint", () => {
  const pkg = JSON.parse(source("package.json"));

  assert.equal(pkg.scripts.test, "node --test \"tests/*.test.mjs\"");
});

test("rules workspace stays enabled and targets the cloud-backed rules contract", () => {
  const app = source("src", "App.tsx");
  const api = source("src", "api.ts");

  assert.match(app, /规则库/);
  assert.match(api, /\/api\/v1\/rules/);
  assert.match(api, /\/api\/v1\/rule-versions/);
  assert.doesNotMatch(app, /rulesFeatureUnavailable/);
  assert.doesNotMatch(app, /后端尚未实现规则接口/);
});

test("rules workspace state is grouped behind a dedicated hook", () => {
  const app = source("src", "App.tsx");

  assert.match(app, /function useRulesWorkspace\(/);
  assert.match(app, /= useRulesWorkspace\(\)/);
});

test("page components expose explicit props instead of accepting any", () => {
  for (const file of ["ReviewPage.tsx", "ComparePage.tsx", "HistoryPage.tsx", "LoginPage.tsx"]) {
    const page = source("src", "pages", file);
    const componentName = file.replace(/\.tsx$/, "");
    assert.match(page, new RegExp(`export interface ${componentName}Props`));
    assert.doesNotMatch(page, /function \w+\(props: any\)/);
  }
});
