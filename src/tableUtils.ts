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

const TABLE_MARKER = "【表格】";

/**
 * Detect whether a paragraph text block is a table block.
 * Table blocks start with "【表格】" followed by pipe-delimited content.
 */
export function isTableBlock(text: string): boolean {
  if (!text) return false;
  const marker = text.trimStart().slice(0, 4);
  return marker === TABLE_MARKER;
}

/**
 * Parse a table block string into headers and rows.
 * Returns null if the text is not a valid table block.
 */
export function parseTableBlock(text: string): ParsedTable | null {
  if (!isTableBlock(text)) return null;

  // Strip the "【表格】" marker and all leading whitespace/newlines
  const markerIdx = text.indexOf(TABLE_MARKER);
  const afterMarker = text.slice(markerIdx + TABLE_MARKER.length);

  // Normalize line endings: \r\n -> \n, then split
  const normalized = afterMarker.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

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