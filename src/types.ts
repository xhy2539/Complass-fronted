export type TaskStatus = "pending" | "processing" | "completed" | "failed";
export type RiskLevel = "high" | "medium" | "low";
export type RiskStatus = "pending" | "confirmed" | "ignored";
export type ChangeType = "added" | "deleted" | "modified" | "moved";
export type RuleRiskLevel = "高" | "中" | "低";

export interface UserInfo {
  id: string;
  email: string;
  nickname: string;
  is_active: boolean;
  is_verified: boolean;
  created_at?: string | null;
  last_login_at?: string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserInfo;
}

export interface Rule {
  id: string;
  version_id?: string | null;
  rule_code: string;
  contract_type: string;
  review_module: string;
  risk_name: string;
  check_point?: string | null;
  trigger_condition?: string | null;
  default_risk_level: RuleRiskLevel;
  suggestion_template?: string | null;
  example_clause?: string | null;
  enabled: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export type RulePayload = Omit<Rule, "id" | "version_id" | "created_at" | "updated_at">;

export interface RuleListParams {
  skip?: number;
  limit?: number;
  version_id?: string;
  contract_type?: string;
  enabled?: boolean | "";
}

export interface RuleListResponse {
  rules: Rule[];
  total: number;
  skip: number;
  limit: number;
}

export interface RuleImportError {
  row?: number | string | null;
  field?: string | null;
  reason?: string | null;
  message?: string | null;
}

export interface RuleImportResponse {
  success: boolean;
  version_id?: string | null;
  version_no?: number | null;
  imported_count?: number | null;
  errors?: RuleImportError[];
}

export interface RuleVersion {
  id: string;
  version_no: number;
  name: string;
  description?: string | null;
  status: "active" | "draft" | "inactive" | string;
  activated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  rule_count?: number | null;
}

export interface RuleVersionCreatePayload {
  name: string;
  description?: string | null;
}

export interface Paragraph {
  id?: string;
  review_task_id?: string;
  index: number;
  text?: string | null;
  char_offset_start?: number | null;
  char_offset_end?: number | null;
  page_number?: number | null;
  is_key_clause?: boolean;
  paragraph_type?: string;
  paragraph_level?: number;
}

export interface RiskStats {
  total: number;
  confirmed: number;
  ignored: number;
  pending: number;
}

export interface RiskPoint {
  id: string;
  title: string;
  level: RiskLevel;
  reason?: string | null;
  suggestion?: string | null;
  category?: string | null;
  evidence?: string | null;
  impact?: string | null;
  replace_text?: string | null;
  position?: Record<string, unknown> | null;
  original_text?: string | null;
  status: RiskStatus;
  ignore_reason?: string | null;
  review_comment?: string | null;
  source?: string;
  sentence_id?: string | null;
  sentence_text?: string | null;
  created_at?: string | null;
}

export interface ReviewTask {
  id: string;
  file_name: string;
  file_type: string;
  file_size?: number | null;
  sanitized_text?: string | null;
  char_count?: number | null;
  page_count?: number | null;
  paragraph_count?: number | null;
  sentence_count?: number | null;
  overall_conclusion?: string | null;
  risk_summary?: Record<string, number> | null;
  suggest_deep_review: boolean;
  status: TaskStatus;
  created_at?: string | null;
  completed_at?: string | null;
  risk_count: number;
  risk_stats?: RiskStats | null;
  paragraphs: Paragraph[];
  paragraphs_json?: Paragraph[] | null;
}

export interface ReviewDetail {
  task: ReviewTask;
  risk_points: RiskPoint[];
  message?: string;
}

export interface ReviewListResponse {
  tasks: ReviewTask[];
  total: number;
  skip: number;
  limit: number;
}

export interface ComparisonDocument {
  id: string;
  version: "old" | "new";
  file_name: string;
  file_type: string;
  text?: string | null;
  char_count?: number | null;
  page_count?: number | null;
  paragraph_count?: number | null;
  sentence_count?: number | null;
}

export interface DiffDetail {
  index: number;
  change_type: ChangeType;
  old_text?: string | null;
  new_text?: string | null;
  similarity?: number | null;
  old_position?: Record<string, unknown> | null;
  new_position?: Record<string, unknown> | null;
}

export interface ComparisonRiskPoint {
  id: string;
  change_type: ChangeType;
  old_text?: string | null;
  new_text?: string | null;
  similarity?: number | null;
  summary?: string | null;
  risk_level?: RiskLevel | null;
  category?: string | null;
  evidence?: string | null;
  impact?: string | null;
  suggestion?: string | null;
  old_position?: Record<string, unknown> | null;
  new_position?: Record<string, unknown> | null;
  status: RiskStatus;
  ignore_reason?: string | null;
  review_comment?: string | null;
  source?: string;
  created_at?: string | null;
}

export interface ComparisonTask {
  id: string;
  old_file_name: string;
  new_file_name: string;
  old_file_type: string;
  new_file_type: string;
  old_text?: string | null;
  new_text?: string | null;
  old_sanitized_text?: string | null;
  new_sanitized_text?: string | null;
  old_char_count?: number | null;
  new_char_count?: number | null;
  diff_stats?: Record<string, number> | null;
  total_risks: number;
  status: TaskStatus;
  created_at?: string | null;
  completed_at?: string | null;
  risk_count?: number;
  risk_stats?: RiskStats | null;
}

export interface ComparisonDetail {
  success: boolean;
  task: ComparisonTask;
  documents: ComparisonDocument[];
  diff_details: DiffDetail[];
  risk_points: ComparisonRiskPoint[];
  coze_enhanced: unknown[];
  message?: string;
}

export interface ComparisonListResponse {
  tasks: ComparisonTask[];
  total: number;
  skip: number;
  limit: number;
}
