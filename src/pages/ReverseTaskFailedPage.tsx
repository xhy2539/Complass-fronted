import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { Badge, FieldLabel, formatTime } from "../components/shared";
import { reverseTaskStatusLabel } from "../reverseRuleUi";
import type { ReverseRuleTask } from "../types";

export function ReverseTaskFailedPage() {
  const { taskId = "" } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<ReverseRuleTask | null>(null);
  const [message, setMessage] = useState("");
  const [retrying, setRetrying] = useState(false);

  async function loadTask() {
    if (!taskId) return;
    try {
      setTask(await api.getReverseRuleTask(taskId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "失败详情加载失败");
    }
  }

  async function retryTask() {
    setRetrying(true);
    setMessage("");
    try {
      const next = await api.retryReverseRuleTask(taskId);
      navigate(`/rules/reverse-tasks/${next.id}/progress`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "重新解析失败");
    } finally {
      setRetrying(false);
    }
  }

  useEffect(() => {
    void loadTask();
  }, [taskId]);

  return (
    <div className="work-page reverse-page reverse-failed-page">
      <header className="page-head compact">
        <div className="risk-review-title-row">
          <div>
            <p className="eyebrow">TASK FAILED</p>
            <h1>{task?.task_name || "解析失败详情"}</h1>
            <p>查看失败原因后可重新发起解析。</p>
          </div>
          <button className="ghost-action" onClick={() => navigate("/rules/reverse-tasks")}>返回任务列表</button>
        </div>
      </header>

      {message && <div className="notice-panel warning">{message}</div>}

      <section className="panel-surface reverse-failure-panel">
        <div className="reverse-failure-alert">
          <AlertTriangle size={24} />
          <div>
            <strong>{task?.error_type || "解析任务失败"}</strong>
            <p>{task?.error_message || "后端未返回具体失败原因，请稍后重试或联系后端排查任务日志。"}</p>
          </div>
        </div>
      </section>

      <section className="panel-surface reverse-summary-grid">
        <FieldLabel title="任务状态" value={task ? reverseTaskStatusLabel[task.status] : "--"} />
        <FieldLabel title="合同组数" value={`${task?.pair_count ?? 0} 组`} />
        <FieldLabel title="候选规则" value={`${task?.candidate_rule_count ?? 0} 条`} />
        <FieldLabel title="失败时间" value={formatTime(task?.failed_at || task?.updated_at)} />
        <FieldLabel title="合同类型" value={task?.contract_type || "--"} />
        <FieldLabel title="审核视角" value={task?.review_role || "--"} />
      </section>

      <section className="panel-surface reverse-reason-panel">
        <div className="panel-head">
          <h2>可能原因</h2>
        </div>
        <div className="reverse-reason-list">
          {["文件解析失败", "合同组字段缺失", "规则生成失败", "JSON 校验失败", "系统异常"].map((reason) => (
            <Badge tone="warning" key={reason}>{reason}</Badge>
          ))}
        </div>
      </section>

      <div className="reverse-bottom-actions">
        <button className="primary-action" onClick={() => void retryTask()} disabled={retrying}>
          <RefreshCw className={retrying ? "spin" : ""} size={16} />
          重新解析
        </button>
        <button className="ghost-action" onClick={() => navigate("/rules/reverse-tasks")}>返回任务列表</button>
      </div>
    </div>
  );
}
