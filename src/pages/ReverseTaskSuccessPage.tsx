import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { Badge, EmptyState, FieldLabel, formatTime } from "../components/shared";
import type { ReverseCandidateRule, ReverseRuleTask } from "../types";

function riskTone(level: string) {
  if (level === "高") return "risk-high";
  if (level === "低") return "risk-low";
  return "risk-medium";
}

function sourcePairLabel(candidate: ReverseCandidateRule) {
  const value = candidate.source_pair || candidate.traces[0]?.pair_id || "";
  if (!value) return "--";
  const match = value.match(/^pair-(\d+)$/i);
  return match ? `第${match[1]}组` : value;
}

function reverseImportDecisionLabel(candidate: ReverseCandidateRule) {
  return candidate.decision === "included" ? "已入库" : "已忽略";
}

export function ReverseTaskSuccessPage() {
  const { taskId = "" } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<ReverseRuleTask | null>(null);
  const [candidates, setCandidates] = useState<ReverseCandidateRule[]>([]);
  const [message, setMessage] = useState("");

  const included = candidates.filter((candidate) => candidate.decision === "included");
  const ignoredCount = candidates.length - included.length;

  async function loadData() {
    if (!taskId) return;
    setMessage("");
    try {
      const [taskData, candidateData] = await Promise.all([api.getReverseRuleTask(taskId), api.getReverseRuleCandidates(taskId).catch(() => ({ candidates: [], total: 0 }))]);
      setTask(taskData);
      setCandidates(candidateData.candidates);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "入库结果加载失败");
    }
  }

  useEffect(() => {
    void loadData();
  }, [taskId]);

  return (
    <div className="work-page reverse-page reverse-success-page">
      <header className="panel-surface reverse-success-hero">
        <h1>{task?.task_name || "逆向解析任务"}</h1>
        <div className="reverse-success-summary" aria-label="候选规则入库统计">
          <FieldLabel title="入库规则数" value={`${task?.included_count ?? included.length} 条`} />
          <FieldLabel title="已忽略规则数" value={`${task?.ignored_count ?? ignoredCount} 条`} />
          <FieldLabel title="来源合同组数" value={`${task?.pair_count ?? 0} 组`} />
          <FieldLabel title="入库时间" value={formatTime(task?.completed_at || task?.updated_at)} />
        </div>
      </header>

      {message && <div className="notice-panel warning">{message}</div>}

      <section className="panel-surface reverse-table">
        <div className="panel-head">
          <h2>全部候选规则</h2>
        </div>
        <div className="reverse-table-body">
          {candidates.length === 0 ? (
            <EmptyState title="暂无入库结果" copy="后端未返回候选规则明细。" />
          ) : (
            <>
              <div className="reverse-row reverse-row-head reverse-result-row">
                <span />
                <span>风险名称</span>
                <span>合同类型</span>
                <span>审核模块</span>
                <span>风险等级</span>
                <span>检查点 / 触发条件</span>
                <span>来源合同组</span>
                <span>状态</span>
              </div>
              {candidates.map((rule, index) => (
                <div className="reverse-row reverse-result-row" key={rule.candidate_id}>
                  <span className="reverse-result-index">{index + 1}</span>
                  <strong>{rule.risk_name}</strong>
                  <span>{rule.contract_type}</span>
                  <span>{rule.review_module}</span>
                  <Badge tone={riskTone(rule.default_risk_level)}>{rule.default_risk_level}</Badge>
                  <span>{rule.check_point || rule.trigger_condition || "--"}</span>
                  <span>{sourcePairLabel(rule)}</span>
                  <Badge tone={rule.decision === "included" ? "decision-included" : "decision-ignored"}>{reverseImportDecisionLabel(rule)}</Badge>
                </div>
              ))}
            </>
          )}
        </div>
        <div className="reverse-bottom-actions">
          <button className="ghost-action" onClick={() => navigate("/rules/reverse-tasks")}>返回任务列表</button>
        </div>
      </section>
    </div>
  );
}
