import type { ComparisonDetail, ReviewDetail, TaskStatus } from "./types";

export type AiStateKind = "ok" | "warning" | "pending" | "failed";

export interface AiState {
  kind: AiStateKind;
  title: string;
  message: string;
}

const okState: AiState = {
  kind: "ok",
  title: "AI 分析结果已返回",
  message: "可以查看风险结果。"
};

function isRunning(status?: TaskStatus) {
  return status === "pending" || status === "processing";
}

function hasRiskSummary(summary: Record<string, number> | null | undefined) {
  if (!summary) return false;
  return Object.values(summary).some((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
}

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export function getReviewAiState(detail: ReviewDetail | null): AiState {
  if (!detail) return okState;

  if (isRunning(detail.task.status)) {
    return {
      kind: "pending",
      title: "AI 分析进行中",
      message: "任务仍在处理，请等待分析结果返回。"
    };
  }

  if (detail.task.status === "failed") {
    return {
      kind: "failed",
      title: "AI 分析失败",
      message: "任务失败，请重新发起审查或联系管理员排查。"
    };
  }

  const hasConclusion = hasText(detail.task.overall_conclusion);
  const hasSummary = hasRiskSummary(detail.task.risk_summary);
  const riskCount = detail.task.risk_count ?? detail.risk_points.length;
  const hasRisks = riskCount > 0 || detail.risk_points.length > 0;

  if (detail.task.status === "completed" && !hasConclusion && !hasSummary && !hasRisks) {
    return {
      kind: "warning",
      title: "AI 分析结果缺失",
      message: "任务已完成，但未返回总体结论、风险摘要或风险点。请确认 AI 分析结果后再判断合同风险。"
    };
  }

  return okState;
}

export function getComparisonAiState(detail: ComparisonDetail | null): AiState {
  if (!detail) return okState;

  if (isRunning(detail.task.status)) {
    return {
      kind: "pending",
      title: "AI 增强分析进行中",
      message: "任务仍在处理，请等待差异风险解释返回。"
    };
  }

  if (detail.task.status === "failed") {
    return {
      kind: "failed",
      title: "AI 增强分析失败",
      message: "任务失败，请重新发起比对或联系管理员排查。"
    };
  }

  const totalRisks = detail.task.total_risks ?? detail.task.risk_count ?? detail.risk_points.length;
  const hasDiffs = detail.diff_details.length > 0;
  const hasEnhancement = detail.coze_enhanced.length > 0;
  const hasRisks = totalRisks > 0 || detail.risk_points.length > 0;

  if (detail.task.status === "completed" && hasDiffs && !hasEnhancement && !hasRisks) {
    return {
      kind: "warning",
      title: "AI 增强结果缺失",
      message: "已生成合同差异，但未返回 AI 风险增强结果。请确认 AI 分析状态后再判断变更风险。"
    };
  }

  return okState;
}
