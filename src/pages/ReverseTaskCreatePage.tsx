import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, FileText, FileUp, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const MAX_REVERSE_RULE_PAIRS = 5;
const MAX_REVERSE_RULE_FILE_SIZE = 50 * 1024 * 1024;

interface DraftPair {
  id: string;
  pair_name: string;
  before_file: File | null;
  after_file: File | null;
}

function newPair(index: number): DraftPair {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `pair-${Date.now()}-${index}`,
    pair_name: `合同组 ${index}`,
    before_file: null,
    after_file: null
  };
}

function validateDocx(file: File | null) {
  if (!file) return "请选择文件";
  if (!file.name.toLowerCase().endsWith(".docx")) return "仅支持 .docx 文件";
  if (file.size > MAX_REVERSE_RULE_FILE_SIZE) return "文件不能超过 50MB";
  return "";
}

function fileSizeLabel(size: number) {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export function ReverseTaskCreatePage() {
  const navigate = useNavigate();
  const [taskName, setTaskName] = useState("");
  const [contractType, setContractType] = useState("");
  const [reviewRole, setReviewRole] = useState("");
  const [ruleVersionId, setRuleVersionId] = useState("");
  const [pairs, setPairs] = useState<DraftPair[]>(() => [newPair(1)]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const uploadedFileCount = pairs.reduce((count, pair) => count + (pair.before_file ? 1 : 0) + (pair.after_file ? 1 : 0), 0);
  const normalizedTaskName = useMemo(() => taskName.trim() || `逆向解析任务 ${new Date().toLocaleString("zh-CN", { hour12: false })}`, [taskName]);

  function updatePair(id: string, patch: Partial<DraftPair>) {
    setPairs((current) => current.map((pair) => (pair.id === id ? { ...pair, ...patch } : pair)));
  }

  function addPair() {
    if (pairs.length < MAX_REVERSE_RULE_PAIRS) {
      setPairs((current) => [...current, newPair(current.length + 1)]);
    }
  }

  function removePair(id: string) {
    setPairs((current) => (current.length === 1 ? current : current.filter((pair) => pair.id !== id)));
  }

  function validateForm() {
    if (pairs.length < 1 || pairs.length > MAX_REVERSE_RULE_PAIRS) return "合同组数量必须为 1-5 组";
    for (const [index, pair] of pairs.entries()) {
      const beforeError = validateDocx(pair.before_file);
      if (beforeError) return `第 ${index + 1} 组修改前合同：${beforeError}`;
      const afterError = validateDocx(pair.after_file);
      if (afterError) return `第 ${index + 1} 组修改后合同：${afterError}`;
    }
    return "";
  }

  async function submitTask() {
    const validation = validateForm();
    if (validation) {
      setMessage(validation);
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await api.createReverseRuleTask({
        task_name: normalizedTaskName,
        contract_type: contractType.trim() || undefined,
        review_role: reviewRole.trim() || undefined,
        rule_version_id: ruleVersionId.trim() || undefined,
        pairs: pairs.map((pair, index) => ({
          pair_name: pair.pair_name.trim() || `合同组 ${index + 1}`,
          before_file: pair.before_file!,
          after_file: pair.after_file!
        }))
      });
      navigate("/rules/reverse-tasks", { state: { reverseTaskNotice: "任务已创建，请等待解析完成" } });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建解析任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="work-page reverse-page reverse-create-page">
      <header className="page-head compact reverse-create-hero">
        <div>
          <h1>新建逆向解析任务</h1>
          <p>
            上传多组审核前后合同，系统将自动抽取候选规则。
            <strong>建议 1-5 组以获得更快、更稳定的解析结果。</strong>
          </p>
        </div>
        <button className="ghost-action" onClick={() => navigate("/rules/reverse-tasks")}>
          <ArrowLeft size={16} />
          返回任务列表
        </button>
      </header>

      {message && <div className="notice-panel warning">{message}</div>}

      <section className="panel-surface reverse-create-preferences" aria-label="解析偏好">
        <div>
          <h2>解析偏好 <span>（可选）</span></h2>
          <p className="panel-subtitle">未选择时，系统将根据合同内容自动识别。</p>
        </div>
        <label className="field-block">
          任务名称
          <input value={taskName} onChange={(event) => setTaskName(event.target.value)} placeholder={normalizedTaskName} />
        </label>
        <label className="field-block">
          合同类型
          <select value={contractType} onChange={(event) => setContractType(event.target.value)}>
            <option value="">自动识别</option>
            <option value="采购合同">采购合同</option>
            <option value="服务合同">服务合同</option>
            <option value="通用">通用</option>
          </select>
        </label>
        <label className="field-block">
          审核视角
          <select value={reviewRole} onChange={(event) => setReviewRole(event.target.value)}>
            <option value="">自动识别</option>
            <option value="甲方">甲方</option>
            <option value="乙方">乙方</option>
            <option value="中立">中立</option>
          </select>
        </label>
        <label className="field-block">
          规则版本
          <select value={ruleVersionId} onChange={(event) => setRuleVersionId(event.target.value)}>
            <option value="">当前版本</option>
          </select>
        </label>
      </section>

      <section className="panel-surface reverse-pair-panel reverse-create-upload-panel">
        <div className="panel-head">
          <div>
            <h2>合同组上传</h2>
          </div>
        </div>

        <div className="reverse-pair-list">
          {pairs.map((pair, index) => (
            <article className="reverse-pair-row" key={pair.id}>
              <div className="reverse-pair-index">第 {index + 1} 组</div>
              <div className="reverse-pair-fields">
                <label className="field-block">
                  合同组名称
                  <input value={pair.pair_name} onChange={(event) => updatePair(pair.id, { pair_name: event.target.value })} />
                </label>
                <button className="icon-action danger" onClick={() => removePair(pair.id)} disabled={pairs.length === 1} title="删除本组">
                  <Trash2 size={16} />
                </button>
              </div>
              <FileSlot
                label="修改前合同"
                file={pair.before_file}
                onChange={(file) => updatePair(pair.id, { before_file: file })}
              />
              <FileSlot
                label="修改后合同"
                file={pair.after_file}
                onChange={(file) => updatePair(pair.id, { after_file: file })}
              />
            </article>
          ))}
        </div>

        <div className="reverse-create-footer">
          <button className="ghost-action" onClick={addPair} disabled={pairs.length >= MAX_REVERSE_RULE_PAIRS}>
            + 添加合同组
          </button>
          <span className="reverse-create-count">已添加 {pairs.length} 组合同（共 {uploadedFileCount} 个文件）</span>
          <div className="reverse-bottom-actions">
            <button className="ghost-action" onClick={() => navigate("/rules/reverse-tasks")}>取消</button>
            <button className="primary-action" onClick={() => void submitTask()} disabled={submitting}>
              <CheckCircle2 size={16} />
              {submitting ? "创建中..." : "开始解析"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FileSlot({ label, file, onChange }: { label: string; file: File | null; onChange: (file: File | null) => void }) {
  if (file) {
    return (
      <div className="reverse-file-chip">
        <FileText size={18} />
        <span>
          <strong>{file.name}</strong>
          <small>{fileSizeLabel(file.size)}</small>
        </span>
        <button className="icon-action" onClick={() => onChange(null)} title={`移除${label}`}>
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <label className="reverse-file-drop">
      <input type="file" accept=".docx" onChange={(event) => onChange(event.target.files?.[0] ?? null)} />
      <FileUp size={18} />
      <span>点击上传或拖拽文件到此处</span>
      <small>{label}，支持 .docx，单个文件 ≤ 50MB</small>
    </label>
  );
}
