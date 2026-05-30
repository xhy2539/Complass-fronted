import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const srcPath = (...parts) => join(process.cwd(), "src", ...parts);
const source = (...parts) => readFileSync(srcPath(...parts), "utf8");

test("app uses react-router routes for the primary pages", () => {
  const app = source("App.tsx");

  assert.match(app, /BrowserRouter/);
  assert.match(app, /Routes/);
  assert.match(app, /Route/);
  assert.match(app, /path="\/login"/);
  assert.match(app, /path="\/review"/);
  assert.match(app, /path="\/reviews\/:taskId"/);
  assert.match(app, /path="\/compare"/);
  assert.match(app, /path="\/comparisons\/:taskId"/);
  assert.match(app, /path="\/history"/);
});

test("im deep links preserve the original destination through login", () => {
  const app = source("App.tsx");

  assert.match(app, /loginRedirectPath/);
  assert.match(app, /redirect=/);
  assert.match(app, /navigate\(loginRedirectPath,\s*\{\s*replace:\s*true\s*\}\)/);
});

test("primary pages are split out of App.tsx", () => {
  const pageFiles = [
    "LoginPage.tsx",
    "ReviewPage.tsx",
    "ComparePage.tsx",
    "HistoryPage.tsx"
  ];

  for (const file of pageFiles) {
    assert.equal(existsSync(srcPath("pages", file)), true, `${file} should exist`);
  }

  const app = source("App.tsx");
  assert.doesNotMatch(app, /function renderReview/);
  assert.doesNotMatch(app, /function renderCompare/);
  assert.doesNotMatch(app, /function renderHistory/);
});
