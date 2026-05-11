import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useRulesStore = defineStore('rules', () => {
  const rules = ref([
    {
      id: 1,
      category: 'payment',
      name: '预付款比例限制',
      description: '预付款比例不得超过合同总价款的20%',
      enabled: true,
      params: { maxPercentage: 20 }
    },
    {
      id: 2,
      category: 'payment',
      name: '质保金比例限制',
      description: '质保金比例不得低于合同总价款的5%',
      enabled: true,
      params: { minPercentage: 5 }
    },
    {
      id: 3,
      category: 'penalty',
      name: '违约金比例下限',
      description: '逾期付款违约金比例不得低于每日0.3%',
      enabled: true,
      params: { minRate: 0.3 }
    },
    {
      id: 4,
      category: 'penalty',
      name: '逾期交付违约金',
      description: '逾期交付违约金比例不得低于每日0.3%',
      enabled: false,
      params: { minRate: 0.3 }
    },
    {
      id: 5,
      category: 'delivery',
      name: '交付周期限制',
      description: '产品交付周期不得超过30个工作日',
      enabled: true,
      params: { maxDays: 30 }
    },
    {
      id: 6,
      category: 'warranty',
      name: '质保期最低要求',
      description: '质保期不得少于12个月',
      enabled: true,
      params: { minMonths: 12 }
    },
    {
      id: 7,
      category: 'warranty',
      name: '质保范围明确',
      description: '质保条款需明确包含软件升级服务',
      enabled: false,
      params: {}
    },
    {
      id: 8,
      category: 'dispute',
      name: '争议解决地明确',
      description: '需明确合同签订地具体位置',
      enabled: true,
      params: {}
    },
    {
      id: 9,
      category: 'dispute',
      name: '仲裁条款优先',
      description: '建议优先选择仲裁方式解决争议',
      enabled: false,
      params: {}
    },
    {
      id: 10,
      category: 'misc',
      name: '合同有效期明确',
      description: '需明确合同有效期限',
      enabled: true,
      params: {}
    }
  ])

  const categories = ref([
    { id: 'payment', name: '付款条款', icon: '💰' },
    { id: 'penalty', name: '违约条款', icon: '⚖️' },
    { id: 'delivery', name: '交付条款', icon: '📦' },
    { id: 'warranty', name: '质保条款', icon: '🛡️' },
    { id: 'dispute', name: '争议解决', icon: '⚔️' },
    { id: 'misc', name: '其他条款', icon: '📝' }
  ])

  const uploadHistory = ref([
    { id: 1, fileName: '标准采购合同模板.docx', uploadTime: '2024-01-10 14:30', status: 'processed', rulesExtracted: 5 },
    { id: 2, fileName: '服务协议范本.docx', uploadTime: '2024-01-08 09:15', status: 'processed', rulesExtracted: 3 },
    { id: 3, fileName: '技术合作协议.pdf', uploadTime: '2024-01-05 16:45', status: 'pending', rulesExtracted: 0 }
  ])

  function toggleRule(id) {
    const rule = rules.value.find(r => r.id === id)
    if (rule) {
      rule.enabled = !rule.enabled
    }
  }

  function updateRuleParams(id, params) {
    const rule = rules.value.find(r => r.id === id)
    if (rule) {
      rule.params = { ...rule.params, ...params }
    }
  }

  function addRule(rule) {
    const newId = Math.max(...rules.value.map(r => r.id)) + 1
    rules.value.push({ ...rule, id: newId, enabled: false })
  }

  function deleteRule(id) {
    rules.value = rules.value.filter(r => r.id !== id)
  }

  function uploadContract(file) {
    const newFile = {
      id: Date.now(),
      fileName: file.name,
      uploadTime: new Date().toLocaleString('zh-CN'),
      status: 'pending',
      rulesExtracted: 0
    }
    uploadHistory.value.unshift(newFile)
    
    setTimeout(() => {
      const uploaded = uploadHistory.value.find(f => f.id === newFile.id)
      if (uploaded) {
        uploaded.status = 'processed'
        uploaded.rulesExtracted = Math.floor(Math.random() * 5) + 2
      }
    }, 2000)
  }

  const enabledCount = () => rules.value.filter(r => r.enabled).length

  return {
    rules,
    categories,
    uploadHistory,
    toggleRule,
    updateRuleParams,
    addRule,
    deleteRule,
    uploadContract,
    enabledCount
  }
})