import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api, downloadBlob } from "../api";
import { Badge, EmptyState, formatTime } from "../components/shared";
import type { ReverseCandidateRule, ReverseRuleTask } from "../types";

type DetailTab = "detail" | "evidence";

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
  const [detailTab, setDetailTab] = useState<DetailTab>("detail");

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
  const includedCandidateIds = useMemo(
    () => candidates.filter((candidate) => checkedCandidateIds.includes(candidate.candidate_id)).map((candidate) => candidate.candidate_id),
    [candidates, checkedCandidateIds]
  );
  const ignoredCandidateIds = useMemo(
    () => candidates.filter((candidate) => !checkedCandidateIds.includes(candidate.candidate_id)).map((candidate) => candidate.candidate_id),
    [candidates, checkedCandidateIds]
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

  const allChecked = candidates.length > 0 && checkedCandidateIds.length === candidates.length;
  const hasCandidates = candidates.length > 0;

  function toggleCandidate(candidateId: string) {
    setCheckedCandidateIds((current) => (current.includes(candidateId) ? current.filter((id) => id !== candidateId) : [...current, candidateId]));
  }

  function toggleAllCandidates() {
    setCheckedCandidateIds(allChecked ? [] : candidates.map((candidate) => candidate.candidate_id));
  }

  async function confirmImport() {
    if (includedCandidateIds.length === 0) {
      setMessage("请先勾选至少 1 条需要入库的候选规则");
      return;
    }
    setBusy("confirm");
    setMessage("");
    try {
      const includedUpdate = await api.batchUpdateReverseRuleCandidates(taskId, includedCandidateIds, "included");
      setCandidates(includedUpdate.candidates);
      if (ignoredCandidateIds.length > 0) {
        const ignoredUpdate = await api.batchUpdateReverseRuleCandidates(taskId, ignoredCandidateIds, "ignored");
        setCandidates(ignoredUpdate.candidates);
      }
      await api.confirmReverseRuleImport(taskId, includedCandidateIds);
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

       </div>

      {message && <div className="notice-panel warning">{message}</div>}

      <section className="reverse-confirm-workspace">
        <article className="panel-surface reverse-candidate-table">
          <div className="panel-head">
            <h2>候选规则</h2>
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
                  <span>等级</span>
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
                    <Badge tone={riskTone(candidate.default_risk_level)} compact>{candidate.default_risk_level}</Badge>
                  </div>
                ))}
              </div>
              <div className="reverse-confirm-actions">
                <button className="primary-action" onClick={() => void confirmImport()} disabled={includedCandidateIds.length === 0 || busy === "confirm"} type="button">
                  确认入库（{includedCandidateIds.length} 条纳入）
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
                <div className="reverse-detail-tabs">
                  <button
                    className={detailTab === "detail" ? "active" : ""}
                    onClick={() => setDetailTab("detail")}
                    type="button"
                  >
                    规则详情
                  </button>
                  <button
                    className={detailTab === "evidence" ? "active" : ""}
                    onClick={() => setDetailTab("evidence")}
                    type="button"
                  >
                    来源证据
                  </button>
                </div>
              </div>

              {detailTab === "detail" ? (
                <>
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
                  <div className="reverse-detail-source">来源：{sourcePairLabel(candidateSource(selected))}</div>
                </>
              ) : (
                <div className="reverse-evidence-list">
                  {selected.traces.length === 0 && (
                    <EmptyState title="暂无来源证据" copy="后端未返回 traces 字段。" />
                  )}
                  {selected.traces.map((trace, index) => (
                    <section className="reverse-evidence" key={`${trace.pair_id}-${index}`}>
                      <div className="reverse-evidence-header">
                        <span>第{trace.pair_id?.match(/^pair-(\d+)$/i)?.[1] || index + 1}组证据</span>
                      </div>
                      <div className="reverse-evidence-grid">
                        <div className="reverse-evidence-field">
                          <span>修改前证据</span>
                          <p>{trace.evidence_before || "--"}</p>
                        </div>
                        <div className="reverse-evidence-field">
                          <span>修改后证据</span>
                          <p>{trace.evidence_after || "--"}</p>
                        </div>
                       <div className="reverse-evidence-field">
                          <span>差异摘要</span>
                          <p>{trace.diff_summary || "--"}</p>
                        </div>
                        <div className="reverse-evidence-field">
                          <span>用户意图</span>
                          <p>{trace.user_intent || "--"}</p>
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </aside>
      </section>
    </div>
  );
}
