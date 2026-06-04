import type { ReverseRuleCandidateDecision, ReverseRuleStepStatus, ReverseRuleTask, ReverseRuleTaskStatus } from "./types";

export const reverseTaskStatusLabel: Record<ReverseRuleTaskStatus, string> = {
  draft: "草稿",
  parsing: "解析中",
  pending_confirm: "待确认",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消"
};

export const reverseStepStatusLabel: Record<ReverseRuleStepStatus, string> = {
  pending: "待开始",
  running: "进行中",
  completed: "已完成",
  failed: "失败"
};

export const reverseDecisionLabel: Record<ReverseRuleCandidateDecision, string> = {
  pending: "待处理",
  included: "纳入",
  ignored: "忽略"
};

export const defaultReverseSteps = [
  { key: "uploaded", name: "上传完成", status: "completed" as const },
  { key: "diff", name: "差异识别", status: "pending" as const },
  { key: "retrieval", name: "案例检索", status: "pending" as const },
  { key: "generation", name: "规则生成", status: "pending" as const },
  { key: "summary", name: "结果汇总", status: "pending" as const }
];

export function reverseTaskNeedsConfirmation(
  task: Pick<ReverseRuleTask, "status"> & Partial<Pick<ReverseRuleTask, "candidate_rule_count" | "included_count" | "ignored_count">>
) {
  if (task.status === "pending_confirm") return true;
  if (task.status !== "completed") return false;
  const total = Number(task.candidate_rule_count ?? 0);
  const resolved = Number(task.included_count ?? 0) + Number(task.ignored_count ?? 0);
  return total > 0 && resolved < total;
}

export function reverseTaskTarget(task: Pick<ReverseRuleTask, "id" | "status"> & Partial<Pick<ReverseRuleTask, "candidate_rule_count" | "included_count" | "ignored_count">>) {
  if (reverseTaskNeedsConfirmation(task)) return `/rules/reverse-tasks/${task.id}/progress`;
  if (task.status === "completed") return `/rules/reverse-tasks/${task.id}/success`;
  if (task.status === "failed") return `/rules/reverse-tasks/${task.id}/failed`;
  return `/rules/reverse-tasks/${task.id}/progress`;
}

export function formatPercent(value?: number | null) {
  const normalized = Math.max(0, Math.min(100, Number(value ?? 0)));
  return `${Math.round(normalized)}%`;
}

export function confidenceLabel(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return `${Math.round(value * (value <= 1 ? 100 : 1))}%`;
}
