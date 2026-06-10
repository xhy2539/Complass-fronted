// Minimal test: verify table replace preserves format, insert dedup works
import fs from "fs";

const d = JSON.parse(fs.readFileSync("E:/tmp_review_data.json", "utf8"));
const paras = d.task.paragraphs || [];
const reviewText = paras.map((p) => p.text || "").join("\n\n");

function safeReplace(text, search, replacement) {
  return text.replace(search, replacement.replace(/\$/g, "$$$$"));
}

function parseTableBlock(text) {
  const lines = (text || "").split("\n").filter(l => l.trim());
  const tableStart = lines.findIndex(l => l.trim() === "【表格】");
  if (tableStart < 0) return null;
  const headerLine = lines[tableStart + 1];
  if (!headerLine || !headerLine.includes("|")) return null;
  const headers = headerLine.split("|").map(c => c.trim());
  const rows = [];
  for (let i = tableStart + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.includes("|")) break;
    rows.push(line.split("|").map(c => c.trim()));
  }
  return { headers, rows };
}

function serializeTableBlock(headers, rows) {
  const lines = ["【表格】", headers.join(" | ")];
  for (const row of rows) lines.push(row.join(" | "));
  return lines.join("\n");
}

// TABLE REPLACE
const tableRisk = d.risk_points.find(r => r.action_type === "replace" && (r.evidence || "").includes("付款节点"));
if (tableRisk) {
  console.log("=== REPLACE:", tableRisk.title, "===");
  const ev = tableRisk.evidence.trim();
  const rt = tableRisk.replace_text;

  for (const p of paras) {
    const pt = p.text || "";
    if (!pt.includes(ev) || !pt.includes("【表格】")) continue;

    const table = parseTableBlock(pt);
    console.log("table headers:", table.headers);
    console.log("table rows before:", table.rows.length);

    // Simulate replace: find the row containing evidence and replace it
    const sep = " | ";
    let changed = false;
    const newRows = table.rows.map(row => {
      const rowStr = row.join(sep);
      if (rowStr.includes(ev)) {
        changed = true;
        const newRow = safeReplace(rowStr, ev, rt);
        return newRow.split(sep).map(c => c.trim());
      }
      return row;
    });

    if (changed) {
      const newPt = serializeTableBlock(table.headers, newRows);
      // Find old paragraph text in reviewText and replace it
      const idx = reviewText.indexOf(pt);
      const result = idx >= 0 ? reviewText.slice(0, idx) + newPt + reviewText.slice(idx + pt.length) : null;

      console.log("BEFORE:", pt.slice(0, 300));
      console.log("AFTER :", (newPt).slice(0, 300));
      console.log("table_ok:", newPt.includes("【表格】") && newPt.includes("|"));

      // Check evidence not duplicated
      const rowsAfter = parseTableBlock(newPt).rows;
      const dupCheck = rowsAfter.filter(r => r.join(sep).includes(ev));
      console.log("rows_with_evidence_after_replace:", dupCheck.length, "(期望 0，>0 说明 evidence 残留)");
      break;
    }
  }
}

// INSERT with dedup
const insRisk = d.risk_points.find(r => r.action_type === "insert");
if (insRisk) {
  console.log("\n=== INSERT:", insRisk.title, "===");
  const ev = (insRisk.evidence || "").trim();
  const rt = insRisk.replace_text || "";
  console.log("starts_with_evidence:", rt.startsWith(ev));

  // Dedup: strip evidence prefix
  let insertText = rt;
  if (insertText.startsWith(ev)) insertText = insertText.slice(ev.length);
  console.log("insertText (after dedup):", insertText.slice(0, 80));

  const pos = reviewText.indexOf(ev);
  if (pos >= 0) {
    const end = pos + ev.length;
    const result = reviewText.slice(0, end) + insertText + reviewText.slice(end);

    // Count evidence occurrences
    const escaped = ev.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const count = (result.match(new RegExp(escaped, "g")) || []).length;
    console.log("evidence_occurrences:", count, "(期望 1，>1 则重复)");

    // Show the insertion point
    console.log("context:", result.slice(Math.max(0, pos-20), end + insertText.length + 50));
  }
}
