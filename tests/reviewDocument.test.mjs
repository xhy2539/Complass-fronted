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

  // 新行为：evidence 优先级最高，匹配到 paragraph 1 中的 "penalty"
  assert.equal(result.locations["risk-1"].status, "matched");
  assert.equal(result.locations["risk-1"].paragraphIndex, 1);
  assert.equal(result.locations["risk-1"].targetText, "penalty");
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
      { id: "risk-3", evidence: "confidentiality survives termination" },
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
    { id: "risk-7", evidence: "whenever buyer decides", replace_text: "within 15 working days after acceptance" }
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

test("prioritizes evidence over sentence_text in findRiskTextMatch", () => {
  const { buildReviewParagraphHighlights } = loadReviewDocument();
  const paragraphs = [
    { index: 0, text: "甲方应于收到乙方发票后30日内支付合同款项。" }
  ];
   const risks = [
    {
      id: "risk-evidence-priority",
      action_type: "replace",
      sentence_text: "30日内支付", // 低优先级
      evidence: "收到乙方发票后30日内支付合同款项", // 高优先级（精确匹配：存在于段落中）
      replace_text: "收到乙方发票后45日内支付合同款项"
    }
  ];

  const result = buildReviewParagraphHighlights(paragraphs, risks);

  assert.equal(result.locations["risk-evidence-priority"].status, "matched");
  assert.equal(result.locations["risk-evidence-priority"].targetText, "收到乙方发票后30日内支付合同款项");
});

test("replace type trusts backend containment_exact position without indexOf search", () => {
  const { buildReviewParagraphHighlights } = loadReviewDocument();
  const paragraphs = [
    { index: 0, text: "甲方应于收到乙方发票后30日内支付合同款项，如逾期付款应按日万分之五支付违约金。" },
    { index: 1, text: "乙方应在验收合格后10日内提交结算报告。" }
  ];
  const risk = {
    id: "risk-backend-position",
    action_type: "replace",
    evidence: "收到乙方发票后30日内支付",
    replace_text: "收到乙方发票后45日内支付",
    // 后端已计算好精确偏移
    position: { paragraph_index: 0, char_offset_start: 5, char_offset_end: 17, match_strategy: "containment_exact" }
  };

  const result = buildReviewParagraphHighlights(paragraphs, [risk]);

  // 应该信任后端精确偏移，直接 matched，跳过 indexOf
  assert.equal(result.locations["risk-backend-position"].status, "matched");
  assert.equal(result.locations["risk-backend-position"].paragraphIndex, 0);
});

test("replace type without match returns missing instead of fallback", () => {
  const { buildReviewParagraphHighlights } = loadReviewDocument();
  const paragraphs = [
    { index: 0, text: "甲方应于收到乙方发票后30日内支付合同款项。" }
  ];
  const risks = [
    {
      id: "risk-no-match",
      action_type: "replace",
      evidence: "这条文本根本不存在于合同原文中",
      replace_text: "替换成这个",
      position: { paragraph_index: 0 } // 有 position，但不应该 fallback
    }
  ];

  const result = buildReviewParagraphHighlights(paragraphs, risks);

  assert.equal(result.locations["risk-no-match"].status, "missing");
  assert.equal(result.locations["risk-no-match"].paragraphIndex, null);
});

test("insert type without match returns missing instead of fallback", () => {
  const { buildReviewParagraphHighlights } = loadReviewDocument();
  const paragraphs = [
    { index: 0, text: "甲方应于收到乙方发票后30日内支付合同款项。" }
  ];
  const risks = [
    {
      id: "risk-insert-no-match",
      action_type: "insert",
      evidence: "这条文本根本不存在",
      replace_text: "插入一个新段落",
      position: { paragraph_index: 0 }
    }
  ];

  const result = buildReviewParagraphHighlights(paragraphs, risks);

  assert.equal(result.locations["risk-insert-no-match"].status, "missing");
});

test("insert type with match allows insert action", () => {
  const { buildReviewParagraphHighlights } = loadReviewDocument();
  const paragraphs = [
    { index: 0, text: "甲方应于收到乙方发票后30日内支付合同款项。" },
    { index: 1, text: "如逾期付款应按日万分之五支付违约金。" }
  ];
  const risks = [
    {
      id: "risk-insert-match",
      action_type: "insert",
      evidence: "收到乙方发票后30日内支付",
      replace_text: "【新增条款】乙方应在验收合格后10日内提交结算报告。",
      position: { paragraph_index: 0, match_strategy: "containment_exact" }
    }
  ];

  const result = buildReviewParagraphHighlights(paragraphs, risks);

  assert.equal(result.locations["risk-insert-match"].status, "matched");
  assert.equal(result.locations["risk-insert-match"].paragraphIndex, 0);
});

test("manual type does not get apply button (canApply logic)", () => {
  const { buildReviewParagraphHighlights } = loadReviewDocument();
  const paragraphs = [{ index: 0, text: "甲方应于收到乙方发票后30日内支付合同款项。" }];
  const risks = [
    {
      id: "risk-manual",
      action_type: "manual",
      evidence: "收到乙方发票后30日内支付",
      replace_text: "替换文本",
      position: { paragraph_index: 0, match_strategy: "containment_exact" }
    }
  ];

  const result = buildReviewParagraphHighlights(paragraphs, risks);

  // manual 类型即使 matched也不应该有 canApply（由 ReviewPage.tsx 的 canApply 逻辑控制）
  // 这里只验证 locateRisk 本身不限制 action_type
  assert.equal(result.locations["risk-manual"].status, "matched");
});

test("applyRiskInsertionToText inserts replace_text right after evidence inline", () => {
  const { applyRiskInsertionToText } = loadReviewDocument();
  const risk = {
    id: "risk-insert",
    action_type: "insert",
    replace_text: "【新增条款】乙方应在验收合格后10日内提交结算报告。",
    evidence: "第一条 标的"
  };

  const text = "第一条 标的\n\n第二条 付款\n\n第三条 交付";
  const result = applyRiskInsertionToText(text, risk);

  // 插入到 evidence 之后，紧跟在同一段内
  assert.notEqual(result, null);
  assert.ok(result.startsWith("第一条 标的【新增条款】乙方应在验收合格后10日内提交结算报告。"));
});

test("fallback is still allowed for manual type when no source texts available", () => {
  const { buildReviewParagraphHighlights } = loadReviewDocument();
  const result = buildReviewParagraphHighlights(
    [{ index: 4, text: "general warranty language" }],
    [{ id: "risk-fallback-manual", action_type: "manual", position: { paragraph_index: 4 } }]
  );

  assert.equal(result.locations["risk-fallback-manual"].status, "fallback");
  assert.equal(result.locations["risk-fallback-manual"].paragraphIndex, 4);
});

test("append type uses evidence to locate paragraph for highlighting", () => {
  const { buildReviewParagraphHighlights } = loadReviewDocument();
  const paragraphs = [
    { index: 0, text: "第一条 合同标的" },
    { index: 1, text: "第二条 付款条款" }
  ];
  const risks = [
    {
      id: "risk-append-match",
      action_type: "append",
      evidence: "合同标的",
      replace_text: "第三条 违约责任"
    }
  ];

  const result = buildReviewParagraphHighlights(paragraphs, risks);

  assert.equal(result.locations["risk-append-match"].status, "matched");
  assert.equal(result.locations["risk-append-match"].paragraphIndex, 0);
  assert.equal(result.locations["risk-append-match"].targetText, "合同标的");
});

test("append type falls back to sentence_text when evidence not found", () => {
  const { buildReviewParagraphHighlights } = loadReviewDocument();
  const paragraphs = [{ index: 0, text: "第一条 合同标的" }];
  const risks = [
    {
      id: "risk-append-fallback",
      action_type: "append",
      evidence: "付款条款",
      sentence_text: "合同标的",
      replace_text: "追加条款"
    }
  ];

  const result = buildReviewParagraphHighlights(paragraphs, risks);

  // evidence "付款条款" 不在段落中，降级到 sentence_text "合同标的"
  assert.equal(result.locations["risk-append-fallback"].status, "matched");
  assert.equal(result.locations["risk-append-fallback"].targetText, "合同标的");
});

test("applyRiskAppendToText appends replace_text to end of contract", () => {
  const { applyRiskAppendToText } = loadReviewDocument();
  const risk = {
    id: "risk-append",
    action_type: "append",
    replace_text: "第十条 违约责任条款"
  };

  const text = "第一条 标的\n\n第二条 付款";
  const result = applyRiskAppendToText(text, risk);

  assert.notEqual(result, null);
  const paragraphs = result.split("\n\n");
  assert.equal(paragraphs[paragraphs.length - 1], "第十条 违约责任条款");
  assert.equal(paragraphs.length, 3);
});

test("applyRiskAppendToText handles empty text", () => {
  const { applyRiskAppendToText } = loadReviewDocument();
  const risk = {
    id: "risk-append-empty",
    action_type: "append",
    replace_text: "第一条 标的"
  };

  const result = applyRiskAppendToText("", risk);

  assert.equal(result, "第一条 标的");
});

test("revertRiskAppendInText removes the appended paragraph from end", () => {
  const { revertRiskAppendInText } = loadReviewDocument();
  const risk = {
    id: "risk-append-revert",
    action_type: "append",
    replace_text: "第十条 违约责任"
  };

  const text = "第一条 标的\n\n第二条 付款\n\n第十条 违约责任";
  const result = revertRiskAppendInText(text, risk);

  assert.equal(result, "第一条 标的\n\n第二条 付款");
});

test("revertRiskAppendInText removes only the last matching instance", () => {
  const { revertRiskAppendInText } = loadReviewDocument();
  const risk = {
    id: "risk-append-multi",
    action_type: "append",
    replace_text: "追加条款"
  };

  // 第一次追加在末尾，第二次又追加了同样的内容
  const text = "第一条 标的\n\n第二条 付款\n\n追加条款\n\n追加条款";
  const result = revertRiskAppendInText(text, risk);

  // 应该只移除最后一个 "追加条款"
  assert.equal(result, "第一条 标的\n\n第二条 付款\n\n追加条款");
});

test("revertRiskInsertionInText removes replace_text right after evidence", () => {
  const { revertRiskInsertionInText } = loadReviewDocument();
  const risk = {
    id: "risk-insert-revert",
    action_type: "insert",
    evidence: "第二条 付款",
    replace_text: "【新增】第三条 交付条款"
  };

  // evidence + replace_text 紧跟在一起
  const text = "第一条 标的\n\n第二条 付款【新增】第三条 交付条款\n\n第四条 验收";
  const result = revertRiskInsertionInText(text, risk);

  assert.equal(result, "第一条 标的\n\n第二条 付款\n\n第四条 验收");
});

test("revertRiskInsertionInText returns null when replace_text not found", () => {
  const { revertRiskInsertionInText } = loadReviewDocument();
  const risk = {
    id: "risk-insert-revert-miss",
    action_type: "insert",
    replace_text: "不存在的文本"
  };

  const text = "第一条 标的\n\n第二条 付款";
  const result = revertRiskInsertionInText(text, risk);

  assert.equal(result, null);
});

test("locateRisk handles replace/insert with placeholder evidence as missing", () => {
  const { buildReviewParagraphHighlights } = loadReviewDocument();
  const paragraphs = [{ index: 0, text: "第一条 合同标的" }];
  const risks = [
    {
      id: "risk-placeholder",
      action_type: "replace",
      evidence: "未发现明确原文，但相关内容缺失",
      replace_text: "替换文本",
      position: { paragraph_index: 0 }
    }
  ];

  const result = buildReviewParagraphHighlights(paragraphs, risks);

  assert.equal(result.locations["risk-placeholder"].status, "missing");
  assert.equal(result.locations["risk-placeholder"].paragraphIndex, null);
});

test("applyRiskReplacementToText returns null when evidence is placeholder", () => {
  const { applyRiskReplacementToText } = loadReviewDocument();
  const risk = {
    id: "risk-placeholder-replace",
    action_type: "replace",
    evidence: "未发现明确原文，但相关内容缺失",
    replace_text: "替换文本"
  };

  const text = "第一条 合同标的";
  const result = applyRiskReplacementToText(text, risk);

  assert.equal(result, null);
});

test("applyRiskInsertionToText returns null when evidence not found", () => {
  const { applyRiskInsertionToText } = loadReviewDocument();
  const risk = {
    id: "risk-insert-miss",
    action_type: "insert",
    evidence: "不存在的证据文本",
    replace_text: "插入的条款"
  };

  const text = "第一条 标的\n\n第二条 付款";
  const result = applyRiskInsertionToText(text, risk);

  assert.equal(result, null);
});

test("applyRiskInsertionToText returns null when evidence is placeholder", () => {
  const { applyRiskInsertionToText } = loadReviewDocument();
  const risk = {
    id: "risk-insert-placeholder",
    action_type: "insert",
    evidence: "相关内容缺失",
    replace_text: "插入的条款"
  };

  const text = "第一条 标的";
  const result = applyRiskInsertionToText(text, risk);

  assert.equal(result, null);
});

test("applyRiskInsertionToText returns null when replace_text is empty", () => {
  const { applyRiskInsertionToText } = loadReviewDocument();
  const risk = {
    id: "risk-insert-no-replace",
    action_type: "insert",
    evidence: "第一条 标的"
  };

  const text = "第一条 标的\n\n第二条 付款";
  const result = applyRiskInsertionToText(text, risk);

  assert.equal(result, null);
});

test("replacement preserves dollar signs in replace_text", () => {
  const { applyRiskReplacementToText } = loadReviewDocument();
  const risk = {
    id: "risk-dollar",
    action_type: "replace",
    evidence: "合同金额为100万元",
    replace_text: "合同金额为$500万元"
  };
  const text = "第一条 付款\n\n合同金额为100万元\n\n第三条 验收";
  const result = applyRiskReplacementToText(text, risk);
  assert.equal(result, "第一条 付款\n\n合同金额为$500万元\n\n第三条 验收");
});

test("replacement preserves dollar signs through apply-then-revert roundtrip", () => {
  const { applyRiskReplacementToText, revertRiskReplacementInText } = loadReviewDocument();
  const risk = {
    id: "risk-dollar-revert",
    action_type: "replace",
    evidence: "总价$100万",
    replace_text: "总价$200万"
  };
  const text = "第一条 价格\n\n总价$100万\n\n第三条 验收";
  const applied = applyRiskReplacementToText(text, risk);
  assert.equal(applied, "第一条 价格\n\n总价$200万\n\n第三条 验收");
  const reverted = revertRiskReplacementInText(applied, risk);
  assert.equal(reverted, text);
});

test("revertRiskAppendInText matches trimmed replace_text", () => {
  const { revertRiskAppendInText } = loadReviewDocument();
  const risk = {
    id: "risk-append-trim",
    action_type: "append",
    replace_text: "  第十条 违约责任  "
  };
  const text = "第一条 标的\n\n第二条 付款\n\n第十条 违约责任";
  const result = revertRiskAppendInText(text, risk);
  assert.equal(result, "第一条 标的\n\n第二条 付款");
});

test("table replacement preserves pipe-delimited format", () => {
  const { applyRiskReplacementToText } = loadReviewDocument();
  const tablePara = "【表格】\n付款节点 | 付款比例\n30%预付款；60%到货验收款；10%质保金 | 100%";
  const fullText = "第一条 合同\n\n" + tablePara + "\n\n第三条 其他";
  const risk = {
    id: "risk-table",
    action_type: "replace",
    evidence: "30%预付款；60%到货验收款；10%质保金",
    replace_text: "20%预付款；70%到货验收款；10%质保金"
  };
  const paragraphs = [{ index: 1, text: tablePara }];
  const result = applyRiskReplacementToText(fullText, risk, paragraphs);
  assert.notEqual(result, null);
  assert.ok(result.includes("【表格】"));
  assert.ok(result.includes(" | "));
  assert.ok(result.includes("20%预付款"));
  assert.ok(!result.includes("30%预付款"));
});
