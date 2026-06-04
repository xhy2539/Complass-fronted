import { useEffect, useState } from "react";
import { CheckCircle2, Download, Plus } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api, downloadBlob } from "../api";
import { Badge, EmptyState, FieldLabel, formatTime } from "../components/shared";
import type { ReverseCandidateRule, ReverseRuleTask } from "../types";

export function ReverseTaskSuccessPage() {
  const { taskId = "" } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<ReverseRuleTask | null>(null);
  const [candidates, setCandidates] = useState<ReverseCandidateRule[]>([]);
  const [message, setMessage] = useState("");

  const included = candidates.filter((candidate) => candidate.decision === "included");
  const ignored = candidates.filter((candidate) => candidate.decision === "ignored");

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
            <p className="eyebrow">IMPORT SUCCESS</p>
            <h1>{task?.task_name || "入库成功结果"}</h1>
            <p>查看本次纳入和忽略的规则，并继续后续操作。</p>
          </div>
        </div>
      </header>

      {message && <div className="notice-panel warning">{message}</div>}

      <section className="panel-surface reverse-success-panel">
        <CheckCircle2 size={42} />
        <div>
          <h2>规则已成功入库</h2>
          <p>后端已生成正式规则编号、版本和启用状态。</p>
        </div>
      </section>

      <section className="panel-surface reverse-summary-grid">
        <FieldLabel title="入库规则数" value={`${task?.included_count ?? included.length} 条`} />
        <FieldLabel title="已忽略规则数" value={`${task?.ignored_count ?? ignored.length} 条`} />
        <FieldLabel title="来源合同组数" value={`${task?.pair_count ?? 0} 组`} />
        <FieldLabel title="入库时间" value={formatTime(task?.completed_at || task?.updated_at)} />
      </section>

      <section className="panel-surface reverse-table">
        <div className="panel-head">
          <h2>本次入库规则列表</h2>
        </div>
        {included.length === 0 ? (
          <EmptyState title="暂无入库明细" copy="后端未返回候选规则明细，规则库中仍可查看正式规则。" />
        ) : (
          <>
            <div className="reverse-row reverse-row-head six">
              <span>规则编号</span>
              <span>合同类型</span>
              <span>审核模块</span>
              <span>风险名称</span>
              <span>等级</span>
              <span>状态</span>
            </div>
            {included.map((rule) => (
              <div className="reverse-row six" key={rule.candidate_id}>
                <strong>{rule.candidate_id}</strong>
                <span>{rule.contract_type}</span>
                <span>{rule.review_module}</span>
                <span>{rule.risk_name}</span>
                <Badge tone={rule.default_risk_level === "高" ? "risk-high" : rule.default_risk_level === "中" ? "risk-medium" : "risk-low"}>{rule.default_risk_level}</Badge>
                <Badge tone="status-completed">启用</Badge>
              </div>
            ))}
          </>
        )}
      </section>

      <section className="panel-surface reverse-table">
        <div className="panel-head">
          <h2>已忽略规则列表</h2>
        </div>
        {ignored.length === 0 ? (
          <EmptyState title="暂无忽略规则" copy="本次没有忽略规则或后端未返回忽略规则明细。" />
        ) : (
          <>
            <div className="reverse-row reverse-row-head four">
              <span>风险名称</span>
              <span>审核模块</span>
              <span>合同类型</span>
              <span>忽略原因</span>
            </div>
            {ignored.map((rule) => (
              <div className="reverse-row four" key={rule.candidate_id}>
                <strong>{rule.risk_name}</strong>
                <span>{rule.review_module}</span>
                <span>{rule.contract_type}</span>
                <span>{rule.ignored_reason || "用户选择忽略"}</span>
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
