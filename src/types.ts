export type TaskStatus = "pending" | "processing" | "completed" | "failed";
export type RiskLevel = "high" | "medium" | "low";
export type RiskStatus = "pending" | "confirmed" | "ignored";
export type ChangeType = "added" | "deleted" | "modified" | "moved";

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
  sanitization_error?: string | null;
  coze_message?: string | null;
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
  sanitization_error?: string | null;
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
