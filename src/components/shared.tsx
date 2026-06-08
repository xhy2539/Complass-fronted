import React from "react";
import { CheckCircle2, ChevronDown, ClipboardCheck, Search, ShieldCheck, Upload, XCircle } from "lucide-react";
import { buildComparisonParagraphHighlights } from "../reviewDocument";
import { isTableBlock, parseTableBlock } from "../tableUtils";
import type { ChangeType, ComparisonRiskPoint, DiffDetail, RiskLevel, RiskPoint, RiskStatus, TaskStatus } from "../types";

export const statusLabel: Record<string, string> = {
  pending: "待处理",
  processing: "处理中",
  completed: "已完成",
  failed: "失败"
};

export const riskStatusLabel: Record<string, string> = {
  pending: "待处理",
  confirmed: "已确认",
  ignored: "已忽略"
};

export const riskLevelLabel: Record<string, string> = {
  high: "高风险",
  medium: "中风险",
  low: "低风险"
};

export const changeTypeLabel: Record<string, string> = {
  added: "新增",
  deleted: "删除",
  modified: "修改",
  moved: "移位"
};

export const actionTypeLabel: Record<string, string> = {
  replace: "替换",
  insert: "插入",
  append: "追加",
  manual: "人工处理"
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = ["docx", "pdf", "txt"];

export function fileSizeLabel(size?: number | null) {
  if (!size) return "--";
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function similarityLabel(value?: number | null) {
  if (typeof value !== "number") return null;
  return `${Math.round(value * (value <= 1 ? 100 : 1))}%`;
}

export function formatTime(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function getExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

export function validateContractFile(file: File | null) {
  if (!file) return "请选择文件";
  if (!SUPPORTED_EXTENSIONS.includes(getExtension(file))) return "仅支持 docx、pdf、txt 文件";
  if (file.size > MAX_FILE_SIZE) return "文件不能超过 10MB";
  return "";
}

export function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("button, input, textarea, select, a"));
}

export function scrollElementInsideNearestScroller(element: HTMLElement) {
  let scroller: HTMLElement | null = element.parentElement;
  while (scroller) {
    const style = window.getComputedStyle(scroller);
    const canScroll = /(auto|scroll)/.test(style.overflowY) && scroller.scrollHeight > scroller.clientHeight;
    if (canScroll) break;
    scroller = scroller.parentElement;
  }

  if (!scroller || scroller === document.body || scroller === document.documentElement) {
    const elementRect = element.getBoundingClientRect();
    const nextTop = window.scrollY + elementRect.top - window.innerHeight / 2 + elementRect.height / 2;
    window.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
    return;
  }

  const elementRect = element.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const nextTop = scroller.scrollTop + elementRect.top - scrollerRect.top - scroller.clientHeight / 2 + elementRect.height / 2;
  scroller.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
}

export function Badge({ children, tone = "info", compact = false }: { children: React.ReactNode; tone?: string; compact?: boolean }) {
  return <span className={`badge ${tone} ${compact ? "compact" : ""}`}>{children}</span>;
}

export function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{copy}</span>
    </div>
  );
}

export function FieldLabel({ title, value }: { title: string; value?: string | number | null }) {
  return (
    <div className="info-pair">
      <span>{title}</span>
      <strong>{value ?? "--"}</strong>
    </div>
  );
}

export function ComparisonDocumentPane({
  title,
  highlights,
  side,
  selectedDiffIndex,
  onSelectDiff,
  paragraphRefs,
  highlightRefs
}: {
  title: string;
  highlights: ReturnType<typeof buildComparisonParagraphHighlights>;
  side: "old" | "new";
  selectedDiffIndex: number | null;
  onSelectDiff: (index: number) => void;
  paragraphRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  highlightRefs: React.MutableRefObject<Record<number, HTMLElement | null>>;
}) {
  return (
    <article className="document-pane panel-surface">
      <div className="document-head">
        <div className="compare-document-title-row">
          <h2>{title}</h2>
          <span className="compare-version-label">{side === "old" ? "旧版文本" : "新版文本"}</span>
        </div>
      </div>
      <div className="document-scroll">
        {highlights.paragraphs.length === 0 && <EmptyState title="暂无文本" copy="后端详情未返回该版本全文。" />}
        {highlights.paragraphs.map(({ paragraph, tokens }) => {
          const isActive = tokens.some((token) => token.type === "diff" && token.diffIndex === selectedDiffIndex);
          return (
            <div
              className={`contract-paragraph ${isActive ? "active" : ""}`}
              key={`${side}-${paragraph.index}`}
              ref={(node) => {
                paragraphRefs.current[paragraph.index] = node;
              }}
            >
              {paragraph.paragraph_type === "table" || isTableBlock(paragraph.text ?? "") ? (
                (() => {
                  const table = parseTableBlock(paragraph.text ?? "");
                  return table ? (
                    <table className="contract-table">
                      <thead>
                        <tr>{table.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {table.rows.map((row, ri) => (
                          <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p>{paragraph.text}</p>
                  );
                })()
              ) : (
                <p>
                  {tokens.map((token, index) => {
                    if (token.type === "text") return <span key={`${side}-${paragraph.index}-text-${index}`}>{token.text}</span>;
                    const tokenActive = token.diffIndex === selectedDiffIndex;
                    return (
                      <mark
                        className={`diff-highlight type-${token.changeType} ${tokenActive ? "active" : ""} ${token.riskLevel ? `risk-level-${token.riskLevel}` : ""}`}
                        data-diff-index={token.diffIndex}
                        data-side={side}
                        key={`${side}-${paragraph.index}-diff-${token.diffIndex}-${index}`}
                        onClick={() => onSelectDiff(token.diffIndex)}
                        ref={(node) => {
                          highlightRefs.current[token.diffIndex] = node;
                        }}
                      >
                        {token.text}
                      </mark>
                    );
                  })}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function RecentPanel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  return (
    <div className="overview-card panel-surface">
      <p className="section-label">{title}</p>
      <div className="recent-list">{children || <EmptyState title={empty} copy="完成任务后会显示最近记录。" />}</div>
    </div>
  );
}

export function Stat({ tone, label, value }: { tone: string; label: string; value: number | string }) {
  return (
    <div className={`stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Select({
  value,
  onChange,
  label,
  children
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="select-shell">
      <span>{label}</span>
      <span className="select-wrap">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {children}
        </select>
        <ChevronDown size={16} />
      </span>
    </label>
  );
}

export function UploadButton({ title, file, onChange }: { title: string; file: File | null; onChange: (file: File | null) => void }) {
  return (
    <label className={`upload-contract-button ${file ? "selected" : ""}`}>
      <input className="upload-file-input" type="file" accept=".docx,.pdf,.txt" onChange={(event) => onChange(event.target.files?.[0] ?? null)} />
      <span className="upload-contract-button-title">
        <Upload size={16} />
        <span>{file ? file.name : title}</span>
      </span>
    </label>
  );
}

export function ReviewInlineToolbar({
  risk,
  applied,
  collapsed,
  canApply,
  onApply,
  onRevoke,
  onSetStatus,
  onHide,
  onShow
}: {
  risk: RiskPoint;
  applied: boolean;
  collapsed: boolean;
  canApply: boolean;
  onApply: () => void;
  onRevoke: () => void;
  onSetStatus: (status: RiskStatus) => void;
  onHide: () => void;
  onShow: () => void;
}) {
  if (collapsed) {
    return (
      <button className="risk-inline-toolbar-collapsed" onClick={onShow} type="button">
        <Search size={14} />
        显示
      </button>
    );
  }

  const isConfirmed = risk.status === "confirmed";
  const isIgnored = risk.status === "ignored";
  const replacementDisabled = !applied && !canApply;
  const actionType = risk.action_type ?? "manual";
  const isInsert = actionType === "insert";
  const applyLabel = applied ? "撤回" : isInsert ? "插入条款" : "一键替换";

  return (
    <div className="risk-inline-toolbar">
      <div className="risk-inline-toolbar-head">
        <span className={`risk-inline-toolbar-title risk-tone-${risk.level}`}>当前风险：{risk.title}</span>
        <button className="risk-inline-hide" onClick={onHide} type="button">
          <XCircle size={14} />
          隐藏
        </button>
      </div>
      <div className="risk-inline-toolbar-actions">
       <button className="mini-action primary-action" disabled={replacementDisabled} onClick={applied ? onRevoke : onApply} type="button">
          {applyLabel}
        </button>
        <button className="mini-action primary-action" onClick={() => onSetStatus(isConfirmed ? "pending" : "confirmed")} type="button">
          {isConfirmed ? "撤回确认" : "确认风险"}
        </button>
        <button className="mini-action ghost-action" onClick={() => onSetStatus(isIgnored ? "pending" : "ignored")} type="button">
          {isIgnored ? "撤回忽略" : "忽略风险"}
        </button>
      </div>
    </div>
  );
}

export function RiskCard({
  risk,
  active,
  expanded,
  applied,
  onSelect,
  onToggle,
  registerRef,
  children
}: {
  risk: RiskPoint;
  active: boolean;
  expanded: boolean;
  applied: boolean;
  onSelect: () => void;
  onToggle: () => void;
  registerRef: (node: HTMLElement | null) => void;
  children?: React.ReactNode;
}) {
  const subtitle = [risk.category, risk.reason, risk.evidence, risk.suggestion].find((value) => {
    const text = value?.trim();
    return text && text.toLowerCase() !== "coze";
  });

  return (
    <article
      className={`risk-list-item ${active ? "active" : ""} ${expanded ? "expanded" : ""} ${applied ? "applied" : ""}`}
      onClick={(event) => {
        if (!isInteractiveTarget(event.target)) onSelect();
      }}
      ref={registerRef}
    >
      <div className="risk-list-item-top">
        <button className="risk-list-item-summary-button" onClick={onSelect} type="button">
          <span className="risk-list-item-summary">
            <span className="risk-list-item-head">
              <span className="risk-list-title-row">
                <strong>{risk.title}</strong>
                <span className="risk-list-badges">
                  <Badge tone={`risk-${risk.level}`} compact>{riskLevelLabel[risk.level]}</Badge>
                  {risk.action_type && <Badge tone="action-type" compact>{actionTypeLabel[risk.action_type] ?? risk.action_type}</Badge>}
                  {applied && <Badge tone="status-applied" compact>已替换</Badge>}
                  <Badge tone={`status-${risk.status}`} compact>{riskStatusLabel[risk.status]}</Badge>
                </span>
              </span>
            </span>
            {subtitle && <small className="risk-list-meta">{subtitle}</small>}
          </span>
        </button>
        <span className="risk-list-item-actions">
          <span className="risk-list-badges">
            {risk.action_type && <Badge tone="action-type">{actionTypeLabel[risk.action_type] ?? risk.action_type}</Badge>}
            {applied && <Badge tone="status-applied">已替换</Badge>}
            <Badge tone={`status-${risk.status}`}>{riskStatusLabel[risk.status]}</Badge>
          </span>
        </span>
      </div>
      {expanded && children}
      <button aria-expanded={expanded} className="card-expand-link" onClick={onToggle} type="button">
        <ChevronDown size={14} />
        <span>{expanded ? "收起" : "展开"}</span>
      </button>
    </article>
  );
}

export function DiffDetailCard({
  diff,
  risks,
  onJump
}: {
  diff: DiffDetail;
  risks: ComparisonRiskPoint[];
  onJump: (side: "old" | "new") => void;
}) {
  return (
    <section className="diff-detail" aria-label="差异详情">
      {risks.length > 0 && (
        <div className="diff-risk-detail">
          {risks.map((risk) => {
            return (
              <React.Fragment key={risk.id}>
                {risk.category && <DetailBlock title="分类" value={risk.category} />}
                <DetailBlock title="摘要" value={risk.summary} />
                <DetailBlock title="证据" value={risk.evidence} />
                <DetailBlock title="影响" value={risk.impact} />
                <DetailBlock title="建议" value={risk.suggestion} />
                {!risk.summary && !risk.evidence && !risk.impact && !risk.suggestion && <p className="diff-risk-copy">该风险暂无 AI 说明字段</p>}
              </React.Fragment>
            );
          })}
        </div>
      )}
      <div className={`diff-detail-actions compact ${!diff.old_text || !diff.new_text ? "single" : ""}`}>
        {diff.old_text && (
          <button className="mini-action ghost-action" onClick={() => onJump("old")} type="button">
            <Search size={13} />
            旧版原文
          </button>
        )}
        {diff.new_text && (
          <button className="mini-action ghost-action" onClick={() => onJump("new")} type="button">
            <Search size={13} />
            新版原文
          </button>
        )}
      </div>
    </section>
  );
}

export function RiskDetail({
  risk,
  applied,
  canApply,
  onApply,
  onRevoke
}: {
  risk: RiskPoint;
  applied: boolean;
  canApply?: boolean;
  onApply?: () => void;
  onRevoke?: () => void;
}) {
  const actionType = risk.action_type ?? "manual";
  const isAutoAction = actionType === "replace" || actionType === "insert";
  const applyButtonLabel = actionType === "insert" ? "插入条款" : "一键替换";

  return (
    <div className="risk-detail">
      <div className="risk-detail-head">
        {risk.action_type && <Badge tone="action-type">{actionTypeLabel[risk.action_type] ?? risk.action_type}</Badge>}
        <Badge tone={`status-${risk.status}`}>{riskStatusLabel[risk.status]}</Badge>
      </div>
      <DetailBlock title="风险原因" value={risk.reason} />
      <DetailBlock title="证据" value={risk.evidence || risk.sentence_text || risk.original_text} />
      <DetailBlock title="影响" value={risk.impact} />
      <DetailBlock title="建议" value={risk.suggestion} />
      {risk.replace_text && isAutoAction && (
        <div className="detail-block">
          <div>
            <ClipboardCheck size={15} />
            {actionType === "insert" ? "插入文本" : "替换建议"}
          </div>
          <p className="replacement-copy">{risk.replace_text}</p>
          {isAutoAction && (
            <div className="detail-block-actions">
              <button
                className="primary-action"
                disabled={!canApply}
                onClick={applied ? onRevoke : onApply}
                type="button"
              >
                {applied ? "撤回" : applyButtonLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ComparisonRiskDetail({
  risk,
  onConfirm,
  onIgnore,
  onJumpOld,
  onJumpNew
}: {
  risk: ComparisonRiskPoint;
  onConfirm: () => void;
  onIgnore: () => void;
  onJumpOld?: () => void;
  onJumpNew?: () => void;
}) {
  const isConfirmed = risk.status === "confirmed";
  const isIgnored = risk.status === "ignored";
  return (
    <div className="risk-detail">
      <div className="risk-detail-head">
        <Badge tone={`status-${risk.status}`}>{riskStatusLabel[risk.status]}</Badge>
        {risk.risk_level && <Badge tone={`risk-${risk.risk_level}`}>{riskLevelLabel[risk.risk_level]}</Badge>}
      </div>
      <DetailBlock title="摘要" value={risk.summary} />
      <DetailBlock title="旧版文本" value={risk.old_text} />
      <DetailBlock title="新版文本" value={risk.new_text} />
      <DetailBlock title="证据" value={risk.evidence} />
      <DetailBlock title="影响" value={risk.impact} />
      <DetailBlock title="建议" value={risk.suggestion} />
      {risk.category && <DetailBlock title="分类" value={risk.category} />}
      <DetailBlock title="相似度" value={similarityLabel(risk.similarity)} />
      {(onJumpOld || onJumpNew) && (
        <div className={`diff-detail-actions compact ${!onJumpOld || !onJumpNew ? "single" : ""}`}>
          {onJumpOld && (
            <button className="mini-action ghost-action" onClick={onJumpOld} type="button">
              <Search size={13} />
              旧版原文
            </button>
          )}
          {onJumpNew && (
            <button className="mini-action ghost-action" onClick={onJumpNew} type="button">
              <Search size={13} />
              新版原文
            </button>
          )}
        </div>
      )}
      <div className="diff-detail-actions">
        <button className="primary-action" onClick={onConfirm}>
          <CheckCircle2 size={16} />
          {isConfirmed ? "撤回确认" : "确认风险"}
        </button>
        <button className="ghost-action" onClick={onIgnore}>
          <XCircle size={16} />
          {isIgnored ? "撤回忽略" : "忽略风险"}
        </button>
      </div>
    </div>
  );
}
export function DetailBlock({ title, value }: { title: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="detail-block">
      <div>{title}</div>
      <p>{value}</p>
    </div>
  );
}
