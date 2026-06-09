import { useEffect } from "react";
import { ArrowRight, FileText, Filter, Scale } from "lucide-react";
import { Badge, EmptyState, Select, fileSizeLabel, formatTime, statusLabel } from "../components/shared";
import type { ComparisonTask, ReviewTask, TaskStatus } from "../types";

type StatusFilter = "" | TaskStatus;

const HISTORY_PAGE_SIZE = 20;

export interface HistoryPageProps {
  historyMode: "review" | "comparison";
  setHistoryMode: (value: "review" | "comparison") => void;
  historyStatus: StatusFilter;
  setHistoryStatus: (value: StatusFilter) => void;
  historySearch: string;
  setHistorySearch: (value: string) => void;
  loadHistory: (skip: number, searchText?: string) => void;
  reviewTasks: ReviewTask[];
  comparisonTasks: ComparisonTask[];
  historyTotal: number;
  historySkip: number;
  goHistoryPage: (direction: -1 | 1) => void;
  openReview: (taskId: string) => Promise<void>;
  openComparison: (taskId: string) => Promise<void>;
}

export function HistoryPage(props: HistoryPageProps) {
  const {
    historyMode,
    setHistoryMode,
    historyStatus,
    setHistoryStatus,
    historySearch,
    setHistorySearch,
    loadHistory,
    reviewTasks,
    comparisonTasks,
    historyTotal,
    historySkip,
    goHistoryPage,
    openReview,
    openComparison
  } = props;

  useEffect(() => {
    void loadHistory(0);
  }, [historyMode]);

  const items = historyMode === "review" ? reviewTasks : comparisonTasks;
  const historyPage = Math.floor(historySkip / HISTORY_PAGE_SIZE) + 1;
  const historyPageCount = Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE));

  return (
    <div className="work-page history-page">
      <section className="compare-toolbar panel-surface history-toolbar">
        <div className="toolbar-segmented">
          <button
            className={historyMode === "review" ? "segmented-active" : ""}
            onClick={() => setHistoryMode("review")}
          >
            审查任务
          </button>
          <button
            className={historyMode === "comparison" ? "segmented-active" : ""}
            onClick={() => setHistoryMode("comparison")}
          >
            比对任务
          </button>
        </div>
        <div className="toolbar-controls">
          <input
            type="text"
            className="search-input"
            placeholder="搜索文件名..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void loadHistory(0, historySearch);
              }
            }}
          />
          <Select
            value={historyStatus}
            onChange={(value) => setHistoryStatus(value as StatusFilter)}
            label="任务状态"
          >
            <option value="">全部状态</option>
            <option value="pending">待处理</option>
            <option value="processing">处理中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
          </Select>
          <button
            className="ghost-action inline"
            onClick={() => void loadHistory(0, historySearch)}
          >
            <Filter size={16} />
            筛选
          </button>
        </div>
      </section>

      <section className="rules-table panel-surface">
        <div className="panel-head">
          <div>
            <h2>
              {historyMode === "review" ? "审查任务" : "比对任务"}
              <span> 共 {historyTotal} 条</span>
            </h2>
          </div>
        </div>
        <div className="rules-table-scroll">
          <div className="rule-row rule-row-head">
            {historyMode === "review" ? (
              <>
                <span>文件名</span>
                <span>任务状态</span>
                <span>创建时间</span>
                <span>文件大小</span>
              </>
            ) : (
              <>
                <span>旧文件 / 新文件</span>
                <span>任务状态</span>
                <span>创建时间</span>
              </>
            )}
          </div>
          {items.length === 0 && (
            <EmptyState
              title="暂无任务"
              copy="创建审查或比对任务后会显示在这里。"
            />
          )}
          {historyMode === "review"
            ? reviewTasks.map((task) => (
                <article
                  className="rule-row rule-row-link"
                  key={task.id}
                  onClick={() => void openReview(task.id)}
                >
                  <span className="history-file-name">
                    <FileText size={15} />
                    {task.file_name}
                  </span>
                  <Badge tone={`status-${task.status}`}>
                    {statusLabel[task.status as TaskStatus]}
                  </Badge>
                  <span>{formatTime(task.created_at)}</span>
                  <span>{fileSizeLabel(task.file_size)}</span>
                </article>
              ))
            : comparisonTasks.map((task) => (
                <article
                  className="rule-row rule-row-link"
                  key={task.id}
                  onClick={() => void openComparison(task.id)}
                >
                  <span className="history-file-name">
                    <Scale size={15} />
                    {task.old_file_name} / {task.new_file_name}
                  </span>
                  <Badge tone={`status-${task.status}`}>
                    {statusLabel[task.status as TaskStatus]}
                  </Badge>
                  <span>{formatTime(task.created_at)}</span>
                </article>
              ))}
        </div>
        <div className="rules-table-footer">
          <label>
            每页展示：
            <span className="rules-page-size">{HISTORY_PAGE_SIZE} 条/页</span>
          </label>
          <div className="rules-pager">
            <button
              className="icon-action"
              disabled={historySkip === 0}
              onClick={() => void goHistoryPage(-1)}
              title="上一页"
            >
              <ArrowRight size={16} style={{ transform: "rotate(180deg)" }} />
            </button>
            <span>
              {historyPage} / {historyPageCount}
            </span>
            <button
              className="icon-action"
              disabled={historySkip + HISTORY_PAGE_SIZE >= historyTotal}
              onClick={() => void goHistoryPage(1)}
              title="下一页"
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}