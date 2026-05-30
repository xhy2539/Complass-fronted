import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ClipboardCheck,
  Download,
  FileText,
  Filter,
  Gauge,
  History,
  LogOut,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Upload,
  XCircle
} from "lucide-react";
import { api, clearSession, downloadBlob, getStoredToken, getStoredUser, setUnauthorizedHandler, storeSession } from "./api";
import {
  applyRiskReplacementToText,
  buildComparisonParagraphHighlights,
  buildReviewParagraphHighlights,
  docTextFromReview,
  getComparisonDocumentText,
  getReviewParagraphs,
  isMeaningfulComparisonDiff,
  matchingComparisonRisksForDiff,
  revertRiskReplacementInText,
  splitDocumentText
} from "./reviewDocument";
import { getComparisonAiState, getReviewAiState } from "./taskHealth";
import type {
  ChangeType,
  ComparisonDetail,
  ComparisonRiskPoint,
  ComparisonTask,
  DiffDetail,
  ReviewDetail,
  ReviewTask,
  RiskLevel,
  RiskPoint,
  RiskStatus,
  TaskStatus,
  UserInfo
} from "./types";

type View = "dashboard" | "review" | "compare" | "history";
type HistoryMode = "review" | "comparison";
type StatusFilter = "" | TaskStatus;
type LevelFilter = "" | RiskLevel;
type RiskStatusFilter = "" | RiskStatus;
type DiffFilter = "" | ChangeType;

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = ["docx", "pdf", "txt"];

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
  const date = new Date(value);
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

function isTaskRunning(status?: TaskStatus) {
  return status === "pending" || status === "processing";
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

export function App() {
  const [token, setToken] = useState(getStoredToken());
  const [user, setUser] = useState<UserInfo | null>(getStoredUser());
  const [view, setView] = useState<View>(token ? "dashboard" : "dashboard");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
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

  const paragraphRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const riskHighlightRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const reviewRiskCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const oldDiffRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const newDiffRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const oldDiffHighlightRefs = useRef<Record<number, HTMLElement | null>>({});
  const newDiffHighlightRefs = useRef<Record<number, HTMLElement | null>>({});

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
      setNotice("登录已失效，请重新登录");
    });
  }, []);

  useEffect(() => {
    if (token) void refreshLists();
  }, [token]);

  useEffect(() => {
    if (!reviewDetail || !isTaskRunning(reviewDetail.task.status)) return;
    const timer = window.setInterval(() => void openReview(reviewDetail.task.id, false), 2500);
    return () => window.clearInterval(timer);
  }, [reviewDetail?.task.id, reviewDetail?.task.status]);

  useEffect(() => {
    if (!comparisonDetail || !isTaskRunning(comparisonDetail.task.status)) return;
    const timer = window.setInterval(() => void openComparison(comparisonDetail.task.id, false), 2500);
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

  const meaningfulDiffs = useMemo(() => {
    return (comparisonDetail?.diff_details ?? []).filter(isMeaningfulComparisonDiff);
  }, [comparisonDetail]);

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
    return (comparisonDetail?.risk_points ?? []).filter((risk) => !compareLevelFilter || risk.risk_level === compareLevelFilter);
  }, [comparisonDetail, compareLevelFilter]);

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

  async function withBusy<T>(label: string, action: () => Promise<T>) {
    setBusy(label);
    setNotice("");
    try {
      return await action();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "操作失败");
      throw error;
    } finally {
      setBusy("");
    }
  }

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    if (!authEmail || !authPassword || (authMode === "register" && !authName)) {
      setNotice("请完整填写账号信息");
      return;
    }
    await withBusy("auth", async () => {
      const auth =
        authMode === "login"
          ? await api.login(authEmail.trim(), authPassword)
          : await api.register(authEmail.trim(), authName.trim(), authPassword);
      storeSession(auth);
      setToken(auth.access_token);
      setUser(auth.user);
      setView("dashboard");
      setNotice("");
    }).catch(() => undefined);
  }

  function logout() {
    clearSession();
    setToken(null);
    setUser(null);
    setReviewDetail(null);
    setComparisonDetail(null);
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
      setNotice("审查任务已提交，正在后台处理中");
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
      setNotice("比对任务已提交，正在后台处理中");
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
    if (!risk || reviewDetail?.task.status !== "completed") return;
    await withBusy(`review-risk-${status}`, async () => {
      await api.updateRiskStatus(risk.id, status, reviewComment, status === "ignored" ? ignoreReason : undefined);
      if (reviewDetail) await openReview(reviewDetail.task.id, false);
      setReviewComment("");
      setIgnoreReason("");
    }).catch(() => undefined);
  }

  async function updateComparisonRisk(status: RiskStatus, risk = selectedComparisonRisk) {
    if (!risk || comparisonDetail?.task.status !== "completed") return;
    await withBusy(`comparison-risk-${status}`, async () => {
      await api.updateRiskStatus(risk.id, status, comparisonComment, status === "ignored" ? comparisonIgnoreReason : undefined);
      if (comparisonDetail) await openComparison(comparisonDetail.task.id, false);
      setComparisonComment("");
      setComparisonIgnoreReason("");
    }).catch(() => undefined);
  }

  function applyRiskSuggestion(risk = selectedRisk) {
    if (!risk?.replace_text || reviewDetail?.task.status !== "completed") return;
    const nextText = applyRiskReplacementToText(reviewText, risk);
    if (!nextText) return;
    setReviewText(nextText);
    setAppliedRisks((current) => new Set(current).add(risk.id));
  }

  function revokeRiskSuggestion(risk = selectedRisk) {
    if (!risk) return;
    const nextText = revertRiskReplacementInText(reviewText, risk);
    if (nextText) setReviewText(nextText);
    setAppliedRisks((current) => {
      const next = new Set(current);
      next.delete(risk.id);
      return next;
    });
  }

  async function exportReview() {
    if (!reviewDetail || reviewDetail.task.status !== "completed") return;
    await withBusy("export", async () => {
      const name = `${reviewDetail.task.file_name.replace(/\.[^.]+$/, "")}_修改版.docx`;
      const blob = await api.exportReview(reviewDetail.task.id, reviewText || docTextFromReview(reviewDetail), name);
      downloadBlob(blob, name);
    }).catch(() => undefined);
  }

  async function loadHistory() {
    await withBusy("history", async () => {
      if (historyMode === "review") {
        const data = await api.listReviews(historyStatus, 0, 20);
        setReviewTasks(data.tasks);
      } else {
        const data = await api.listComparisons(historyStatus, 0, 20);
        setComparisonTasks(data.tasks);
      }
    }).catch(() => undefined);
  }

  if (!token) {
    return (
      <main className="auth-screen">
        <section className="auth-visual">
          <div className="brand-mark">
            <Scale size={30} />
          </div>
          <p className="eyebrow">COMPLASS</p>
          <h1>合规罗盘</h1>
          <p>上传合同、定位风险、复核建议，并把最终文本导出为清洁版本。</p>
          <div className="auth-proof">
            <span>单合同审查</span>
            <span>版本差异比对</span>
            <span>人工复核闭环</span>
          </div>
        </section>
        <form className="auth-panel" onSubmit={handleAuth}>
          <div>
            <p className="eyebrow">{authMode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}</p>
            <h2>{authMode === "login" ? "登录工作台" : "注册账号"}</h2>
          </div>
          <label>
            邮箱
            <input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} type="email" placeholder="user@example.com" />
          </label>
          {authMode === "register" && (
            <label>
              昵称
              <input value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="请输入昵称" />
            </label>
          )}
          <label>
            密码
            <input value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} type="password" placeholder="至少 6 位" />
          </label>
          {notice && <div className="notice-panel warning">{notice}</div>}
          <button className="primary-action large" disabled={busy === "auth"}>
            {busy === "auth" ? <RefreshCw className="spin" size={18} /> : <ShieldCheck size={18} />}
            {authMode === "login" ? "登录" : "注册并登录"}
          </button>
          <button type="button" className="link-button" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
            {authMode === "login" ? "没有账号？注册" : "已有账号？登录"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="app-nav">
        <div className="nav-brand">
          <div className="brand-mark small">
            <Scale size={22} />
          </div>
          <div>
            <strong>合规罗盘</strong>
            <span>合同审查工作台</span>
          </div>
        </div>
        <nav className="nav-list">
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>
            <Gauge size={18} />
            总览
          </button>
          <button className={view === "review" ? "active" : ""} onClick={() => setView("review")}>
            <FileText size={18} />
            单合同审查
          </button>
          <button className={view === "compare" ? "active" : ""} onClick={() => setView("compare")}>
            <Scale size={18} />
            版本比对
          </button>
          <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}>
            <History size={18} />
            历史任务
          </button>
        </nav>
        <div className="nav-user">
          <span>{user?.nickname || user?.email}</span>
          <button className="ghost-action inline" onClick={logout}>
            <LogOut size={16} />
            退出
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
        {view === "dashboard" && renderDashboard()}
        {view === "review" && renderReview()}
        {view === "compare" && renderCompare()}
        {view === "history" && renderHistory()}
      </section>
    </main>
  );

  function renderDashboard() {
    return (
      <div className="dashboard dashboard-workbench">
        <section className="dashboard-command panel-surface">
          <div className="dashboard-intro">
            <p className="eyebrow">WORKBENCH</p>
            <h1>合同审查原型工作台</h1>
            <p>围绕合同文本、风险点、版本差异和人工确认组织工作流，保持双栏/三栏审查体验。</p>
            <div className="launcher-actions">
              <button className="primary-action large" onClick={() => setView("review")}>
                <FileText size={18} />
                开始单合同审查
              </button>
              <button className="ghost-action large" onClick={() => setView("compare")}>
                <Scale size={18} />
                创建版本比对
              </button>
            </div>
          </div>
        </section>

        <section className="dashboard-action-grid" aria-label="常用操作">
          <button className="feature-entry" onClick={() => setView("review")}>
            <span className="entry-icon">
              <Upload size={22} />
            </span>
            <span className="entry-copy">
              <small>REVIEW</small>
              <strong>上传合同审查</strong>
              <em>解析段落、定位风险、复核建议并导出修改版。</em>
            </span>
            <ArrowRight size={18} />
          </button>
          <button className="feature-entry risk-entry" onClick={() => setView("compare")}>
            <span className="entry-icon">
              <Search size={22} />
            </span>
            <span className="entry-copy">
              <small>COMPARE</small>
              <strong>对照两个版本</strong>
              <em>同步查看旧版、新版和差异风险。</em>
            </span>
            <ArrowRight size={18} />
          </button>
        </section>

        <section className="dashboard-main-grid">
          <RecentPanel title="最近审查" empty="暂无审查任务">
            {reviewTasks.slice(0, 4).map((task) => (
              <button className="recent-item" key={task.id} onClick={() => void openReview(task.id)}>
                <span>
                  <strong className="recent-file-name">{task.file_name}</strong>
                  <small>{formatTime(task.created_at)}</small>
                </span>
                <Badge tone={`status-${task.status}`}>{statusLabel[task.status]}</Badge>
              </button>
            ))}
          </RecentPanel>
          <RecentPanel title="最近比对" empty="暂无比对任务">
            {comparisonTasks.slice(0, 4).map((task) => (
              <button className="recent-item" key={task.id} onClick={() => void openComparison(task.id)}>
                <span>
                  <strong className="recent-file-name">{task.old_file_name} / {task.new_file_name}</strong>
                  <small>{formatTime(task.created_at)}</small>
                </span>
                <Badge tone={`status-${task.status}`}>{statusLabel[task.status]}</Badge>
              </button>
            ))}
          </RecentPanel>
        </section>
      </div>
    );
  }

  function renderReview() {
    const paragraphs = getReviewParagraphs(reviewDetail, reviewText);
    const reviewHighlights = buildReviewParagraphHighlights(paragraphs, reviewDetail?.risk_points ?? [], appliedRisks);
    const selectedRiskLocation = selectedRisk ? reviewHighlights.locations[selectedRisk.id] : null;
    const reviewTaskReady = reviewDetail?.task.status === "completed";
    const reviewTaskRunning = isTaskRunning(reviewDetail?.task.status);
    const selectedRiskCanApply = Boolean(
      reviewTaskReady &&
        selectedRisk?.replace_text &&
        selectedRiskLocation?.status === "matched" &&
        !appliedRisks.has(selectedRisk.id) &&
        selectedRisk.status !== "ignored"
    );
    const activeParagraph = selectedRiskLocation?.paragraphIndex ?? null;
    const reviewAiState = getReviewAiState(reviewDetail);
    const showReviewAiStatus = reviewAiState.kind !== "ok";

    return (
      <div className="work-page">
        <header className="page-head compact">
          <div className="risk-review-title-row">
            <div className="risk-review-hero">
              <p className="eyebrow">CONTRACT REVIEW</p>
              <h1>单合同审查</h1>
              <p>上传合同后展示段落、风险点、定位高亮和人工复核状态。</p>
            </div>
            <div className="page-head-actions">
              <label className={`risk-upload-button ${reviewFile ? "selected" : ""}`}>
                <input className="upload-file-input" type="file" accept=".docx,.pdf,.txt" onChange={(event) => setReviewFile(event.target.files?.[0] ?? null)} />
                <span className="risk-upload-button-title">
                  <Upload size={16} />
                  <span>{reviewFile ? reviewFile.name : "选择合同"}</span>
                </span>
              </label>
              <button className="primary-action" onClick={uploadReview} disabled={busy === "review-upload"}>
                {busy === "review-upload" ? "提交中..." : "提交审查"}
              </button>
            </div>
          </div>
        </header>

        {!reviewDetail ? (
          <EmptyState title="还没有审查结果" copy="选择合同文件并开始审查，完成后会在这里显示合同正文与风险面板。" />
        ) : (
          <>
            <section className="compare-toolbar panel-surface">
              <div className="diff-stats review-stats">
                <Stat tone="tone-info" label="总风险" value={reviewRiskStats.total} />
                <Stat tone="tone-danger" label="高风险" value={reviewRiskStats.high} />
                <Stat tone="tone-warning" label="中风险" value={reviewRiskStats.medium} />
                <Stat tone="tone-safe" label="低风险" value={reviewRiskStats.low} />
                <Stat tone="tone-move" label="待处理" value={reviewRiskStats.pending} />
              </div>
              <div className="toolbar-controls">
                <Select value={reviewLevelFilter} onChange={(value) => setReviewLevelFilter(value as LevelFilter)} label="风险等级">
                  <option value="">全部等级</option>
                  <option value="high">高风险</option>
                  <option value="medium">中风险</option>
                  <option value="low">低风险</option>
                </Select>
                <Select value={reviewStatusFilter} onChange={(value) => setReviewStatusFilter(value as RiskStatusFilter)} label="处理状态">
                  <option value="">全部状态</option>
                  <option value="pending">待处理</option>
                  <option value="confirmed">已确认</option>
                  <option value="ignored">已忽略</option>
                </Select>
                <button className="ghost-action inline" onClick={exportReview} disabled={busy === "export" || !reviewTaskReady}>
                  <Download size={16} />
                  导出修改版
                </button>
              </div>
            </section>

            {showReviewAiStatus && (
              <section className="notice-panel warning ai-state-panel" role="alert">
                {reviewTaskRunning ? <RefreshCw size={18} /> : <AlertTriangle size={18} />}
                <span>
                  <strong>{reviewAiState.title}</strong>
                  {reviewAiState.message}
                </span>
              </section>
            )}

            <section className="risk-workspace">
              <article className="review-document panel-surface">
                <div className="document-head">
                  <h2>{reviewDetail.task.file_name}</h2>
                  <p className="panel-subtitle">{showReviewAiStatus ? reviewAiState.message : reviewDetail.task.overall_conclusion || "暂无总体结论"}</p>
                </div>
                <div className="review-scroll">
                  {selectedRisk && selectedRiskLocation?.status === "missing" && (
                    <ReviewInlineToolbar
                      risk={selectedRisk}
                      applied={appliedRisks.has(selectedRisk.id)}
                      collapsed={reviewToolbarCollapsed}
                      canApply={selectedRiskCanApply}
                      onApply={() => applyRiskSuggestion(selectedRisk)}
                      onRevoke={() => revokeRiskSuggestion(selectedRisk)}
                      onSetStatus={(status) => void updateReviewRisk(status, selectedRisk)}
                      onHide={() => setReviewToolbarCollapsed(true)}
                      onShow={() => setReviewToolbarCollapsed(false)}
                      disabled={!reviewTaskReady}
                    />
                  )}
                  {reviewHighlights.paragraphs.map(({ paragraph, tokens }) => {
                    const isActive = activeParagraph === paragraph.index && selectedRiskLocation?.status !== "missing";
                    const selectedToken = tokens.find((token) => token.type === "risk" && token.riskIds.includes(selectedRiskId));
                    const tokenRiskId = selectedToken ? selectedRiskId : tokens.find((token) => token.type === "risk")?.riskId;
                    const relatedRisk =
                      (tokenRiskId ? reviewDetail.risk_points.find((risk) => risk.id === tokenRiskId) : null) ??
                      reviewDetail.risk_points.find((risk) => reviewHighlights.locations[risk.id]?.paragraphIndex === paragraph.index);
                    return (
                      <div
                        className={`contract-paragraph ${isActive ? "active" : ""}`}
                        key={`${paragraph.index}-${paragraph.text}`}
                        ref={(node) => {
                          paragraphRefs.current[paragraph.index] = node;
                        }}
                      >
                        <div className={`contract-paragraph-body ${isActive ? "has-active-risk" : ""}`}>
                          {relatedRisk && <span className="inline-marker">{riskLevelLabel[relatedRisk.level]}</span>}
                          <p>
                            {tokens.map((token, index) => {
                              if (token.type === "text") return <span key={`${paragraph.index}-text-${index}`}>{token.text}</span>;
                              const activeTokenRiskId = token.riskIds.includes(selectedRiskId) ? selectedRiskId : token.riskId;
                              const risk = reviewDetail.risk_points.find((item) => item.id === activeTokenRiskId);
                              const status = risk?.status ?? "pending";
                              const levelClass = risk ? `risk-${risk.level}` : "";
                              const isTokenActive = token.riskIds.includes(selectedRiskId);
                              return (
                                <button
                                  className={`risk-highlight status-${status} ${levelClass} ${isTokenActive ? "active" : ""} ${token.replaced ? "replaced" : ""}`}
                                  key={`${paragraph.index}-${token.riskIds.join("-")}-${index}`}
                                  onClick={() => selectRiskFromText(activeTokenRiskId)}
                                  ref={(node) => {
                                    token.riskIds.forEach((riskId) => {
                                      riskHighlightRefs.current[riskId] = node;
                                    });
                                  }}
                                  type="button"
                                >
                                  {token.text}
                                </button>
                              );
                            })}
                          </p>
                          {isActive && selectedRisk && (
                            <ReviewInlineToolbar
                              risk={selectedRisk}
                              applied={appliedRisks.has(selectedRisk.id)}
                              collapsed={reviewToolbarCollapsed}
                              canApply={selectedRiskCanApply}
                              onApply={() => applyRiskSuggestion(selectedRisk)}
                              onRevoke={() => revokeRiskSuggestion(selectedRisk)}
                              onSetStatus={(status) => void updateReviewRisk(status, selectedRisk)}
                              onHide={() => setReviewToolbarCollapsed(true)}
                              onShow={() => setReviewToolbarCollapsed(false)}
                              disabled={!reviewTaskReady}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>

              <aside className="risk-panel panel-surface">
                <div className="panel-head risk-panel-head">
                  <div className="risk-panel-heading">
                    <h2>风险点</h2>
                    <p className="panel-subtitle">{filteredReviewRisks.length} / {reviewDetail.risk_points.length} 项</p>
                  </div>
                </div>
                <div className="risk-panel-scroll">
                  <div className="risk-list">
                    {reviewTaskRunning && <EmptyState title="审查处理中" copy="系统正在解析合同并生成风险点，结果会自动刷新。" />}
                    {filteredReviewRisks.length === 0 && (
                      <EmptyState
                        title={showReviewAiStatus ? "AI 风险结果缺失" : "没有匹配风险"}
                        copy={showReviewAiStatus ? reviewAiState.message : "调整筛选条件后再查看。"}
                      />
                    )}
                    {filteredReviewRisks.map((risk) => {
                      const canApply = Boolean(
                        reviewTaskReady &&
                          risk.replace_text &&
                          reviewHighlights.locations[risk.id]?.status === "matched" &&
                          !appliedRisks.has(risk.id) &&
                          risk.status !== "ignored"
                      );
                      return (
                        <RiskCard
                          key={risk.id}
                          active={risk.id === selectedRiskId}
                          expanded={risk.id === expandedReviewRiskId}
                          risk={risk}
                          applied={appliedRisks.has(risk.id)}
                          onSelect={() => scrollToRisk(risk)}
                          onToggle={() => toggleReviewRiskDetail(risk)}
                          registerRef={(node) => {
                            reviewRiskCardRefs.current[risk.id] = node;
                          }}
                        >
                          {risk.id === expandedReviewRiskId && (
                            <RiskDetail
                              risk={risk}
                              reviewComment={reviewComment}
                              ignoreReason={ignoreReason}
                              canApply={canApply}
                              onReviewComment={setReviewComment}
                              onIgnoreReason={setIgnoreReason}
                              onApply={reviewTaskReady && risk.replace_text ? () => applyRiskSuggestion(risk) : undefined}
                              onRevoke={() => revokeRiskSuggestion(risk)}
                              applied={appliedRisks.has(risk.id)}
                            />
                          )}
                        </RiskCard>
                      );
                    })}
                  </div>
                </div>
              </aside>
            </section>

            <section className="editor-panel panel-surface">
              <div>
                <p className="section-label">EXPORT TEXT</p>
                <h2>导出文本</h2>
                <p>应用建议后的内容只保存在当前页面，导出时会提交这份完整文本。</p>
              </div>
              <textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} disabled={!reviewTaskReady} />
            </section>
          </>
        )}
      </div>
    );
  }

  function renderCompare() {
    const comparisonAiState = getComparisonAiState(comparisonDetail);
    const comparisonTaskReady = comparisonDetail?.task.status === "completed";
    const comparisonTaskRunning = isTaskRunning(comparisonDetail?.task.status);
    const showComparisonAiStatus = comparisonAiState.kind !== "ok";

    return (
      <div className="work-page">
        <header className="page-head compact">
          <div className="risk-review-title-row">
            <div>
              <p className="eyebrow">VERSION COMPARE</p>
              <h1>版本比对</h1>
              <p>上传旧版和新版合同，按差异类型同步查看文本与风险解释。</p>
            </div>
            <div className="compare-upload-bar">
              <UploadButton title="旧版合同" file={oldFile} onChange={setOldFile} />
              <UploadButton title="新版合同" file={newFile} onChange={setNewFile} />
            </div>
            <div className="page-head-actions">
              <button className="primary-action" onClick={uploadComparison} disabled={busy === "comparison-upload"}>
                {busy === "comparison-upload" ? "提交中..." : "提交比对"}
              </button>
            </div>
          </div>
        </header>

        {!comparisonDetail ? (
          <EmptyState title="还没有比对结果" copy="选择旧版与新版合同后开始比对。" />
        ) : (
          <>
            <section className="compare-toolbar panel-surface">
              <div className="diff-stats">
                <Stat tone="tone-info" label="总差异" value={visibleDiffStats.total} />
                <Stat tone="tone-add" label="新增" value={visibleDiffStats.added} />
                <Stat tone="tone-delete" label="删除" value={visibleDiffStats.deleted} />
                <Stat tone="tone-modify" label="修改" value={visibleDiffStats.modified} />
                <Stat tone="tone-risk" label="风险" value={comparisonDetail.task.total_risks ?? comparisonDetail.risk_points.length} />
              </div>
              <div className="toolbar-controls">
                <Select value={diffFilter} onChange={(value) => setDiffFilter(value as DiffFilter)} label="差异类型">
                  <option value="">全部差异</option>
                  <option value="added">新增</option>
                  <option value="deleted">删除</option>
                  <option value="modified">修改</option>
                  <option value="moved">移位</option>
                </Select>
                <Select value={compareLevelFilter} onChange={(value) => setCompareLevelFilter(value as LevelFilter)} label="风险等级">
                  <option value="">全部风险</option>
                  <option value="high">高风险</option>
                  <option value="medium">中风险</option>
                  <option value="low">低风险</option>
                </Select>
              </div>
            </section>
            {showComparisonAiStatus && (
              <section className="notice-panel warning ai-state-panel" role="alert">
                {comparisonTaskRunning ? <RefreshCw size={18} /> : <AlertTriangle size={18} />}
                <span>
                  <strong>{comparisonAiState.title}</strong>
                  {comparisonAiState.message}
                </span>
              </section>
            )}
            <section className="compare-workspace">
              <ComparisonDocumentPane
                title={oldDocument?.file_name || "旧版合同"}
                highlights={oldComparisonHighlights}
                side="old"
                selectedDiffIndex={selectedDiffIndex}
                onSelectDiff={(index) => setSelectedDiffIndex(index)}
                paragraphRefs={oldDiffRefs}
                highlightRefs={oldDiffHighlightRefs}
              />
              <ComparisonDocumentPane
                title={newDocument?.file_name || "新版合同"}
                highlights={newComparisonHighlights}
                side="new"
                selectedDiffIndex={selectedDiffIndex}
                onSelectDiff={(index) => setSelectedDiffIndex(index)}
                paragraphRefs={newDiffRefs}
                highlightRefs={newDiffHighlightRefs}
              />
              <aside className="diff-panel panel-surface">
                <div className="panel-head">
                  <h2>差异与风险</h2>
                  <p className="panel-subtitle">{filteredDiffs.length} 项差异，{filteredComparisonRisks.length} 项风险</p>
                </div>
                <div className="diff-panel-scroll">
                  <div className="diff-list">
                    {comparisonTaskRunning && <EmptyState title="比对处理中" copy="系统正在解析两个版本并生成差异，结果会自动刷新。" />}
                    {filteredDiffs.map((diff) => {
                      const expanded = expandedDiffIndex === diff.index;
                      const matchedRisks = matchingComparisonRisksForDiff(diff, comparisonRisks);
                      const diffRiskLevel = matchedRisks[0]?.risk_level ?? null;
                      return (
                        <article className={`diff-card compact ${selectedDiffIndex === diff.index ? "active" : ""} ${expanded ? "expanded" : ""}`} key={diff.index}>
                          <div className="diff-card-top">
                            <button className="diff-card-summary-button" onClick={() => scrollToDiff(diff)} type="button">
                              <span className="diff-card-summary">
                                <span className="diff-card-badges">
                                  <Badge tone={`type-${diff.change_type}`}>{changeTypeLabel[diff.change_type]}</Badge>
                                  {diffRiskLevel && <Badge tone={`risk-${diffRiskLevel}`}>{riskLevelLabel[diffRiskLevel]}</Badge>}
                                  {similarityLabel(diff.similarity) && <Badge tone="muted">相似度 {similarityLabel(diff.similarity)}</Badge>}
                                </span>
                                <strong>{diff.new_text || diff.old_text || "文本差异"}</strong>
                                <small className="diff-card-meta">
                                  {diff.change_type === "moved" ? "点击选中该差异，展开后可分别定位旧版/新版原文" : "点击定位到正文差异位置"}
                                </small>
                              </span>
                            </button>
                          </div>
                          {expanded && <DiffDetailCard diff={diff} risks={matchedRisks} onJump={(side) => scrollToDiff(diff, side)} />}
                          <button aria-expanded={expanded} className="card-expand-link" onClick={() => toggleDiffDetail(diff)} type="button">
                            <ChevronDown size={14} />
                            <span>{expanded ? "收起" : "展开"}</span>
                          </button>
                        </article>
                      );
                    })}
                    {filteredDiffs.length === 0 && <EmptyState title="暂无匹配差异" copy="调整类型筛选后再查看。" />}
                  </div>

                  <div className="risk-list compare-risk-list">
                    <p className="section-label">RISK REVIEW</p>
                    {filteredComparisonRisks.map((risk) => {
                      const expanded = expandedComparisonRiskId === risk.id;
                      const matched = findComparisonRiskDiff(risk);
                      return (
                        <article
                          className={`risk-list-item ${risk.id === selectedComparisonRiskId ? "active" : ""} ${expanded ? "expanded" : ""}`}
                          key={risk.id}
                          onClick={(event) => {
                            if (!isInteractiveTarget(event.target)) selectComparisonRisk(risk);
                          }}
                        >
                          <div className="risk-list-item-top">
                            <button className="risk-list-item-summary-button" onClick={() => selectComparisonRisk(risk)} type="button">
                              <span className="risk-list-item-summary">
                                <span className="risk-list-badges">
                                  <Badge tone={`type-${risk.change_type}`}>{changeTypeLabel[risk.change_type]}</Badge>
                                  {risk.risk_level && <Badge tone={`risk-${risk.risk_level}`}>{riskLevelLabel[risk.risk_level]}</Badge>}
                                  <Badge tone={`status-${risk.status}`}>{riskStatusLabel[risk.status]}</Badge>
                                </span>
                                <strong>{risk.summary || risk.category || "比对风险"}</strong>
                                <small>{risk.suggestion || risk.evidence || risk.impact}</small>
                              </span>
                            </button>
                          </div>
                          {expanded && (
                            <ComparisonRiskDetail
                              risk={risk}
                              comment={comparisonComment}
                              ignoreReason={comparisonIgnoreReason}
                              onComment={setComparisonComment}
                              onIgnoreReason={setComparisonIgnoreReason}
                              onConfirm={() => void updateComparisonRisk(risk.status === "confirmed" ? "pending" : "confirmed", risk)}
                              onIgnore={() => void updateComparisonRisk(risk.status === "ignored" ? "pending" : "ignored", risk)}
                              onJumpOld={matched ? () => scrollToDiff(matched, "old") : undefined}
                              onJumpNew={matched ? () => scrollToDiff(matched, "new") : undefined}
                              disabled={!comparisonTaskReady}
                            />
                          )}
                          <button aria-expanded={expanded} className="card-expand-link" onClick={() => toggleComparisonRiskDetail(risk)} type="button">
                            <ChevronDown size={14} />
                            <span>{expanded ? "收起" : "展开"}</span>
                          </button>
                        </article>
                      );
                    })}
                    {filteredComparisonRisks.length === 0 && (
                      <EmptyState
                        title={showComparisonAiStatus ? "AI 风险增强缺失" : "暂无匹配风险"}
                        copy={showComparisonAiStatus ? comparisonAiState.message : "调整风险等级筛选后再查看。"}
                      />
                    )}
                  </div>

                </div>
              </aside>
            </section>
          </>
        )}
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

  function renderHistory() {
    const items = historyMode === "review" ? reviewTasks : comparisonTasks;
    return (
      <div className="work-page">
        <header className="page-head compact">
          <p className="eyebrow">HISTORY</p>
          <h1>历史任务</h1>
          <p>按任务类型和状态查看审查记录，点击任一记录进入详情。</p>
        </header>
        <section className="compare-toolbar panel-surface">
          <div className="segmented">
            <button className={historyMode === "review" ? "active" : ""} onClick={() => setHistoryMode("review")}>审查任务</button>
            <button className={historyMode === "comparison" ? "active" : ""} onClick={() => setHistoryMode("comparison")}>比对任务</button>
          </div>
          <div className="toolbar-controls">
            <Select value={historyStatus} onChange={(value) => setHistoryStatus(value as StatusFilter)} label="任务状态">
              <option value="">全部状态</option>
              <option value="pending">待处理</option>
              <option value="processing">处理中</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
            </Select>
            <button className="ghost-action inline" onClick={loadHistory}>
              <Filter size={16} />
              筛选
            </button>
          </div>
        </section>
        <section className="history-list panel-surface">
          {items.length === 0 && <EmptyState title="暂无任务" copy="创建审查或比对任务后会显示在这里。" />}
          {historyMode === "review"
            ? reviewTasks.map((task) => (
                <button className="history-row" key={task.id} onClick={() => void openReview(task.id)}>
                  <FileText size={18} />
                  <span>
                    <strong className="recent-file-name">{task.file_name}</strong>
                    <small>{formatTime(task.created_at)} · {fileSizeLabel(task.file_size)}</small>
                  </span>
                  <Badge tone={`status-${task.status}`}>{statusLabel[task.status]}</Badge>
                  <ArrowRight size={16} />
                </button>
              ))
            : comparisonTasks.map((task) => (
                <button className="history-row" key={task.id} onClick={() => void openComparison(task.id)}>
                  <Scale size={18} />
                  <span>
                    <strong className="recent-file-name">{task.old_file_name} / {task.new_file_name}</strong>
                    <small>{formatTime(task.created_at)}</small>
                  </span>
                  <Badge tone={`status-${task.status}`}>{statusLabel[task.status]}</Badge>
                  <ArrowRight size={16} />
                </button>
              ))}
        </section>
      </div>
    );
  }
}

function ComparisonDocumentPane({
  title,
  highlights,
  side,
  selectedDiffIndex,
  onSelectDiff,
  paragraphRefs,
  highlightRefs
}: {
  title: string;
  highlights: ReturnType<typeof buildComparisonParagraphHighlights>;
  side: "old" | "new";
  selectedDiffIndex: number | null;
  onSelectDiff: (index: number) => void;
  paragraphRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  highlightRefs: React.MutableRefObject<Record<number, HTMLElement | null>>;
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
                paragraphRefs.current[paragraph.index] = node;
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
                      onClick={() => onSelectDiff(token.diffIndex)}
                      ref={(node) => {
                        highlightRefs.current[token.diffIndex] = node;
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

function RecentPanel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  return (
    <div className="overview-card panel-surface">
      <p className="section-label">{title}</p>
      <div className="recent-list">{children || <EmptyState title={empty} copy="完成任务后会显示最近记录。" />}</div>
    </div>
  );
}

function Stat({ tone, label, value }: { tone: string; label: string; value: number }) {
  return (
    <div className={`stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Select({
  value,
  onChange,
  label,
  children
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="select-shell">
      <span>{label}</span>
      <span className="select-wrap">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {children}
        </select>
        <ChevronDown size={16} />
      </span>
    </label>
  );
}

function UploadButton({ title, file, onChange }: { title: string; file: File | null; onChange: (file: File | null) => void }) {
  return (
    <label className={`upload-contract-button ${file ? "selected" : ""}`}>
      <input className="upload-file-input" type="file" accept=".docx,.pdf,.txt" onChange={(event) => onChange(event.target.files?.[0] ?? null)} />
      <span className="upload-contract-button-title">
        <Upload size={16} />
        <span>{file ? file.name : title}</span>
      </span>
    </label>
  );
}

function ReviewInlineToolbar({
  risk,
  applied,
  collapsed,
  canApply,
  onApply,
  onRevoke,
  onSetStatus,
  onHide,
  onShow,
  disabled = false
}: {
  risk: RiskPoint;
  applied: boolean;
  collapsed: boolean;
  canApply: boolean;
  onApply: () => void;
  onRevoke: () => void;
  onSetStatus: (status: RiskStatus) => void;
  onHide: () => void;
  onShow: () => void;
  disabled?: boolean;
}) {
  if (collapsed) {
    return (
      <button className="risk-inline-toolbar-collapsed" onClick={onShow} type="button">
        <Search size={14} />
        显示
      </button>
    );
  }

  const isConfirmed = risk.status === "confirmed";
  const isIgnored = risk.status === "ignored";
  const replacementDisabled = !applied && !canApply;

  return (
    <div className="risk-inline-toolbar">
      <div className="risk-inline-toolbar-head">
        <span className={`risk-inline-toolbar-title risk-tone-${risk.level}`}>当前风险：{risk.title}</span>
        <button className="risk-inline-hide" onClick={onHide} type="button">
          <XCircle size={14} />
          隐藏
        </button>
      </div>
      <div className="risk-inline-toolbar-actions">
        <button className="mini-action primary-action" disabled={disabled || replacementDisabled} onClick={applied ? onRevoke : onApply} type="button">
          {applied ? "撤回替换" : "一键替换"}
        </button>
        <button className="mini-action primary-action" disabled={disabled} onClick={() => onSetStatus(isConfirmed ? "pending" : "confirmed")} type="button">
          {isConfirmed ? "撤回确认" : "确认风险"}
        </button>
        <button className="mini-action ghost-action" disabled={disabled} onClick={() => onSetStatus(isIgnored ? "pending" : "ignored")} type="button">
          {isIgnored ? "撤回忽略" : "忽略风险"}
        </button>
      </div>
    </div>
  );
}

function RiskCard({
  risk,
  active,
  expanded,
  applied,
  onSelect,
  onToggle,
  registerRef,
  children
}: {
  risk: RiskPoint;
  active: boolean;
  expanded: boolean;
  applied: boolean;
  onSelect: () => void;
  onToggle: () => void;
  registerRef: (node: HTMLElement | null) => void;
  children?: React.ReactNode;
}) {
  const subtitle = [risk.category, risk.reason, risk.evidence, risk.suggestion].find((value) => {
    const text = value?.trim();
    return text && text.toLowerCase() !== "coze";
  });

  return (
    <article
      className={`risk-list-item ${active ? "active" : ""} ${expanded ? "expanded" : ""} ${applied ? "applied" : ""}`}
      onClick={(event) => {
        if (!isInteractiveTarget(event.target)) onSelect();
      }}
      ref={registerRef}
    >
      <div className="risk-list-item-top">
        <button className="risk-list-item-summary-button" onClick={onSelect} type="button">
          <span className="risk-list-item-summary">
            <span className="risk-list-item-head">
              <span className="risk-list-title-row">
                <strong>{risk.title}</strong>
                <Badge tone={`risk-${risk.level}`} compact>{riskLevelLabel[risk.level]}</Badge>
              </span>
            </span>
            {subtitle && <small className="risk-list-meta">{subtitle}</small>}
          </span>
        </button>
        <span className="risk-list-item-actions">
          <span className="risk-list-badges">
            {applied && <Badge tone="status-applied">已替换</Badge>}
            <Badge tone={`status-${risk.status}`}>{riskStatusLabel[risk.status]}</Badge>
          </span>
        </span>
      </div>
      {expanded && children}
      <button aria-expanded={expanded} className="card-expand-link" onClick={onToggle} type="button">
        <ChevronDown size={14} />
        <span>{expanded ? "收起" : "展开"}</span>
      </button>
    </article>
  );
}

function DiffDetailCard({
  diff,
  risks,
  onJump
}: {
  diff: DiffDetail;
  risks: ComparisonRiskPoint[];
  onJump: (side: "old" | "new") => void;
}) {
  return (
    <section className="diff-detail" aria-label="差异详情">
      <DetailBlock title="旧版文本" value={diff.old_text} />
      <DetailBlock title="新版文本" value={diff.new_text} />
      {risks.length > 0 && (
        <div className="diff-risk-detail">
          <div className="detail-block">
            <div>
              <ShieldCheck size={15} />
              AI 风险说明
            </div>
          </div>
          {risks.map((risk) => {
            return (
              <article className="diff-risk-entry" key={risk.id}>
                <div className="risk-detail-head compact">
                  {risk.risk_level && <Badge tone={`risk-${risk.risk_level}`}>{riskLevelLabel[risk.risk_level]}</Badge>}
                  <Badge tone={`status-${risk.status}`}>{riskStatusLabel[risk.status]}</Badge>
                  <Badge tone={`type-${risk.change_type}`}>{changeTypeLabel[risk.change_type]}</Badge>
                </div>
                {risk.category && <DetailBlock title="分类" value={risk.category} />}
                <DetailBlock title="摘要" value={risk.summary} />
                <DetailBlock title="证据" value={risk.evidence} />
                <DetailBlock title="影响" value={risk.impact} />
                <DetailBlock title="建议" value={risk.suggestion} />
                {!risk.summary && !risk.evidence && !risk.impact && !risk.suggestion && <p className="diff-risk-copy">该风险暂无 AI 说明字段</p>}
              </article>
            );
          })}
        </div>
      )}
      <div className={`diff-detail-actions compact ${!diff.old_text || !diff.new_text ? "single" : ""}`}>
        {diff.old_text && (
          <button className="mini-action ghost-action" onClick={() => onJump("old")} type="button">
            <Search size={13} />
            旧版原文
          </button>
        )}
        {diff.new_text && (
          <button className="mini-action ghost-action" onClick={() => onJump("new")} type="button">
            <Search size={13} />
            新版原文
          </button>
        )}
      </div>
    </section>
  );
}

function RiskDetail({
  risk,
  reviewComment,
  ignoreReason,
  onReviewComment,
  onIgnoreReason
}: {
  risk: RiskPoint;
  reviewComment: string;
  ignoreReason: string;
  applied: boolean;
  canApply?: boolean;
  onReviewComment: (value: string) => void;
  onIgnoreReason: (value: string) => void;
  onApply?: () => void;
  onRevoke?: () => void;
}) {
  return (
    <div className="risk-detail">
      <div className="risk-detail-head">
        <Badge tone={`status-${risk.status}`}>{riskStatusLabel[risk.status]}</Badge>
      </div>
      <DetailBlock title="风险原因" value={risk.reason} />
      <DetailBlock title="证据" value={risk.evidence || risk.sentence_text || risk.original_text} />
      <DetailBlock title="影响" value={risk.impact} />
      <DetailBlock title="建议" value={risk.suggestion} />
      {risk.replace_text && (
        <div className="detail-block">
          <div>
            <ClipboardCheck size={15} />
            替换建议
          </div>
          <p className="replacement-copy">{risk.replace_text}</p>
        </div>
      )}
      <div className="decision-panel">
        <textarea value={reviewComment} onChange={(event) => onReviewComment(event.target.value)} placeholder="复核备注（可选）" />
        <input value={ignoreReason} onChange={(event) => onIgnoreReason(event.target.value)} placeholder="忽略原因（忽略时可填写）" />
      </div>
    </div>
  );
}

function ComparisonRiskDetail({
  risk,
  comment,
  ignoreReason,
  onComment,
  onIgnoreReason,
  onConfirm,
  onIgnore,
  onJumpOld,
  onJumpNew,
  disabled = false
}: {
  risk: ComparisonRiskPoint;
  comment: string;
  ignoreReason: string;
  onComment: (value: string) => void;
  onIgnoreReason: (value: string) => void;
  onConfirm: () => void;
  onIgnore: () => void;
  onJumpOld?: () => void;
  onJumpNew?: () => void;
  disabled?: boolean;
}) {
  const isConfirmed = risk.status === "confirmed";
  const isIgnored = risk.status === "ignored";
  return (
    <div className="risk-detail">
      <div className="risk-detail-head">
        <Badge tone={`status-${risk.status}`}>{riskStatusLabel[risk.status]}</Badge>
        {risk.risk_level && <Badge tone={`risk-${risk.risk_level}`}>{riskLevelLabel[risk.risk_level]}</Badge>}
      </div>
      <DetailBlock title="摘要" value={risk.summary} />
      <DetailBlock title="旧版文本" value={risk.old_text} />
      <DetailBlock title="新版文本" value={risk.new_text} />
      <DetailBlock title="证据" value={risk.evidence} />
      <DetailBlock title="影响" value={risk.impact} />
      <DetailBlock title="建议" value={risk.suggestion} />
      {risk.category && <DetailBlock title="分类" value={risk.category} />}
      <DetailBlock title="相似度" value={similarityLabel(risk.similarity)} />
      {(onJumpOld || onJumpNew) && (
        <div className={`diff-detail-actions compact ${!onJumpOld || !onJumpNew ? "single" : ""}`}>
          {onJumpOld && (
            <button className="mini-action ghost-action" onClick={onJumpOld} type="button">
              <Search size={13} />
              旧版原文
            </button>
          )}
          {onJumpNew && (
            <button className="mini-action ghost-action" onClick={onJumpNew} type="button">
              <Search size={13} />
              新版原文
            </button>
          )}
        </div>
      )}
      <textarea value={comment} onChange={(event) => onComment(event.target.value)} placeholder="复核备注（可选）" />
      <input value={ignoreReason} onChange={(event) => onIgnoreReason(event.target.value)} placeholder="忽略原因（忽略时可填写）" />
      <div className="diff-detail-actions">
        <button className="primary-action" onClick={onConfirm} disabled={disabled}>
          <CheckCircle2 size={16} />
          {isConfirmed ? "撤回确认" : "确认风险"}
        </button>
        <button className="ghost-action" onClick={onIgnore} disabled={disabled}>
          <XCircle size={16} />
          {isIgnored ? "撤回忽略" : "忽略风险"}
        </button>
      </div>
    </div>
  );
}
function DetailBlock({ title, value }: { title: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="detail-block">
      <div>
        <CircleDot size={14} />
        {title}
      </div>
      <p>{value}</p>
    </div>
  );
}
