import type { MutableRefObject } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { matchingComparisonRisksForDiff } from "../reviewDocument";
import type { ComparisonParagraphHighlightResult } from "../reviewDocument";
import { getComparisonAiState } from "../taskHealth";
import {
  Badge,
  ComparisonDocumentPane,
  ComparisonRiskDetail,
  DiffDetailCard,
  EmptyState,
  Select,
  Stat,
  UploadButton,
  changeTypeLabel,
  isInteractiveTarget,
  riskLevelLabel,
  riskStatusLabel,
  similarityLabel
} from "../components/shared";
import type { ChangeType, ComparisonDetail, ComparisonDocument, ComparisonRiskPoint, DiffDetail, RiskLevel, RiskStatus } from "../types";

type DiffFilter = "" | ChangeType;
type LevelFilter = "" | RiskLevel;

export interface ComparePageProps {
  comparisonDetail: ComparisonDetail | null;
  oldDocument?: ComparisonDocument;
  newDocument?: ComparisonDocument;
  oldComparisonHighlights: ComparisonParagraphHighlightResult;
  newComparisonHighlights: ComparisonParagraphHighlightResult;
  selectedDiffIndex: number | null;
  oldDiffRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
  oldDiffHighlightRefs: MutableRefObject<Record<number, HTMLElement | null>>;
  newDiffRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
  newDiffHighlightRefs: MutableRefObject<Record<number, HTMLElement | null>>;
  filteredDiffs: DiffDetail[];
  expandedDiffIndex: number | null;
  comparisonRisks: ComparisonRiskPoint[];
  filteredComparisonRisks: ComparisonRiskPoint[];
  selectedComparisonRiskId: string;
  expandedComparisonRiskId: string;
  comparisonComment: string;
  comparisonIgnoreReason: string;
  oldFile: File | null;
  newFile: File | null;
  busy: (label: string) => boolean;
  visibleDiffStats: { total: number; added: number; deleted: number; modified: number };
  diffFilter: DiffFilter;
  compareLevelFilter: LevelFilter;
  setOldFile: (file: File | null) => void;
  setNewFile: (file: File | null) => void;
  uploadComparison: () => void;
  setDiffFilter: (value: DiffFilter) => void;
  setCompareLevelFilter: (value: LevelFilter) => void;
  setSelectedDiffIndex: (index: number) => void;
  scrollToDiff: (diff: DiffDetail, side?: "old" | "new") => void;
  toggleDiffDetail: (diff: DiffDetail) => void;
  findComparisonRiskDiff: (risk: ComparisonRiskPoint) => DiffDetail | null;
  selectComparisonRisk: (risk: ComparisonRiskPoint) => void;
  toggleComparisonRiskDetail: (risk: ComparisonRiskPoint) => void;
  setComparisonComment: (value: string) => void;
  setComparisonIgnoreReason: (value: string) => void;
  updateComparisonRisk: (status: RiskStatus, risk?: ComparisonRiskPoint | null) => Promise<void>;
}

export function ComparePage(props: ComparePageProps) {
  const {
    comparisonDetail,
    oldDocument,
    newDocument,
    oldComparisonHighlights,
    newComparisonHighlights,
    selectedDiffIndex,
    oldDiffRefs,
    oldDiffHighlightRefs,
    newDiffRefs,
    newDiffHighlightRefs,
    filteredDiffs,
    expandedDiffIndex,
    comparisonRisks,
    filteredComparisonRisks,
    selectedComparisonRiskId,
    expandedComparisonRiskId,
    comparisonComment,
    comparisonIgnoreReason,
    oldFile,
    newFile,
    busy,
    visibleDiffStats,
    diffFilter,
    compareLevelFilter,
    setOldFile,
    setNewFile,
    uploadComparison,
    setDiffFilter,
    setCompareLevelFilter,
    setSelectedDiffIndex,
    scrollToDiff,
    toggleDiffDetail,
    findComparisonRiskDiff,
    selectComparisonRisk,
    toggleComparisonRiskDetail,
    setComparisonComment,
    setComparisonIgnoreReason,
    updateComparisonRisk
  } = props;

  const comparisonAiState = getComparisonAiState(comparisonDetail);
  const isComparisonRunning = comparisonAiState.kind === "pending";
  const showComparisonAiState = comparisonAiState.kind !== "ok";
  const showComparisonAiWarning = comparisonAiState.kind === "warning" || comparisonAiState.kind === "failed";
  const comparisonRiskCount = comparisonDetail?.task.total_risks ?? comparisonDetail?.risk_points.length ?? 0;

  return (
    <div className="work-page compare-page">
      <header className="page-head compact compare-hero-panel">
        <div className="risk-review-title-row">
          <div className="risk-review-hero">
            <p className="eyebrow">VERSION COMPARE</p>
            <h1>版本比对</h1>
            <p>上传旧版和新版合同，按差异类型同步查看文本与风险解读。</p>
          </div>
          <div className="compare-head-actions">
            <div className="compare-upload-bar">
              <UploadButton title="旧版合同" file={oldFile} onChange={setOldFile} />
              <UploadButton title="新版合同" file={newFile} onChange={setNewFile} />
            </div>
            <button className="primary-action" onClick={uploadComparison} disabled={busy("comparison-upload")}>
              {busy("comparison-upload") ? "比对中..." : "开始比对"}
            </button>
          </div>
        </div>
      </header>

      {!comparisonDetail ? (
        <section className="compare-empty-shell panel-surface">
          <EmptyState title="还没有比对结果" copy="选择旧版与新版合同后开始比对，完成后会在这里显示双栏正文与差异列表。" />
        </section>
      ) : (
        <>
          <section className="compare-toolbar panel-surface compare-stats-toolbar">
            <div className="diff-stats compare-stats">
              <Stat tone="tone-info" label="总差异" value={isComparisonRunning ? "--" : visibleDiffStats.total} />
              <Stat tone="tone-add" label="新增" value={isComparisonRunning ? "--" : visibleDiffStats.added} />
              <Stat tone="tone-delete" label="删除" value={isComparisonRunning ? "--" : visibleDiffStats.deleted} />
              <Stat tone="tone-modify" label="修改" value={isComparisonRunning ? "--" : visibleDiffStats.modified} />
              <Stat tone="tone-risk" label="风险" value={isComparisonRunning ? "--" : comparisonRiskCount} />
            </div>
            <div className="toolbar-controls">
              <Select value={diffFilter} onChange={(value) => setDiffFilter(value as DiffFilter)} label="差异类型">
                <option value="">全部差异</option>
                <option value="added">新增</option>
                <option value="deleted">删除</option>
                <option value="modified">修改</option>
                <option value="moved">移位</option>
              </Select>
              <Select value={compareLevelFilter} onChange={(value) => setCompareLevelFilter(value as LevelFilter)} label="风险等级">
                <option value="">全部风险</option>
                <option value="high">高风险</option>
                <option value="medium">中风险</option>
                <option value="low">低风险</option>
              </Select>
            </div>
          </section>

          {showComparisonAiState && (
            <section className={`notice-panel ${showComparisonAiWarning ? "warning" : "info"} ai-state-panel`} role="status">
              <AlertTriangle size={18} />
              <span>
                <strong>{comparisonAiState.title}</strong>
                {comparisonAiState.message}
              </span>
            </section>
          )}

          <section className="compare-workspace">
            <ComparisonDocumentPane
              title={oldDocument?.file_name || "旧版合同"}
              highlights={oldComparisonHighlights}
              side="old"
              selectedDiffIndex={selectedDiffIndex}
              onSelectDiff={(index) => setSelectedDiffIndex(index)}
              paragraphRefs={oldDiffRefs}
              highlightRefs={oldDiffHighlightRefs}
            />
            <ComparisonDocumentPane
              title={newDocument?.file_name || "新版合同"}
              highlights={newComparisonHighlights}
              side="new"
              selectedDiffIndex={selectedDiffIndex}
              onSelectDiff={(index) => setSelectedDiffIndex(index)}
              paragraphRefs={newDiffRefs}
              highlightRefs={newDiffHighlightRefs}
            />
            <aside className="diff-panel panel-surface">
              <div className="panel-head">
                <h2>差异与风险</h2>
                <p className="panel-subtitle">
                  {isComparisonRunning ? "--" : filteredDiffs.length} 项差异 | {isComparisonRunning ? "--" : filteredComparisonRisks.length} 项风险
                </p>
              </div>
              <div className="diff-panel-scroll">
                <div className="diff-list">
                  {filteredDiffs.map((diff) => {
                    const expanded = expandedDiffIndex === diff.index;
                    const matchedRisks = matchingComparisonRisksForDiff(diff, comparisonRisks);
                    const diffRiskLevel = matchedRisks[0]?.risk_level ?? null;
                    return (
                      <article className={`diff-card compact ${selectedDiffIndex === diff.index ? "active" : ""} ${expanded ? "expanded" : ""}`} key={diff.index}>
                        <div className="diff-card-top">
                          <button className="diff-card-summary-button" onClick={() => scrollToDiff(diff)} type="button">
                            <span className="diff-card-summary">
                              <span className="diff-card-badges">
                                <Badge tone={`type-${diff.change_type}`}>{changeTypeLabel[diff.change_type]}</Badge>
                                {diffRiskLevel && <Badge tone={`risk-${diffRiskLevel}`}>{riskLevelLabel[diffRiskLevel]}</Badge>}
                                {similarityLabel(diff.similarity) && <Badge tone="muted">相似度 {similarityLabel(diff.similarity)}</Badge>}
                              </span>
                              <strong>{diff.new_text || diff.old_text || "文本差异"}</strong>
                              <small className="diff-card-meta">
                                {diff.change_type === "moved" ? "展开后可分别定位旧版/新版原文" : "点击定位到正文差异位置"}
                              </small>
                            </span>
                          </button>
                        </div>
                        {expanded && <DiffDetailCard diff={diff} risks={matchedRisks} onJump={(side) => scrollToDiff(diff, side)} />}
                        <button aria-expanded={expanded} className="card-expand-link" onClick={() => toggleDiffDetail(diff)} type="button">
                          <ChevronDown size={14} />
                          <span>{expanded ? "收起" : "展开"}</span>
                        </button>
                      </article>
                    );
                  })}
                  {filteredDiffs.length === 0 && <EmptyState title="暂无匹配差异" copy="调整类型筛选后再查看。" />}
                </div>

                <div className="risk-list compare-risk-list">
                  <p className="section-label">RISK REVIEW</p>
                  {filteredComparisonRisks.map((risk) => {
                    const expanded = expandedComparisonRiskId === risk.id;
                    const matched = findComparisonRiskDiff(risk);
                    return (
                      <article
                        className={`risk-list-item ${risk.id === selectedComparisonRiskId ? "active" : ""} ${expanded ? "expanded" : ""}`}
                        key={risk.id}
                        onClick={(event) => {
                          if (!isInteractiveTarget(event.target)) selectComparisonRisk(risk);
                        }}
                      >
                        <div className="risk-list-item-top">
                          <button className="risk-list-item-summary-button" onClick={() => selectComparisonRisk(risk)} type="button">
                            <span className="risk-list-item-summary">
                              <span className="risk-list-badges">
                                <Badge tone={`type-${risk.change_type}`}>{changeTypeLabel[risk.change_type]}</Badge>
                                {risk.risk_level && <Badge tone={`risk-${risk.risk_level}`}>{riskLevelLabel[risk.risk_level]}</Badge>}
                                <Badge tone={`status-${risk.status}`}>{riskStatusLabel[risk.status]}</Badge>
                              </span>
                              <strong>{risk.summary || risk.category || "比对风险"}</strong>
                              <small>{risk.suggestion || risk.evidence || risk.impact}</small>
                            </span>
                          </button>
                        </div>
                        {expanded && (
                          <ComparisonRiskDetail
                            risk={risk}
                            comment={comparisonComment}
                            ignoreReason={comparisonIgnoreReason}
                            onComment={setComparisonComment}
                            onIgnoreReason={setComparisonIgnoreReason}
                            onConfirm={() => void updateComparisonRisk(risk.status === "confirmed" ? "pending" : "confirmed", risk)}
                            onIgnore={() => void updateComparisonRisk(risk.status === "ignored" ? "pending" : "ignored", risk)}
                            onJumpOld={matched ? () => scrollToDiff(matched, "old") : undefined}
                            onJumpNew={matched ? () => scrollToDiff(matched, "new") : undefined}
                          />
                        )}
                        <button aria-expanded={expanded} className="card-expand-link" onClick={() => toggleComparisonRiskDetail(risk)} type="button">
                          <ChevronDown size={14} />
                          <span>{expanded ? "收起" : "展开"}</span>
                        </button>
                      </article>
                    );
                  })}
                  {filteredComparisonRisks.length === 0 && (
                    <EmptyState
                      title={showComparisonAiState ? comparisonAiState.title : "暂无匹配风险"}
                      copy={showComparisonAiState ? comparisonAiState.message : "调整风险等级筛选后再查看。"}
                    />
                  )}
                </div>
              </div>
            </aside>
          </section>
        </>
      )}
    </div>
  );
}
