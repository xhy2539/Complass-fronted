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

test("upload actions use per-label busy locks instead of one overwritten busy string", () => {
  const app = source("src", "App.tsx");
  const reviewPage = source("src", "pages", "ReviewPage.tsx");
  const comparePage = source("src", "pages", "ComparePage.tsx");
  const loginPage = source("src", "pages", "LoginPage.tsx");

  assert.match(app, /busyLabelsRef/);
  assert.match(app, /busyLabelsRef\.current\.has\(label\)/);
  assert.match(reviewPage, /busy\("review-upload"\)/);
  assert.match(comparePage, /busy\("comparison-upload"\)/);
  assert.match(loginPage, /disabled=\{busy\("auth"\)\}/);
  assert.doesNotMatch(reviewPage, /busy === "review-upload"/);
});

test("review page does not display zero-risk stats while AI analysis is still running", () => {
  const reviewPage = source("src", "pages", "ReviewPage.tsx");

  assert.match(reviewPage, /reviewAiState\.kind === "pending"/);
  assert.match(reviewPage, /value=\{isReviewRunning \? "--" : (?:reviewDetail \? )?reviewRiskStats\.total(?: : 0)?\}/);
  assert.match(reviewPage, /reviewAiState\.kind !== "ok"/);
});

test("review upload button reflects an already-running AI analysis task", () => {
  const reviewPage = source("src", "pages", "ReviewPage.tsx");

  assert.match(reviewPage, /disabled=\{isReviewRunning \|\| busy\("review-upload"\)\}/);
  assert.match(reviewPage, /\{isReviewRunning \|\| busy\("review-upload"\) \? "审查中\.\.\." : "开始审查"\}/);
});

test("comparison upload button reflects an already-running AI enhancement task", () => {
  const comparePage = source("src", "pages", "ComparePage.tsx");

  assert.match(comparePage, /disabled=\{isComparisonRunning \|\| busy\("comparison-upload"\)\}/);
  assert.match(comparePage, /\{isComparisonRunning \|\| busy\("comparison-upload"\) \? "比对中\.\.\." : "开始比对"\}/);
});

test("comparison page does not display zero stats while AI enhancement is still running", () => {
  const comparePage = source("src", "pages", "ComparePage.tsx");

  assert.match(comparePage, /comparisonAiState\.kind === "pending"/);
  assert.match(comparePage, /value=\{isComparisonRunning \? "--" : (?:comparisonDetail \? )?visibleDiffStats\.total(?: : 0)?\}/);
  assert.match(comparePage, /value=\{isComparisonRunning \? "--" : (?:comparisonDetail \? )?comparisonRiskCount(?: : 0)?\}/);
  assert.match(comparePage, /comparisonAiState\.kind !== "ok"/);
});
