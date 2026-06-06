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
  assert.match(app, /api\.register\(authEmail\.trim\(\), authPhone\.trim\(\), authName\.trim\(\), authPassword\)/);
  assert.match(app, /authPhone=\{authPhone\}/);
  assert.match(app, /setAuthPhone=\{setAuthPhone\}/);

  assert.match(loginPage, /authPhone: string/);
  assert.match(loginPage, /setAuthPhone: \(value: string\) => void/);
  assert.match(loginPage, /type="tel"/);
  assert.match(loginPage, /value=\{authPhone\}/);
  assert.match(loginPage, /onChange=\{\(event\) => setAuthPhone\(event\.target\.value\)\}/);
  assert.match(loginPage, /邮箱\/手机号/);

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
  assert.match(comparePage, /value=\{isComparisonRunning \? "--" : (?:comparisonDetail \? )?visibleDiffStats\.total(?: : 0)?\}/);
  assert.match(comparePage, /value=\{isComparisonRunning \? "--" : (?:comparisonDetail \? )?comparisonRiskCount(?: : 0)?\}/);
  assert.match(comparePage, /comparisonAiState\.kind !== "ok"/);
});
