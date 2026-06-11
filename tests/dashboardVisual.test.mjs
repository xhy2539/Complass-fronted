import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const appSource = () => readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
const cssSource = () => readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

test("dashboard uses the compliance compass hero layout hooks", () => {
  const source = appSource();

  assert.match(source, /dashboard-workbench/);
  assert.match(source, /dashboard-hero/);
  assert.match(source, /合规罗盘/);
  assert.doesNotMatch(source, /dashboard-kpis/);
  assert.match(source, /dashboard-main-grid/);
  assert.doesNotMatch(source, /dashboard-action-grid/);
  assert.doesNotMatch(source, /合同审查原型工作台/);
  assert.doesNotMatch(source, /rules-entry/);
});

test("shared page surfaces use the unified visual system hooks", () => {
  const source = cssSource();

  assert.match(source, /--radius-panel/);
  assert.match(source, /\.dashboard-hero/);
  assert.match(source, /dashboard-hero-bg\.png/);
  assert.match(source, /\.dashboard-main-grid/);
  assert.match(source, /\.recent-file-name/);
  assert.match(source, /\.document-pane,\s*\n\.review-document,\s*\n\.diff-panel,\s*\n\.risk-panel/);
});

test("review workspace uses source and export preview tabs", () => {
  const reviewPage = readFileSync(join(process.cwd(), "src", "pages", "ReviewPage.tsx"), "utf8");
  const css = cssSource();

  assert.match(reviewPage, /activeReviewTextTab/);
  assert.match(reviewPage, /review-document-tabs/);
  assert.match(reviewPage, /review-toolbar/);
  assert.match(reviewPage, /review-export-preview/);
  assert.match(reviewPage, /onChange/);
  assert.doesNotMatch(reviewPage, /editor-panel/);

  assert.match(css, /\.review-document-tabs/);
  assert.match(css, /\.review-toolbar/);
  assert.match(css, /\.review-toolbar\s*\{[^}]*box-shadow:\s*none/s);
  assert.match(css, /\.review-export-preview/);
  assert.match(css, /\.review-scroll\.source-document/);
  assert.match(css, /\.source-document\s+\.contract-paragraph\s*\{[^}]*border:\s*0/s);
});

test("contract reading surfaces use theme text and transparent highlights", () => {
  const css = cssSource();

  assert.match(css, /\.source-document\s+\.contract-paragraph p\s*\{[^}]*color:\s*var\(--text\)/s);
  assert.match(css, /\.review-export-preview\s*\{[^}]*color:\s*var\(--text\)/s);
  assert.match(css, /\.contract-paragraph p\s*\{[^}]*color:\s*var\(--text\)/s);
  assert.match(css, /\.compare-workspace\s+\.contract-paragraph p\s*\{[^}]*color:\s*var\(--text\)/s);
  assert.match(css, /\.diff-highlight,\s*\n\.risk-highlight\s*\{[^}]*color:\s*var\(--text\)/s);

  assert.match(css, /rgba\(15,\s*138,\s*75,\s*0\.16\)/);
  assert.match(css, /rgba\(217,\s*45,\s*32,\s*0\.16\)/);
  assert.match(css, /rgba\((?:185|202),/);
  assert.match(css, /rgba\(15,\s*99,\s*230,\s*0\.14\)/);

  assert.match(css, /\.diff-highlight\.active,[\s\S]*?\.risk-highlight\.active[^{]*\{[^}]*text-decoration-line:\s*underline/s);
  assert.match(css, /\.diff-highlight\.active,[\s\S]*?\.risk-highlight\.active[^{]*\{[^}]*text-decoration-color:\s*currentColor/s);
  assert.match(css, /\.diff-highlight\.active,[\s\S]*?\.risk-highlight\.active[^{]*\{[^}]*text-decoration-thickness:\s*2px/s);
  assert.doesNotMatch(css, /\.diff-highlight\.active,[\s\S]*?\.risk-highlight\.active[^{]*\{[^}]*box-shadow:\s*0 0 0 2px/s);
});
