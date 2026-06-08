import { useState } from "react";
import type { MutableRefObject } from "react";
import { AlertTriangle, Download, Upload } from "lucide-react";
import { buildReviewParagraphHighlights, docTextFromReview, getReviewParagraphs } from "../reviewDocument";
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
    setReviewToolbarCollapsed,
    applyRiskSuggestion,
    revokeRiskSuggestion,
    updateReviewRisk,
    selectRiskFromText,
    scrollToRisk,
    toggleReviewRiskDetail
  } = props;

  const [activeReviewTextTab, setActiveReviewTextTab] = useState<"source" | "export">("source");
  const paragraphs = getReviewParagraphs(reviewDetail, reviewText);
  const reviewHighlights = buildReviewParagraphHighlights(paragraphs, reviewDetail?.risk_points ?? [], appliedRisks);
  const selectedRiskLocation = selectedRisk ? reviewHighlights.locations[selectedRisk.id] : null;
  const selectedRiskCanApply = Boolean(
    selectedRisk?.replace_text &&
      selectedRiskLocation?.status === "matched" &&
      !appliedRisks.has(selectedRisk.id) &&
      selectedRisk.status !== "ignored"
  );
  const activeParagraph = selectedRiskLocation?.paragraphIndex ?? null;
  const reviewAiState = getReviewAiState(reviewDetail);
  const isReviewRunning = reviewAiState.kind === "pending";
  const showReviewAiState = reviewAiState.kind !== "ok";
  const showReviewAiWarning = reviewAiState.kind === "warning" || reviewAiState.kind === "failed";
  const exportPreviewText = reviewText || docTextFromReview(reviewDetail);

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
                  {selectedRisk && selectedRiskLocation?.status === "missing" && (
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
                            {paragraph.paragraph_type === "table" || isTableBlock(paragraph.text ?? "") ? (
                              (() => {
                                const table = parseTableBlock(paragraph.text ?? "");
                                if (!table) return <p>{paragraph.text}</p>;
                                return (
                                  <table className="contract-table">
                                    <thead>
                                      <tr>
                                        {table.headers.map((h, i) => <th key={i}>{h}</th>)}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {table.rows.map((row, ri) => (
                                        <tr key={ri}>
                                          {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                );
                              })()
                            ) : (
                              <p>
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
                            )}
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
                  </div>
                </div>
              ) : (
                <div className="review-scroll export-document">
                  <textarea className="review-export-preview" value={exportPreviewText} readOnly aria-label="导出文本预览" />
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
                        reviewHighlights.locations[risk.id]?.status === "matched" &&
                        !appliedRisks.has(risk.id) &&
                        risk.status !== "ignored"
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
