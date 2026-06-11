import { useCallback, useState } from "react";
import type { MutableRefObject } from "react";
import { AlertTriangle, Download, Upload } from "lucide-react";
import { buildReviewParagraphHighlights, docTextFromReview, getReviewParagraphs, paragraphsFromText } from "../reviewDocument";
import { getReviewAiState } from "../taskHealth";
import type { ReviewDetail, RiskLevel, RiskPoint, RiskStatus } from "../types";
import { EmptyState, ReviewInlineToolbar, RiskCard, RiskDetail, Select, Stat, riskLevelLabel } from "../components/shared";
import { isTableBlock, parseTableBlock } from "../tableUtils";

type LevelFilter = "" | RiskLevel;
type RiskStatusFilter = "" | RiskStatus;

export interface ReviewPageProps {
  reviewDetail: ReviewDetail | null;
  reviewText: string;
  appliedRisks: Set<string>;
  selectedRisk: RiskPoint | null;
  selectedRiskId: string;
  reviewToolbarCollapsed: boolean;
  reviewFile: File | null;
  busy: (label: string) => boolean;
  reviewRiskStats: { total: number; high: number; medium: number; low: number; pending: number };
  reviewLevelFilter: LevelFilter;
  reviewStatusFilter: RiskStatusFilter;
  filteredReviewRisks: RiskPoint[];
  expandedReviewRiskId: string;
  paragraphRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
  riskHighlightRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  reviewRiskCardRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  setReviewFile: (file: File | null) => void;
  uploadReview: () => void;
  setReviewLevelFilter: (value: LevelFilter) => void;
  setReviewStatusFilter: (value: RiskStatusFilter) => void;
  exportReview: () => void;
  setReviewText: (text: string) => void;
  setReviewToolbarCollapsed: (value: boolean) => void;
  applyRiskSuggestion: (risk?: RiskPoint | null) => void;
  revokeRiskSuggestion: (risk?: RiskPoint | null) => void;
  updateReviewRisk: (status: RiskStatus, risk?: RiskPoint | null) => Promise<void>;
  selectRiskFromText: (riskId: string) => void;
  scrollToRisk: (risk: RiskPoint) => void;
  toggleReviewRiskDetail: (risk: RiskPoint) => void;
}

export function ReviewPage(props: ReviewPageProps) {
  const {
    reviewDetail,
    reviewText,
    appliedRisks,
    selectedRisk,
    selectedRiskId,
    reviewToolbarCollapsed,
    reviewFile,
    busy,
    reviewRiskStats,
    reviewLevelFilter,
    reviewStatusFilter,
    filteredReviewRisks,
    expandedReviewRiskId,
    paragraphRefs,
    riskHighlightRefs,
    reviewRiskCardRefs,
    setReviewFile,
    uploadReview,
    setReviewLevelFilter,
    setReviewStatusFilter,
    exportReview,
    setReviewText,
    setReviewToolbarCollapsed,
    applyRiskSuggestion,
    revokeRiskSuggestion,
    updateReviewRisk,
    selectRiskFromText,
    scrollToRisk,
    toggleReviewRiskDetail
  } = props;

  const [activeReviewTextTab, setActiveReviewTextTab] = useState<"source" | "export">("source");
  // 优先从当前 reviewText 分段落，确保定位/高亮与 apply/revoke 操作数据源一致
  const baseParagraphs = getReviewParagraphs(reviewDetail, reviewText);
  const originalText = reviewDetail ? (reviewDetail.task.paragraphs || []).map(p => p.text || '').join('\n\n') : '';
  // 有修改时，按段落真实 index 合入编辑文本，保留风险定位

  const syncTableEdit = useCallback((paragraphIndex: number) => (e: React.FocusEvent) => {
    const table = e.currentTarget.closest('table');
    if (!table) return;
    const headers: string[] = [];
    table.querySelectorAll('thead th').forEach(th => headers.push(th.textContent || ''));
    const rows: string[][] = [];
    table.querySelectorAll('tbody tr').forEach(tr => {
      const cells: string[] = [];
      tr.querySelectorAll('td').forEach(td => cells.push(td.textContent || ''));
      if (cells.some(c => c)) rows.push(cells);
    });
    // Serialize back to table paragraph format
    const lines = [headers.join(' | ')];
    rows.forEach(r => lines.push(r.join(' | ')));
    const tableText = '【表格】\n' + lines.join('\n');
    const currentParas = (reviewText || docTextFromReview(reviewDetail)).split('\n\n');
    if (paragraphIndex >= 0 && paragraphIndex < currentParas.length) {
      currentParas[paragraphIndex] = tableText;
      setReviewText(currentParas.join('\n\n'));
    }
  }, [reviewText, reviewDetail, setReviewText]);

  // 合入编辑：API段落保持原index，追加段落补充到末尾
  const editedParas = (reviewText && reviewText !== originalText) ? reviewText.split('\n\n') : null;
  const paragraphs = editedParas
    ? (() => {
        const merged = baseParagraphs.map((p) => {
          const idx = typeof p.index === 'number' ? p.index : -1;
          return (idx >= 0 && idx < editedParas.length) ? { ...p, text: editedParas[idx] } : p;
        });
        // 追加（如append）超出baseParagraphs的新段落
        for (let i = baseParagraphs.length; i < editedParas.length; i++) {
          merged.push({ index: i, text: editedParas[i] });
        }
        return merged;
      })()
    : baseParagraphs;
  const reviewHighlights = buildReviewParagraphHighlights(paragraphs, reviewDetail?.risk_points ?? [], appliedRisks);
  const selectedRiskLocation = selectedRisk ? reviewHighlights.locations[selectedRisk.id] : null;
  const selectedRiskCanApply = Boolean(
    selectedRisk?.replace_text &&
      !appliedRisks.has(selectedRisk.id) &&
      selectedRisk.status !== "ignored" &&
      (selectedRisk.action_type === "replace" || selectedRisk.action_type === "insert" || selectedRisk.action_type === "append") &&
      (selectedRisk.action_type === "append" || selectedRiskLocation?.status === "matched")
  );
  const activeParagraph = selectedRiskLocation?.paragraphIndex ?? null;
  const reviewAiState = getReviewAiState(reviewDetail);
  const isReviewRunning = reviewAiState.kind === "pending";
  const showReviewAiState = reviewAiState.kind !== "ok";
  const showReviewAiWarning = reviewAiState.kind === "warning" || reviewAiState.kind === "failed";
  const exportPreviewText = reviewText || docTextFromReview(reviewDetail);
  const syncParagraphs = useCallback((index: number) => (e: React.FocusEvent<HTMLParagraphElement>) => {
    const newText = e.currentTarget.textContent || "";
    const currentParas = (reviewText || docTextFromReview(reviewDetail)).split("\n\n");
    // 用原始 index 匹配段落位置
    let targetIdx = -1;
    for (let i = 0; i < currentParas.length; i++) {
      if (i === index) { targetIdx = i; break; }
    }
    if (targetIdx >= 0) {
      currentParas[targetIdx] = newText;
      setReviewText(currentParas.join("\n\n"));
    }
  }, [reviewText, reviewDetail, setReviewText]);

  function focusRiskInSource(risk: RiskPoint) {
    if (activeReviewTextTab !== "source") {
      setActiveReviewTextTab("source");
      window.setTimeout(() => scrollToRisk(risk), 40);
      return;
    }
    scrollToRisk(risk);
  }

  return (
    <div className="work-page review-page">
      <section className="compare-toolbar panel-surface review-toolbar review-command-toolbar">
        <div className="diff-stats review-stats">
          <Stat tone="tone-info" label="总风险" value={isReviewRunning ? "--" : reviewDetail ? reviewRiskStats.total : 0} />
          <Stat tone="tone-danger" label="高风险" value={isReviewRunning ? "--" : reviewDetail ? reviewRiskStats.high : 0} />
          <Stat tone="tone-warning" label="中风险" value={isReviewRunning ? "--" : reviewDetail ? reviewRiskStats.medium : 0} />
          <Stat tone="tone-safe" label="低风险" value={isReviewRunning ? "--" : reviewDetail ? reviewRiskStats.low : 0} />
          <Stat tone="tone-move" label="待处理" value={isReviewRunning ? "--" : reviewDetail ? reviewRiskStats.pending : 0} />
        </div>
        <div className="toolbar-actions review-toolbar-actions">
          <label className={`risk-upload-button ${reviewFile ? "selected" : ""}`}>
            <input
              className="upload-file-input"
              type="file"
              accept=".docx,.pdf,.txt"
              onChange={(event) => setReviewFile(event.target.files?.[0] ?? null)}
            />
            <span className="risk-upload-button-title">
              <Upload size={16} />
              <span>{reviewFile ? reviewFile.name : "选择合同"}</span>
            </span>
          </label>
          <button className="ghost-action review-export-action" onClick={exportReview} disabled={!reviewDetail || busy("export")}>
            <Download size={16} />
            导出修改版
          </button>
          <button className="primary-action" onClick={uploadReview} disabled={isReviewRunning || busy("review-upload")}>
            {isReviewRunning || busy("review-upload") ? "审查中..." : "开始审查"}
          </button>
        </div>
      </section>

      {!reviewDetail ? (
        <section className="review-empty-shell panel-surface">
          <EmptyState title="还没有审查结果" copy="请上传合同文件并开始审查。" />
        </section>
      ) : (
        <>
          {showReviewAiState && (
            <section className={`notice-panel ${showReviewAiWarning ? "warning" : "info"} ai-state-panel`} role="status">
              <AlertTriangle size={18} />
              <span>
                <strong>{reviewAiState.title}</strong>
                {reviewAiState.message}
              </span>
            </section>
          )}

          <section className="risk-workspace">
            <article className="review-document panel-surface">
              <div className="document-head">
                <div className="review-document-title">
                  <h2>{reviewDetail.task.file_name}</h2>
                  {(showReviewAiState || reviewDetail.task.overall_conclusion) && (
                    <p className="panel-subtitle">
                      {showReviewAiState ? reviewAiState.message : reviewDetail.task.overall_conclusion}
                    </p>
                  )}
                </div>
                <div className="review-document-tabs" role="tablist" aria-label="合同正文视图">
                  <button
                    className={activeReviewTextTab === "source" ? "active" : ""}
                    onClick={() => setActiveReviewTextTab("source")}
                    role="tab"
                    aria-selected={activeReviewTextTab === "source"}
                    type="button"
                  >
                    原文
                  </button>
                  <button
                    className={activeReviewTextTab === "export" ? "active" : ""}
                    onClick={() => setActiveReviewTextTab("export")}
                    role="tab"
                    aria-selected={activeReviewTextTab === "export"}
                    type="button"
                  >
                    导出文本
                  </button>
                </div>
              </div>
              {activeReviewTextTab === "source" ? (
                <div className="review-scroll source-document">
                  {selectedRisk && selectedRiskLocation?.status === "missing" && selectedRisk.action_type !== "append" && (
                    <ReviewInlineToolbar
                      risk={selectedRisk}
                      applied={appliedRisks.has(selectedRisk.id)}
                      collapsed={reviewToolbarCollapsed}
                      canApply={selectedRiskCanApply}
                      onApply={() => applyRiskSuggestion(selectedRisk)}
                      onRevoke={() => revokeRiskSuggestion(selectedRisk)}
                      onSetStatus={(status) => void updateReviewRisk(status, selectedRisk)}
                      onHide={() => setReviewToolbarCollapsed(true)}
                      onShow={() => setReviewToolbarCollapsed(false)}
                    />
                  )}
                  <div className="review-document-paper">
                    {reviewHighlights.paragraphs.map(({ paragraph, tokens }) => {
                      const isActive = activeParagraph === paragraph.index && selectedRiskLocation?.status !== "missing";
                      const selectedToken = tokens.find((token) => token.type === "risk" && token.riskIds.includes(selectedRiskId));
                      const tokenRiskId = selectedToken ? selectedRiskId : tokens.find((token) => token.type === "risk")?.riskId;
                      const relatedRisk =
                        (tokenRiskId ? reviewDetail.risk_points.find((risk) => risk.id === tokenRiskId) : null) ??
                        reviewDetail.risk_points.find((risk) => reviewHighlights.locations[risk.id]?.paragraphIndex === paragraph.index);
                      return (
                        <div
                          className={`contract-paragraph ${isActive ? "active" : ""}`}
                          key={`${paragraph.index}-${paragraph.text}`}
                          ref={(node) => {
                            paragraphRefs.current[paragraph.index] = node;
                          }}
                        >
                          <div className={`contract-paragraph-body ${isActive ? "has-active-risk" : ""}`}>
                            {relatedRisk && <span className="inline-marker">{riskLevelLabel[relatedRisk.level]}</span>}
                            {(() => {
                              const table = parseTableBlock(paragraph.text ?? "");
                              if (table) {
                                const riskTokens = tokens.filter(t => t.type === "risk");
                                return (
                                  <table className="contract-table">
                                    <thead>
                                      <tr>
                                        {table.headers.map((h, i) => {
                                          const token = riskTokens.find(t => h.includes(t.text));
                                          if (token) {
                                            const risk = reviewDetail.risk_points.find(r => r.id === token.riskId);
                                            const status = risk?.status ?? "pending";
                                            const levelClass = risk ? `risk-${risk.level}` : "";
                                            const isActive = token.riskIds.includes(selectedRiskId);
                                            return (
                                              <th key={i} contentEditable={false}>
                                                <button
                                                  className={`risk-highlight status-${status} ${levelClass} ${isActive ? "active" : ""} ${token.replaced ? "replaced" : ""}`}
                                                  onClick={() => selectRiskFromText(token.riskId)}
                                                  ref={(node) => { token.riskIds.forEach(rid => { riskHighlightRefs.current[rid] = node; }); }}
                                                  type="button"
                                                >
                                                  {h}
                                                </button>
                                              </th>
                                            );
                                          }
                                          return <th key={i} contentEditable={false}><span contentEditable suppressContentEditableWarning onBlur={syncTableEdit(paragraph.index)}>{h}</span></th>;
                                        })}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {table.rows.map((row, ri) => (
                                        <tr key={ri}>
                                          {row.map((cell, ci) => {
                                            const token = riskTokens.find(t => cell.includes(t.text));
                                            if (token) {
                                              const risk = reviewDetail.risk_points.find(r => r.id === token.riskId);
                                              const status = risk?.status ?? "pending";
                                              const levelClass = risk ? `risk-${risk.level}` : "";
                                              const isActive = token.riskIds.includes(selectedRiskId);
                                              return (
                                                <td key={ci}>
                                                  <button
                                                    className={`risk-highlight status-${status} ${levelClass} ${isActive ? "active" : ""} ${token.replaced ? "replaced" : ""}`}
                                                    onClick={() => selectRiskFromText(token.riskId)}
                                                    ref={(node) => { token.riskIds.forEach(rid => { riskHighlightRefs.current[rid] = node; }); }}
                                                    type="button"
                                                  >
                                                    {cell}
                                                  </button>
                                                </td>
                                              );
                                            }
                                            return <td key={ci}><span contentEditable suppressContentEditableWarning onBlur={syncTableEdit(paragraph.index)}>{cell}</span></td>;
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                );
                              }
                              return (
                                <p contentEditable suppressContentEditableWarning onBlur={syncParagraphs(paragraph.index)}>
                                  {tokens.map((token, index) => {
                                    if (token.type === "text") return <span key={`${paragraph.index}-text-${index}`}>{token.text}</span>;
                                    const activeTokenRiskId = token.riskIds.includes(selectedRiskId) ? selectedRiskId : token.riskId;
                                    const risk = reviewDetail.risk_points.find((item) => item.id === activeTokenRiskId);
                                    const status = risk?.status ?? "pending";
                                    const levelClass = risk ? `risk-${risk.level}` : "";
                                    const isTokenActive = token.riskIds.includes(selectedRiskId);
                                    return (
                                      <button
                                        className={`risk-highlight status-${status} ${levelClass} ${isTokenActive ? "active" : ""} ${token.replaced ? "replaced" : ""}`}
                                        key={`${paragraph.index}-${token.riskIds.join("-")}-${index}`}
                                        onClick={() => selectRiskFromText(activeTokenRiskId)}
                                        ref={(node) => {
                                          token.riskIds.forEach((riskId) => {
                                            riskHighlightRefs.current[riskId] = node;
                                          });
                                        }}
                                        type="button"
                                      >
                                        {token.text}
                                      </button>
                                    );
                                  })}
                                </p>
                              );
                            })()}
                            {isActive && selectedRisk && (
                              <ReviewInlineToolbar
                                risk={selectedRisk}
                                applied={appliedRisks.has(selectedRisk.id)}
                                collapsed={reviewToolbarCollapsed}
                                canApply={selectedRiskCanApply}
                                onApply={() => applyRiskSuggestion(selectedRisk)}
                                onRevoke={() => revokeRiskSuggestion(selectedRisk)}
                                onSetStatus={(status) => void updateReviewRisk(status, selectedRisk)}
                                onHide={() => setReviewToolbarCollapsed(true)}
                                onShow={() => setReviewToolbarCollapsed(false)}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  {selectedRisk && selectedRisk.action_type === "append" && (
                    <ReviewInlineToolbar
                      risk={selectedRisk}
                      applied={appliedRisks.has(selectedRisk.id)}
                      collapsed={reviewToolbarCollapsed}
                      canApply={selectedRiskCanApply}
                      onApply={() => applyRiskSuggestion(selectedRisk)}
                      onRevoke={() => revokeRiskSuggestion(selectedRisk)}
                      onSetStatus={(status) => void updateReviewRisk(status, selectedRisk)}
                      onHide={() => setReviewToolbarCollapsed(true)}
                      onShow={() => setReviewToolbarCollapsed(false)}
                    />
                  )}
                  </div>
                </div>
              ) : (
                <div className="review-scroll export-document">
                  <textarea className="review-export-preview" value={exportPreviewText} onChange={(e) => setReviewText(e.target.value)} aria-label="导出文本预览" />
                </div>
              )}
            </article>

            <aside className="risk-panel panel-surface">
              <div className="panel-head risk-panel-head">
                <div className="risk-panel-heading">
                  <h2>风险点</h2>
                </div>
                <div className="panel-filter-row right-panel-filter-row">
                  <Select value={reviewLevelFilter} onChange={(value) => setReviewLevelFilter(value as LevelFilter)} label="风险等级">
                    <option value="">全部等级</option>
                    <option value="high">高风险</option>
                    <option value="medium">中风险</option>
                    <option value="low">低风险</option>
                  </Select>
                  <Select value={reviewStatusFilter} onChange={(value) => setReviewStatusFilter(value as RiskStatusFilter)} label="处理状态">
                    <option value="">全部状态</option>
                    <option value="pending">待处理</option>
                    <option value="confirmed">已确认</option>
                    <option value="ignored">已忽略</option>
                  </Select>
                </div>
              </div>
              <div className="risk-panel-scroll">
                <div className="risk-list">
                  {filteredReviewRisks.length === 0 && (
                    <EmptyState
                      title={showReviewAiWarning ? "AI 风险结果缺失" : "没有匹配风险"}
                      copy={showReviewAiWarning ? reviewAiState.message : "调整筛选条件后再查看。"}
                    />
                  )}
                  {filteredReviewRisks.map((risk) => {
                    const canApply = Boolean(
                      risk.replace_text &&
                        !appliedRisks.has(risk.id) &&
                        risk.status !== "ignored" &&
                        (risk.action_type === "replace" || risk.action_type === "insert") &&
                        reviewHighlights.locations[risk.id]?.status === "matched"
                    );
                    return (
                      <RiskCard
                        key={risk.id}
                        active={risk.id === selectedRiskId}
                        expanded={risk.id === expandedReviewRiskId}
                        risk={risk}
                        applied={appliedRisks.has(risk.id)}
                        onSelect={() => focusRiskInSource(risk)}
                        onToggle={() => toggleReviewRiskDetail(risk)}
                        registerRef={(node) => {
                          reviewRiskCardRefs.current[risk.id] = node;
                        }}
                      >
                        {risk.id === expandedReviewRiskId && (
                          <RiskDetail
                            risk={risk}
                            canApply={canApply}
                            onApply={risk.replace_text ? () => applyRiskSuggestion(risk) : undefined}
                            onRevoke={() => revokeRiskSuggestion(risk)}
                            applied={appliedRisks.has(risk.id)}
                          />
                        )}
                      </RiskCard>
                    );
                  })}
                </div>
              </div>
            </aside>
          </section>
        </>
      )}
    </div>
  );
}
