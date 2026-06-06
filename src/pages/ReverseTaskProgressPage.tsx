import { useEffect, useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { Badge, EmptyState, FieldLabel, formatTime } from "../components/shared";
import { defaultReverseSteps, formatPercent, reverseStepStatusLabel, reverseTaskNeedsConfirmation, reverseTaskStatusLabel, reverseTaskTarget } from "../reverseRuleUi";
import type { ReverseRulePairStatus, ReverseRuleTask } from "../types";

const reversePairStatusLabel: Record<ReverseRulePairStatus, string> = {
  pending: "待开始",
  running: "解析中",
  completed: "已完成",
  failed: "失败"
};

export function ReverseTaskProgressPage() {
  const { taskId = "" } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<ReverseRuleTask | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadTask() {
    if (!taskId) return;
    setLoading(true);
    setMessage("");
    try {
      const data = await api.getReverseRuleTask(taskId);
      setTask(data);
      if (data.status === "failed") navigate(`/rules/reverse-tasks/${data.id}/failed`, { replace: true });
      if (data.status === "completed" && !reverseTaskNeedsConfirmation(data)) navigate(`/rules/reverse-tasks/${data.id}/success`, { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "任务加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTask();
  }, [taskId]);

  useEffect(() => {
    if (!task || task.status !== "parsing") return;
    const timer = window.setInterval(() => void loadTask(), 2500);
    return () => window.clearInterval(timer);
  }, [task?.id, task?.status]);

  const steps = task?.steps?.length ? task.steps : defaultReverseSteps;
  const parsedPairCount = task?.pairs?.filter((pair) => pair.status === "completed").length ?? 0;

  return (
    <div className="work-page reverse-page reverse-progress-page">
      <header className="reverse-progress-hero">
        <div className="reverse-progress-title-area">
          <button className="reverse-back-link" onClick={() => navigate("/rules/reverse-tasks")} type="button">
            返回任务列表
          </button>
          <div className="reverse-progress-title-row">
            <h1>{task?.task_name || "解析任务进度"}</h1>
            {task && (
              <span className="reverse-progress-status">
                <Badge tone={`reverse-status-${task.status}`}>{reverseTaskStatusLabel[task.status]}</Badge>
              </span>
            )}
          </div>
          <p>用户已离开页面也可后台继续运行，可随时返回查看当前进度。</p>
        </div>
        <div className="reverse-progress-actions">
          <button className="ghost-action inline" onClick={() => void loadTask()} disabled={loading}>
            <RefreshCw className={loading ? "spin" : ""} size={16} />
            刷新状态
          </button>
          {task && reverseTaskNeedsConfirmation(task) && (
            <button className="primary-action" onClick={() => navigate(`/rules/reverse-tasks/${task.id}/confirm`)}>
              查看结果
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </header>

      {message && <div className="notice-panel warning">{message}</div>}

      {!task ? (
        <section className="panel-surface">
          <EmptyState title="正在读取任务" copy="稍等片刻，系统正在获取解析进度。" />
        </section>
      ) : (
        <>
          <section className="panel-surface reverse-progress-summary-strip">
            <FieldLabel title="合同组数" value={`${task.pair_count} 组`} />
            <FieldLabel title="已解析" value={`${parsedPairCount}/${task.pair_count} 组`} />
            <FieldLabel title="候选规则数" value={task.candidate_rule_count ? `${task.candidate_rule_count} 条` : "-"} />
            <FieldLabel title="创建时间" value={formatTime(task.created_at)} />
            <FieldLabel title="更新时间" value={formatTime(task.updated_at)} />
            <FieldLabel title="规则版本" value={task.rule_version || task.rule_version_id || "当前版本"} />
          </section>

          <section className="panel-surface reverse-step-panel">
            <div className="panel-head">
              <h2>解析进度</h2>
            </div>
            <div className="reverse-stepper" aria-label={`解析进度 ${formatPercent(task.progress)}`}>
              {steps.map((step) => (
                <article className={`reverse-step-node status-${step.status}`} key={step.key}>
                  <span className="reverse-step-dot" />
                  <strong>{step.name}</strong>
                  <small>{reverseStepStatusLabel[step.status]}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="panel-surface reverse-table reverse-progress-table-card">
            <div className="panel-head">
              <h2>合同组执行状态</h2>
            </div>
            <div className="reverse-progress-table">
              <div className="reverse-row reverse-row-head four">
                <span>合同组</span>
                <span>合同组名称</span>
                <span>状态</span>
                <span>已生成候选规则</span>
              </div>
              {(task.pairs ?? []).length === 0 && <EmptyState title="暂无合同组状态" copy="后端详情未返回合同组执行明细。" />}
              {(task.pairs ?? []).map((pair) => (
                <div className="reverse-row four" key={pair.pair_id}>
                  <strong>{pair.pair_id}</strong>
                  <span>{pair.pair_name}</span>
                  <Badge tone={`reverse-pair-${pair.status}`}>{reversePairStatusLabel[pair.status]}</Badge>
                  <span>{pair.candidate_rule_count} 条</span>
                </div>
              ))}
            </div>
          </section>

          {task.status !== "parsing" && task.status !== "draft" && (
            <div className="reverse-bottom-actions">
              <button className="primary-action" onClick={() => navigate(reverseTaskNeedsConfirmation(task) ? `/rules/reverse-tasks/${task.id}/confirm` : reverseTaskTarget(task) ?? "/rules/reverse-tasks")}>
                {reverseTaskNeedsConfirmation(task) ? "查看候选规则" : "进入下一步"}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
