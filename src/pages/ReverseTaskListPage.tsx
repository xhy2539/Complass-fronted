import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Filter, Plus, RefreshCw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Badge, EmptyState, Select, formatTime } from "../components/shared";
import { reverseTaskStatusLabel, reverseTaskTarget } from "../reverseRuleUi";
import type { ReverseRuleTask, ReverseRuleTaskStatus } from "../types";

type StatusFilter = "" | ReverseRuleTaskStatus;

const REVERSE_TASK_PAGE_SIZE = 20;

function reverseTaskActionLabel(status: ReverseRuleTaskStatus) {
  if (status === "pending_confirm") return "查看候选规则";
  if (status === "completed") return "查看入库结果";
  if (status === "failed") return "查看失败原因";
  return "任务未完成";
}

function reverseTaskCandidateLabel(task: ReverseRuleTask) {
  if (task.status === "parsing" || task.status === "draft" || task.status === "cancelled") return "-";
  return `${task.candidate_rule_count} 条`;
}

function pageItems(current: number, pageCount: number) {
  const pages = new Set([1, current - 1, current, current + 1, pageCount].filter((page) => page >= 1 && page <= pageCount));
  const ordered = Array.from(pages).sort((a, b) => a - b);
  return ordered.reduce<Array<number | "ellipsis">>((items, page, index) => {
    if (index > 0 && page - ordered[index - 1] > 1) items.push("ellipsis");
    items.push(page);
    return items;
  }, []);
}

export function ReverseTaskListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<ReverseRuleTask[]>([]);
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const pageCount = Math.max(1, Math.ceil(total / REVERSE_TASK_PAGE_SIZE));
  const visiblePages = useMemo(() => pageItems(page, pageCount), [page, pageCount]);

  async function loadTasks(nextPage = page) {
    setLoading(true);
    setMessage("");
    try {
      const data = await api.listReverseRuleTasks({
        status,
        skip: (nextPage - 1) * REVERSE_TASK_PAGE_SIZE,
        limit: REVERSE_TASK_PAGE_SIZE
      });
      setTasks(data.tasks);
      setTotal(data.total);
      setPage(Math.floor((data.skip ?? (nextPage - 1) * REVERSE_TASK_PAGE_SIZE) / REVERSE_TASK_PAGE_SIZE) + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "任务加载失败");
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    void loadTasks(1);
  }

  function goPage(nextPage: number) {
    if (nextPage < 1 || nextPage > pageCount || nextPage === page) return;
    void loadTasks(nextPage);
  }

  useEffect(() => {
    void loadTasks(1);
  }, [status]);

  useEffect(() => {
    const state = location.state as { reverseTaskNotice?: string } | null;
    if (!state?.reverseTaskNotice) return;
    setMessage(state.reverseTaskNotice);
    navigate(".", { replace: true, state: null });
  }, [location.state, navigate]);

  return (
    <div className="work-page reverse-page reverse-list-page">
      {message && <div className="notice-panel warning reverse-list-notice">{message}</div>}

      <section className="compare-toolbar panel-surface reverse-toolbar reverse-list-toolbar">
        <div className="toolbar-controls">
          <Select value={status} onChange={(value) => setStatus(value as StatusFilter)} label="状态">
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="parsing">解析中</option>
            <option value="pending_confirm">待确认</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
            <option value="cancelled">已取消</option>
          </Select>
          <button className="ghost-action inline reverse-filter-button" onClick={applyFilters} disabled={loading}>
            {loading ? <RefreshCw className="spin" size={16} /> : <Filter size={16} />}
            筛选
          </button>
          <span className="reverse-toolbar-spacer" />
          <button className="primary-action reverse-new-task-button" onClick={() => navigate("/rules/reverse-tasks/new")}>
            <Plus size={16} />
            新建解析
          </button>
        </div>
      </section>

      <section className="reverse-list-table-card panel-surface">
        <div className="panel-head">
          <div>
            <h2>
              解析任务列表 <span>共 {total} 个</span>
            </h2>
          </div>
        </div>
        <div className="reverse-list-table-scroll">
          <div className="reverse-row reverse-row-head">
            <span>任务名称</span>
            <span>合同组数</span>
            <span>候选规则数</span>
            <span>状态</span>
            <span>创建时间</span>
            <span>操作</span>
          </div>
          {tasks.length === 0 && <EmptyState title="暂无逆向解析任务" copy="新建解析后，任务进度和候选规则会显示在这里。" />}
          {tasks.map((task) => {
            const target = reverseTaskTarget(task);
            return (
              <button
                className={`reverse-row reverse-row-button ${target ? "" : "reverse-row-disabled"}`}
                disabled={!target}
                key={task.id}
                onClick={() => {
                  if (target) navigate(target);
                }}
              >
                <strong>{task.task_name}</strong>
                <span>{task.pair_count} 组</span>
                <span>{reverseTaskCandidateLabel(task)}</span>
                <Badge tone={`reverse-status-${task.status}`}>{reverseTaskStatusLabel[task.status]}</Badge>
                <span>{formatTime(task.created_at)}</span>
                <span className="reverse-row-action">{reverseTaskActionLabel(task.status)}</span>
              </button>
            );
          })}
        </div>
        <div className="reverse-list-pagination">
          <label>
            每页显示：
            <span className="reverse-page-size">{REVERSE_TASK_PAGE_SIZE} 条/页</span>
          </label>
          <nav aria-label="逆向解析任务分页">
            <button className="reverse-page-button icon" disabled={page <= 1 || loading} onClick={() => goPage(page - 1)} title="上一页">
              <ChevronLeft size={15} />
            </button>
            {visiblePages.map((item, index) =>
              item === "ellipsis" ? (
                <span className="reverse-page-ellipsis" key={`ellipsis-${index}`}>...</span>
              ) : (
                <button className={`reverse-page-button ${item === page ? "active" : ""}`} disabled={loading || item === page} key={item} onClick={() => goPage(item)}>
                  {item}
                </button>
              )
            )}
            <button className="reverse-page-button icon" disabled={page >= pageCount || loading} onClick={() => goPage(page + 1)} title="下一页">
              <ChevronRight size={15} />
            </button>
          </nav>
        </div>
      </section>
    </div>
  );
}
