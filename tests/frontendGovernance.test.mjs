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

test("app shell supports a persistent collapsible sidebar", () => {
  const app = source("src", "App.tsx");
  const styles = source("src", "styles.css");

  assert.match(app, /NAV_COLLAPSED_KEY = "complass_nav_collapsed"/);
  assert.match(app, /localStorage\.getItem\(NAV_COLLAPSED_KEY\) === "true"/);
  assert.match(app, /localStorage\.setItem\(NAV_COLLAPSED_KEY, String\(navCollapsed\)\)/);
  assert.match(app, /className=\{`app-shell \$\{navCollapsed \? "nav-collapsed" : ""\}`\}/);
  assert.match(app, /aria-label=\{navCollapsed \? "展开侧边栏" : "收起侧边栏"\}/);
  assert.match(app, /className="nav-item-label"/);
  assert.match(styles, /\.app-shell\.nav-collapsed/);
  assert.match(styles, /\.app-nav\.collapsed \.nav-item-label/);
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

test("auth registration collects phone and sends the backend register contract", () => {
  const app = source("src", "App.tsx");
  const api = source("src", "api.ts");
  const loginPage = source("src", "pages", "LoginPage.tsx");
  const types = source("src", "types.ts");

  assert.match(api, /register\(email: string, phone: string, nickname: string, password: string\)/);
  assert.match(api, /JSON\.stringify\(\{ email, phone, nickname, password \}\)/);
  assert.match(api, /login\(account: string, password: string\)/);
  assert.match(api, /JSON\.stringify\(\{ account, password \}\)/);

  assert.match(app, /const \[authPhone, setAuthPhone\] = useState\(""\)/);
  assert.match(app, /authMode === "register" && \(!authName \|\| !authPhone\)/);
  assert.match(app, /authMode === "register" && !authEmail\.trim\(\)\.includes\("@"\)/);
  assert.match(app, /api\.register\(authEmail\.trim\(\), authPhone\.trim\(\), authName\.trim\(\), authPassword\)/);
  assert.match(app, /authPhone=\{authPhone\}/);
  assert.match(app, /setAuthPhone=\{setAuthPhone\}/);

  assert.match(loginPage, /authPhone: string/);
  assert.match(loginPage, /setAuthPhone: \(value: string\) => void/);
  assert.match(loginPage, /type="tel"/);
  assert.match(loginPage, /value=\{authPhone\}/);
  assert.match(loginPage, /onChange=\{\(event\) => setAuthPhone\(event\.target\.value\)\}/);
  assert.match(loginPage, /\{authMode === "login" \? "邮箱\/手机号" : "邮箱"\}/);

  assert.match(types, /phone: string/);
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
  assert.match(comparePage, /value=\{isComparisonFailed \? 0 : isComparisonRunning \? "--" : comparisonDetail \? visibleDiffStats\.total : 0\}/);
  assert.match(comparePage, /value=\{isComparisonFailed \? 0 : isComparisonRunning \? "--" : comparisonDetail \? comparisonRiskCount : 0\}/);
  assert.match(comparePage, /comparisonAiState\.kind !== "ok"/);
});

test("comparison page hides result workspace and stats when task has failed", () => {
  const app = source("src", "App.tsx");
  const comparePage = source("src", "pages", "ComparePage.tsx");

  assert.match(app, /const isComparisonFailed = comparisonDetail\?\.task\.status === "failed"/);
  assert.match(app, /if \(isComparisonFailed\) return \[\]/);
  assert.match(comparePage, /const isComparisonFailed = comparisonAiState\.kind === "failed"/);
  assert.match(comparePage, /value=\{isComparisonFailed \? 0 : isComparisonRunning \? "--" : comparisonDetail \? visibleDiffStats\.total : 0\}/);
  assert.match(comparePage, /\{!isComparisonFailed && \(\s*<section className="compare-workspace">/s);
});

test("review and comparison side panels keep compact filters in the header", () => {
  const reviewPage = source("src", "pages", "ReviewPage.tsx");
  const comparePage = source("src", "pages", "ComparePage.tsx");
  const styles = source("src", "styles.css");

  assert.match(reviewPage, /<div className="panel-head risk-panel-head">[\s\S]*?<h2>风险点<\/h2>[\s\S]*?panel-filter-row right-panel-filter-row[\s\S]*?setReviewLevelFilter[\s\S]*?setReviewStatusFilter[\s\S]*?<\/div>\s*<div className="risk-panel-scroll">/);
  assert.doesNotMatch(reviewPage, /<p className="panel-subtitle">\s*\{filteredReviewRisks\.length\}/);

  assert.match(comparePage, /<div className="panel-head">[\s\S]*?<h2>差异点<\/h2>[\s\S]*?panel-filter-row right-panel-filter-row[\s\S]*?setDiffFilter[\s\S]*?setCompareLevelFilter[\s\S]*?<\/div>\s*<div className="diff-panel-scroll">/);
  assert.doesNotMatch(comparePage, /filteredDiffs\.length[\s\S]{0,80}filteredComparisonRisks\.length/);

  assert.match(styles, /\.right-panel-filter-row/);
  assert.match(styles, /\.right-panel-filter-row\s+\.select-wrap select\s*\{[^}]*height:\s*40px/s);
  assert.doesNotMatch(styles, /\.diff-card\.active,\s*\n\.risk-list-item\.active\s*\{[^}]*box-shadow:\s*inset/s);
  assert.doesNotMatch(styles, /\.diff-card\.active,\s*\n\.risk-list-item\.active\s*\{[^}]*border-color:/s);
  assert.match(styles, /\.diff-card\.active,\s*\n\.risk-list-item\.active\s*\{[^}]*background:\s*#f5f9ff/s);
});

test("risk detail cards remove manual note inputs", () => {
  const shared = source("src", "components", "shared.tsx");

  const riskDetail = shared.match(/export function RiskDetail[\s\S]*?export function ComparisonRiskDetail/);
  assert.ok(riskDetail, "RiskDetail component should be present");
  assert.doesNotMatch(riskDetail[0], /textarea/);
  assert.doesNotMatch(riskDetail[0], /input/);
  assert.doesNotMatch(riskDetail[0], /reviewComment/);
  assert.doesNotMatch(riskDetail[0], /ignoreReason/);

  const comparisonRiskDetail = shared.match(/export function ComparisonRiskDetail[\s\S]*?export function DetailBlock/);
  assert.ok(comparisonRiskDetail, "ComparisonRiskDetail component should be present");
  assert.doesNotMatch(comparisonRiskDetail[0], /textarea/);
  assert.doesNotMatch(comparisonRiskDetail[0], /input/);
  assert.doesNotMatch(comparisonRiskDetail[0], /comment/);
  assert.doesNotMatch(comparisonRiskDetail[0], /ignoreReason/);
});

test("review and comparison filters are 40px tall and content-width", () => {
  const styles = source("src", "styles.css");

  assert.match(styles, /\.right-panel-filter-row\s+\.select-shell\s*\{[^}]*width:\s*fit-content/s);
  assert.match(styles, /\.right-panel-filter-row\s+\.select-wrap\s*\{[^}]*width:\s*fit-content/s);
  assert.match(styles, /\.right-panel-filter-row\s+\.select-wrap select\s*\{[^}]*height:\s*40px/s);
  assert.match(styles, /\.right-panel-filter-row\s+\.select-wrap select\s*\{[^}]*min-width:\s*0/s);
});

test("comparison diff cards keep only type risk and status badges", () => {
  const comparePage = source("src", "pages", "ComparePage.tsx");
  const shared = source("src", "components", "shared.tsx");

  const diffCard = comparePage.match(/<article className=\{`diff-card compact[\s\S]*?\{expanded && <DiffDetailCard/);
  assert.ok(diffCard, "comparison diff card markup should be present");
  assert.match(diffCard[0], /changeTypeLabel\[diff\.change_type\]/);
  assert.match(diffCard[0], /riskLevelLabel\[diffRiskLevel\]/);
  assert.match(diffCard[0], /riskStatusLabel\[diffStatus\]/);
  assert.doesNotMatch(diffCard[0], /similarityLabel/);

  const diffDetail = shared.match(/export function DiffDetailCard[\s\S]*?export function RiskDetail/);
  assert.ok(diffDetail, "DiffDetailCard component should be present");
  assert.doesNotMatch(diffDetail[0], /<article className="diff-risk-entry"/);
  assert.match(diffDetail[0], /DetailBlock title=/);
});

test("active document highlights use blue underline only", () => {
  const styles = source("src", "styles.css");

  assert.match(styles, /\.diff-highlight\.active,\s*\n\.risk-highlight\.active\s*\{[^}]*text-decoration-line:\s*underline/s);
  assert.match(styles, /\.diff-highlight\.active,\s*\n\.risk-highlight\.active\s*\{[^}]*text-decoration-color:\s*var\(--brand\)/s);
  assert.match(styles, /\.diff-highlight\.active,\s*\n\.risk-highlight\.active\s*\{[^}]*text-decoration-thickness:\s*2px/s);
  assert.doesNotMatch(styles, /\.diff-highlight\.active,\s*\n\.risk-highlight\.active\s*\{[^}]*box-shadow/s);
});
