import type {
  ReverseCandidateRule,
  ReverseRuleCandidateDecision,
  ReverseRuleCandidateListResponse,
  ReverseRuleCreateTaskInput,
  ReverseRuleCreateTaskResponse,
  ReverseRuleImportResult,
  ReverseRuleTask,
  ReverseRuleTaskListParams,
  ReverseRuleTaskListResponse,
  Rule
} from "./types";

const now = "2026-06-01T10:30:00+08:00";

function cloneTask(task: ReverseRuleTask): ReverseRuleTask {
  return {
    ...task,
    steps: task.steps?.map((step) => ({ ...step })),
    pairs: task.pairs?.map((pair) => ({ ...pair }))
  };
}

function cloneCandidate(candidate: ReverseCandidateRule): ReverseCandidateRule {
  return {
    ...candidate,
    traces: candidate.traces.map((trace) => ({ ...trace }))
  };
}

function taskStats(candidates: ReverseCandidateRule[]) {
  return {
    candidate_rule_count: candidates.length,
    included_count: candidates.filter((candidate) => candidate.decision === "included").length,
    ignored_count: candidates.filter((candidate) => candidate.decision === "ignored").length,
    pending_count: candidates.filter((candidate) => candidate.decision === "pending").length
  };
}

function mockTask(task: ReverseRuleTask): ReverseRuleTask {
  return task;
}

function taskTimestamp(value?: string | null) {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

const seedCandidates: ReverseCandidateRule[] = [
  {
    candidate_id: "cand-payment-001",
    task_id: "confirm-task",
    contract_type: "采购合同",
    review_role: "乙方",
    review_module: "付款条款",
    risk_name: "付款期限过长",
    check_point: "检查付款期限是否超过合理周期。",
    trigger_condition: "验收后付款期限超过 30 日时触发。",
    default_risk_level: "中",
    suggestion_template: "建议将付款期限调整为验收并收到合法有效发票后 30 日内。",
    example_clause: "甲方应在验收后 90 日内向乙方支付服务费。",
    confidence: 0.88,
    source_pair: "pair-1",
    decision: "pending",
    traces: [
      {
        pair_id: "pair-1",
        evidence_before: "甲方应在验收后90日内向乙方支付服务费。",
        evidence_after: "甲方应在验收并收到合法有效发票后30日内向乙方支付服务费。",
        diff_summary: "付款期限由 90 日缩短为 30 日，并新增发票条件。",
        user_intent: "控制回款周期并明确付款前置条件。",
        confidence: 0.88
      }
    ]
  },
  {
    candidate_id: "cand-ip-002",
    task_id: "confirm-task",
    contract_type: "采购合同",
    review_role: "乙方",
    review_module: "知识产权",
    risk_name: "交付成果权属不清",
    check_point: "检查交付成果知识产权归属和授权范围。",
    trigger_condition: "条款未明确乙方既有技术或第三方组件权利边界时触发。",
    default_risk_level: "高",
    suggestion_template: "建议区分新开发成果、乙方既有技术和第三方组件的权利归属。",
    example_clause: "项目成果全部知识产权归甲方所有。",
    confidence: 0.81,
    source_pair: "pair-2",
    decision: "pending",
    traces: [
      {
        pair_id: "pair-2",
        evidence_before: "项目成果全部知识产权归甲方所有。",
        evidence_after: "新开发成果归甲方所有，乙方既有技术仍归乙方所有。",
        diff_summary: "知识产权归属从概括归甲方调整为分层归属。",
        user_intent: "保留乙方既有技术权利。",
        confidence: 0.81
      }
    ]
  },
  {
    candidate_id: "cand-liability-003",
    task_id: "confirm-task",
    contract_type: "服务合同",
    review_role: "乙方",
    review_module: "违约责任",
    risk_name: "责任上限缺失",
    check_point: "检查违约赔偿是否设置责任上限。",
    trigger_condition: "违约责任未设置总赔偿上限时触发。",
    default_risk_level: "高",
    suggestion_template: "建议约定累计赔偿责任不超过合同总价。",
    example_clause: "乙方应赔偿甲方因此遭受的全部损失。",
    confidence: 0.79,
    source_pair: "pair-3",
    decision: "ignored",
    traces: [
      {
        pair_id: "pair-3",
        evidence_before: "乙方应赔偿甲方因此遭受的全部损失。",
        evidence_after: "乙方累计赔偿责任不超过合同总价。",
        diff_summary: "新增责任上限。",
        user_intent: "控制违约赔偿敞口。",
        confidence: 0.79
      }
    ]
  }
];

let tasks: ReverseRuleTask[] = [
  {
    id: "parsing-task",
    task_name: "智能设备采购合同规则提炼",
    status: "parsing",
    progress: 45,
    pair_count: 3,
    ...taskStats(seedCandidates),
    contract_type: "采购合同",
    review_role: "乙方",
    rule_version: "当前版本",
    created_at: now,
    updated_at: now,
    steps: [
      { key: "uploaded", name: "上传完成", status: "completed" },
      { key: "diff", name: "差异识别", status: "completed" },
      { key: "retrieval", name: "案例检索", status: "running" },
      { key: "generation", name: "规则生成", status: "pending" },
      { key: "summary", name: "结果汇总", status: "pending" }
    ],
    pairs: [
      { pair_id: "pair-1", pair_name: "付款条款组", before_file_name: "采购合同_旧版.docx", after_file_name: "采购合同_新版.docx", status: "completed", candidate_rule_count: 1 },
      { pair_id: "pair-2", pair_name: "知识产权组", before_file_name: "服务合同_旧版.docx", after_file_name: "服务合同_新版.docx", status: "running", candidate_rule_count: 1 },
      { pair_id: "pair-3", pair_name: "违约责任组", before_file_name: "运维合同_旧版.docx", after_file_name: "运维合同_新版.docx", status: "pending", candidate_rule_count: 1 }
    ]
  },
  {
    id: "confirm-task",
    task_name: "服务合同候选规则确认",
    status: "pending_confirm",
    progress: 100,
    pair_count: 3,
    ...taskStats(seedCandidates),
    contract_type: "服务合同",
    review_role: "乙方",
    rule_version: "当前版本",
    created_at: now,
    updated_at: now,
    steps: [
      { key: "uploaded", name: "上传完成", status: "completed" },
      { key: "diff", name: "差异识别", status: "completed" },
      { key: "retrieval", name: "案例检索", status: "completed" },
      { key: "generation", name: "规则生成", status: "completed" },
      { key: "summary", name: "结果汇总", status: "completed" }
    ],
    pairs: [
      { pair_id: "pair-1", pair_name: "付款条款组", status: "completed", candidate_rule_count: 1 },
      { pair_id: "pair-2", pair_name: "知识产权组", status: "completed", candidate_rule_count: 1 },
      { pair_id: "pair-3", pair_name: "违约责任组", status: "completed", candidate_rule_count: 1 }
    ]
  },
  {
    id: "failed-task",
    task_name: "房屋租赁合同解析失败样例",
    status: "failed",
    progress: 60,
    pair_count: 2,
    candidate_rule_count: 0,
    included_count: 0,
    ignored_count: 0,
    pending_count: 0,
    contract_type: "租赁合同",
    review_role: "甲方",
    created_at: now,
    updated_at: now,
    failed_at: now,
    error_type: "llm_generation_failed",
    error_message: "规则生成节点返回内容未通过 JSON 校验。",
    steps: [
      { key: "uploaded", name: "上传完成", status: "completed" },
      { key: "diff", name: "差异识别", status: "completed" },
      { key: "retrieval", name: "案例检索", status: "completed" },
      { key: "generation", name: "规则生成", status: "failed" },
      { key: "summary", name: "结果汇总", status: "pending" }
    ],
    pairs: [
      { pair_id: "pair-1", pair_name: "租赁期限组", status: "completed", candidate_rule_count: 0 },
      { pair_id: "pair-2", pair_name: "押金条款组", status: "failed", candidate_rule_count: 0 }
    ]
  },
  {
    id: "completed-task",
    task_name: "商业保密协议规则已入库",
    status: "completed",
    progress: 100,
    pair_count: 1,
    candidate_rule_count: 3,
    included_count: 2,
    ignored_count: 1,
    pending_count: 0,
    contract_type: "保密协议",
    review_role: "中立",
    created_at: now,
    updated_at: now,
    completed_at: now
  },
  mockTask({
    id: "software-task",
    task_name: "软件开发合同规则提取",
    status: "completed",
    progress: 100,
    pair_count: 2,
    candidate_rule_count: 18,
    included_count: 14,
    ignored_count: 4,
    pending_count: 0,
    contract_type: "软件开发合同",
    review_role: "乙方",
    created_at: "2026-05-30T11:21:00+08:00",
    updated_at: "2026-05-30T11:35:00+08:00",
    completed_at: "2026-05-30T11:35:00+08:00"
  }),
  mockTask({
    id: "service-outsourcing-task",
    task_name: "服务外包合同规则提取",
    status: "failed",
    progress: 0,
    pair_count: 2,
    candidate_rule_count: 0,
    included_count: 0,
    ignored_count: 0,
    pending_count: 0,
    contract_type: "服务外包合同",
    review_role: "甲方",
    created_at: "2026-05-29T10:12:00+08:00",
    updated_at: "2026-05-29T10:16:00+08:00",
    failed_at: "2026-05-29T10:16:00+08:00",
    error_type: "diff_parse_failed",
    error_message: "合同差异识别失败。"
  }),
  mockTask({
    id: "cancelled-task",
    task_name: "采购合同规则提取",
    status: "cancelled",
    progress: 0,
    pair_count: 1,
    candidate_rule_count: 0,
    included_count: 0,
    ignored_count: 0,
    pending_count: 0,
    contract_type: "采购合同",
    review_role: "中立",
    created_at: "2026-05-28T14:33:00+08:00",
    updated_at: "2026-05-28T14:35:00+08:00"
  })
];

let candidatesByTask: Record<string, ReverseCandidateRule[]> = {
  "confirm-task": seedCandidates.map(cloneCandidate),
  "completed-task": seedCandidates.map((candidate, index) => ({
    ...cloneCandidate(candidate),
    task_id: "completed-task",
    decision: index < 2 ? "included" : "ignored"
  }))
};

function syncTaskStats(taskId: string) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;
  const stats = taskStats(candidatesByTask[taskId] ?? []);
  Object.assign(task, stats, { updated_at: new Date().toISOString() });
}

function advanceTask(task: ReverseRuleTask) {
  if (task.status !== "parsing") return;
  task.progress = Math.min(100, task.progress + 25);
  task.updated_at = new Date().toISOString();
  if (task.progress >= 100) {
    task.status = "pending_confirm";
    task.steps = task.steps?.map((step) => ({ ...step, status: "completed" }));
    task.pairs = task.pairs?.map((pair) => ({ ...pair, status: "completed" }));
  } else if (task.steps) {
    task.steps = task.steps.map((step) => {
      if (task.progress >= 75 && step.key === "generation") return { ...step, status: "running" };
      if (task.progress >= 70 && step.key === "retrieval") return { ...step, status: "completed" };
      return step;
    });
  }
}

function taskCandidates(taskId: string) {
  if (!candidatesByTask[taskId]) {
    candidatesByTask[taskId] = seedCandidates.map((candidate) => ({ ...cloneCandidate(candidate), task_id: taskId, decision: "pending" }));
  }
  return candidatesByTask[taskId];
}

export const reverseRuleMock = {
  async listTasks(params: ReverseRuleTaskListParams = {}): Promise<ReverseRuleTaskListResponse> {
    let filtered = tasks;
    if (params.status) filtered = filtered.filter((task) => task.status === params.status);
    if (params.contract_type) filtered = filtered.filter((task) => task.contract_type?.includes(params.contract_type ?? ""));
    if (params.created_from) {
      const from = taskTimestamp(`${params.created_from}T00:00:00+08:00`);
      filtered = filtered.filter((task) => taskTimestamp(task.created_at) >= from);
    }
    if (params.created_to) {
      const to = taskTimestamp(`${params.created_to}T23:59:59+08:00`);
      filtered = filtered.filter((task) => taskTimestamp(task.created_at) <= to);
    }
    const skip = params.skip ?? 0;
    const limit = params.limit ?? 20;
    return {
      tasks: filtered.slice(skip, skip + limit).map(cloneTask),
      total: filtered.length,
      skip,
      limit
    };
  },
  async createTask(payload: ReverseRuleCreateTaskInput): Promise<ReverseRuleCreateTaskResponse> {
    const id = `mock-task-${Date.now()}`;
    const nextCandidates = seedCandidates.map((candidate) => ({ ...cloneCandidate(candidate), task_id: id, decision: "pending" as const }));
    candidatesByTask[id] = nextCandidates;
    const task: ReverseRuleTask = {
      id,
      task_name: payload.task_name,
      status: "parsing",
      progress: 20,
      pair_count: payload.pairs.length,
      ...taskStats(nextCandidates),
      contract_type: payload.contract_type || "自动识别",
      review_role: payload.review_role || "自动识别",
      rule_version_id: payload.rule_version_id || null,
      rule_version: payload.rule_version_id ? null : "当前版本",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      steps: [
        { key: "uploaded", name: "上传完成", status: "completed" },
        { key: "diff", name: "差异识别", status: "running" },
        { key: "retrieval", name: "案例检索", status: "pending" },
        { key: "generation", name: "规则生成", status: "pending" },
        { key: "summary", name: "结果汇总", status: "pending" }
      ],
      pairs: payload.pairs.map((pair, index) => ({
        pair_id: `pair-${index + 1}`,
        pair_name: pair.pair_name,
        before_file_name: pair.before_file.name,
        after_file_name: pair.after_file.name,
        status: index === 0 ? "running" : "pending",
        candidate_rule_count: 0
      }))
    };
    tasks = [task, ...tasks];
    return { task_id: id, status: task.status, task: cloneTask(task), message: "mock task created" };
  },
  async getTask(taskId: string): Promise<ReverseRuleTask> {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("未找到逆向解析任务");
    advanceTask(task);
    return cloneTask(task);
  },
  async getCandidates(taskId: string): Promise<ReverseRuleCandidateListResponse> {
    const candidates = taskCandidates(taskId).map(cloneCandidate);
    return { candidates, total: candidates.length };
  },
  async updateCandidateDecision(candidateId: string, decision: ReverseRuleCandidateDecision): Promise<ReverseCandidateRule> {
    for (const [taskId, candidates] of Object.entries(candidatesByTask)) {
      const candidate = candidates.find((item) => item.candidate_id === candidateId);
      if (candidate) {
        candidate.decision = decision;
        syncTaskStats(taskId);
        return cloneCandidate(candidate);
      }
    }
    throw new Error("未找到候选规则");
  },
  async batchUpdateCandidates(taskId: string, candidateIds: string[], decision: ReverseRuleCandidateDecision): Promise<ReverseRuleCandidateListResponse> {
    const candidates = taskCandidates(taskId);
    candidates.forEach((candidate) => {
      if (candidateIds.includes(candidate.candidate_id)) candidate.decision = decision;
    });
    syncTaskStats(taskId);
    return { candidates: candidates.map(cloneCandidate), total: candidates.length };
  },
  async confirmImport(taskId: string, candidateIds: string[]): Promise<ReverseRuleImportResult> {
    const candidates = taskCandidates(taskId);
    candidates.forEach((candidate) => {
      if (candidateIds.includes(candidate.candidate_id)) candidate.decision = "included";
      else if (candidate.decision === "pending") candidate.decision = "ignored";
    });
    const task = tasks.find((item) => item.id === taskId);
    if (task) {
      task.status = "completed";
      task.progress = 100;
      task.completed_at = new Date().toISOString();
      syncTaskStats(taskId);
    }
    const included = candidates.filter((candidate) => candidate.decision === "included");
    const ignored = candidates.filter((candidate) => candidate.decision === "ignored");
    const imported_rules: Rule[] = included.map((candidate, index) => ({
      id: `mock-rule-${index + 1}`,
      rule_code: `REV-MOCK-${String(index + 1).padStart(3, "0")}`,
      contract_type: candidate.contract_type,
      review_module: candidate.review_module,
      risk_name: candidate.risk_name,
      check_point: candidate.check_point,
      trigger_condition: candidate.trigger_condition,
      default_risk_level: candidate.default_risk_level,
      suggestion_template: candidate.suggestion_template,
      example_clause: candidate.example_clause,
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    return {
      task_id: taskId,
      included_count: included.length,
      ignored_count: ignored.length,
      pair_count: task?.pair_count ?? 0,
      imported_at: new Date().toISOString(),
      imported_rules,
      ignored_rules: ignored.map(cloneCandidate)
    };
  },
  async retryTask(taskId: string): Promise<ReverseRuleTask> {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("未找到逆向解析任务");
    task.status = "parsing";
    task.progress = 25;
    task.error_type = null;
    task.error_message = null;
    task.failed_at = null;
    task.updated_at = new Date().toISOString();
    task.steps = [
      { key: "uploaded", name: "上传完成", status: "completed" },
      { key: "diff", name: "差异识别", status: "running" },
      { key: "retrieval", name: "案例检索", status: "pending" },
      { key: "generation", name: "规则生成", status: "pending" },
      { key: "summary", name: "结果汇总", status: "pending" }
    ];
    return cloneTask(task);
  },
  async exportResult(taskId: string): Promise<Blob> {
    const rows = [["task_id", "risk_name", "decision"], ...taskCandidates(taskId).map((candidate) => [taskId, candidate.risk_name, candidate.decision])];
    return new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  }
};
