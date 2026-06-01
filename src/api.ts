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
  ReverseCandidateRule,
  ReverseRuleCandidateDecision,
  ReverseRuleCandidateListResponse,
  ReverseRuleCreateTaskInput,
  ReverseRuleCreateTaskResponse,
  ReverseRuleImportResult,
  ReverseRulePair,
  ReverseRulePairStatus,
  ReverseRuleStep,
  ReverseRuleStepStatus,
  ReverseRuleTask,
  ReverseRuleTaskListParams,
  ReverseRuleTaskListResponse,
  ReverseRuleTaskStatus,
  ReverseRuleTrace,
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
import { reverseRuleMock } from "./reverseRuleMock";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const USE_REVERSE_RULE_MOCK = import.meta.env.VITE_USE_REVERSE_RULE_MOCK === "true";
const USER_KEY = "complass_user";
const ACCESS_TOKEN_KEY = "complass_access_token";
const SESSION_EXPIRES_KEY = "complass_session_expires_at";
const MOCK_REVERSE_ACCEPTANCE_TIME = "2026-06-01T10:20:00+08:00";

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

function parseReverseRuleTaskStatus(value: unknown, name = "status"): ReverseRuleTaskStatus {
  const status = requireString(value, name).toLowerCase();
  if (["draft", "parsing", "pending_confirm", "completed", "failed", "cancelled"].includes(status)) return status as ReverseRuleTaskStatus;
  if (status === "running" || status === "processing") return "parsing";
  if (status === "pending") return "draft";
  throw new Error(`Unknown ${name}: ${status}`);
}

function parseReverseRulePairStatus(value: unknown, name = "pair.status"): ReverseRulePairStatus {
  const status = requireString(value ?? "pending", name).toLowerCase();
  if (["pending", "running", "completed", "failed"].includes(status)) return status as ReverseRulePairStatus;
  if (status === "parsing" || status === "processing") return "running";
  throw new Error(`Unknown ${name}: ${status}`);
}

function parseReverseRuleStepStatus(value: unknown, name = "step.status"): ReverseRuleStepStatus {
  const status = requireString(value ?? "pending", name).toLowerCase();
  if (["pending", "running", "completed", "failed"].includes(status)) return status as ReverseRuleStepStatus;
  if (status === "parsing" || status === "processing") return "running";
  throw new Error(`Unknown ${name}: ${status}`);
}

function parseReverseRuleCandidateDecision(value: unknown): ReverseRuleCandidateDecision {
  const decision = requireString(value ?? "pending", "decision").toLowerCase();
  if (["pending", "included", "ignored"].includes(decision)) return decision as ReverseRuleCandidateDecision;
  if (decision === "include" || decision === "confirmed") return "included";
  if (decision === "ignore") return "ignored";
  throw new Error(`Unknown decision: ${decision}`);
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
    user: parseUser(user)
  };
}

export function parseUser(value: unknown): UserInfo {
  const user = requireObject(value, "user");
  return {
    ...(user as unknown as UserInfo),
    id: requireString(user.id, "user.id"),
    email: requireString(user.email, "user.email"),
    nickname: requireString(user.nickname, "user.nickname"),
    is_active: Boolean(user.is_active ?? true),
    is_verified: Boolean(user.is_verified ?? false)
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

export function parseReverseRuleStep(value: unknown): ReverseRuleStep {
  const step = requireObject(value, "reverse rule step");
  return {
    ...(step as unknown as ReverseRuleStep),
    key: requireString(step.key ?? step.name, "step.key"),
    name: requireString(step.name ?? step.key, "step.name"),
    status: parseReverseRuleStepStatus(step.status)
  };
}

export function parseReverseRulePair(value: unknown): ReverseRulePair {
  const pair = requireObject(value, "reverse rule pair");
  return {
    ...(pair as unknown as ReverseRulePair),
    pair_id: requireString(pair.pair_id ?? pair.id, "pair.pair_id"),
    pair_name: typeof pair.pair_name === "string" && pair.pair_name ? pair.pair_name : requireString(pair.name ?? pair.pair_id ?? pair.id, "pair.pair_name"),
    before_file_name: typeof pair.before_file_name === "string" ? pair.before_file_name : typeof pair.before_file === "string" ? pair.before_file : null,
    after_file_name: typeof pair.after_file_name === "string" ? pair.after_file_name : typeof pair.after_file === "string" ? pair.after_file : null,
    status: parseReverseRulePairStatus(pair.status),
    candidate_rule_count: Number(pair.candidate_rule_count ?? pair.candidate_count ?? 0)
  };
}

export function parseReverseRuleTask(value: unknown): ReverseRuleTask {
  const task = requireObject(value, "reverse rule task");
  const pairs = Array.isArray(task.pairs) ? task.pairs.map(parseReverseRulePair) : [];
  return {
    ...(task as unknown as ReverseRuleTask),
    id: requireString(task.id ?? task.task_id, "reverse task.id"),
    task_name: requireString(task.task_name ?? task.name, "task_name"),
    status: parseReverseRuleTaskStatus(task.status),
    progress: Number(task.progress ?? 0),
    pair_count: Number(task.pair_count ?? pairs.length ?? 0),
    candidate_rule_count: Number(task.candidate_rule_count ?? task.candidate_count ?? 0),
    included_count: Number(task.included_count ?? 0),
    ignored_count: Number(task.ignored_count ?? 0),
    pending_count: Number(task.pending_count ?? 0),
    contract_type: typeof task.contract_type === "string" ? task.contract_type : null,
    review_role: typeof task.review_role === "string" ? task.review_role : null,
    rule_version_id: typeof task.rule_version_id === "string" ? task.rule_version_id : null,
    rule_version: typeof task.rule_version === "string" ? task.rule_version : null,
    steps: Array.isArray(task.steps) ? task.steps.map(parseReverseRuleStep) : [],
    pairs
  };
}

export function parseReverseRuleTaskListResponse(value: unknown): ReverseRuleTaskListResponse {
  const list = requireObject(value, "reverse rule task list response");
  return {
    ...(list as unknown as ReverseRuleTaskListResponse),
    tasks: requireArray(list.tasks, "tasks").map(parseReverseRuleTask),
    total: Number(list.total ?? 0),
    skip: Number(list.skip ?? 0),
    limit: Number(list.limit ?? 20)
  };
}

export function parseReverseRuleTrace(value: unknown): ReverseRuleTrace {
  const trace = requireObject(value, "reverse rule trace");
  return {
    ...(trace as unknown as ReverseRuleTrace),
    pair_id: requireString(trace.pair_id, "trace.pair_id"),
    confidence: trace.confidence === undefined || trace.confidence === null ? null : Number(trace.confidence)
  };
}

export function parseReverseCandidateRule(value: unknown): ReverseCandidateRule {
  const candidate = requireObject(value, "reverse candidate rule");
  return {
    ...(candidate as unknown as ReverseCandidateRule),
    candidate_id: requireString(candidate.candidate_id ?? candidate.id, "candidate_id"),
    task_id: requireString(candidate.task_id, "candidate.task_id"),
    contract_type: requireString(candidate.contract_type, "candidate.contract_type"),
    review_role: typeof candidate.review_role === "string" ? candidate.review_role : null,
    review_module: requireString(candidate.review_module, "candidate.review_module"),
    risk_name: requireString(candidate.risk_name, "candidate.risk_name"),
    default_risk_level: requireString(candidate.default_risk_level, "candidate.default_risk_level") as ReverseCandidateRule["default_risk_level"],
    confidence: candidate.confidence === undefined || candidate.confidence === null ? null : Number(candidate.confidence),
    source_pair: typeof candidate.source_pair === "string" ? candidate.source_pair : null,
    decision: parseReverseRuleCandidateDecision(candidate.decision ?? candidate.status),
    traces: requireArray(candidate.traces ?? [], "candidate.traces").map(parseReverseRuleTrace)
  };
}

export function parseReverseRuleCandidateListResponse(value: unknown): ReverseRuleCandidateListResponse {
  const list = requireObject(value, "reverse rule candidate list response");
  return {
    candidates: requireArray(list.candidates ?? list.rules ?? [], "candidates").map(parseReverseCandidateRule),
    total: Number(list.total ?? (Array.isArray(list.candidates) ? list.candidates.length : 0))
  };
}

export function parseReverseRuleImportResult(value: unknown): ReverseRuleImportResult {
  const result = requireObject(value, "reverse rule import result");
  return {
    ...(result as unknown as ReverseRuleImportResult),
    task_id: requireString(result.task_id, "import.task_id"),
    included_count: Number(result.included_count ?? 0),
    ignored_count: Number(result.ignored_count ?? 0),
    pair_count: Number(result.pair_count ?? 0),
    imported_rules: requireArray(result.imported_rules ?? [], "imported_rules").map(parseRule),
    ignored_rules: requireArray(result.ignored_rules ?? [], "ignored_rules").map(parseReverseCandidateRule)
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
    if (USE_REVERSE_RULE_MOCK) {
      return Promise.resolve({
        access_token: "mock-reverse-rule-token",
        token_type: "bearer",
        expires_in: 24 * 60 * 60,
        user: {
          id: "mock-user",
          email,
          nickname: "前端验收用户",
          is_active: true,
          is_verified: true
        }
      } satisfies AuthResponse);
    }
    return request<unknown>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }).then(parseAuthResponse);
  },
  register(email: string, nickname: string, password: string) {
    if (USE_REVERSE_RULE_MOCK) {
      return Promise.resolve({
        access_token: "mock-reverse-rule-token",
        token_type: "bearer",
        expires_in: 24 * 60 * 60,
        user: {
          id: "mock-user",
          email,
          nickname: nickname || "前端验收用户",
          is_active: true,
          is_verified: true
        }
      } satisfies AuthResponse);
    }
    return request<unknown>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, nickname, password })
    }).then(parseAuthResponse);
  },
  async getMe(token: string): Promise<UserInfo> {
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${token}`);
    const data = await request<unknown>("/api/v1/auth/me", { headers });
    return parseUser(data);
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
    if (USE_REVERSE_RULE_MOCK) return { tasks: [], total: 0, skip, limit };
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
    if (USE_REVERSE_RULE_MOCK) return { tasks: [], total: 0, skip, limit };
    const qs = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (status) qs.set("status", status.toLowerCase());
    const data = await request<unknown>(`/api/v1/comparisons?${qs.toString()}`);
    return parseComparisonListResponse(data);
  },
  async listRules(params: RuleListParams = {}): Promise<RuleListResponse> {
    if (USE_REVERSE_RULE_MOCK) {
      const rules: Rule[] = [
        {
          id: "mock-rule-001",
          version_id: "mock-version-active",
          rule_code: "R-SALE-001",
          contract_type: "销售合同",
          review_module: "付款条款",
          risk_name: "付款周期过长",
          check_point: "检查合同约定付款期限是否超过公司标准。",
          trigger_condition: "付款期限超过 90 天且无担保措施。",
          default_risk_level: "高" as Rule["default_risk_level"],
          suggestion_template: "建议将付款周期调整为 30-60 天，或增加逾期违约责任。",
          example_clause: "买方应在验收合格后 30 日内完成付款。",
          enabled: true,
          created_at: MOCK_REVERSE_ACCEPTANCE_TIME,
          updated_at: MOCK_REVERSE_ACCEPTANCE_TIME
        },
        {
          id: "mock-rule-002",
          version_id: "mock-version-active",
          rule_code: "R-SALE-002",
          contract_type: "销售合同",
          review_module: "违约责任",
          risk_name: "违约金上限缺失",
          check_point: "检查违约责任是否设置明确上限。",
          trigger_condition: "违约金按日累计且未设置累计上限。",
          default_risk_level: "中" as Rule["default_risk_level"],
          suggestion_template: "建议补充违约金累计不超过合同总价的一定比例。",
          example_clause: "违约金累计总额不超过合同总价的 10%。",
          enabled: true,
          created_at: MOCK_REVERSE_ACCEPTANCE_TIME,
          updated_at: MOCK_REVERSE_ACCEPTANCE_TIME
        }
      ];
      rules.push(
        {
          id: "mock-rule-003",
          version_id: "mock-version-active",
          rule_code: "CON-RISK-003",
          contract_type: "服务合同",
          review_module: "法务",
          risk_name: "违约责任不明确",
          default_risk_level: "中" as Rule["default_risk_level"],
          enabled: true,
          created_at: "2026-05-28T17:18:52+08:00",
          updated_at: "2026-05-28T17:18:52+08:00"
        },
        {
          id: "mock-rule-004",
          version_id: "mock-version-active",
          rule_code: "CON-RISK-004",
          contract_type: "销售合同",
          review_module: "财务",
          risk_name: "发票条款不明确",
          default_risk_level: "中" as Rule["default_risk_level"],
          enabled: true,
          created_at: "2026-05-28T16:05:31+08:00",
          updated_at: "2026-05-28T16:05:31+08:00"
        },
        {
          id: "mock-rule-005",
          version_id: "mock-version-active",
          rule_code: "CON-RISK-005",
          contract_type: "销售合同",
          review_module: "法务",
          risk_name: "租赁期限未约定",
          default_risk_level: "中" as Rule["default_risk_level"],
          enabled: true,
          created_at: "2026-05-28T14:33:27+08:00",
          updated_at: "2026-05-28T14:33:27+08:00"
        },
        {
          id: "mock-rule-006",
          version_id: "mock-version-active",
          rule_code: "CON-RISK-006",
          contract_type: "服务合同",
          review_module: "财务",
          risk_name: "费用承担不明确",
          default_risk_level: "低" as Rule["default_risk_level"],
          enabled: true,
          created_at: "2026-05-27T11:07:09+08:00",
          updated_at: "2026-05-27T11:07:09+08:00"
        },
        {
          id: "mock-rule-007",
          version_id: "mock-version-active",
          rule_code: "CON-RISK-007",
          contract_type: "采购合同",
          review_module: "合规",
          risk_name: "保密义务条款缺失",
          default_risk_level: "低" as Rule["default_risk_level"],
          enabled: false,
          created_at: "2026-05-27T10:55:42+08:00",
          updated_at: "2026-05-27T10:55:42+08:00"
        },
        {
          id: "mock-rule-008",
          version_id: "mock-version-active",
          rule_code: "CON-RISK-008",
          contract_type: "销售合同",
          review_module: "合规",
          risk_name: "数据安全条款缺失",
          default_risk_level: "低" as Rule["default_risk_level"],
          enabled: true,
          created_at: "2026-05-26T15:23:44+08:00",
          updated_at: "2026-05-26T15:23:44+08:00"
        }
      );
      const filtered = rules.filter((rule) => {
        if (params.contract_type && rule.contract_type !== params.contract_type) return false;
        if (params.version_id && rule.version_id !== params.version_id) return false;
        if (params.enabled !== undefined && params.enabled !== "" && rule.enabled !== params.enabled) return false;
        return true;
      });
      const skip = params.skip ?? 0;
      const limit = params.limit ?? 20;
      return { rules: filtered.slice(0, Math.min(limit, filtered.length)), total: filtered.length === rules.length ? 128 : filtered.length, skip, limit };
    }
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
    if (USE_REVERSE_RULE_MOCK) {
      return Promise.resolve([
        {
          id: "mock-version-active",
          version_no: 3,
          name: "逆向解析验收版本",
          description: "用于前端 mock 验收的规则版本。",
          status: "active",
          activated_at: MOCK_REVERSE_ACCEPTANCE_TIME,
          created_at: MOCK_REVERSE_ACCEPTANCE_TIME,
          updated_at: MOCK_REVERSE_ACCEPTANCE_TIME,
          rule_count: 2
        }
      ] satisfies RuleVersion[]);
    }
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
  async listReverseRuleTasks(params: ReverseRuleTaskListParams = {}): Promise<ReverseRuleTaskListResponse> {
    if (USE_REVERSE_RULE_MOCK) return reverseRuleMock.listTasks(params);
    const qs = new URLSearchParams({
      skip: String(params.skip ?? 0),
      limit: String(params.limit ?? 20)
    });
    if (params.status) qs.set("status", params.status);
    if (params.contract_type) qs.set("contract_type", params.contract_type);
    if (params.created_from) qs.set("created_from", params.created_from);
    if (params.created_to) qs.set("created_to", params.created_to);
    const data = await request<unknown>(`/api/v1/reverse-rule-tasks?${qs.toString()}`);
    return parseReverseRuleTaskListResponse(data);
  },
  async createReverseRuleTask(payload: ReverseRuleCreateTaskInput): Promise<ReverseRuleCreateTaskResponse> {
    if (USE_REVERSE_RULE_MOCK) return reverseRuleMock.createTask(payload);
    const form = new FormData();
    form.append("task_name", payload.task_name);
    if (payload.contract_type) form.append("contract_type", payload.contract_type);
    if (payload.review_role) form.append("review_role", payload.review_role);
    if (payload.rule_version_id) form.append("rule_version_id", payload.rule_version_id);
    payload.pairs.forEach((pair, index) => {
      form.append(`pairs[${index}][pair_name]`, pair.pair_name);
      form.append(`pairs[${index}][before_file]`, pair.before_file);
      form.append(`pairs[${index}][after_file]`, pair.after_file);
    });
    const data = await request<unknown>("/api/v1/reverse-rule-tasks", {
      method: "POST",
      body: form
    });
    const response = requireObject(data, "reverse rule create response");
    return {
      ...(response as unknown as ReverseRuleCreateTaskResponse),
      task_id: requireString(response.task_id ?? response.id, "task_id"),
      status: parseReverseRuleTaskStatus(response.status ?? (response.task && isObject(response.task) ? (response.task as Record<string, unknown>).status : "draft")),
      task: response.task ? parseReverseRuleTask(response.task) : undefined,
      message: typeof response.message === "string" ? response.message : undefined
    };
  },
  async getReverseRuleTask(taskId: string): Promise<ReverseRuleTask> {
    if (USE_REVERSE_RULE_MOCK) return reverseRuleMock.getTask(taskId);
    const data = await request<unknown>(`/api/v1/reverse-rule-tasks/${taskId}`);
    return parseReverseRuleTask(data);
  },
  async getReverseRuleCandidates(taskId: string): Promise<ReverseRuleCandidateListResponse> {
    if (USE_REVERSE_RULE_MOCK) return reverseRuleMock.getCandidates(taskId);
    const data = await request<unknown>(`/api/v1/reverse-rule-tasks/${taskId}/candidates`);
    return parseReverseRuleCandidateListResponse(data);
  },
  updateReverseRuleCandidateDecision(candidateId: string, decision: ReverseRuleCandidateDecision, ignoredReason?: string) {
    if (USE_REVERSE_RULE_MOCK) return reverseRuleMock.updateCandidateDecision(candidateId, decision);
    return request<unknown>(`/api/v1/reverse-rule-candidates/${candidateId}/decision`, {
      method: "PATCH",
      body: JSON.stringify({ decision, ignored_reason: ignoredReason || null })
    }).then(parseReverseCandidateRule);
  },
  batchUpdateReverseRuleCandidates(taskId: string, candidateIds: string[], decision: ReverseRuleCandidateDecision) {
    if (USE_REVERSE_RULE_MOCK) return reverseRuleMock.batchUpdateCandidates(taskId, candidateIds, decision);
    return request<unknown>(`/api/v1/reverse-rule-tasks/${taskId}/candidates/decision`, {
      method: "PATCH",
      body: JSON.stringify({ candidate_ids: candidateIds, decision })
    }).then(parseReverseRuleCandidateListResponse);
  },
  confirmReverseRuleImport(taskId: string, candidateIds: string[]) {
    if (USE_REVERSE_RULE_MOCK) return reverseRuleMock.confirmImport(taskId, candidateIds);
    return request<unknown>(`/api/v1/reverse-rule-tasks/${taskId}/confirm-import`, {
      method: "POST",
      body: JSON.stringify({ candidate_ids: candidateIds })
    }).then(parseReverseRuleImportResult);
  },
  retryReverseRuleTask(taskId: string) {
    if (USE_REVERSE_RULE_MOCK) return reverseRuleMock.retryTask(taskId);
    return request<unknown>(`/api/v1/reverse-rule-tasks/${taskId}/retry`, {
      method: "POST"
    }).then(parseReverseRuleTask);
  },
  exportReverseRuleResult(taskId: string) {
    if (USE_REVERSE_RULE_MOCK) return reverseRuleMock.exportResult(taskId);
    return blobRequest(`/api/v1/reverse-rule-tasks/${taskId}/export`, {});
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
