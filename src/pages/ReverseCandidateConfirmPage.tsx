import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api, downloadBlob } from "../api";
import { Badge, DetailBlock, EmptyState, formatTime } from "../components/shared";
import { confidenceLabel } from "../reverseRuleUi";
import type { ReverseCandidateRule, ReverseRuleCandidateDecision, ReverseRuleTask } from "../types";

function sourcePairLabel(value?: string | null) {
  if (!value) return "来源合同组待返回";
  const match = value.match(/^pair-(\d+)$/i);
  return match ? `第${match[1]}组` : value;
}

function candidateSource(candidate: ReverseCandidateRule) {
  return candidate.source_pair || candidate.traces[0]?.pair_id || "";
}

function riskTone(level: string) {
  if (level === "高") return "risk-high";
  if (level === "低") return "risk-low";
  return "risk-medium";
}

export function ReverseCandidateConfirmPage() {
  const { taskId = "" } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<ReverseRuleTask | null>(null);
  const [candidates, setCandidates] = useState<ReverseCandidateRule[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [checkedCandidateIds, setCheckedCandidateIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  const selected = candidates.find((candidate) => candidate.candidate_id === selectedId) ?? candidates[0] ?? null;
  const stats = useMemo(
    () => ({
      total: candidates.length,
      included: candidates.filter((candidate) => candidate.decision === "included").length,
      ignored: candidates.filter((candidate) => candidate.decision === "ignored").length,
      pending: candidates.filter((candidate) => candidate.decision === "pending").length
    }),
    [candidates]
  );

  async function loadAll() {
    if (!taskId) return;
    setMessage("");
    try {
      const [nextTask, nextCandidates] = await Promise.all([api.getReverseRuleTask(taskId), api.getReverseRuleCandidates(taskId)]);
      setTask(nextTask);
      setCandidates(nextCandidates.candidates);
      setSelectedId((current) => (nextCandidates.candidates.some((candidate) => candidate.candidate_id === current) ? current : nextCandidates.candidates[0]?.candidate_id || ""));
      setCheckedCandidateIds((current) => {
        const available = new Set(nextCandidates.candidates.map((candidate) => candidate.candidate_id));
        const retained = current.filter((candidateId) => available.has(candidateId));
        return retained.length > 0 ? retained : nextCandidates.candidates.map((candidate) => candidate.candidate_id);
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "候选规则加载失败");
    }
  }

  useEffect(() => {
    void loadAll();
  }, [taskId]);

  async function setDecision(candidate: ReverseCandidateRule, decision: ReverseRuleCandidateDecision) {
    setBusy(`decision-${candidate.candidate_id}`);
    setMessage("");
    try {
      const updated = await api.updateReverseRuleCandidateDecision(candidate.candidate_id, decision);
      setCandidates((current) => current.map((item) => (item.candidate_id === updated.candidate_id ? updated : item)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "候选规则状态更新失败");
    } finally {
      setBusy("");
    }
  }

  async function batchDecision(decision: ReverseRuleCandidateDecision) {
    setBusy(`batch-${decision}`);
    setMessage("");
    try {
      if (checkedCandidateIds.length === 0) {
        setMessage("请先勾选需要批量处理的候选规则");
        return;
      }
      const ids = checkedCandidateIds;
      const updated = await api.batchUpdateReverseRuleCandidates(taskId, ids, decision);
      setCandidates(updated.candidates);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "批量更新失败");
    } finally {
      setBusy("");
    }
  }

  const allChecked = candidates.length > 0 && checkedCandidateIds.length === candidates.length;
  const hasCandidates = candidates.length > 0;

  function toggleCandidate(candidateId: string) {
    setCheckedCandidateIds((current) => (current.includes(candidateId) ? current.filter((id) => id !== candidateId) : [...current, candidateId]));
  }

  function toggleAllCandidates() {
    setCheckedCandidateIds(allChecked ? [] : candidates.map((candidate) => candidate.candidate_id));
  }

  async function confirmImport() {
    if (checkedCandidateIds.length === 0) {
      setMessage("请先勾选至少 1 条需要入库的候选规则");
      return;
    }
    setBusy("confirm");
    setMessage("");
    try {
      await api.confirmReverseRuleImport(taskId, checkedCandidateIds);
      navigate(`/rules/reverse-tasks/${taskId}/success`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "确认入库失败");
    } finally {
      setBusy("");
    }
  }

  async function exportResult() {
    setBusy("export");
    setMessage("");
    try {
      const blob = await api.exportReverseRuleResult(taskId);
      downloadBlob(blob, `${task?.task_name || "reverse-rule-result"}.xlsx`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导出失败");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="work-page reverse-page reverse-confirm-page">
      <div className="reverse-confirm-shell">
        <header className="reverse-confirm-head">
          <div>
            <button className="reverse-back-link" onClick={() => navigate("/rules/reverse-tasks")} type="button">
              <ArrowLeft size={15} />
              返回任务列表
            </button>
            <div className="reverse-confirm-title-row">
              <h1>{task?.task_name || "候选规则确认"}</h1>
              <Badge tone="reverse-status-pending_confirm">待确认</Badge>
            </div>
          </div>
          <button className="ghost-action inline" onClick={() => void exportResult()} type="button">
            <Download size={16} />
            导出本次结果
          </button>
        </header>

        <section className="reverse-summary-strip panel-surface" aria-label="候选规则任务统计">
          <div>
            <span>合同组数</span>
            <strong>{task?.pair_count ?? 0}</strong>
            <em>组</em>
          </div>
          <div>
            <span>候选规则</span>
            <strong>{stats.total}</strong>
            <em>条</em>
          </div>
          <div>
            <span>已纳入</span>
            <strong>{stats.included}</strong>
            <em>条</em>
          </div>
          <div>
            <span>已忽略</span>
            <strong>{stats.ignored}</strong>
            <em>条</em>
          </div>
          <div>
            <span>待处理</span>
            <strong>{stats.pending}</strong>
            <em>条</em>
          </div>
          <div>
            <span>创建时间</span>
            <strong>{formatTime(task?.created_at)}</strong>
          </div>
        </section>
      </div>

      {message && <div className="notice-panel warning">{message}</div>}

      <section className="reverse-confirm-workspace">
        <article className="panel-surface reverse-candidate-table">
          <div className="panel-head">
            <h2>候选规则 <span>({stats.total})</span></h2>
          </div>
          {candidates.length === 0 ? (
            <div className="reverse-candidate-empty">
              <EmptyState title="暂无候选规则" copy="本次解析没有生成可确认的候选规则。" />
            </div>
          ) : hasCandidates ? (
            <>
              <div className="reverse-candidate-table-scroll">
                <div className="reverse-candidate-row reverse-candidate-row-head">
                  <label className="reverse-candidate-check">
                    <input checked={allChecked} onChange={toggleAllCandidates} type="checkbox" />
                  </label>
                  <span>风险名称</span>
                  <span>审核模块</span>
                  <span>触发条件（摘要）</span>
                  <span>等级</span>
                  <span>置信度</span>
                  <span>来源合同组</span>
                  <span>操作</span>
                </div>
                {candidates.map((candidate) => (
                  <div
                    className={`reverse-candidate-row ${selected?.candidate_id === candidate.candidate_id ? "active" : ""}`}
                    key={candidate.candidate_id}
                    onClick={() => setSelectedId(candidate.candidate_id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setSelectedId(candidate.candidate_id);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <label className="reverse-candidate-check" onClick={(event) => event.stopPropagation()}>
                      <input checked={checkedCandidateIds.includes(candidate.candidate_id)} onChange={() => toggleCandidate(candidate.candidate_id)} type="checkbox" />
                    </label>
                    <strong>{candidate.risk_name}</strong>
                    <span>{candidate.review_module}</span>
                    <span className="reverse-candidate-summary">{candidate.trigger_condition || candidate.check_point || "--"}</span>
                    <Badge tone={riskTone(candidate.default_risk_level)} compact>{candidate.default_risk_level}</Badge>
                    <span>{confidenceLabel(candidate.confidence)}</span>
                    <span>{sourcePairLabel(candidateSource(candidate))}</span>
                    <span className="reverse-table-actions" onClick={(event) => event.stopPropagation()}>
                      <button className="mini-action primary-action" onClick={() => void setDecision(candidate, candidate.decision === "included" ? "pending" : "included")} disabled={busy === `decision-${candidate.candidate_id}`} type="button">
                        {candidate.decision === "included" ? "撤回" : "纳入"}
                      </button>
                    </span>
                  </div>
                ))}
              </div>
              <div className="reverse-confirm-actions">
                <div className="reverse-inline-actions">
                  <button className="mini-action ghost-action" onClick={() => void batchDecision("included")} disabled={checkedCandidateIds.length === 0 || busy === "batch-included"} type="button">批量纳入</button>
                  <button className="mini-action ghost-action" onClick={() => void batchDecision("ignored")} disabled={checkedCandidateIds.length === 0 || busy === "batch-ignored"} type="button">批量忽略</button>
                </div>
                <button className="primary-action" onClick={() => void confirmImport()} disabled={checkedCandidateIds.length === 0 || busy === "confirm"} type="button">
                  确认入库（{checkedCandidateIds.length} 条纳入）
                </button>
              </div>
            </>
          ) : null}
        </article>

        <aside className="panel-surface reverse-detail-side">
          {!selected ? (
            <EmptyState title="请选择候选规则" copy="点击左侧规则后查看详情与来源证据。" />
          ) : (
            <>
              <div className="panel-head">
                <h2>规则详情</h2>
              </div>

              <div className="reverse-detail-fields">
                <div>
                    <span>风险名称</span>
                  <strong>{selected.risk_name}</strong>
                </div>
                <div>
                    <span>检查点</span>
                  <p>{selected.check_point || "--"}</p>
                </div>
                <div>
                    <span>触发条件</span>
                  <p>{selected.trigger_condition || "--"}</p>
                </div>
                <div>
                    <span>修改建议</span>
                  <p>{selected.suggestion_template || "--"}</p>
                </div>
                <div>
                    <span>示例条款</span>
                  <p>{selected.example_clause || "--"}</p>
                </div>
              </div>

              <details className="reverse-evidence-drawer">
                <summary>来源证据</summary>
                <div className="reverse-evidence-list">
                  {selected.traces.length === 0 && <EmptyState title="暂无来源证据" copy="后端未返回 traces 字段。" />}
                  {selected.traces.map((trace, index) => (
                    <section className="reverse-evidence" key={`${trace.pair_id}-${index}`}>
                      <DetailBlock title="修改前证据" value={trace.evidence_before} />
                      <DetailBlock title="修改后证据" value={trace.evidence_after} />
                      <DetailBlock title="差异摘要" value={trace.diff_summary} />
                      <DetailBlock title="用户意图" value={trace.user_intent} />
                    </section>
                  ))}
                </div>
              </details>

              <div className="reverse-detail-source">来源：{sourcePairLabel(candidateSource(selected))}</div>
            </>
          )}
        </aside>
      </section>
    </div>
  );
}
