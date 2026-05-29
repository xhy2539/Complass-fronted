import type {
  AuthResponse,
  ComparisonDetail,
  ComparisonListResponse,
  ComparisonRiskPoint,
  ComparisonTask,
  DiffDetail,
  ReviewDetail,
  ReviewListResponse,
  ReviewTask,
  RiskLevel,
  RiskPoint,
  RiskStatus,
  TaskStatus,
  UserInfo
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const TOKEN_KEY = "complass_access_token";
const USER_KEY = "complass_user";

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): UserInfo | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserInfo;
  } catch {
    return null;
  }
}

export function storeSession(auth: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, auth.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function normalizeStatus(value?: string | null): TaskStatus {
  const status = String(value ?? "pending").toLowerCase();
  if (["pending", "processing", "completed", "failed"].includes(status)) return status as TaskStatus;
  return "pending";
}

function normalizeRiskStatus(value?: string | null): RiskStatus {
  const status = String(value ?? "pending").toLowerCase();
  if (["pending", "confirmed", "ignored"].includes(status)) return status as RiskStatus;
  return "pending";
}

function normalizeLevel(value?: string | null): RiskLevel {
  const level = String(value ?? "low").toLowerCase();
  if (["high", "medium", "low"].includes(level)) return level as RiskLevel;
  return "low";
}

function normalizeRiskPoint(risk: any): RiskPoint {
  return {
    ...risk,
    level: normalizeLevel(risk.level),
    status: normalizeRiskStatus(risk.status)
  };
}

function normalizeReviewTask(task: any): ReviewTask {
  return {
    ...task,
    status: normalizeStatus(task.status),
    suggest_deep_review: Boolean(task.suggest_deep_review),
    risk_count: Number(task.risk_count ?? task.risk_summary?.total ?? 0),
    paragraphs: task.paragraphs ?? task.paragraphs_json ?? []
  };
}

function normalizeDiff(diff: any): DiffDetail {
  const type = String(diff.change_type ?? "modified").toLowerCase();
  return {
    ...diff,
    change_type: type === "move" ? "moved" : type
  };
}

function normalizeComparisonRisk(risk: any): ComparisonRiskPoint {
  const type = String(risk.change_type ?? "modified").toLowerCase();
  return {
    ...risk,
    change_type: type === "move" ? "moved" : type,
    risk_level: risk.risk_level ? normalizeLevel(risk.risk_level) : null,
    status: normalizeRiskStatus(risk.status)
  };
}

function normalizeComparisonTask(task: any): ComparisonTask {
  return {
    ...task,
    status: normalizeStatus(task.status),
    total_risks: Number(task.total_risks ?? task.risk_count ?? 0)
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 401) {
    clearSession();
    unauthorizedHandler?.();
  }

  if (!response.ok) {
    let message = `请求失败 (${response.status})`;
    try {
      const data = await response.json();
      message = data.detail || data.message || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function blobRequest(path: string, body: unknown): Promise<Blob> {
  const headers = new Headers({ "Content-Type": "application/json" });
  const token = getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    let message = `导出失败 (${response.status})`;
    try {
      const data = await response.json();
      message = data.detail || data.message || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }
  return response.blob();
}

export const api = {
  login(email: string, password: string) {
    return request<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },
  register(email: string, nickname: string, password: string) {
    return request<AuthResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, nickname, password })
    });
  },
  async createReview(file: File, useCoze: boolean) {
    const form = new FormData();
    form.append("file", file);
    return request<{ task_id: string; message: string }>(`/api/v1/reviews?use_coze=${String(useCoze)}`, {
      method: "POST",
      body: form
    });
  },
  async getReview(taskId: string): Promise<ReviewDetail> {
    const data = await request<ReviewDetail>(`/api/v1/reviews/${taskId}`);
    return {
      ...data,
      task: normalizeReviewTask(data.task),
      risk_points: (data.risk_points ?? []).map(normalizeRiskPoint)
    };
  },
  async listReviews(status = "", skip = 0, limit = 20): Promise<ReviewListResponse> {
    const qs = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (status) qs.set("status", status.toLowerCase());
    const data = await request<ReviewListResponse>(`/api/v1/reviews?${qs.toString()}`);
    return { ...data, tasks: (data.tasks ?? []).map(normalizeReviewTask) };
  },
  exportReview(taskId: string, finalText: string, fileName?: string) {
    return blobRequest(`/api/v1/reviews/${taskId}/export`, {
      final_text: finalText,
      file_name: fileName
    });
  },
  async createComparison(oldFile: File, newFile: File, enhance: boolean) {
    const form = new FormData();
    form.append("old_file", oldFile);
    form.append("new_file", newFile);
    return request<{ success: boolean; task_id: string; message: string }>(`/api/v1/comparisons?enhance=${String(enhance)}`, {
      method: "POST",
      body: form
    });
  },
  async getComparison(taskId: string): Promise<ComparisonDetail> {
    const data = await request<ComparisonDetail>(`/api/v1/comparisons/${taskId}`);
    return {
      ...data,
      task: normalizeComparisonTask(data.task),
      diff_details: (data.diff_details ?? []).map(normalizeDiff),
      risk_points: (data.risk_points ?? []).map(normalizeComparisonRisk)
    };
  },
  async listComparisons(status = "", skip = 0, limit = 20): Promise<ComparisonListResponse> {
    const qs = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (status) qs.set("status", status.toLowerCase());
    const data = await request<ComparisonListResponse>(`/api/v1/comparisons?${qs.toString()}`);
    return { ...data, tasks: (data.tasks ?? []).map(normalizeComparisonTask) };
  },
  updateRiskStatus(riskId: string, status: RiskStatus, reviewComment?: string, ignoreReason?: string) {
    return request<{ risk_id: string; old_status: string; new_status: string; message: string }>(
      `/api/v1/risks/${riskId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status,
          review_comment: reviewComment || null,
          ignore_reason: ignoreReason || null
        })
      }
    );
  }
};

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
