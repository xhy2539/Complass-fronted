/**
 * Table block utilities for parsing and serializing the pipe-delimited table format
 * used by the backend parser (e.g. "【表格】\n合同编号 | FW-2026-0524-RISK\n甲方 | 杭州澜舟...").
 *
 * These functions are display-only — they do not affect how the backend stores or
 * processes paragraph text.
 */

export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

/**
 * Detect whether a paragraph text block is a table block.
 * Table blocks start with "【表格】\n" followed by pipe-delimited content.
 */
export function isTableBlock(text: string): boolean {
  return text.startsWith("【表格】\n");
}

/**
 * Parse a table block string into headers and rows.
 * Returns null if the text is not a valid table block.
 */
export function parseTableBlock(text: string): ParsedTable | null {
  if (!isTableBlock(text)) return null;

  const content = text.slice(5).trim(); // strip leading "【表格】\n"
  const lines = content.split("\n").filter((l) => l.trim());

  if (lines.length < 2) return null; // need at least a header row and one data row

  const parseRow = (line: string): string[] =>
    line.split("|").map((cell) => cell.trim());

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);

  // basic validation: all rows should have the same column count as the header
  const colCount = headers.length;
  if (colCount === 0) return null;
  for (const row of rows) {
    if (row.length !== colCount) return null;
  }

  return { headers, rows };
}

/**
 * Serialize headers and rows back into the pipe-delimited table block format
 * that the backend expects.
 */
export function serializeTableBlock(headers: string[], rows: string[][]): string {
  const sep = " | ";
  const headerLine = headers.join(sep);
  const rowLines = rows.map((row) => row.join(sep));
  return `【表格】\n${headerLine}\n${rowLines.join("\n")}`;
}