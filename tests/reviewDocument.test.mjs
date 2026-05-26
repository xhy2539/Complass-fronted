import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadReviewDocument() {
  const source = readFileSync(join(process.cwd(), "src", "reviewDocument.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { exports: module.exports, module, require: () => ({}) });
  return module.exports;
}

test("sorts review paragraphs by index before display", () => {
  const { getReviewParagraphs } = loadReviewDocument();

  const paragraphs = getReviewParagraphs({
    task: {
      paragraphs: [
        { index: 3, text: "第三条 交付" },
        { index: 1, text: "第一条 标的" },
        { index: 2, text: "第二条 付款" }
      ],
      paragraph_count: 3
    },
    risk_points: []
  });

  assert.equal(paragraphs.map((item) => item.text).join("|"), "第一条 标的|第二条 付款|第三条 交付");
});

test("locates review risks by source text before paragraph position", () => {
  const { buildReviewParagraphHighlights } = loadReviewDocument();
  const paragraphs = [
    { index: 0, text: "payment must be made within 30 days" },
    { index: 1, text: "late delivery creates penalty exposure" }
  ];
  const risks = [
    {
      id: "risk-1",
      sentence_text: "late delivery",
      original_text: "delivery",
      evidence: "penalty",
      position: { paragraph_index: 0 }
    }
  ];

  const result = buildReviewParagraphHighlights(paragraphs, risks);

  assert.equal(result.locations["risk-1"].status, "matched");
  assert.equal(result.locations["risk-1"].paragraphIndex, 1);
  assert.equal(result.locations["risk-1"].targetText, "late delivery");
  assert.equal(result.paragraphs[1].tokens.filter((token) => token.type === "risk").map((token) => token.riskId).join("|"), "risk-1");
});

test("falls back to paragraph position only when no source text is available", () => {
  const { buildReviewParagraphHighlights } = loadReviewDocument();
  const result = buildReviewParagraphHighlights(
    [{ index: 4, text: "general warranty language" }],
    [{ id: "risk-2", position: { paragraph_index: 4 } }]
  );

  assert.equal(result.locations["risk-2"].status, "fallback");
  assert.equal(result.locations["risk-2"].paragraphIndex, 4);
  assert.equal(result.paragraphs[0].tokens.every((token) => token.type === "text"), true);
});

test("builds independent highlight tokens for multiple risks in one paragraph", () => {
  const { buildReviewParagraphHighlights } = loadReviewDocument();
  const result = buildReviewParagraphHighlights(
    [{ index: 0, text: "confidentiality survives termination and liability is unlimited" }],
    [
      { id: "risk-3", original_text: "confidentiality survives termination" },
      { id: "risk-4", evidence: "liability is unlimited" }
    ],
    new Set(["risk-4"])
  );

  const riskTokens = result.paragraphs[0].tokens.filter((token) => token.type === "risk");

  assert.equal(riskTokens.map((token) => token.riskId).join("|"), "risk-3|risk-4");
  assert.equal(riskTokens[1].replaced, true);
});

test("keeps shared highlight targets for multiple risks on the same source text", () => {
  const { buildReviewParagraphHighlights } = loadReviewDocument();
  const result = buildReviewParagraphHighlights(
    [{ index: 0, text: "payment requires invoice within 15 working days" }],
    [
      { id: "risk-invoice", sentence_text: "invoice within 15 working days" },
      { id: "risk-settlement", evidence: "invoice within 15 working days" }
    ]
  );

  const riskTokens = result.paragraphs[0].tokens.filter((token) => token.type === "risk");

  assert.equal(riskTokens.length, 1);
  assert.deepEqual(Array.from(riskTokens[0].riskIds), ["risk-invoice", "risk-settlement"]);
  assert.equal(result.locations["risk-invoice"].status, "matched");
  assert.equal(result.locations["risk-settlement"].status, "matched");
});

test("falls back to review paragraph position for placeholder missing-source evidence", () => {
  const { buildReviewParagraphHighlights } = loadReviewDocument();
  const result = buildReviewParagraphHighlights(
    [
      { index: 0, text: "payment clause" },
      { index: 1, text: "late payment context" }
    ],
    [
      {
        id: "risk-missing-clause",
        evidence: "未发现明确原文，但相关内容缺失",
        position: { paragraph_index: 1 }
      }
    ]
  );

  assert.equal(result.locations["risk-missing-clause"].status, "fallback");
  assert.equal(result.locations["risk-missing-clause"].paragraphIndex, 1);
  assert.equal(result.paragraphs[1].tokens.every((token) => token.type === "text"), true);
});

test("renders replacement text inside matched highlight tokens after applying a risk suggestion", () => {
  const { buildReviewParagraphHighlights } = loadReviewDocument();
  const result = buildReviewParagraphHighlights(
    [{ index: 0, text: "payment is due whenever buyer decides" }],
    [{ id: "risk-6", sentence_text: "whenever buyer decides", replace_text: "within 15 working days after acceptance" }],
    new Set(["risk-6"])
  );

  const riskToken = result.paragraphs[0].tokens.find((token) => token.type === "risk");

  assert.equal(riskToken.replaced, true);
  assert.equal(riskToken.text, "within 15 working days after acceptance");
});

test("restores source text when a risk replacement is revoked", () => {
  const { revertRiskReplacementInText } = loadReviewDocument();
  const result = revertRiskReplacementInText(
    "payment is due within 15 working days after acceptance",
    { id: "risk-7", sentence_text: "whenever buyer decides", replace_text: "within 15 working days after acceptance" }
  );

  assert.equal(result, "payment is due whenever buyer decides");
});

test("marks unmatched risks as missing and does not create wrong highlights", () => {
  const { buildReviewParagraphHighlights } = loadReviewDocument();
  const result = buildReviewParagraphHighlights(
    [{ index: 0, text: "ordinary payment clause" }],
    [{ id: "risk-5", evidence: "nonexistent source", position: { paragraph_index: 0 } }]
  );

  assert.equal(result.locations["risk-5"].status, "missing");
  assert.equal(result.locations["risk-5"].paragraphIndex, null);
  assert.equal(result.paragraphs[0].tokens.every((token) => token.type === "text"), true);
});

test("builds independent comparison diff tokens for multiple diffs in one paragraph", () => {
  const { buildComparisonParagraphHighlights } = loadReviewDocument();
  const result = buildComparisonParagraphHighlights(
    ["payment is due in 30 days and delivery occurs on acceptance"],
    [
      { index: 1, change_type: "modified", old_text: "30 days", new_text: "15 days" },
      { index: 2, change_type: "modified", old_text: "delivery occurs on acceptance", new_text: "delivery occurs after launch" }
    ],
    "old"
  );

  const diffTokens = result.paragraphs[0].tokens.filter((token) => token.type === "diff");

  assert.equal(diffTokens.map((token) => token.diffIndex).join("|"), "1|2");
  assert.equal(diffTokens.map((token) => token.text).join("|"), "30|on acceptance");
  assert.equal(result.locations[1].old.status, "matched");
  assert.equal(result.locations[2].old.status, "matched");
});

test("creates comparison highlights only on the side that has diff text", () => {
  const { buildComparisonParagraphHighlights } = loadReviewDocument();
  const diffs = [
    { index: 3, change_type: "added", old_text: null, new_text: "new confidentiality clause" },
    { index: 4, change_type: "deleted", old_text: "deleted penalty clause", new_text: null }
  ];

  const oldResult = buildComparisonParagraphHighlights(["deleted penalty clause"], diffs, "old");
  const newResult = buildComparisonParagraphHighlights(["new confidentiality clause"], diffs, "new");

  assert.equal(oldResult.paragraphs[0].tokens.filter((token) => token.type === "diff").map((token) => token.diffIndex).join("|"), "4");
  assert.equal(newResult.paragraphs[0].tokens.filter((token) => token.type === "diff").map((token) => token.diffIndex).join("|"), "3");
  assert.equal(oldResult.locations[3].old.status, "missing");
  assert.equal(newResult.locations[4].new.status, "missing");
});

test("ignores modified comparison diffs when old and new text are unchanged after whitespace normalization", () => {
  const { buildComparisonParagraphHighlights, isMeaningfulComparisonDiff } = loadReviewDocument();
  const diff = {
    index: 7,
    change_type: "modified",
    old_text: "First Article   Contract Subject",
    new_text: " First Article Contract Subject "
  };

  const result = buildComparisonParagraphHighlights(["First Article Contract Subject"], [diff], "old");

  assert.equal(isMeaningfulComparisonDiff(diff), false);
  assert.equal(result.locations[7].old.status, "missing");
  assert.equal(result.paragraphs[0].tokens.every((token) => token.type === "text"), true);
});

test("highlights only the changed segment for modified comparison diffs", () => {
  const { buildComparisonParagraphHighlights } = loadReviewDocument();
  const diff = {
    index: 8,
    change_type: "modified",
    old_text: "quantity: 60 units, delivered within 10 days",
    new_text: "quantity: 72 units, delivered within 10 days"
  };

  const oldResult = buildComparisonParagraphHighlights(["quantity: 60 units, delivered within 10 days"], [diff], "old");
  const newResult = buildComparisonParagraphHighlights(["quantity: 72 units, delivered within 10 days"], [diff], "new");
  const oldDiffTokens = oldResult.paragraphs[0].tokens.filter((token) => token.type === "diff");
  const newDiffTokens = newResult.paragraphs[0].tokens.filter((token) => token.type === "diff");

  assert.equal(oldDiffTokens.map((token) => token.text).join("|"), "60");
  assert.equal(newDiffTokens.map((token) => token.text).join("|"), "72");
  assert.equal(oldResult.locations[8].old.targetText, "60");
  assert.equal(newResult.locations[8].new.targetText, "72");
});

test("matches comparison risks to diffs by related text and sorts risks by severity", () => {
  const { comparisonRiskLevelForDiff, matchingComparisonRisksForDiff } = loadReviewDocument();
  const diff = {
    index: 9,
    change_type: "modified",
    old_text: "payment penalty is 15%",
    new_text: "payment penalty is 5%"
  };
  const risks = [
    { id: "risk-low", risk_level: "low", old_text: "payment penalty" },
    { id: "risk-high", risk_level: "high", new_text: "penalty is 5%" },
    { id: "risk-none", risk_level: "medium", old_text: "confidentiality clause" }
  ];

  const matches = matchingComparisonRisksForDiff(diff, risks);

  assert.equal(matches.map((risk) => risk.id).join("|"), "risk-high|risk-low");
  assert.equal(comparisonRiskLevelForDiff(diff, risks), "high");
});

test("matches comparison risks to diffs by paragraph position when text is unavailable", () => {
  const { matchingComparisonRisksForDiff } = loadReviewDocument();
  const matches = matchingComparisonRisksForDiff(
    { index: 10, change_type: "modified", old_position: { paragraph_index: 5 }, new_position: { paragraph_index: 8 } },
    [
      { id: "risk-position", risk_level: "medium", old_position: { paragraph_index: 5 } },
      { id: "risk-miss", risk_level: "high", old_position: { paragraph_index: 9 } }
    ]
  );

  assert.equal(matches.map((risk) => risk.id).join("|"), "risk-position");
});

test("returns no comparison risk matches when text and position do not overlap", () => {
  const { comparisonRiskLevelForDiff, matchingComparisonRisksForDiff } = loadReviewDocument();
  const diff = { index: 11, change_type: "added", new_text: "new arbitration clause", new_position: { paragraph_index: 2 } };
  const risks = [{ id: "risk-other", risk_level: "high", new_text: "new warranty clause", new_position: { paragraph_index: 7 } }];

  assert.equal(matchingComparisonRisksForDiff(diff, risks).length, 0);
  assert.equal(comparisonRiskLevelForDiff(diff, risks), null);
});

test("falls back to comparison paragraph position without creating wrong highlight tokens", () => {
  const { buildComparisonParagraphHighlights } = loadReviewDocument();
  const result = buildComparisonParagraphHighlights(
    ["ordinary clause", "payment language with changed wording"],
    [{ index: 5, change_type: "modified", old_text: "nonexistent source", old_position: { paragraph_index: 1 } }],
    "old"
  );

  assert.equal(result.locations[5].old.status, "fallback");
  assert.equal(result.locations[5].old.paragraphIndex, 1);
  assert.equal(result.paragraphs[1].tokens.every((token) => token.type === "text"), true);
});

test("marks comparison diffs as missing when text and position cannot be used", () => {
  const { buildComparisonParagraphHighlights } = loadReviewDocument();
  const result = buildComparisonParagraphHighlights(
    ["ordinary clause"],
    [{ index: 6, change_type: "modified", old_text: "nonexistent source", old_position: { paragraph_index: 9 } }],
    "old"
  );

  assert.equal(result.locations[6].old.status, "missing");
  assert.equal(result.locations[6].old.paragraphIndex, null);
  assert.equal(result.paragraphs[0].tokens.every((token) => token.type === "text"), true);
});

test("uses sanitized text when returned paragraphs are incomplete", () => {
  const { getReviewParagraphs, docTextFromReview } = loadReviewDocument();
  const detail = {
    task: {
      paragraphs: [{ index: 4, text: "第四条 违约责任" }],
      paragraph_count: 3,
      sanitized_text: "第一条 标的\n\n第二条 付款\n\n第三条 交付"
    },
    risk_points: []
  };

  const paragraphs = getReviewParagraphs(detail);

  assert.equal(paragraphs.map((item) => item.text).join("|"), "第一条 标的|第二条 付款|第三条 交付");
  assert.equal(docTextFromReview(detail), "第一条 标的\n\n第二条 付款\n\n第三条 交付");
});

test("uses comparison task text when document text is missing", () => {
  const { getComparisonDocumentText } = loadReviewDocument();

  const detail = {
    task: {
      old_text: "旧版合同全文",
      new_text: "新版合同全文"
    },
    documents: [
      { version: "old", file_name: "old.docx" },
      { version: "new", file_name: "new.docx" }
    ],
    diff_details: [],
    risk_points: [],
    coze_enhanced: []
  };

  assert.equal(getComparisonDocumentText(detail, "old"), "旧版合同全文");
  assert.equal(getComparisonDocumentText(detail, "new"), "新版合同全文");
});
