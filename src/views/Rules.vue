<template>
  <div class="rules-container">
    <header class="rules-header">
      <div class="header-left">
        <router-link to="/" class="logo">
          <span>🧭</span>
          <span>合规罗盘</span>
        </router-link>
      </div>
      <div class="header-center">
        <h1>规则配置中心</h1>
      </div>
      <div class="header-right">
        <span class="enabled-count">已启用 {{ store.enabledCount() }} / {{ store.rules.length }} 条规则</span>
      </div>
    </header>

    <div class="rules-body">
      <div class="sidebar">
        <div class="category-list">
          <div 
            v-for="category in store.categories" 
            :key="category.id"
            class="category-item"
            :class="{ active: selectedCategory === category.id }"
            @click="selectedCategory = category.id"
          >
            <span class="category-icon">{{ category.icon }}</span>
            <span class="category-name">{{ category.name }}</span>
            <span class="category-count">{{ getCategoryCount(category.id) }}</span>
          </div>
        </div>
      </div>

      <div class="main-content">
        <div class="content-header">
          <h2>{{ currentCategoryName }}</h2>
          <button class="btn-add" @click="showAddModal = true">+ 添加规则</button>
        </div>

        <div class="rules-list">
          <div 
            v-for="rule in filteredRules" 
            :key="rule.id"
            class="rule-card"
          >
            <div class="rule-header">
              <div class="rule-info">
                <span class="rule-name">{{ rule.name }}</span>
                <span class="rule-desc">{{ rule.description }}</span>
              </div>
              <div class="rule-actions">
                <label class="toggle-switch">
                  <input 
                    type="checkbox" 
                    :checked="rule.enabled"
                    @change="store.toggleRule(rule.id)"
                  />
                  <span class="slider"></span>
                </label>
                <button 
                  class="btn-delete" 
                  @click="store.deleteRule(rule.id)"
                  title="删除规则"
                >
                  🗑️
                </button>
              </div>
            </div>
            <div v-if="Object.keys(rule.params).length > 0" class="rule-params">
              <div class="params-label">参数配置</div>
              <div class="params-content">
                <div 
                  v-for="(value, key) in rule.params" 
                  :key="key"
                  class="param-item"
                >
                  <span class="param-name">{{ getParamLabel(key) }}</span>
                  <input 
                    type="number" 
                    :value="value"
                    @input="updateParam(rule.id, key, $event.target.value)"
                    class="param-input"
                  />
                  <span class="param-unit">{{ getParamUnit(key) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="upload-section">
          <h3>📁 批量上传历史合同</h3>
          <p class="upload-desc">上传企业历史标准合同，系统自动逆向抽取商业条款共性，生成专属审查草案</p>
          <div class="upload-area" @click="triggerFileInput" @dragover.prevent @drop="handleDrop">
            <input 
              ref="fileInputRef"
              type="file" 
              accept=".docx,.pdf"
              multiple
              @change="handleFileSelect"
              class="file-input"
            />
            <div class="upload-icon">📤</div>
            <div class="upload-text">点击或拖拽文件到此处上传</div>
            <div class="upload-hint">支持 .docx、.pdf 格式，单次最多上传10个文件</div>
          </div>

          <div v-if="store.uploadHistory.length > 0" class="upload-history">
            <h4>上传历史</h4>
            <div class="history-list">
              <div 
                v-for="item in store.uploadHistory" 
                :key="item.id"
                class="history-item"
              >
                <div class="history-info">
                  <span class="history-icon">{{ item.status === 'processed' ? '✅' : '⏳' }}</span>
                  <span class="history-name">{{ item.fileName }}</span>
                </div>
                <div class="history-meta">
                  <span class="history-time">{{ item.uploadTime }}</span>
                  <span v-if="item.status === 'processed'" class="history-extracted">
                    提取 {{ item.rulesExtracted }} 条规则
                  </span>
                  <span v-else class="history-pending">处理中...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>添加新规则</h3>
          <button class="modal-close" @click="showAddModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>规则名称</label>
            <input 
              v-model="newRule.name" 
              type="text" 
              placeholder="输入规则名称"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label>规则描述</label>
            <textarea 
              v-model="newRule.description" 
              placeholder="输入规则描述"
              class="form-textarea"
            ></textarea>
          </div>
          <div class="form-group">
            <label>规则分类</label>
            <select v-model="newRule.category" class="form-select">
              <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">
                {{ cat.icon }} {{ cat.name }}
              </option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showAddModal = false">取消</button>
          <button class="btn-confirm" @click="addNewRule">确认添加</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useRulesStore } from '@/stores/rules'

const store = useRulesStore()
const selectedCategory = ref('payment')
const showAddModal = ref(false)
const fileInputRef = ref(null)

const newRule = reactive({
  name: '',
  description: '',
  category: 'payment'
})

const currentCategoryName = computed(() => {
  const category = store.categories.find(c => c.id === selectedCategory.value)
  return category ? `${category.icon} ${category.name}` : '全部规则'
})

const filteredRules = computed(() => {
  return store.rules.filter(r => r.category === selectedCategory.value)
})

function getCategoryCount(categoryId) {
  return store.rules.filter(r => r.category === categoryId).length
}

function getParamLabel(key) {
  const labels = {
    maxPercentage: '最大比例',
    minPercentage: '最小比例',
    minRate: '最低比例',
    maxDays: '最大天数',
    minMonths: '最小月份'
  }
  return labels[key] || key
}

function getParamUnit(key) {
  const units = {
    maxPercentage: '%',
    minPercentage: '%',
    minRate: '%',
    maxDays: '天',
    minMonths: '月'
  }
  return units[key] || ''
}

function updateParam(ruleId, key, value) {
  store.updateRuleParams(ruleId, { [key]: parseFloat(value) || 0 })
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileSelect(event) {
  const files = Array.from(event.target.files || [])
  files.forEach(file => {
    store.uploadContract(file)
  })
  event.target.value = ''
}

function handleDrop(event) {
  const files = Array.from(event.dataTransfer?.files || [])
  files.forEach(file => {
    store.uploadContract(file)
  })
}

function addNewRule() {
  if (!newRule.name.trim() || !newRule.description.trim()) {
    alert('请填写完整的规则信息')
    return
  }
  store.addRule({ ...newRule })
  newRule.name = ''
  newRule.description = ''
  newRule.category = 'payment'
  showAddModal.value = false
}
</script>

<style lang="scss" scoped>
.rules-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.rules-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: white;
  border-bottom: 1px solid #e0e0e0;
}

.header-left .logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  color: #667eea;
  font-weight: 600;
  font-size: 1.1rem;
}

.header-center h1 {
  font-size: 1.25rem;
  color: #333;
}

.enabled-count {
  padding: 0.5rem 1rem;
  background: #ecfdf5;
  color: #059669;
  border-radius: 20px;
  font-size: 0.85rem;
}

.rules-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 200px;
  background: white;
  border-right: 1px solid #e0e0e0;
}

.category-list {
  padding: 0.5rem;
}

.category-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  margin-bottom: 0.25rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f5f7fa;
  }

  &.active {
    background: #667eea;
    color: white;
  }
}

.category-icon {
  font-size: 1.1rem;
  margin-right: 0.5rem;
}

.category-name {
  flex: 1;
}

.category-count {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.content-header h2 {
  font-size: 1.1rem;
  color: #333;
}

.btn-add {
  padding: 0.5rem 1rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s;

  &:hover {
    background: #5a6fd6;
  }
}

.rules-list {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.rule-card {
  padding: 1rem;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rule-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 0.25rem;
  display: block;
}

.rule-desc {
  font-size: 0.85rem;
  color: #666;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  margin-right: 0.5rem;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.3s;
  border-radius: 24px;

  &::before {
    position: absolute;
    content: '';
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }
}

.toggle-switch input:checked + .slider {
  background-color: #667eea;
}

.toggle-switch input:checked + .slider::before {
  transform: translateX(20px);
}

.btn-delete {
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
}

.rule-params {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed #e0e0e0;
}

.params-label {
  font-size: 0.75rem;
  color: #999;
  margin-bottom: 0.5rem;
}

.params-content {
  display: flex;
  gap: 1rem;
}

.param-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.param-name {
  font-size: 0.85rem;
  color: #666;
  min-width: 60px;
}

.param-input {
  width: 80px;
  padding: 0.25rem 0.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 0.85rem;
}

.param-unit {
  font-size: 0.75rem;
  color: #999;
}

.upload-section {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
}

.upload-section h3 {
  margin-bottom: 0.5rem;
  color: #333;
}

.upload-desc {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 1rem;
}

.upload-area {
  border: 2px dashed #e0e0e0;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #667eea;
    background: #f8fafc;
  }
}

.file-input {
  display: none;
}

.upload-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.upload-text {
  font-weight: 500;
  color: #333;
  margin-bottom: 0.25rem;
}

.upload-hint {
  font-size: 0.75rem;
  color: #999;
}

.upload-history {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #f0f0f0;
}

.upload-history h4 {
  margin-bottom: 0.75rem;
  color: #333;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 6px;
}

.history-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.history-icon {
  font-size: 0.9rem;
}

.history-name {
  font-size: 0.85rem;
  color: #333;
}

.history-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.history-time {
  font-size: 0.75rem;
  color: #999;
}

.history-extracted {
  font-size: 0.75rem;
  color: #059669;
  background: #ecfdf5;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
}

.history-pending {
  font-size: 0.75rem;
  color: #f59e0b;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  font-size: 1rem;
  color: #333;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: #999;
}

.modal-body {
  padding: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  color: #333;
  margin-bottom: 0.25rem;
}

.form-input, .form-textarea, .form-select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 0.9rem;
}

.form-textarea {
  min-height: 80px;
  resize: vertical;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid #e0e0e0;
}

.btn-cancel {
  padding: 0.5rem 1rem;
  background: #f5f7fa;
  color: #666;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-confirm {
  padding: 0.5rem 1rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}
</style>