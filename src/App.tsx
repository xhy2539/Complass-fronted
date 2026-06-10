import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Download,
  FileText,
  FileUp,
  Filter,
  Gauge,
  History,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Trash2,
  XCircle
} from "lucide-react";
import { api, clearSession, downloadBlob, getStoredToken, getStoredUser, setUnauthorizedHandler, storeSession } from "./api";
import {
  applyRiskAppendToText,
  applyRiskInsertionToText,
  applyRiskReplacementToText,
  paragraphsFromText,
  buildComparisonParagraphHighlights,
  buildReviewParagraphHighlights,
  docTextFromReview,
  getComparisonDocumentText,
  getReviewParagraphs,
  isMeaningfulComparisonDiff,
  matchingComparisonRisksForDiff,
  revertRiskAppendInText,
  revertRiskInsertionInText,
  revertRiskReplacementInText,
  splitDocumentText
} from "./reviewDocument";
import { getComparisonAiState, getReviewAiState } from "./taskHealth";
import { Select } from "./components/shared";
import { ComparePage } from "./pages/ComparePage";
import { FeishuAuthPage } from "./pages/FeishuAuthPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LoginPage } from "./pages/LoginPage";
import { ReviewPage } from "./pages/ReviewPage";
import { ReverseCandidateConfirmPage } from "./pages/ReverseCandidateConfirmPage";
import { ReverseTaskCreatePage } from "./pages/ReverseTaskCreatePage";
import { ReverseTaskFailedPage } from "./pages/ReverseTaskFailedPage";
import { ReverseTaskListPage } from "./pages/ReverseTaskListPage";
import { ReverseTaskSuccessPage } from "./pages/ReverseTaskSuccessPage";
import type {
  ChangeType,
  ComparisonDetail,
  ComparisonRiskPoint,
  ComparisonTask,
  DiffDetail,
  ReviewDetail,
  ReviewTask,
  Rule,
  RuleImportResponse,
  RulePayload,
  RuleRiskLevel,
  RiskLevel,
  RiskPoint,
  RiskStatus,
  TaskStatus,
  UserInfo
} from "./types";

type View = "dashboard" | "review" | "compare" | "history" | "rules";
type HistoryMode = "review" | "comparison";
type StatusFilter = "" | TaskStatus;
type LevelFilter = "" | RiskLevel;
type RiskStatusFilter = "" | RiskStatus;
type DiffFilter = "" | ChangeType;
type EnabledFilter = "" | "true" | "false";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = ["docx", "pdf", "txt"];
const RULE_PAGE_SIZE = 20;
const NAV_COLLAPSED_KEY = "complass_nav_collapsed";
const REVIEW_LAST_TASK_KEY = "complass_last_review_task_id";
const COMPARISON_LAST_TASK_KEY = "complass_last_comparison_task_id";
const RULE_CONTRACT_TYPES = ["通用", "采购合同", "服务合同", "合作协议"] as const;

const emptyRuleForm: RulePayload = {
  rule_code: "",
  contract_type: "通用",
  review_module: "",
  risk_name: "",
  check_point: "",
  trigger_condition: "",
  default_risk_level: "中",
  suggestion_template: "",
  example_clause: "",
  enabled: true
};

const statusLabel: Record<TaskStatus, string> = {
  pending: "待处理",
  processing: "处理中",
  completed: "已完成",
  failed: "失败"
};

const riskStatusLabel: Record<RiskStatus, string> = {
  pending: "待处理",
  confirmed: "已确认",
  ignored: "已忽略"
};

const riskLevelLabel: Record<RiskLevel, string> = {
  high: "高风险",
  medium: "中风险",
  low: "低风险"
};

const changeTypeLabel: Record<ChangeType, string> = {
  added: "新增",
  deleted: "删除",
  modified: "修改",
  moved: "移位"
};

function fileSizeLabel(size?: number | null) {
  if (!size) return "--";
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function similarityLabel(value?: number | null) {
  if (typeof value !== "number") return null;
  return `${Math.round(value * (value <= 1 ? 100 : 1))}%`;
}

function formatTime(value?: string | null) {
  if (!value) return "--";
  const normalized = /[+\-]\d{2}:\d{2}$/.test(value) || value.endsWith("Z") ? value : value + "Z";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function getExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function validateContractFile(file: File | null) {
  if (!file) return "请选择文件";
  if (!SUPPORTED_EXTENSIONS.includes(getExtension(file))) return "仅支持 docx、pdf、txt 文件";
  if (file.size > MAX_FILE_SIZE) return "文件不能超过 10MB";
  return "";
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("button, input, textarea, select, a"));
}

function scrollElementInsideNearestScroller(element: HTMLElement) {
  let scroller: HTMLElement | null = element.parentElement;
  while (scroller) {
    const style = window.getComputedStyle(scroller);
    const canScroll = /(auto|scroll)/.test(style.overflowY) && scroller.scrollHeight > scroller.clientHeight;
    if (canScroll) break;
    scroller = scroller.parentElement;
  }

  if (!scroller || scroller === document.body || scroller === document.documentElement) {
    const elementRect = element.getBoundingClientRect();
    const nextTop = window.scrollY + elementRect.top - window.innerHeight / 2 + elementRect.height / 2;
    window.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
    return;
  }

  const elementRect = element.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const nextTop = scroller.scrollTop + elementRect.top - scrollerRect.top - scroller.clientHeight / 2 + elementRect.height / 2;
  scroller.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
}

function Badge({ children, tone = "info", compact = false }: { children: React.ReactNode; tone?: string; compact?: boolean }) {
  return <span className={`badge ${tone} ${compact ? "compact" : ""}`}>{children}</span>;
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{copy}</span>
    </div>
  );
}

function FieldLabel({ title, value }: { title: string; value?: string | number | null }) {
  return (
    <div className="info-pair">
      <span>{title}</span>
      <strong>{value ?? "--"}</strong>
    </div>
  );
}

const viewPath: Record<View, string> = {
  dashboard: "/",
  review: "/review",
  compare: "/compare",
  history: "/history",
  rules: "/rules"
};

function pathToView(pathname: string): View {
  if (pathname.startsWith("/review")) return "review";
  if (pathname.startsWith("/compare")) return "compare";
  if (pathname.startsWith("/history")) return "history";
  if (pathname.startsWith("/rules")) return "rules";
  return "dashboard";
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function safeRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "";
  return value;
}

function buildFeishuLoginUrl(next: string) {
  const base = (API_BASE || "").replace(/\/+$/, "");
  return `${base}/api/v1/auth/feishu/login?next=${encodeURIComponent(next)}`;
}

function loginPathForLocation(pathname: string, search: string) {
  if (pathname === "/login") return "/login";
  return `/login?redirect=${encodeURIComponent(`${pathname}${search}`)}`;
}

function directTaskRoute(pathname: string) {
  const reviewMatch = pathname.match(/^\/reviews\/([^/]+)$/);
  if (reviewMatch) return { type: "review" as const, taskId: decodeURIComponent(reviewMatch[1]) };
  const comparisonMatch = pathname.match(/^\/comparisons\/([^/]+)$/);
  if (comparisonMatch) return { type: "comparison" as const, taskId: decodeURIComponent(comparisonMatch[1]) };
  return null;
}

function FeishuLoginRedirect({ nextPath }: { nextPath: string }) {
  useEffect(() => {
    window.location.assign(buildFeishuLoginUrl(nextPath));
  }, [nextPath]);
  return null;
}

function useRulesWorkspace() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [rulesTotal, setRulesTotal] = useState(0);
  const [rulesSkip, setRulesSkip] = useState(0);
  const [ruleContractFilter, setRuleContractFilter] = useState("");
  const [ruleEnabledFilter, setRuleEnabledFilter] = useState<EnabledFilter>("");
  const [editingRuleId, setEditingRuleId] = useState("");
  const [ruleForm, setRuleForm] = useState<RulePayload>(emptyRuleForm);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleImportFile, setRuleImportFile] = useState<File | null>(null);
  const [ruleImportResult, setRuleImportResult] = useState<RuleImportResponse | null>(null);

  const ruleContractTypes = RULE_CONTRACT_TYPES;
  const rulesEnabledCount = useMemo(() => rules.filter((rule) => rule.enabled).length, [rules]);
  const rulePage = Math.floor(rulesSkip / RULE_PAGE_SIZE) + 1;
  const rulePageCount = Math.max(1, Math.ceil(rulesTotal / RULE_PAGE_SIZE));

  return {
    rules,
    setRules,
    rulesTotal,
    setRulesTotal,
    rulesSkip,
    setRulesSkip,
    ruleContractFilter,
    setRuleContractFilter,
    ruleEnabledFilter,
    setRuleEnabledFilter,
    editingRuleId,
    setEditingRuleId,
    ruleForm,
    setRuleForm,
    showRuleForm,
    setShowRuleForm,
    ruleImportFile,
    setRuleImportFile,
    ruleImportResult,
    setRuleImportResult,
    ruleContractTypes,
    rulesEnabledCount,
    rulePage,
    rulePageCount
  };
}

export function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState(getStoredToken());
  const [user, setUser] = useState<UserInfo | null>(getStoredUser());
  const view = pathToView(location.pathname);
  const rulesSubView = location.pathname.startsWith("/rules/reverse-tasks") ? "reverse" : "library";
  const loginRedirectPath = safeRedirectPath(new URLSearchParams(location.search).get("redirect"));
  const [notice, setNotice] = useState("");
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try {
      return localStorage.getItem(NAV_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const setView = (nextView: View) => {
    setNotice("");
    navigate(viewPath[nextView]);
  };
  const [busyLabels, setBusyLabels] = useState<ReadonlySet<string>>(() => new Set());
  const busyLabelsRef = useRef<Set<string>>(new Set());

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>([]);
  const [comparisonTasks, setComparisonTasks] = useState<ComparisonTask[]>([]);
  const [reviewDetail, setReviewDetail] = useState<ReviewDetail | null>(null);
  const [comparisonDetail, setComparisonDetail] = useState<ComparisonDetail | null>(null);

  const [reviewFile, setReviewFile] = useState<File | null>(null);
  const [reviewLevelFilter, setReviewLevelFilter] = useState<LevelFilter>("");
  const [reviewStatusFilter, setReviewStatusFilter] = useState<RiskStatusFilter>("");
  const [selectedRiskId, setSelectedRiskId] = useState("");
  const [expandedReviewRiskId, setExpandedReviewRiskId] = useState("");
  const [reviewToolbarCollapsed, setReviewToolbarCollapsed] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [ignoreReason, setIgnoreReason] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [appliedRisks, setAppliedRisks] = useState<Set<string>>(new Set());

  const [oldFile, setOldFile] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [diffFilter, setDiffFilter] = useState<DiffFilter>("");
  const [compareLevelFilter, setCompareLevelFilter] = useState<LevelFilter>("");
  const [selectedDiffIndex, setSelectedDiffIndex] = useState<number | null>(null);
  const [expandedDiffIndex, setExpandedDiffIndex] = useState<number | null>(null);
  const [selectedComparisonRiskId, setSelectedComparisonRiskId] = useState("");
  const [expandedComparisonRiskId, setExpandedComparisonRiskId] = useState("");
  const [comparisonComment, setComparisonComment] = useState("");
  const [comparisonIgnoreReason, setComparisonIgnoreReason] = useState("");

  const [historyMode, setHistoryMode] = useState<HistoryMode>("review");
  const [historyStatus, setHistoryStatus] = useState<StatusFilter>("");
  const [historySkip, setHistorySkip] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historySearch, setHistorySearch] = useState("");

  const {
    rules,
    setRules,
    rulesTotal,
    setRulesTotal,
    rulesSkip,
    setRulesSkip,
    ruleContractFilter,
    setRuleContractFilter,
    ruleEnabledFilter,
    setRuleEnabledFilter,
    editingRuleId,
    setEditingRuleId,
    ruleForm,
    setRuleForm,
    showRuleForm,
    setShowRuleForm,
    ruleImportFile,
    setRuleImportFile,
    ruleImportResult,
    setRuleImportResult,
    ruleContractTypes,
    rulesEnabledCount,
    rulePage,
    rulePageCount
  } = useRulesWorkspace();

  const paragraphRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const riskHighlightRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const reviewRiskCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const oldDiffRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const newDiffRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const oldDiffHighlightRefs = useRef<Record<number, HTMLElement | null>>({});
  const newDiffHighlightRefs = useRef<Record<number, HTMLElement | null>>({});
  const ruleImportInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
      setNotice("登录已失效，请重新登录");
      navigate(loginPathForLocation(location.pathname, location.search), { replace: true });
    });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    try {
      localStorage.setItem(NAV_COLLAPSED_KEY, String(navCollapsed));
    } catch {
      // Keep navigation usable if storage is unavailable.
    }
  }, [navCollapsed]);

  useEffect(() => {
    if (token) void refreshLists();
  }, [token]);

  useEffect(() => {
    if (token && view === "rules") void applyRuleFilters();
  }, [token, view, ruleContractFilter, ruleEnabledFilter]);

  useEffect(() => {
    if (!token) return;
    const route = directTaskRoute(location.pathname);
    if (!route) return;
    if (route.type === "review") {
      void withBusy("deep-link", async () => openReview(route.taskId, false)).catch(() => undefined);
      return;
    }
    void withBusy("deep-link", async () => openComparison(route.taskId, false)).catch(() => undefined);
  }, [location.pathname, token]);

  useEffect(() => {
    if (!token || directTaskRoute(location.pathname)) return;
    if (location.pathname !== "/review" && location.pathname !== "/compare") return;

    const reviewTaskId = localStorage.getItem(REVIEW_LAST_TASK_KEY);
    const comparisonTaskId = localStorage.getItem(COMPARISON_LAST_TASK_KEY);

    if (location.pathname === "/review" && !reviewDetail && reviewTaskId) {
      void withBusy("deep-link", async () => openReview(reviewTaskId, false)).catch(() => undefined);
      return;
    }

    if (location.pathname === "/compare" && !comparisonDetail && comparisonTaskId) {
      void withBusy("deep-link", async () => openComparison(comparisonTaskId, false)).catch(() => undefined);
    }
  }, [comparisonDetail, location.pathname, reviewDetail, token]);

  useEffect(() => {
    if (!reviewDetail || !["pending", "processing"].includes(reviewDetail.task.status)) return;
    const timer = window.setInterval(() => {
      openReview(reviewDetail.task.id, false).catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [reviewDetail?.task.id, reviewDetail?.task.status]);

  useEffect(() => {
    if (!comparisonDetail || !["pending", "processing"].includes(comparisonDetail.task.status)) return;
    const timer = window.setInterval(() => {
      openComparison(comparisonDetail.task.id, false).catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [comparisonDetail?.task.id, comparisonDetail?.task.status]);

  const selectedRisk = useMemo(
    () => reviewDetail?.risk_points.find((risk) => risk.id === selectedRiskId) ?? null,
    [reviewDetail, selectedRiskId]
  );

  const selectedComparisonRisk = useMemo(
    () => comparisonDetail?.risk_points.find((risk) => risk.id === selectedComparisonRiskId) ?? null,
    [comparisonDetail, selectedComparisonRiskId]
  );

  const reviewRiskStats = useMemo(() => {
    const risks = reviewDetail?.risk_points ?? [];
    return {
      total: risks.length,
      high: risks.filter((risk) => risk.level === "high").length,
      medium: risks.filter((risk) => risk.level === "medium").length,
      low: risks.filter((risk) => risk.level === "low").length,
      pending: risks.filter((risk) => risk.status === "pending").length
    };
  }, [reviewDetail]);

  const filteredReviewRisks = useMemo(() => {
    return (reviewDetail?.risk_points ?? []).filter((risk) => {
      return (!reviewLevelFilter || risk.level === reviewLevelFilter) && (!reviewStatusFilter || risk.status === reviewStatusFilter);
    });
  }, [reviewDetail, reviewLevelFilter, reviewStatusFilter]);

  const isComparisonFailed = comparisonDetail?.task.status === "failed";
  const meaningfulDiffs = useMemo(() => {
    if (isComparisonFailed) return [];
    return (comparisonDetail?.diff_details ?? []).filter(isMeaningfulComparisonDiff);
  }, [comparisonDetail, isComparisonFailed]);

  const filteredDiffs = useMemo(() => {
    return meaningfulDiffs.filter((diff) => !diffFilter || diff.change_type === diffFilter);
  }, [meaningfulDiffs, diffFilter]);

  const visibleDiffStats = useMemo(
    () => ({
      total: meaningfulDiffs.length,
      added: meaningfulDiffs.filter((diff) => diff.change_type === "added").length,
      deleted: meaningfulDiffs.filter((diff) => diff.change_type === "deleted").length,
      modified: meaningfulDiffs.filter((diff) => diff.change_type === "modified").length
    }),
    [meaningfulDiffs]
  );

  const filteredComparisonRisks = useMemo(() => {
    if (isComparisonFailed) return [];
    return (comparisonDetail?.risk_points ?? []).filter((risk) => !compareLevelFilter || risk.risk_level === compareLevelFilter);
  }, [comparisonDetail, compareLevelFilter, isComparisonFailed]);

  useEffect(() => {
    const visibleRiskIds = new Set(filteredReviewRisks.map((risk) => risk.id));
    if (reviewDetail && selectedRiskId && !visibleRiskIds.has(selectedRiskId)) {
      setSelectedRiskId(filteredReviewRisks[0]?.id || "");
    }
    if (expandedReviewRiskId && !visibleRiskIds.has(expandedReviewRiskId)) {
      setExpandedReviewRiskId("");
    }
  }, [reviewDetail, filteredReviewRisks, selectedRiskId, expandedReviewRiskId]);

  useEffect(() => {
    const diffIndexes = new Set(filteredDiffs.map((diff) => diff.index));
    const visibleRiskIds = new Set(filteredComparisonRisks.map((risk) => risk.id));
    if (selectedDiffIndex !== null && !diffIndexes.has(selectedDiffIndex)) {
      setSelectedDiffIndex(filteredDiffs[0]?.index ?? null);
    }
    if (expandedDiffIndex !== null && !diffIndexes.has(expandedDiffIndex)) {
      setExpandedDiffIndex(null);
    }
    if (comparisonDetail && selectedComparisonRiskId && !visibleRiskIds.has(selectedComparisonRiskId)) {
      setSelectedComparisonRiskId(filteredComparisonRisks[0]?.id || "");
    }
    if (expandedComparisonRiskId && !visibleRiskIds.has(expandedComparisonRiskId)) {
      setExpandedComparisonRiskId("");
    }
  }, [comparisonDetail, filteredDiffs, filteredComparisonRisks, selectedDiffIndex, expandedDiffIndex, selectedComparisonRiskId, expandedComparisonRiskId]);

  const oldDocument = comparisonDetail?.documents.find((doc) => doc.version === "old");
  const newDocument = comparisonDetail?.documents.find((doc) => doc.version === "new");
  const oldDocumentText = getComparisonDocumentText(comparisonDetail, "old");
  const newDocumentText = getComparisonDocumentText(comparisonDetail, "new");
  const comparisonRisks = comparisonDetail?.risk_points ?? [];
  const oldComparisonHighlights = useMemo(
    () => buildComparisonParagraphHighlights(splitDocumentText(oldDocumentText), meaningfulDiffs, "old", comparisonRisks),
    [oldDocumentText, meaningfulDiffs, comparisonRisks]
  );
  const newComparisonHighlights = useMemo(
    () => buildComparisonParagraphHighlights(splitDocumentText(newDocumentText), meaningfulDiffs, "new", comparisonRisks),
    [newDocumentText, meaningfulDiffs, comparisonRisks]
  );
  const busy = (label: string) => busyLabels.has(label);

  function setBusyLabel(label: string, active: boolean) {
    const nextLabels = new Set(busyLabelsRef.current);
    if (active) nextLabels.add(label);
    else nextLabels.delete(label);
    busyLabelsRef.current = nextLabels;
    setBusyLabels(nextLabels);
  }

  async function withBusy<T>(label: string, action: () => Promise<T>) {
    if (busyLabelsRef.current.has(label)) return undefined;
    setBusyLabel(label, true);
    setNotice("");
    try {
      return await action();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "操作失败");
      throw error;
    } finally {
      setBusyLabel(label, false);
    }
  }

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    if (!authEmail || !authPassword || (authMode === "register" && (!authName || !authPhone))) {
      setNotice("请完整填写账号信息");
      return;
    }
    if (authMode === "register" && !authEmail.trim().includes("@")) {
      setNotice("注册需要填写邮箱地址，手机号请填写在手机号栏");
      return;
    }
    await withBusy("auth", async () => {
      const auth =
        authMode === "login"
          ? await api.login(authEmail.trim(), authPassword)
          : await api.register(authEmail.trim(), authPhone.trim(), authName.trim(), authPassword);
      storeSession(auth);
      setToken(auth.access_token);
      setUser(auth.user);
      setNotice("");
      if (loginRedirectPath) {
        navigate(loginRedirectPath, { replace: true });
      } else {
        setView("dashboard");
      }
    }).catch(() => undefined);
  }

  function logout() {
    clearSession();
    setToken(null);
    setUser(null);
    setReviewDetail(null);
    setComparisonDetail(null);
    navigate("/login", { replace: true });
  }

  async function refreshLists() {
    await withBusy("lists", async () => {
      const [reviews, comparisons] = await Promise.all([api.listReviews("", 0, 8), api.listComparisons("", 0, 8)]);
      setReviewTasks(reviews.tasks);
      setComparisonTasks(comparisons.tasks);
    }).catch(() => undefined);
  }

  async function uploadReview() {
    const validation = validateContractFile(reviewFile);
    if (validation) {
      setNotice(validation);
      return;
    }
    await withBusy("review-upload", async () => {
      const result = await api.createReview(reviewFile!, true);
      await openReview(result.task_id, true);
      await refreshLists();
    }).catch(() => undefined);
  }

  async function openReview(taskId: string, navigate = true) {
    const data = await api.getReview(taskId);
    setReviewDetail(data);
    setReviewText((current) => (data.task.id === reviewDetail?.task.id && current ? current : docTextFromReview(data)));
    setSelectedRiskId((current) => (data.risk_points.some((risk) => risk.id === current) ? current : data.risk_points[0]?.id || ""));
    setExpandedReviewRiskId((current) => (data.risk_points.some((risk) => risk.id === current) ? current : ""));
    setReviewToolbarCollapsed(false);
    localStorage.setItem(REVIEW_LAST_TASK_KEY, taskId);
    if (navigate) setView("review");
  }

  async function uploadComparison() {
    const oldValidation = validateContractFile(oldFile);
    const newValidation = validateContractFile(newFile);
    if (oldValidation || newValidation) {
      setNotice(oldValidation || newValidation);
      return;
    }
    await withBusy("comparison-upload", async () => {
      const result = await api.createComparison(oldFile!, newFile!, true);
      await openComparison(result.task_id, true);
      await refreshLists();
    }).catch(() => undefined);
  }

  async function openComparison(taskId: string, navigate = true) {
    const data = await api.getComparison(taskId);
    const nextMeaningfulDiffs = data.diff_details.filter(isMeaningfulComparisonDiff);
    setComparisonDetail(data);
    setSelectedDiffIndex((current) => (nextMeaningfulDiffs.some((diff) => diff.index === current) ? current : nextMeaningfulDiffs[0]?.index ?? null));
    setExpandedDiffIndex((current) => (nextMeaningfulDiffs.some((diff) => diff.index === current) ? current : null));
    setSelectedComparisonRiskId((current) => (data.risk_points.some((risk) => risk.id === current) ? current : data.risk_points[0]?.id || ""));
    setExpandedComparisonRiskId((current) => (data.risk_points.some((risk) => risk.id === current) ? current : ""));
    localStorage.setItem(COMPARISON_LAST_TASK_KEY, taskId);
    if (navigate) setView("compare");
  }

  function scrollToRisk(risk: RiskPoint) {
    setSelectedRiskId(risk.id);
    setReviewToolbarCollapsed(false);
    const paragraphs = getReviewParagraphs(reviewDetail, reviewText);
    const locations = buildReviewParagraphHighlights(paragraphs, reviewDetail?.risk_points ?? [], appliedRisks).locations;
    const location = locations[risk.id];
    window.setTimeout(() => {
      const highlight = riskHighlightRefs.current[risk.id];
      if (location?.status === "matched") {
        if (highlight) {
          highlight.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (location.paragraphIndex !== null) {
          paragraphRefs.current[location.paragraphIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } else if (location?.status === "fallback" && location.paragraphIndex !== null) {
        paragraphRefs.current[location.paragraphIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 20);
  }

  function selectRiskFromText(riskId: string) {
    setSelectedRiskId(riskId);
    setReviewToolbarCollapsed(false);
    setExpandedReviewRiskId(riskId);
    window.setTimeout(() => reviewRiskCardRefs.current[riskId]?.scrollIntoView({ behavior: "smooth", block: "center" }), 20);
  }

  function toggleReviewRiskDetail(risk: RiskPoint) {
    setSelectedRiskId(risk.id);
    setReviewToolbarCollapsed(false);
    setExpandedReviewRiskId((current) => (current === risk.id ? "" : risk.id));
    window.setTimeout(() => reviewRiskCardRefs.current[risk.id]?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 20);
  }

  function scrollToDiff(diff: DiffDetail, side?: "old" | "new") {
    setSelectedDiffIndex(diff.index);
    if (!side && diff.change_type === "moved") return;

    const scrollSide = (targetSide: "old" | "new") => {
      const highlights = targetSide === "old" ? oldComparisonHighlights : newComparisonHighlights;
      const refs = targetSide === "old" ? oldDiffRefs : newDiffRefs;
      const highlightRefs = targetSide === "old" ? oldDiffHighlightRefs : newDiffHighlightRefs;
      const location = highlights.locations[diff.index]?.[targetSide];
      if (location?.paragraphIndex === null || location?.paragraphIndex === undefined || location.status === "missing") return;
      const target =
        document.querySelector<HTMLElement>(`mark.diff-highlight[data-side="${targetSide}"][data-diff-index="${diff.index}"]`) ??
        highlightRefs.current[diff.index] ??
        refs.current[location.paragraphIndex];
      if (target) scrollElementInsideNearestScroller(target);
    };

    window.setTimeout(() => {
      if (side) {
        scrollSide(side);
        return;
      }
      scrollSide("old");
      scrollSide("new");
    }, 80);
  }

  function toggleDiffDetail(diff: DiffDetail) {
    setExpandedDiffIndex((current) => (current === diff.index ? null : diff.index));
  }

  function toggleComparisonRiskDetail(risk: ComparisonRiskPoint) {
    setSelectedComparisonRiskId(risk.id);
    setExpandedComparisonRiskId((current) => (current === risk.id ? "" : risk.id));
  }

  function findComparisonRiskDiff(risk: ComparisonRiskPoint) {
    return meaningfulDiffs.find((diff) => matchingComparisonRisksForDiff(diff, [risk]).length > 0) ?? null;
  }

  function selectComparisonRisk(risk: ComparisonRiskPoint) {
    setSelectedComparisonRiskId(risk.id);
    const matched = findComparisonRiskDiff(risk);
    if (matched) scrollToDiff(matched);
  }

  async function updateReviewRisk(status: RiskStatus, risk = selectedRisk) {
    if (!risk) return;
    await withBusy(`review-risk-${status}`, async () => {
      await api.updateRiskStatus(risk.id, status, reviewComment, status === "ignored" ? ignoreReason : undefined);
      if (reviewDetail) await openReview(reviewDetail.task.id, false);
      setReviewComment("");
      setIgnoreReason("");
    }).catch(() => undefined);
  }

  async function updateComparisonRisk(status: RiskStatus, risk = selectedComparisonRisk) {
    if (!risk) return;
    await withBusy(`comparison-risk-${status}`, async () => {
      await api.updateRiskStatus(risk.id, status, comparisonComment, status === "ignored" ? comparisonIgnoreReason : undefined);
      if (comparisonDetail) await openComparison(comparisonDetail.task.id, false);
      setComparisonComment("");
      setComparisonIgnoreReason("");
    }).catch(() => undefined);
  }

  /** 从当前 reviewText 重新分段落，确保 apply/revoke 与修改后的文本一致。 */
  function getParagraphsForOperation() {
    return paragraphsFromText(reviewText);
  }

  function applyRiskSuggestion(risk = selectedRisk) {
    if (!risk?.replace_text) return;
    const actionType = risk?.action_type ?? "manual";
    const paragraphs = getParagraphsForOperation();
    let nextText: string | null = null;
    if (actionType === "insert") {
      nextText = applyRiskInsertionToText(reviewText, risk, paragraphs);
    } else {
      nextText = applyRiskReplacementToText(reviewText, risk, paragraphs);
    }
    if (!nextText) {
      setNotice("无法定位原文位置，请手动处理此风险点");
      return;
    }
    setReviewText(nextText);
    setAppliedRisks((current) => new Set(current).add(risk.id));
  }

  function revokeRiskSuggestion(risk = selectedRisk) {
    if (!risk) return;
    const actionType = risk?.action_type ?? "manual";
    const paragraphs = getParagraphsForOperation();
    let nextText: string | null = null;
    if (actionType === "insert") {
      nextText = revertRiskInsertionInText(reviewText, risk, paragraphs);
    } else {
      nextText = revertRiskReplacementInText(reviewText, risk, paragraphs);
    }
    if (!nextText) {
      setNotice("撤回失败，原文已被其他修改覆盖，请手动处理");
      return;
    }
    setReviewText(nextText);
    setAppliedRisks((current) => {
      const next = new Set(current);
      next.delete(risk.id);
      return next;
    });
  }

  async function exportReview() {
    if (!reviewDetail) return;
    await withBusy("export", async () => {
      const name = `${reviewDetail.task.file_name.replace(/\.[^.]+$/, "")}_修改版.docx`;
      const blob = await api.exportReview(reviewDetail.task.id, reviewText || docTextFromReview(reviewDetail), name);
      downloadBlob(blob, name);
    }).catch(() => undefined);
  }

  async function deleteReviewTask(taskId: string) {
    await withBusy(`delete-review-${taskId}`, async () => {
      await api.deleteReview(taskId);
      await loadHistory(historySkip, historySearch);
    }).catch(() => undefined);
  }

  async function deleteComparisonTask(taskId: string) {
    await withBusy(`delete-comparison-${taskId}`, async () => {
      await api.deleteComparison(taskId);
      await loadHistory(historySkip, historySearch);
    }).catch(() => undefined);
  }

  async function loadHistory(nextSkip = 0, searchText = "") {
    await withBusy("history", async () => {
      const isSearching = searchText.trim() !== "";
      const keyword = searchText.trim().toLowerCase();

      if (historyMode === "review") {
        if (isSearching) {
          const data = await api.listReviews(historyStatus, 0, 10000);
          const filtered = data.tasks.filter((t) => t.file_name.toLowerCase().includes(keyword));
          setReviewTasks(filtered.slice(nextSkip, nextSkip + 20));
          setHistorySkip(nextSkip);
          setHistoryTotal(filtered.length);
        } else {
          const data = await api.listReviews(historyStatus, nextSkip, 20);
          setReviewTasks(data.tasks);
          setHistorySkip(data.skip ?? nextSkip);
          setHistoryTotal(data.total ?? 0);
        }
      } else {
        if (isSearching) {
          const data = await api.listComparisons(historyStatus, 0, 10000);
          const filtered = data.tasks.filter(
            (t) =>
              t.old_file_name.toLowerCase().includes(keyword) ||
              t.new_file_name.toLowerCase().includes(keyword)
          );
          setComparisonTasks(filtered.slice(nextSkip, nextSkip + 20));
          setHistorySkip(nextSkip);
          setHistoryTotal(filtered.length);
        } else {
          const data = await api.listComparisons(historyStatus, nextSkip, 20);
          setComparisonTasks(data.tasks);
          setHistorySkip(data.skip ?? nextSkip);
          setHistoryTotal(data.total ?? 0);
        }
      }
    }).catch(() => undefined);
  }

  async function goHistoryPage(direction: -1 | 1) {
    const nextSkip = Math.max(
      0,
      Math.min(Math.max(0, historyTotal - 1), historySkip + direction * 20)
    );
    await loadHistory(nextSkip, historySearch);
  }

  async function loadRules(nextSkip = rulesSkip) {
    await withBusy("rules-load", async () => {
      const data = await api.listRules({
        skip: nextSkip,
        limit: RULE_PAGE_SIZE,
        contract_type: ruleContractFilter.trim(),
        enabled: ruleEnabledFilter === "" ? "" : ruleEnabledFilter === "true"
      });
      setRules(data.rules);
      setRulesTotal(data.total ?? data.rules.length);
      setRulesSkip(data.skip ?? nextSkip);
    }).catch(() => undefined);
  }

  function resetRuleForm() {
    setEditingRuleId("");
    setRuleForm(emptyRuleForm);
    setShowRuleForm(true);
  }

  function editRule(rule: Rule) {
    setEditingRuleId(rule.id);
    setRuleForm({
      rule_code: rule.rule_code,
      contract_type: rule.contract_type,
      review_module: rule.review_module,
      risk_name: rule.risk_name,
      check_point: rule.check_point ?? "",
      trigger_condition: rule.trigger_condition ?? "",
      default_risk_level: rule.default_risk_level,
      suggestion_template: rule.suggestion_template ?? "",
      example_clause: rule.example_clause ?? "",
      enabled: Boolean(rule.enabled)
    });
    setShowRuleForm(true);
  }

  function updateRuleForm<K extends keyof RulePayload>(key: K, value: RulePayload[K]) {
    setRuleForm((current) => ({ ...current, [key]: value }));
  }

  function validateRuleForm() {
    if (!ruleForm.rule_code.trim()) return "请填写规则编号";
    if (!ruleForm.contract_type.trim()) return "请填写合同类型";
    if (!ruleForm.review_module.trim()) return "请填写审核模块";
    if (!ruleForm.risk_name.trim()) return "请填写风险名称";
    if (!ruleForm.default_risk_level) return "请选择默认风险等级";
    return "";
  }

  function normalizeRulePayload(): RulePayload {
    return {
      ...ruleForm,
      rule_code: ruleForm.rule_code.trim(),
      contract_type: ruleForm.contract_type.trim(),
      review_module: ruleForm.review_module.trim(),
      risk_name: ruleForm.risk_name.trim(),
      check_point: ruleForm.check_point?.trim() || "",
      trigger_condition: ruleForm.trigger_condition?.trim() || "",
      suggestion_template: ruleForm.suggestion_template?.trim() || "",
      example_clause: ruleForm.example_clause?.trim() || ""
    };
  }

  async function submitRuleForm(event: FormEvent) {
    event.preventDefault();
    const validation = validateRuleForm();
    if (validation) {
      setNotice(validation);
      return;
    }
    await withBusy("rule-save", async () => {
      const payload = normalizeRulePayload();
      if (editingRuleId) await api.updateRule(editingRuleId, payload);
      else await api.createRule(payload);
      setShowRuleForm(false);
      setEditingRuleId("");
      setRuleForm(emptyRuleForm);
      await loadRules();
    }).catch(() => undefined);
  }

  async function toggleRuleEnabled(rule: Rule) {
    await withBusy(`rule-enable-${rule.id}`, async () => {
      await api.setRuleEnabled(rule.id, !rule.enabled);
      await loadRules();
    }).catch(() => undefined);
  }

  async function deleteRule(rule: Rule) {
    if (!window.confirm(`确认删除规则 ${rule.rule_code}？`)) return;
    await withBusy(`rule-delete-${rule.id}`, async () => {
      await api.deleteRule(rule.id);
      const nextSkip = rules.length === 1 && rulesSkip > 0 ? Math.max(0, rulesSkip - RULE_PAGE_SIZE) : rulesSkip;
      await loadRules(nextSkip);
    }).catch(() => undefined);
  }

  async function importRulesCsvFile(file: File | null) {
    if (!file) {
      setNotice("请选择规则 CSV 文件");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setNotice("仅支持 CSV 文件");
      return;
    }
    await withBusy("rule-import", async () => {
      const result = await api.importRulesCsv(file);
      setRuleImportResult(result);
      setRuleImportFile(null);
      await loadRules(0);
    }).catch(() => undefined);
  }

  async function importRulesCsv() {
    await importRulesCsvFile(ruleImportFile);
  }

  async function applyRuleFilters() {
    setRulesSkip(0);
    await loadRules(0);
  }

  async function clearRuleFilters() {
    setRuleContractFilter("");
    setRuleEnabledFilter("");
    setRulesSkip(0);
    await withBusy("rules-load", async () => {
      const data = await api.listRules({ skip: 0, limit: RULE_PAGE_SIZE });
      setRules(data.rules);
      setRulesTotal(data.total ?? data.rules.length);
      setRulesSkip(data.skip ?? 0);
    }).catch(() => undefined);
  }

  async function goRulePage(direction: -1 | 1) {
    const nextSkip = Math.max(0, Math.min(Math.max(0, rulesTotal - 1), rulesSkip + direction * RULE_PAGE_SIZE));
    await loadRules(nextSkip);
  }

  if (!token) {
    const deepLink = directTaskRoute(location.pathname);
    const nextPath = `${location.pathname}${location.search}`;
    return (
      <Routes>
        {deepLink ? <Route path="*" element={<FeishuLoginRedirect nextPath={nextPath} />} /> : null}
        <Route
          path="/login"
          element={
            <LoginPage
              authMode={authMode}
              authEmail={authEmail}
              authPhone={authPhone}
              authName={authName}
              authPassword={authPassword}
              notice={notice}
              busy={busy}
              handleAuth={handleAuth}
              setAuthEmail={setAuthEmail}
              setAuthPhone={setAuthPhone}
              setAuthName={setAuthName}
              setAuthPassword={setAuthPassword}
              setAuthMode={setAuthMode}
            />
          }
        />
        <Route path="/auth/feishu" element={<FeishuAuthPage />} />
        <Route path="*" element={<Navigate to={loginPathForLocation(location.pathname, location.search)} replace />} />
      </Routes>
    );
  }

  const pageProps = {
    reviewDetail,
    reviewText,
    appliedRisks,
    selectedRisk,
    selectedRiskId,
    reviewToolbarCollapsed,
    reviewFile,
    busy,
    reviewRiskStats,
    reviewLevelFilter,
    reviewStatusFilter,
    filteredReviewRisks,
    expandedReviewRiskId,
    reviewComment,
    ignoreReason,
    paragraphRefs,
    riskHighlightRefs,
    reviewRiskCardRefs,
    setReviewFile,
    uploadReview,
    setReviewLevelFilter,
    setReviewStatusFilter,
    exportReview,
    setReviewToolbarCollapsed,
    applyRiskSuggestion,
    revokeRiskSuggestion,
    updateReviewRisk,
    selectRiskFromText,
    scrollToRisk,
    toggleReviewRiskDetail,
    setReviewComment,
    setIgnoreReason,
    setReviewText,
    comparisonDetail,
    oldDocument,
    newDocument,
    oldComparisonHighlights,
    newComparisonHighlights,
    selectedDiffIndex,
    oldDiffRefs,
    oldDiffHighlightRefs,
    newDiffRefs,
    newDiffHighlightRefs,
    filteredDiffs,
    expandedDiffIndex,
    comparisonRisks,
    filteredComparisonRisks,
    selectedComparisonRiskId,
    expandedComparisonRiskId,
    comparisonComment,
    comparisonIgnoreReason,
    oldFile,
    newFile,
    visibleDiffStats,
    diffFilter,
    compareLevelFilter,
    setOldFile,
    setNewFile,
    uploadComparison,
    setDiffFilter,
    setCompareLevelFilter,
    setSelectedDiffIndex,
    scrollToDiff,
    toggleDiffDetail,
    findComparisonRiskDiff,
    selectComparisonRisk,
    toggleComparisonRiskDetail,
    setComparisonComment,
    setComparisonIgnoreReason,
    updateComparisonRisk,
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
    openComparison,
    deleteReviewTask,
    deleteComparisonTask
  };

  return (
    <main className={`app-shell ${navCollapsed ? "nav-collapsed" : ""}`}>
      <aside className={`app-nav ${navCollapsed ? "collapsed" : ""}`}>
        <div className="nav-brand-row">
          <div className="nav-brand">
            <div className="brand-mark small">
              <Scale size={22} />
            </div>
            <div className="nav-brand-copy">
              <strong>合规罗盘</strong>
              <span>合同审查工作台</span>
            </div>
          </div>
          <button
            aria-label={navCollapsed ? "展开侧边栏" : "收起侧边栏"}
            className="nav-toggle"
            onClick={() => setNavCollapsed((current) => !current)}
            title={navCollapsed ? "展开侧边栏" : "收起侧边栏"}
            type="button"
          >
            {navCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <nav className="nav-list">
          <button aria-label="总览" className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")} title="总览">
            <Gauge size={18} />
            <span className="nav-item-label">总览</span>
          </button>
          <button aria-label="单合同审查" className={view === "review" ? "active" : ""} onClick={() => setView("review")} title="单合同审查">
            <FileText size={18} />
            <span className="nav-item-label">单合同审查</span>
          </button>
          <button aria-label="版本比对" className={view === "compare" ? "active" : ""} onClick={() => setView("compare")} title="版本比对">
            <Scale size={18} />
            <span className="nav-item-label">版本比对</span>
          </button>
          <button aria-label="历史任务" className={view === "history" ? "active" : ""} onClick={() => setView("history")} title="历史任务">
            <History size={18} />
            <span className="nav-item-label">历史任务</span>
          </button>
          <button aria-label="规则处理" className={view === "rules" ? "active" : ""} onClick={() => setView("rules")} title="规则处理">
            <BookOpenCheck size={18} />
            <span className="nav-item-label">规则处理</span>
          </button>
          {view === "rules" && (
            <div className="rules-subnav" aria-label="规则处理二级导航">
              <button
                aria-label="规则库"
                className={rulesSubView === "library" ? "active" : ""}
                onClick={() => navigate("/rules")}
                title="规则库"
                type="button"
              >
                <span className="rules-subnav-dot" />
                <span className="nav-item-label">规则库</span>
              </button>
              <button
                aria-label="逆向解析规则"
                className={rulesSubView === "reverse" ? "active" : ""}
                onClick={() => navigate("/rules/reverse-tasks")}
                title="逆向解析规则"
                type="button"
              >
                <span className="rules-subnav-dot" />
                <span className="nav-item-label">逆向解析规则</span>
              </button>
            </div>
          )}
        </nav>
        <div className="nav-user">
          <span className="nav-user-label">{user?.nickname || user?.email}</span>
          <button aria-label="退出" className="ghost-action inline" onClick={logout} title="退出">
            <LogOut size={16} />
            <span className="nav-user-action-label">退出</span>
          </button>
        </div>
      </aside>

      <section className="page-frame">
        {notice && (
          <div className="notice-panel warning top-notice">
            <AlertTriangle size={16} />
            {notice}
          </div>
        )}
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/" element={renderDashboard()} />
          <Route path="/review" element={<ReviewPage {...pageProps} />} />
          <Route path="/reviews/:taskId" element={<ReviewPage {...pageProps} />} />
          <Route path="/compare" element={<ComparePage {...pageProps} />} />
          <Route path="/comparisons/:taskId" element={<ComparePage {...pageProps} />} />
          <Route path="/history" element={<HistoryPage {...pageProps} />} />
          <Route path="/rules" element={renderRules()} />
          <Route path="/rules/reverse-tasks" element={<ReverseTaskListPage />} />
          <Route path="/rules/reverse-tasks/new" element={<ReverseTaskCreatePage />} />
          <Route path="/rules/reverse-tasks/:taskId/progress" element={<Navigate to="/rules/reverse-tasks" replace />} />
          <Route path="/rules/reverse-tasks/:taskId/confirm" element={<ReverseCandidateConfirmPage />} />
          <Route path="/rules/reverse-tasks/:taskId/failed" element={<ReverseTaskFailedPage />} />
          <Route path="/rules/reverse-tasks/:taskId/success" element={<ReverseTaskSuccessPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </section>
    </main>
  );

  function renderDashboard() {
    return (
      <div className="dashboard dashboard-workbench">
        <section className="dashboard-hero panel-surface">
          <div className="dashboard-intro">
            <p className="eyebrow">欢迎使用</p>
            <h1>合规罗盘</h1>
            <p>围绕合同文本、风险点、版本差异和人工确认的工作流，保持双栏/三栏审查体验。</p>
            <div className="launcher-actions">
              <button className="primary-action large" onClick={() => setView("review")}>
                <FileText size={18} />
                <span>开始单合同审查</span>
              </button>
              <button className="ghost-action large" onClick={() => setView("compare")}>
                <Scale size={18} />
                <span>创建版本比对</span>
              </button>
            </div>
          </div>
        </section>

        <section className="dashboard-main-grid">
          <article className="dashboard-recent-card panel-surface">
            <div className="dashboard-recent-head">
              <div>
                <FileText size={20} />
                <h2>最近审查</h2>
              </div>
              <button
                className="dashboard-view-all"
                onClick={() => {
                  setHistoryMode("review");
                  setView("history");
                }}
                type="button"
              >
                查看全部
              </button>
            </div>
            <div className="recent-list">
              {reviewTasks.slice(0, 5).map((task) => (
                <button className="recent-item dashboard-recent-item" key={task.id} onClick={() => void openReview(task.id)} type="button">
                  <span className="dashboard-file-icon word">W</span>
                  <span className="dashboard-recent-copy">
                    <strong className="recent-file-name">{task.file_name}</strong>
                    <small>{formatTime(task.created_at)}</small>
                  </span>
                  <Badge tone={`status-${task.status}`}>{statusLabel[task.status]}</Badge>
                  <ChevronRight className="dashboard-row-arrow" size={18} />
                </button>
              ))}
              {reviewTasks.length === 0 && <EmptyState title="暂无审查任务" copy="完成任务后会显示最近记录。" />}
            </div>
          </article>

          <article className="dashboard-recent-card panel-surface">
            <div className="dashboard-recent-head">
              <div>
                <FileText size={20} />
                <h2>最近比对</h2>
              </div>
              <button
                className="dashboard-view-all"
                onClick={() => {
                  setHistoryMode("comparison");
                  setView("history");
                }}
                type="button"
              >
                查看全部
              </button>
            </div>
            <div className="recent-list">
              {comparisonTasks.slice(0, 5).map((task) => (
                <button className="recent-item dashboard-recent-item recent-comparison-item" key={task.id} onClick={() => void openComparison(task.id)} type="button">
                  <span className="dashboard-file-icon compare">
                    <Scale size={17} />
                  </span>
                  <span className="dashboard-recent-copy">
                    <strong className="recent-file-name">{task.old_file_name} / {task.new_file_name}</strong>
                    <small>{formatTime(task.created_at)}</small>
                  </span>
                  <Badge tone={`status-${task.status}`}>{statusLabel[task.status]}</Badge>
                  <ChevronRight className="dashboard-row-arrow" size={18} />
                </button>
              ))}
              {comparisonTasks.length === 0 && <EmptyState title="暂无比对任务" copy="完成任务后会显示最近记录。" />}
            </div>
          </article>
        </section>
      </div>
    );
  }

  

  

  function DocumentPane({
    title,
    highlights,
    side
  }: {
    title: string;
    highlights: ReturnType<typeof buildComparisonParagraphHighlights>;
    side: "old" | "new";
  }) {
    return (
      <article className="document-pane panel-surface">
        <div className="document-head">
          <h2>{title}</h2>
          <p className="panel-subtitle">{side === "old" ? "旧版文本" : "新版文本"}</p>
        </div>
        <div className="document-scroll">
          {highlights.paragraphs.length === 0 && <EmptyState title="暂无文本" copy="后端详情未返回该版本全文。" />}
          {highlights.paragraphs.map(({ paragraph, tokens }) => {
            const isActive = tokens.some((token) => token.type === "diff" && token.diffIndex === selectedDiffIndex);
            return (
              <div
                className={`contract-paragraph ${isActive ? "active" : ""}`}
                key={`${side}-${paragraph.index}`}
                ref={(node) => {
                  if (side === "old") oldDiffRefs.current[paragraph.index] = node;
                  else newDiffRefs.current[paragraph.index] = node;
                }}
              >
                <p>
                  {tokens.map((token, index) => {
                    if (token.type === "text") return <span key={`${side}-${paragraph.index}-text-${index}`}>{token.text}</span>;
                    const tokenActive = token.diffIndex === selectedDiffIndex;
                    return (
                      <mark
                        className={`diff-highlight type-${token.changeType} ${tokenActive ? "active" : ""} ${token.riskLevel ? `risk-level-${token.riskLevel}` : ""}`}
                        data-diff-index={token.diffIndex}
                        data-side={side}
                        key={`${side}-${paragraph.index}-diff-${token.diffIndex}-${index}`}
                        onClick={() => setSelectedDiffIndex(token.diffIndex)}
                        ref={(node) => {
                          if (side === "old") oldDiffHighlightRefs.current[token.diffIndex] = node;
                          else newDiffHighlightRefs.current[token.diffIndex] = node;
                        }}
                      >
                        {token.text}
                      </mark>
                    );
                  })}
                </p>
              </div>
            );
          })}
        </div>
      </article>
    );
  }

  

  function renderRules() {
    return (
      <div className="work-page rules-page">
        <section className="compare-toolbar panel-surface rules-toolbar">
          <div className="toolbar-controls">
            <Select value={ruleContractFilter} onChange={(value) => setRuleContractFilter(value)} label="合同类型">
              <option value="">全部合同类型</option>
              {ruleContractTypes.map((type) => (
                <option value={type} key={type}>
                  {type}
                </option>
              ))}
            </Select>
            <Select value={ruleEnabledFilter} onChange={(value) => setRuleEnabledFilter(value as EnabledFilter)} label="启用状态">
              <option value="">全部状态</option>
              <option value="true">启用</option>
              <option value="false">停用</option>
            </Select>
            <button className="ghost-action inline" onClick={() => void applyRuleFilters()}>
              <Filter size={16} />
              筛选
            </button>
          </div>
          {ruleImportResult && (
            <div className="rule-import-result">
              <strong>{ruleImportResult.success ? "导入完成" : "导入失败"}</strong>
              <span>
                V{ruleImportResult.version_no ?? "--"} / {ruleImportResult.imported_count ?? 0} 条
              </span>
              {(ruleImportResult.errors ?? []).length > 0 && (
                <div className="rule-import-errors">
                  {(ruleImportResult.errors ?? []).map((error, index) => (
                    <small key={`${error.row}-${error.field}-${index}`}>
                      第 {error.row ?? "--"} 行 {error.field ?? "字段"}：{error.reason || error.message || "导入失败"}
                    </small>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {showRuleForm && (
          <div className="rule-modal-backdrop" role="presentation" onMouseDown={() => setShowRuleForm(false)}>
            <form
              className="rule-form-modal panel-surface"
              role="dialog"
              aria-modal="true"
              aria-labelledby="rule-form-title"
              onMouseDown={(event) => event.stopPropagation()}
              onSubmit={submitRuleForm}
            >
                <div className="panel-head">
                  <div>
                    <p className="section-label">{editingRuleId ? "EDIT RULE" : "CREATE RULE"}</p>
                    <h2 id="rule-form-title">{editingRuleId ? "编辑规则" : "新建规则"}</h2>
                  </div>
                  <button className="icon-action" type="button" onClick={() => setShowRuleForm(false)} title="关闭">
                    <XCircle size={16} />
                  </button>
                </div>
                <div className="rule-form-grid">
                  <label className="field-block">
                    规则编号
                    <input value={ruleForm.rule_code} onChange={(event) => updateRuleForm("rule_code", event.target.value)} placeholder="COM-FIN-001" />
                  </label>
                  <label className="field-block">
                    合同类型
                    <input value={ruleForm.contract_type} onChange={(event) => updateRuleForm("contract_type", event.target.value)} placeholder="通用" />
                  </label>
                  <label className="field-block">
                    审核模块
                    <input value={ruleForm.review_module} onChange={(event) => updateRuleForm("review_module", event.target.value)} placeholder="财务 / 法务 / 履约" />
                  </label>
                  <label className="field-block">
                    风险名称
                    <input value={ruleForm.risk_name} onChange={(event) => updateRuleForm("risk_name", event.target.value)} placeholder="合同金额不明确" />
                  </label>
                  <label className="field-block">
                    默认风险等级
                    <select value={ruleForm.default_risk_level} onChange={(event) => updateRuleForm("default_risk_level", event.target.value as RuleRiskLevel)}>
                      <option value="高">高</option>
                      <option value="中">中</option>
                      <option value="低">低</option>
                    </select>
                  </label>
                  <label className="rule-toggle field-block">
                    启用状态
                    <span>
                      <input type="checkbox" checked={ruleForm.enabled} onChange={(event) => updateRuleForm("enabled", event.target.checked)} />
                      {ruleForm.enabled ? "启用" : "停用"}
                    </span>
                  </label>
                  <label className="field-block wide">
                    检查点
                    <textarea value={ruleForm.check_point ?? ""} onChange={(event) => updateRuleForm("check_point", event.target.value)} placeholder="说明审查时需要检查什么" />
                  </label>
                  <label className="field-block wide">
                    触发条件
                    <textarea value={ruleForm.trigger_condition ?? ""} onChange={(event) => updateRuleForm("trigger_condition", event.target.value)} placeholder="说明什么情况下命中风险" />
                  </label>
                  <label className="field-block wide">
                    建议模板
                    <textarea value={ruleForm.suggestion_template ?? ""} onChange={(event) => updateRuleForm("suggestion_template", event.target.value)} placeholder="给出修订建议模板" />
                  </label>
                  <label className="field-block wide">
                    示例条款
                    <textarea value={ruleForm.example_clause ?? ""} onChange={(event) => updateRuleForm("example_clause", event.target.value)} placeholder="示例问题条款或参考条款" />
                  </label>
                </div>
                <div className="rule-form-actions">
                  <button className="ghost-action" type="button" onClick={() => setShowRuleForm(false)}>
                    取消
                  </button>
                  <button className="primary-action" disabled={busy("rule-save")}>
                    {busy("rule-save") ? <RefreshCw className="spin" size={16} /> : <CheckCircle2 size={16} />}
                    {editingRuleId ? "保存规则" : "创建规则"}
                  </button>
                </div>
              </form>
          </div>
        )}

            <section className="rules-table panel-surface">
              <div className="panel-head">
                <div>
                  <h2>规则列表 <span>共 {rulesTotal} 条</span></h2>
                </div>
                <div className="rules-table-actions">
                  <input
                    ref={ruleImportInputRef}
                    className="upload-file-input"
                    type="file"
                    accept=".csv"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setRuleImportFile(file);
                      void importRulesCsvFile(file);
                      event.currentTarget.value = "";
                    }}
                  />
                  <button className="primary-action" onClick={() => ruleImportInputRef.current?.click()} disabled={busy("rule-import")}>
                    {busy("rule-import") ? <RefreshCw className="spin" size={16} /> : <FileUp size={16} />}
                    导入规则
                  </button>
                  <button className="primary-action" onClick={resetRuleForm}>
                    <Plus size={16} />
                    新建规则
                  </button>
                </div>
              </div>
              <div className="rules-table-scroll">
                <div className="rule-row rule-row-head">
                  <span>规则编号</span>
                  <span>合同类型</span>
                  <span>审核模块</span>
                  <span>风险名称</span>
                  <span>等级</span>
                  <span>状态</span>
                  <span>更新时间</span>
                  <span>操作</span>
                </div>
                {rules.length === 0 && <EmptyState title="暂无规则" copy="没有符合条件的规则记录。" />}
                {rules.map((rule) => (
                  <article className="rule-row" key={rule.id}>
                    <strong>{rule.rule_code}</strong>
                    <span>{rule.contract_type}</span>
                    <span>{rule.review_module}</span>
                    <span className="rule-risk-name">{rule.risk_name}</span>
                    <Badge tone={rule.default_risk_level === "高" ? "risk-high" : rule.default_risk_level === "中" ? "risk-medium" : "risk-low"}>{rule.default_risk_level}</Badge>
                    <Badge tone={rule.enabled ? "status-completed" : "status-failed"}>{rule.enabled ? "启用" : "停用"}</Badge>
                    <span>{formatTime(rule.updated_at ?? rule.created_at)}</span>
                    <span className="rule-actions">
                      <button className="icon-action" title="编辑" onClick={() => editRule(rule)}>
                        <Pencil size={15} />
                      </button>
                      <button className="icon-action" title={rule.enabled ? "停用" : "启用"} onClick={() => void toggleRuleEnabled(rule)}>
                        <Power size={15} />
                      </button>
                      <button className="icon-action danger" title="删除" onClick={() => void deleteRule(rule)}>
                        <Trash2 size={15} />
                      </button>
                    </span>
                  </article>
                ))}
              </div>
              <div className="rules-table-footer">
                <label>
                  每页展示：
                  <span className="rules-page-size">{RULE_PAGE_SIZE} 条/页</span>
                </label>
                <div className="rules-pager">
                  <button className="icon-action" disabled={rulesSkip === 0} onClick={() => void goRulePage(-1)} title="上一页">
                    <ChevronDown className="pager-prev" size={16} />
                  </button>
                  <span>{rulePage}</span>
                  <button className="icon-action" disabled={rulesSkip + RULE_PAGE_SIZE >= rulesTotal} onClick={() => void goRulePage(1)} title="下一页">
                    <ChevronDown className="pager-next" size={16} />
                  </button>
                </div>
              </div>
            </section>
      </div>
    );
  }
}
