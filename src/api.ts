import type {
  AuthResponse,
  ChangeType,
  ComparisonDetail,
  ComparisonListResponse,
  ComparisonRiskPoint,
  ComparisonTask,
  DiffDetail,
  ReviewDetail,
  ReviewListResponse,
  ReviewTask,
  Rule,
  RuleImportResponse,
  RuleListParams,
  RuleListResponse,
  RulePayload,
  RuleVersion,
  RuleVersionCreatePayload,
  RiskLevel,
  RiskPoint,
  RiskStatus,
  TaskStatus,
  UserInfo
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const USER_KEY = "complass_user";
const ACCESS_TOKEN_KEY = "complass_access_token";
const SESSION_EXPIRES_KEY = "complass_session_expires_at";

let memoryToken: string | null = null;
let sessionClock = () => Date.now();

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

export function __setSessionClockForTests(clock: () => number) {
  sessionClock = clock;
}

function clearExpiredSession() {
  const expiresAt = Number(localStorage.getItem(SESSION_EXPIRES_KEY) ?? 0);
  if (expiresAt && sessionClock() >= expiresAt) {
    clearSession();
    return true;
  }
  return false;
}

export function getStoredToken() {
  if (clearExpiredSession()) return null;
  memoryToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  return memoryToken;
}

export function getStoredUser(): UserInfo | null {
  if (clearExpiredSession()) return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserInfo;
  } catch {
    return null;
  }
}

export function storeSession(auth: AuthResponse) {
  const parsed = parseAuthResponse(auth);
  memoryToken = parsed.access_token;
  localStorage.setItem(ACCESS_TOKEN_KEY, parsed.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(parsed.user));
  localStorage.setItem(SESSION_EXPIRES_KEY, String(sessionClock() + parsed.expires_in * 1000));
}

export function clearSession() {
  memoryToken = null;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SESSION_EXPIRES_KEY);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requireObject(value: unknown, name: string): Record<string, unknown> {
  if (!isObject(value)) throw new Error(`${name} must be an object`);
  return value;
}

function requireArray(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${name} must be a string`);
  return value;
}

function parseTaskStatus(value: unknown, name = "status"): TaskStatus {
  const status = requireString(value, name).toLowerCase();
  if (["pending", "processing", "completed", "failed"].includes(status)) return status as TaskStatus;
  throw new Error(`Unknown ${name}: ${status}`);
}

function parseRiskStatus(value: unknown, name = "status"): RiskStatus {
  if (value === undefined || value === null || value === "") return "pending";
  const status = requireString(value, name).toLowerCase();
  if (["pending", "confirmed", "ignored"].includes(status)) return status as RiskStatus;
  throw new Error(`Unknown ${name}: ${status}`);
}

function parseRiskLevel(value: unknown, name = "level"): RiskLevel {
  const level = requireString(value, name).toLowerCase();
  if (["high", "medium", "low"].includes(level)) return level as RiskLevel;
  throw new Error(`Unknown ${name}: ${level}`);
}

function parseChangeType(value: unknown): ChangeType {
  const type = requireString(value ?? "modified", "change_type").toLowerCase();
  if (type === "move") return "moved";
  if (["added", "deleted", "modified", "moved"].includes(type)) return type as ChangeType;
  throw new Error(`Unknown change_type: ${type}`);
}

export function parseAuthResponse(value: unknown): AuthResponse {
  const auth = requireObject(value, "auth response");
  const user = requireObject(auth.user, "user");
  return {
    ...(auth as unknown as AuthResponse),
    access_token: requireString(auth.access_token, "access_token"),
    token_type: typeof auth.token_type === "string" ? auth.token_type : "bearer",
    expires_in: Number(auth.expires_in),
    user: {
      ...(user as unknown as UserInfo),
      id: requireString(user.id, "user.id"),
      email: requireString(user.email, "user.email"),
      nickname: requireString(user.nickname, "user.nickname"),
      is_active: Boolean(user.is_active ?? true),
      is_verified: Boolean(user.is_verified ?? false)
    }
  };
}

export function parseRiskPoint(value: unknown): RiskPoint {
  const risk = requireObject(value, "risk point");
  return {
    ...(risk as unknown as RiskPoint),
    id: requireString(risk.id, "risk.id"),
    title: requireString(risk.title, "risk.title"),
    level: parseRiskLevel(risk.level),
    status: parseRiskStatus(risk.status)
  };
}

export function parseReviewTask(value: unknown): ReviewTask {
  const task = requireObject(value, "task");
  return {
    ...(task as unknown as ReviewTask),
    id: requireString(task.id, "task.id"),
    file_name: requireString(task.file_name, "task.file_name"),
    file_type: requireString(task.file_type, "task.file_type"),
    status: parseTaskStatus(task.status),
    suggest_deep_review: Boolean(task.suggest_deep_review),
    risk_count: Number(task.risk_count ?? (isObject(task.risk_summary) ? task.risk_summary.total : 0) ?? 0),
    paragraphs: Array.isArray(task.paragraphs) ? task.paragraphs : Array.isArray(task.paragraphs_json) ? task.paragraphs_json : []
  };
}

export function parseDiffDetail(value: unknown): DiffDetail {
  const diff = requireObject(value, "diff detail");
  return {
    ...(diff as unknown as DiffDetail),
    index: Number(diff.index),
    change_type: parseChangeType(diff.change_type)
  };
}

export function parseComparisonRisk(value: unknown): ComparisonRiskPoint {
  const risk = requireObject(value, "comparison risk");
  return {
    ...(risk as unknown as ComparisonRiskPoint),
    id: requireString(risk.id, "comparison risk.id"),
    change_type: parseChangeType(risk.change_type),
    risk_level: risk.risk_level ? parseRiskLevel(risk.risk_level, "risk_level") : null,
    status: parseRiskStatus(risk.status)
  };
}

export function parseComparisonTask(value: unknown): ComparisonTask {
  const task = requireObject(value, "comparison task");
  return {
    ...(task as unknown as ComparisonTask),
    id: requireString(task.id, "comparison task.id"),
    old_file_name: requireString(task.old_file_name, "old_file_name"),
    new_file_name: requireString(task.new_file_name, "new_file_name"),
    old_file_type: typeof task.old_file_type === "string" ? task.old_file_type : "",
    new_file_type: typeof task.new_file_type === "string" ? task.new_file_type : "",
    status: parseTaskStatus(task.status),
    total_risks: Number(task.total_risks ?? task.risk_count ?? 0)
  };
}

export function parseReviewDetail(value: unknown): ReviewDetail {
  const detail = requireObject(value, "review detail");
  return {
    ...(detail as unknown as ReviewDetail),
    task: parseReviewTask(detail.task),
    risk_points: requireArray(detail.risk_points, "risk_points").map(parseRiskPoint)
  };
}

export function parseReviewListResponse(value: unknown): ReviewListResponse {
  const list = requireObject(value, "review list response");
  return {
    ...(list as unknown as ReviewListResponse),
    tasks: requireArray(list.tasks, "tasks").map(parseReviewTask),
    total: Number(list.total ?? 0),
    skip: Number(list.skip ?? 0),
    limit: Number(list.limit ?? 20)
  };
}

export function parseComparisonDetail(value: unknown): ComparisonDetail {
  const detail = requireObject(value, "comparison detail");
  return {
    ...(detail as unknown as ComparisonDetail),
    task: parseComparisonTask(detail.task),
    documents: requireArray(detail.documents ?? [], "documents") as ComparisonDetail["documents"],
    diff_details: requireArray(detail.diff_details, "diff_details").map(parseDiffDetail),
    risk_points: requireArray(detail.risk_points, "risk_points").map(parseComparisonRisk),
    coze_enhanced: requireArray(detail.coze_enhanced ?? [], "coze_enhanced")
  };
}

export function parseComparisonListResponse(value: unknown): ComparisonListResponse {
  const list = requireObject(value, "comparison list response");
  return {
    ...(list as unknown as ComparisonListResponse),
    tasks: requireArray(list.tasks, "tasks").map(parseComparisonTask),
    total: Number(list.total ?? 0),
    skip: Number(list.skip ?? 0),
    limit: Number(list.limit ?? 20)
  };
}

export function parseRule(value: unknown): Rule {
  const rule = requireObject(value, "rule");
  return {
    ...(rule as unknown as Rule),
    id: requireString(rule.id, "rule.id"),
    rule_code: requireString(rule.rule_code, "rule.rule_code"),
    contract_type: requireString(rule.contract_type, "rule.contract_type"),
    review_module: requireString(rule.review_module, "rule.review_module"),
    risk_name: requireString(rule.risk_name, "rule.risk_name"),
    default_risk_level: requireString(rule.default_risk_level, "rule.default_risk_level") as Rule["default_risk_level"],
    enabled: Boolean(rule.enabled)
  };
}

export function parseRuleListResponse(value: unknown): RuleListResponse {
  const list = requireObject(value, "rule list response");
  return {
    ...(list as unknown as RuleListResponse),
    rules: requireArray(list.rules, "rules").map(parseRule),
    total: Number(list.total ?? 0),
    skip: Number(list.skip ?? 0),
    limit: Number(list.limit ?? 20)
  };
}

export function parseRuleVersion(value: unknown): RuleVersion {
  const version = requireObject(value, "rule version");
  return {
    ...(version as unknown as RuleVersion),
    id: requireString(version.id, "rule version.id"),
    version_no: Number(version.version_no),
    name: requireString(version.name, "rule version.name"),
    status: requireString(version.status, "rule version.status")
  };
}

export function parseRuleVersions(value: unknown): RuleVersion[] {
  return requireArray(value, "rule versions").map(parseRuleVersion);
}

export function parseRuleImportResponse(value: unknown): RuleImportResponse {
  const result = requireObject(value, "rule import response");
  return {
    ...(result as unknown as RuleImportResponse),
    success: Boolean(result.success),
    errors: Array.isArray(result.errors) ? (result.errors as RuleImportResponse["errors"]) : []
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
    return request<unknown>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }).then(parseAuthResponse);
  },
  register(email: string, nickname: string, password: string) {
    return request<unknown>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, nickname, password })
    }).then(parseAuthResponse);
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
    const data = await request<unknown>(`/api/v1/reviews/${taskId}`);
    return parseReviewDetail(data);
  },
  async listReviews(status = "", skip = 0, limit = 20): Promise<ReviewListResponse> {
    const qs = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (status) qs.set("status", status.toLowerCase());
    const data = await request<unknown>(`/api/v1/reviews?${qs.toString()}`);
    return parseReviewListResponse(data);
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
    const data = await request<unknown>(`/api/v1/comparisons/${taskId}`);
    return parseComparisonDetail(data);
  },
  async listComparisons(status = "", skip = 0, limit = 20): Promise<ComparisonListResponse> {
    const qs = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (status) qs.set("status", status.toLowerCase());
    const data = await request<unknown>(`/api/v1/comparisons?${qs.toString()}`);
    return parseComparisonListResponse(data);
  },
  async listRules(params: RuleListParams = {}): Promise<RuleListResponse> {
    const qs = new URLSearchParams({
      skip: String(params.skip ?? 0),
      limit: String(params.limit ?? 20)
    });
    if (params.version_id) qs.set("version_id", params.version_id);
    if (params.contract_type) qs.set("contract_type", params.contract_type);
    if (params.enabled !== undefined && params.enabled !== "") qs.set("enabled", String(params.enabled));
    const data = await request<unknown>(`/api/v1/rules?${qs.toString()}`);
    return parseRuleListResponse(data);
  },
  createRule(payload: RulePayload) {
    return request<unknown>("/api/v1/rules", {
      method: "POST",
      body: JSON.stringify(payload)
    }).then(parseRule);
  },
  updateRule(ruleId: string, payload: RulePayload) {
    return request<unknown>(`/api/v1/rules/${ruleId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }).then(parseRule);
  },
  deleteRule(ruleId: string) {
    return request<void>(`/api/v1/rules/${ruleId}`, {
      method: "DELETE"
    });
  },
  setRuleEnabled(ruleId: string, enabled: boolean) {
    return request<unknown>(`/api/v1/rules/${ruleId}/enabled`, {
      method: "PATCH",
      body: JSON.stringify({ enabled })
    }).then(parseRule);
  },
  importRulesCsv(file: File) {
    const form = new FormData();
    form.append("file", file);
    return request<unknown>("/api/v1/rules/import-csv", {
      method: "POST",
      body: form
    }).then(parseRuleImportResponse);
  },
  listRuleVersions() {
    return request<unknown>("/api/v1/rule-versions").then(parseRuleVersions);
  },
  createRuleVersion(payload: RuleVersionCreatePayload) {
    return request<unknown>("/api/v1/rule-versions", {
      method: "POST",
      body: JSON.stringify(payload)
    }).then(parseRuleVersion);
  },
  activateRuleVersion(versionId: string) {
    return request<unknown>(`/api/v1/rule-versions/${versionId}/activate`, {
      method: "POST"
    }).then(parseRuleVersion);
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
