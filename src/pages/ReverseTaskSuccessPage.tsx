import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api, downloadBlob } from "../api";
import { Badge, EmptyState, FieldLabel, formatTime } from "../components/shared";
import { confidenceLabel } from "../reverseRuleUi";
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

  async function exportResult() {
    setMessage("");
    try {
      const blob = await api.exportReverseRuleResult(taskId);
      downloadBlob(blob, `${task?.task_name || "reverse-rule-result"}.xlsx`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导出失败");
    }
  }

  useEffect(() => {
    void loadData();
  }, [taskId]);

  return (
    <div className="work-page reverse-page reverse-success-page">
      <header className="page-head compact">
        <div className="risk-review-title-row">
          <div>
            <p className="eyebrow">IMPORT RESULT</p>
            <h1>{task?.task_name || "入库结果"}</h1>
            <p>查看全部候选规则的入库状态和基本信息。</p>
          </div>
        </div>
      </header>

      {message && <div className="notice-panel warning">{message}</div>}

      <section className="panel-surface reverse-summary-grid">
        <FieldLabel title="入库规则数" value={`${task?.included_count ?? included.length} 条`} />
        <FieldLabel title="已忽略规则数" value={`${task?.ignored_count ?? ignoredCount} 条`} />
        <FieldLabel title="来源合同组数" value={`${task?.pair_count ?? 0} 组`} />
        <FieldLabel title="入库时间" value={formatTime(task?.completed_at || task?.updated_at)} />
      </section>

      <section className="panel-surface reverse-table">
        <div className="panel-head">
          <h2>全部候选规则</h2>
        </div>
        {candidates.length === 0 ? (
          <EmptyState title="暂无入库结果" copy="后端未返回候选规则明细。" />
        ) : (
          <>
            <div className="reverse-row reverse-row-head reverse-result-row">
              <span>风险名称</span>
              <span>合同类型</span>
              <span>审核模块</span>
              <span>风险等级</span>
              <span>检查点 / 触发条件</span>
              <span>来源合同组</span>
              <span>置信度</span>
              <span>状态</span>
            </div>
            {candidates.map((rule) => (
              <div className="reverse-row reverse-result-row" key={rule.candidate_id}>
                <strong>{rule.risk_name}</strong>
                <span>{rule.contract_type}</span>
                <span>{rule.review_module}</span>
                <Badge tone={riskTone(rule.default_risk_level)}>{rule.default_risk_level}</Badge>
                <span>{rule.check_point || rule.trigger_condition || "--"}</span>
                <span>{sourcePairLabel(rule)}</span>
                <span>{confidenceLabel(rule.confidence)}</span>
                <Badge tone={rule.decision === "included" ? "decision-included" : "decision-ignored"}>{reverseImportDecisionLabel(rule)}</Badge>
              </div>
            ))}
          </>
        )}
      </section>

      <div className="reverse-bottom-actions">
        <button className="primary-action" onClick={() => navigate("/rules")}>查看入库规则</button>
        <button className="ghost-action inline" onClick={() => navigate("/rules/reverse-tasks/new")}>
          <Plus size={16} />
          继续逆向生成规则
        </button>
        <button className="ghost-action inline" onClick={() => void exportResult()}>
          <Download size={16} />
          导出本次结果
        </button>
        <button className="ghost-action" onClick={() => navigate("/rules/reverse-tasks")}>返回任务列表</button>
      </div>
    </div>
  );
}
