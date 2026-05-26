import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const appSource = () => readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
const cssSource = () => readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

test("dashboard uses the unified workbench layout hooks", () => {
  const source = appSource();

  assert.match(source, /dashboard-workbench/);
  assert.match(source, /dashboard-command/);
  assert.doesNotMatch(source, /dashboard-kpis/);
  assert.match(source, /dashboard-main-grid/);
});

test("shared page surfaces use the unified visual system hooks", () => {
  const source = cssSource();

  assert.match(source, /--radius-panel/);
  assert.match(source, /\.dashboard-command/);
  assert.match(source, /\.dashboard-main-grid/);
  assert.match(source, /\.recent-file-name/);
  assert.match(source, /\.document-pane,\s*\n\.review-document,\s*\n\.diff-panel,\s*\n\.risk-panel/);
});
