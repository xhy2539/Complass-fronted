import { isTableBlock, parseTableBlock, serializeTableBlock } from "./tableUtils";
import type { ChangeType, ComparisonDetail, ComparisonRiskPoint, DiffDetail, Paragraph, ReviewDetail, RiskLevel, RiskPoint } from "./types";

export type ReviewRiskLocationStatus = "matched" | "fallback" | "missing";

export type ReviewParagraphToken =
  | { type: "text"; text: string }
  | { type: "risk"; text: string; riskId: string; riskIds: string[]; replaced: boolean };

export interface ReviewRiskLocation {
  riskId: string;
  status: ReviewRiskLocationStatus;
  paragraphIndex: number | null;
  targetText: string | null;
}

export interface ReviewParagraphHighlight {
  paragraph: Paragraph;
  tokens: ReviewParagraphToken[];
}

export interface ReviewParagraphHighlightResult {
  paragraphs: ReviewParagraphHighlight[];
  locations: Record<string, ReviewRiskLocation>;
}

export type ComparisonSide = "old" | "new";
export type ComparisonDiffLocationStatus = "matched" | "fallback" | "missing";

export type ComparisonParagraphToken =
  | { type: "text"; text: string }
  | { type: "diff"; text: string; diffIndex: number; changeType: ChangeType; riskLevel: RiskLevel | null };

export interface ComparisonDiffLocation {
  diffIndex: number;
  side: ComparisonSide;
  status: ComparisonDiffLocationStatus;
  paragraphIndex: number | null;
  targetText: string | null;
}

export interface ComparisonParagraphHighlight {
  paragraph: Paragraph;
  tokens: ComparisonParagraphToken[];
}

export interface ComparisonParagraphHighlightResult {
  paragraphs: ComparisonParagraphHighlight[];
  locations: Record<number, Partial<Record<ComparisonSide, ComparisonDiffLocation>>>;
}

function paragraphSortValue(paragraph: Paragraph, fallback: number) {
  return typeof paragraph.index === "number" && Number.isFinite(paragraph.index) ? paragraph.index : fallback;
}

function normalizeParagraphs(paragraphs: Paragraph[] | null | undefined) {
  return [...(paragraphs ?? [])]
    .filter((paragraph) => (paragraph.text ?? "").trim().length > 0)
    .sort((left, right) => paragraphSortValue(left, 0) - paragraphSortValue(right, 0));
}

function paragraphIndexFromPosition(position?: Record<string, unknown> | null) {
  const value = position?.paragraph_index;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function compactText(value?: string | null) {
  const text = value?.trim();
  return text ? text : null;
}

function safeReplace(text: string, search: string, replacement: string) {
  return text.replace(search, replacement.replace(/\$/g, "$$$$"));
}

function isPlaceholderEvidence(text: string) {
  return /未发现明确原文|相关内容缺失/.test(text);
}

/** 返回风险点可用于定位/高亮的原文文本，优先级：evidence → sentence_text。 */
export function riskSourceTexts(risk: Pick<RiskPoint, "sentence_text" | "evidence">) {
  const texts = [compactText(risk.evidence), compactText(risk.sentence_text)].filter(
    (text): text is string => Boolean(text && !isPlaceholderEvidence(text))
  );
  return [...new Set(texts)];
}

/** 用 evidence 字段查找匹配段落的辅助函数（优先使用 evidence）。 */
function findEvidenceMatch(paragraphs: Paragraph[], risk: Pick<RiskPoint, "evidence">) {
  const evidence = compactText(risk.evidence);
  if (!evidence) return null;
  for (const paragraph of paragraphs) {
    const text = paragraph.text ?? "";
    const start = text.indexOf(evidence);
    if (start >= 0) {
      return { paragraph, targetText: evidence, start, end: start + evidence.length };
    }
  }
  return null;
}

export function findRiskTextMatch(paragraphs: Paragraph[], risk: RiskPoint) {
  // 第1优先级：用 evidence 精确匹配（这是 Coze 返回的原始引用，也是后端计算 position 的依据）
  const evidenceMatch = findEvidenceMatch(paragraphs, risk);
  if (evidenceMatch) return evidenceMatch;

  // 第2优先级：sentence_text（关联的原句）
  const sentenceText = compactText(risk.sentence_text);
  if (sentenceText) {
    for (const paragraph of paragraphs) {
      const text = paragraph.text ?? "";
      const start = text.indexOf(sentenceText);
      if (start >= 0) {
        return { paragraph, targetText: sentenceText, start, end: start + sentenceText.length };
      }
    }
  }

  return null;
}

/** 在表格段落中逐格替换 evidence → replace_text，保持管道格式不变。 */
function replaceInTableParagraph(pt: string, evidence: string, replaceText: string): string | null {
  const table = parseTableBlock(pt);
  if (!table) return null;
  const sep = " | ";
  let changed = false;

  // 表头行
  const newHeaders = table.headers.map(cell => {
    if (cell && evidence.includes(cell)) { changed = true; return safeReplace(cell, cell, replaceText); }
    return cell;
  });
  if (changed) return serializeTableBlock(newHeaders, table.rows);

  // 数据行：逐格匹配
  const newRows = table.rows.map(row =>
    row.map(cell => {
      if (cell && evidence.includes(cell)) { changed = true; return safeReplace(cell, cell, replaceText); }
      return cell;
    })
  );
  return changed ? serializeTableBlock(table.headers, newRows) : null;
}

export function applyRiskReplacementToText(text: string, risk: RiskPoint, paragraphs?: Paragraph[]) {
  if (!risk.replace_text) return null;
  const evidence = compactText(risk.evidence);
  if (!evidence || isPlaceholderEvidence(evidence)) return null;
  if (paragraphs) {
    for (const p of paragraphs) {
      const pt = p.text ?? "";
      if (pt.includes(evidence)) {
        // 表格段落：单元格级别替换，保持表格格式
        if (isTableBlock(pt)) {
          const newPt = replaceInTableParagraph(pt, evidence, risk.replace_text);
          if (newPt) {
            const idx = text.indexOf(pt);
            if (idx >= 0) return text.slice(0, idx) + newPt + text.slice(idx + pt.length);
          }
        }
        // 普通段落：直接替换
        const newPt = safeReplace(pt, evidence, risk.replace_text);
        const idx = text.indexOf(pt);
        if (idx >= 0) return text.slice(0, idx) + newPt + text.slice(idx + pt.length);
      }
    }
  }
  if (text.includes(evidence)) {
    return safeReplace(text, evidence, risk.replace_text);
  }
  return null;
}

/**
 * 插入 replace_text：普通段落紧跟 evidence，表格段落按单元格替换。
 * 仅用于 action_type === "insert"。用 evidence 精确定位原文。
 */
export function applyRiskInsertionToText(text: string, risk: RiskPoint, paragraphs?: Paragraph[]) {
  if (!risk.replace_text) return null;
  const evidence = compactText(risk.evidence);
  if (!evidence || isPlaceholderEvidence(evidence)) return null;
  // 去重：如果 replace_text 以 evidence 开头，只取新增部分
  let insertText = risk.replace_text;
  if (insertText.startsWith(evidence)) {
    insertText = insertText.slice(evidence.length);
  }
  if (!insertText) return null;
  if (paragraphs) {
    for (const p of paragraphs) {
      const pt = p.text ?? "";
      const pos = pt.indexOf(evidence);
      if (pos >= 0) {
        let newPt: string;
        // 表格段落：单元格级别替换，保持表格格式
        if (isTableBlock(pt)) {
          const replaced = replaceInTableParagraph(pt, evidence, risk.replace_text);
          if (replaced) newPt = replaced;
          else continue;
        } else {
          // 普通段落：紧跟 evidence 插入新文本
          const end = pos + evidence.length;
          newPt = pt.slice(0, end) + insertText + pt.slice(end);
        }
        const idx = text.indexOf(pt);
        if (idx >= 0) return text.slice(0, idx) + newPt + text.slice(idx + pt.length);
      }
    }
  }
  const pos = text.indexOf(evidence);
  if (pos < 0) return null;
  const end = pos + evidence.length;
  return text.slice(0, end) + insertText + text.slice(end);
}

export function revertRiskReplacementInText(text: string, risk: RiskPoint, paragraphs?: Paragraph[]) {
  if (!risk.replace_text || !text.includes(risk.replace_text)) return null;
  const evidence = compactText(risk.evidence);
  const originalText = evidence || riskSourceTexts(risk)[0];
  if (!originalText) return null;
  if (paragraphs) {
    for (const p of paragraphs) {
      const pt = p.text ?? "";
      if (pt.includes(risk.replace_text!)) {
        const newPt = safeReplace(pt, risk.replace_text!, originalText);
        const idx = text.indexOf(pt);
        if (idx >= 0) return text.slice(0, idx) + newPt + text.slice(idx + pt.length);
      }
    }
  }
  return safeReplace(text, risk.replace_text, originalText);
}

/** 撤回插入：移除紧跟在 evidence 之后的 replace_text（含去重逻辑）。 */
export function revertRiskInsertionInText(text: string, risk: RiskPoint, paragraphs?: Paragraph[]) {
  if (!risk.replace_text) return null;
  const evidence = compactText(risk.evidence);
  if (!evidence) return null;
  // 去重：和 apply 对齐
  let insertText = risk.replace_text;
  if (insertText.startsWith(evidence)) {
    insertText = insertText.slice(evidence.length);
  }
  if (!insertText) return null;
  const inserted = evidence + insertText;
  if (paragraphs) {
    for (const p of paragraphs) {
      const pt = p.text ?? "";
      if (pt.includes(inserted)) {
        let newPt: string;
        if (isTableBlock(pt)) {
          // 表格：用 replace 逆操作还原
          const replaced = replaceInTableParagraph(pt, risk.replace_text, evidence);
          if (replaced) newPt = replaced;
          else continue;
        } else {
          newPt = safeReplace(pt, inserted, evidence);
        }
        const idx = text.indexOf(pt);
        if (idx >= 0) return text.slice(0, idx) + newPt + text.slice(idx + pt.length);
      }
    }
  }
  if (text.includes(inserted)) {
    return safeReplace(text, inserted, evidence);
  }
  return null;
}

/**
 * 追加 replace_text 到合同末尾。
 * 仅用于 action_type === "append"。表示合同缺少某类条款，直接追加。
 * 返回新的合同文本。
 */
export function applyRiskAppendToText(text: string, risk: RiskPoint) {
  if (!risk.replace_text) return null;
  const trimmed = text.trimEnd();
  return trimmed ? `${trimmed}\n\n${risk.replace_text}` : risk.replace_text;
}

/** 撤回追加：以段落为单位移除 replace_text（支持多次追加）。 */
export function revertRiskAppendInText(text: string, risk: RiskPoint) {
  if (!risk.replace_text) return null;
  const paragraphs = splitDocumentText(text);
  // 从末尾向前查找，支持撤回任意一次追加
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    if (paragraphs[i] === risk.replace_text.trim()) {
      const newParagraphs = [...paragraphs];
      newParagraphs.splice(i, 1);
      return newParagraphs.join("\n\n");
    }
  }
  return null;
}

function locateRisk(paragraphs: Paragraph[], risk: RiskPoint): ReviewRiskLocation {
  const actionType = risk.action_type ?? "manual";

  // replace / insert：仅允许 evidence 精确命中，不 fallback
  if (actionType === "replace" || actionType === "insert") {
    const evidenceMatch = findEvidenceMatch(paragraphs, risk);
    if (evidenceMatch) {
      return {
        riskId: risk.id,
        status: "matched",
        paragraphIndex: evidenceMatch.paragraph.index,
        targetText: evidenceMatch.targetText
      };
    }
    // 证据未命中时，尝试用 replace_text 反向定位（已应用替换后的文本）
    const rt = compactText(risk.replace_text);
    if (rt) {
      for (const paragraph of paragraphs) {
        const text = paragraph.text ?? "";
        if (text.includes(rt)) {
          return {
            riskId: risk.id,
            status: "matched",
            paragraphIndex: paragraph.index,
            targetText: rt
          };
        }
      }
    }
    return { riskId: risk.id, status: "missing", paragraphIndex: null, targetText: null };
  }

  // append / manual：允许更宽松的匹配（evidence → sentence_text），匹配不到可 fallback 到段落位置
  const match = findRiskTextMatch(paragraphs, risk);
  if (match) {
    return {
      riskId: risk.id,
      status: "matched",
      paragraphIndex: match.paragraph.index,
      targetText: match.targetText
    };
  }

  const fallbackIndex = paragraphIndexFromPosition(risk.position);
  const hasFallback = fallbackIndex !== null && paragraphs.some((paragraph) => paragraph.index === fallbackIndex);
  if (riskSourceTexts(risk).length === 0 && hasFallback) {
    return { riskId: risk.id, status: "fallback", paragraphIndex: fallbackIndex, targetText: null };
  }

  return { riskId: risk.id, status: "missing", paragraphIndex: null, targetText: null };
}

function buildParagraphTokens(paragraph: Paragraph, risks: RiskPoint[], appliedRiskIds: Set<string>): ReviewParagraphToken[] {
  const text = paragraph.text ?? "";
  const rawMatches = risks
    .flatMap((risk) => {
      // 已应用的 risk：优先用 replace_text 定位（原 evidence 已被替换）
      const applied = appliedRiskIds.has(risk.id);
      const searchTexts = applied
        ? [compactText(risk.replace_text), ...riskSourceTexts(risk)]
        : riskSourceTexts(risk);
      return searchTexts
        .filter((t): t is string => Boolean(t))
        .map((targetText) => {
          const start = text.indexOf(targetText);
          return start >= 0 ? { risk, targetText, start, end: start + targetText.length } : null;
        })
        .filter((match): match is { risk: RiskPoint; targetText: string; start: number; end: number } => Boolean(match))
        .slice(0, 1);
    })
    .sort((left, right) => left.start - right.start || right.end - left.end);
  const matches = rawMatches.reduce<Array<{ risks: RiskPoint[]; targetText: string; start: number; end: number }>>((groups, match) => {
    const existing = groups.find((group) => group.start === match.start && group.end === match.end);
    if (existing) {
      existing.risks.push(match.risk);
      return groups;
    }
    groups.push({ risks: [match.risk], targetText: match.targetText, start: match.start, end: match.end });
    return groups;
  }, []);

  const tokens: ReviewParagraphToken[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue;
    if (cursor < match.start) {
      tokens.push({ type: "text", text: text.slice(cursor, match.start) });
    }
    const primaryRisk = match.risks.find((risk) => appliedRiskIds.has(risk.id)) ?? match.risks[0];
    tokens.push({
      type: "risk",
      text: appliedRiskIds.has(primaryRisk.id) && primaryRisk.replace_text ? primaryRisk.replace_text : text.slice(match.start, match.end),
      riskId: primaryRisk.id,
      riskIds: match.risks.map((risk) => risk.id),
      replaced: appliedRiskIds.has(primaryRisk.id)
    });
    cursor = match.end;
  }

  if (cursor < text.length) {
    tokens.push({ type: "text", text: text.slice(cursor) });
  }
  return tokens.length > 0 ? tokens : [{ type: "text", text }];
}

export function splitDocumentText(text?: string | null): string[] {
  return (text ?? "")
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function paragraphsFromText(text?: string | null): Paragraph[] {
  return splitDocumentText(text).map((item, index) => ({ index, text: item }));
}

function paragraphsFromItems(items: string[] | Paragraph[]) {
  return items.map((item, index) => (typeof item === "string" ? { index, text: item } : item));
}

function diffTextForSide(diff: Pick<DiffDetail, "old_text" | "new_text">, side: ComparisonSide) {
  return compactText(side === "old" ? diff.old_text : diff.new_text);
}

function normalizeComparisonText(value?: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export function isMeaningfulComparisonDiff(diff: Pick<DiffDetail, "change_type" | "old_text" | "new_text">) {
  if (diff.change_type !== "modified") return true;
  const oldText = normalizeComparisonText(diff.old_text);
  const newText = normalizeComparisonText(diff.new_text);
  if (!oldText && !newText) return false;
  return oldText !== newText;
}

function changedSegmentForSide(diff: Pick<DiffDetail, "old_text" | "new_text">, side: ComparisonSide) {
  const oldText = diffTextForSide(diff, "old");
  const newText = diffTextForSide(diff, "new");
  if (!oldText || !newText || oldText === newText) return null;

  let prefix = 0;
  const maxPrefix = Math.min(oldText.length, newText.length);
  while (prefix < maxPrefix && oldText[prefix] === newText[prefix]) prefix += 1;

  let oldSuffix = oldText.length - 1;
  let newSuffix = newText.length - 1;
  while (oldSuffix >= prefix && newSuffix >= prefix && oldText[oldSuffix] === newText[newSuffix]) {
    oldSuffix -= 1;
    newSuffix -= 1;
  }

  const source = side === "old" ? oldText : newText;
  const end = side === "old" ? oldSuffix + 1 : newSuffix + 1;
  const segment = source.slice(prefix, end).trim();
  return segment || null;
}

export function comparisonDiffTextForSide(diff: Pick<DiffDetail, "change_type" | "old_text" | "new_text">, side: ComparisonSide) {
  if (!isMeaningfulComparisonDiff(diff)) return null;
  if (diff.change_type === "modified") return changedSegmentForSide(diff, side) ?? diffTextForSide(diff, side);
  return diffTextForSide(diff, side);
}

function diffPositionForSide(diff: Pick<DiffDetail, "old_position" | "new_position">, side: ComparisonSide) {
  return side === "old" ? diff.old_position : diff.new_position;
}

type ComparisonRiskMatchInput = Pick<
  ComparisonRiskPoint,
  "id" | "change_type" | "status" | "old_text" | "new_text" | "old_position" | "new_position" | "risk_level" | "summary" | "evidence" | "impact" | "suggestion"
>;

const riskLevelRank: Record<RiskLevel, number> = {
  high: 0,
  medium: 1,
  low: 2
};

function comparisonTextsOverlap(left?: string | null, right?: string | null) {
  const leftText = normalizeComparisonText(left);
  const rightText = normalizeComparisonText(right);
  return Boolean(leftText && rightText && (leftText === rightText || leftText.includes(rightText) || rightText.includes(leftText)));
}

function comparisonPositionsOverlap(
  diff: Pick<DiffDetail, "old_position" | "new_position">,
  risk: Pick<ComparisonRiskPoint, "old_position" | "new_position">
) {
  const riskOldIndex = paragraphIndexFromPosition(risk.old_position);
  const riskNewIndex = paragraphIndexFromPosition(risk.new_position);
  const diffOldIndex = paragraphIndexFromPosition(diff.old_position);
  const diffNewIndex = paragraphIndexFromPosition(diff.new_position);
  return (
    (riskOldIndex !== null && diffOldIndex !== null && riskOldIndex === diffOldIndex) ||
    (riskNewIndex !== null && diffNewIndex !== null && riskNewIndex === diffNewIndex)
  );
}

export function matchingComparisonRisksForDiff(
  diff: Pick<DiffDetail, "old_text" | "new_text" | "old_position" | "new_position">,
  risks: ComparisonRiskMatchInput[]
) {
  return risks
    .filter((risk) => {
      return (
        comparisonTextsOverlap(diff.old_text, risk.old_text) ||
        comparisonTextsOverlap(diff.new_text, risk.new_text) ||
        comparisonPositionsOverlap(diff, risk)
      );
    })
    .sort((left, right) => {
      const leftRank = left.risk_level ? riskLevelRank[left.risk_level] : Number.POSITIVE_INFINITY;
      const rightRank = right.risk_level ? riskLevelRank[right.risk_level] : Number.POSITIVE_INFINITY;
      return leftRank - rightRank;
    });
}

export function comparisonRiskLevelForDiff(
  diff: Pick<DiffDetail, "old_text" | "new_text" | "old_position" | "new_position">,
  risks: ComparisonRiskMatchInput[]
) {
  return matchingComparisonRisksForDiff(diff, risks)[0]?.risk_level ?? null;
}

function locateComparisonDiff(paragraphs: Paragraph[], diff: DiffDetail, side: ComparisonSide): ComparisonDiffLocation {
  const targetText = comparisonDiffTextForSide(diff, side);
  if (targetText) {
    for (const paragraph of paragraphs) {
      const text = paragraph.text ?? "";
      if (text.includes(targetText)) {
        return {
          diffIndex: diff.index,
          side,
          status: "matched",
          paragraphIndex: paragraph.index,
          targetText
        };
      }
    }
  }

  const fallbackIndex = paragraphIndexFromPosition(diffPositionForSide(diff, side));
  if (fallbackIndex !== null && paragraphs.some((paragraph) => paragraph.index === fallbackIndex)) {
    return {
      diffIndex: diff.index,
      side,
      status: "fallback",
      paragraphIndex: fallbackIndex,
      targetText: null
    };
  }

  return {
    diffIndex: diff.index,
    side,
    status: "missing",
    paragraphIndex: null,
    targetText: null
  };
}

function buildComparisonParagraphTokens(
  paragraph: Paragraph,
  diffs: DiffDetail[],
  side: ComparisonSide,
  risks: ComparisonRiskMatchInput[] = []
): ComparisonParagraphToken[] {
  const text = paragraph.text ?? "";
  const matches = diffs
    .map((diff) => {
      const targetText = comparisonDiffTextForSide(diff, side);
      if (!targetText) return null;
      const start = text.indexOf(targetText);
      return start >= 0 ? { diff, targetText, start, end: start + targetText.length } : null;
    })
    .filter((match): match is { diff: DiffDetail; targetText: string; start: number; end: number } => Boolean(match))
    .sort((left, right) => left.start - right.start || right.end - left.end);

  const tokens: ComparisonParagraphToken[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue;
    if (cursor < match.start) {
      tokens.push({ type: "text", text: text.slice(cursor, match.start) });
    }
    tokens.push({
      type: "diff",
      text: text.slice(match.start, match.end),
      diffIndex: match.diff.index,
      changeType: match.diff.change_type,
      riskLevel: comparisonRiskLevelForDiff(match.diff, risks)
    });
    cursor = match.end;
  }

  if (cursor < text.length) {
    tokens.push({ type: "text", text: text.slice(cursor) });
  }
  return tokens.length > 0 ? tokens : [{ type: "text", text }];
}

export function buildComparisonParagraphHighlights(
  items: string[] | Paragraph[],
  diffs: DiffDetail[],
  side: ComparisonSide,
  risks: ComparisonRiskMatchInput[] = []
): ComparisonParagraphHighlightResult {
  const paragraphs = paragraphsFromItems(items);
  const locations: ComparisonParagraphHighlightResult["locations"] = {};
  for (const diff of diffs) {
    locations[diff.index] = {
      [side]: locateComparisonDiff(paragraphs, diff, side)
    };
  }

  return {
    locations,
    paragraphs: paragraphs.map((paragraph) => ({
      paragraph,
      tokens: buildComparisonParagraphTokens(paragraph, diffs, side, risks)
    }))
  };
}

export function getComparisonDocumentText(detail: ComparisonDetail | null, side: ComparisonSide) {
  if (!detail) return "";
  const document = detail.documents.find((item) => item.version === side);
  const documentText = compactText(document?.text);
  if (documentText) return documentText;

  const taskText = compactText(side === "old" ? detail.task.old_text : detail.task.new_text);
  if (taskText) return taskText;

  return compactText(side === "old" ? detail.task.old_sanitized_text : detail.task.new_sanitized_text) ?? "";
}

export function getReviewParagraphs(detail: ReviewDetail | null, fallbackText = ""): Paragraph[] {
  if (!detail) return paragraphsFromText(fallbackText);

  const task = detail.task;
  const returnedParagraphs = normalizeParagraphs(
    task.paragraphs?.length ? task.paragraphs : task.paragraphs_json ?? []
  );
  const sanitizedParagraphs = paragraphsFromText(task.sanitized_text);
  const expectedCount = typeof task.paragraph_count === "number" ? task.paragraph_count : null;

  if (sanitizedParagraphs.length > 0 && (returnedParagraphs.length === 0 || (expectedCount !== null && returnedParagraphs.length < expectedCount))) {
    return sanitizedParagraphs;
  }

  if (returnedParagraphs.length > 0) return returnedParagraphs;
  return paragraphsFromText(fallbackText);
}

export function docTextFromReview(detail: ReviewDetail | null, fallbackText = "") {
  return getReviewParagraphs(detail, fallbackText)
    .map((item) => item.text ?? "")
    .join("\n\n");
}

export function buildReviewParagraphHighlights(
  paragraphs: Paragraph[],
  risks: RiskPoint[],
  appliedRiskIds: Set<string> = new Set()
): ReviewParagraphHighlightResult {
  const locations = Object.fromEntries(risks.map((risk) => [risk.id, locateRisk(paragraphs, risk)]));
  return {
    locations,
    paragraphs: paragraphs.map((paragraph) => ({
      paragraph,
      tokens: buildParagraphTokens(paragraph, risks, appliedRiskIds)
    }))
  };
}
