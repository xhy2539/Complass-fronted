import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useContractStore = defineStore('contract', () => {
  const contractText = ref('')
  const diagnosticResults = ref([])
  const highlightedRanges = ref([])
  const currentDiagnostic = ref(null)
  const isLoading = ref(false)

  const mockContract = `甲方：北京科技有限公司
地址：北京市朝阳区科技园区A座1001室
法定代表人：张三

乙方：上海贸易有限公司
地址：上海市浦东新区陆家嘴金融中心88号
法定代表人：李四

根据《中华人民共和国合同法》及相关法律法规，甲乙双方本着平等互利、诚实信用的原则，经友好协商，就乙方购买甲方产品事宜达成如下协议：

第一条 产品名称及规格
1.1 产品名称：智能办公系统V2.0
1.2 产品规格：详见附件一《产品规格说明》

第二条 数量及价款
2.1 数量：壹套
2.2 单价：人民币伍拾万元整（￥500,000.00）
2.3 总价款：人民币伍拾万元整（￥500,000.00）

第三条 付款方式
3.1 合同签订后3个工作日内，乙方向甲方支付合同总价款的30%作为预付款，即人民币壹拾伍万元整（￥150,000.00）。
3.2 产品交付并验收合格后5个工作日内，乙方向甲方支付合同总价款的60%，即人民币叁拾万元整（￥300,000.00）。
3.3 质保期届满后10个工作日内，乙方向甲方支付合同总价款的10%作为质保金，即人民币伍万元整（￥50,000.00）。

第四条 交付与验收
4.1 交付时间：合同签订后30个工作日内
4.2 交付地点：乙方指定地点
4.3 验收标准：按照附件一《产品规格说明》执行

第五条 质保期
5.1 质保期为产品交付验收合格后12个月
5.2 在质保期内，甲方负责免费维修或更换因产品质量问题出现故障的零部件。

第六条 违约责任
6.1 甲方逾期交付产品的，每逾期一日，应向乙方支付合同总价款的0.1%作为违约金；逾期超过15日的，乙方有权解除合同，并要求甲方返还已支付的款项。
6.2 乙方逾期支付款项的，每逾期一日，应向甲方支付逾期金额的0.1%作为违约金。

第七条 争议解决
7.1 本合同的履行过程中如发生争议，双方应首先友好协商解决；协商不成的，任何一方均可向合同签订地有管辖权的人民法院提起诉讼。

第八条 其他条款
8.1 本合同自双方签字盖章之日起生效。
8.2 本合同一式两份，甲乙双方各执一份，具有同等法律效力。
8.3 本合同未尽事宜，可由双方另行签订补充协议。

甲方（盖章）：
法定代表人（签字）：
日期：2024年1月15日

乙方（盖章）：
法定代表人（签字）：
日期：2024年1月15日`

  const mockDiagnostics = [
    {
      id: 1,
      type: 'risk',
      severity: 'high',
      title: '付款比例风险',
      description: '预付款比例高达30%，超过行业常规的20%标准，存在资金占用风险。',
      suggestion: '建议将预付款比例调整为合同总价款的20%，即人民币壹拾万元整（￥100,000.00）。',
      start: 356,
      end: 380
    },
    {
      id: 2,
      type: 'risk',
      severity: 'medium',
      title: '违约金比例偏低',
      description: '违约金比例为每日0.1%，低于行业常见的0.3%-0.5%标准，对违约方约束不足。',
      suggestion: '建议将违约金比例调整为每日0.3%，以增强合同约束力。',
      start: 548,
      end: 565
    },
    {
      id: 3,
      type: 'warning',
      severity: 'low',
      title: '质保期约定不明确',
      description: '质保期仅约定为12个月，但未明确是否包含软件升级服务。',
      suggestion: '建议明确质保期内是否包含免费软件升级服务。',
      start: 478,
      end: 498
    },
    {
      id: 4,
      type: 'risk',
      severity: 'high',
      title: '争议解决地未明确',
      description: '合同中约定向合同签订地法院提起诉讼，但未明确合同签订地具体位置。',
      suggestion: '建议明确合同签订地为：北京市朝阳区。',
      start: 620,
      end: 645
    },
    {
      id: 5,
      type: 'warning',
      severity: 'low',
      title: '交付地点表述模糊',
      description: '"乙方指定地点"表述较为模糊，建议明确具体地址。',
      suggestion: '建议明确交付地点为乙方注册地址：上海市浦东新区陆家嘴金融中心88号。',
      start: 435,
      end: 450
    }
  ]

  const riskCount = computed(() => 
    diagnosticResults.value.filter(d => d.severity === 'high').length
  )

  const warningCount = computed(() => 
    diagnosticResults.value.filter(d => d.severity === 'medium' || d.severity === 'low').length
  )

  function loadMockData() {
    contractText.value = mockContract
    diagnosticResults.value = mockDiagnostics
  }

  function setCurrentDiagnostic(diagnostic) {
    currentDiagnostic.value = diagnostic
    if (diagnostic) {
      highlightedRanges.value = [{ start: diagnostic.start, end: diagnostic.end }]
    } else {
      highlightedRanges.value = []
    }
  }

  function addHighlightRange(range) {
    highlightedRanges.value.push(range)
  }

  function clearHighlights() {
    highlightedRanges.value = []
    currentDiagnostic.value = null
  }

  function acceptSuggestion(diagnosticId) {
    const diagnostic = diagnosticResults.value.find(d => d.id === diagnosticId)
    if (diagnostic && diagnostic.suggestion) {
      const before = contractText.value.substring(0, diagnostic.start)
      const after = contractText.value.substring(diagnostic.end)
      contractText.value = before + diagnostic.suggestion + after
      
      diagnosticResults.value = diagnosticResults.value.filter(d => d.id !== diagnosticId)
      if (currentDiagnostic.value?.id === diagnosticId) {
        currentDiagnostic.value = null
        highlightedRanges.value = []
      }
    }
  }

  function runDiagnosis() {
    isLoading.value = true
    setTimeout(() => {
      diagnosticResults.value = mockDiagnostics
      isLoading.value = false
    }, 1500)
  }

  return {
    contractText,
    diagnosticResults,
    highlightedRanges,
    currentDiagnostic,
    isLoading,
    mockContract,
    riskCount,
    warningCount,
    loadMockData,
    setCurrentDiagnostic,
    addHighlightRange,
    clearHighlights,
    acceptSuggestion,
    runDiagnosis
  }
})