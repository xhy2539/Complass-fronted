<template>
  <div class="im-container">
    <header class="im-header">
      <div class="header-left">
        <router-link to="/" class="logo">
          <span>🧭</span>
          <span>合规罗盘</span>
        </router-link>
      </div>
      <div class="header-center">
        <h1>IM 极速初筛</h1>
      </div>
      <div class="header-right">
        <div class="bot-selector">
          <select v-model="selectedBot" class="bot-select">
            <option value="wecom">💼 企业微信</option>
            <option value="feishu">📧 飞书</option>
          </select>
        </div>
      </div>
    </header>

    <div class="im-body">
      <div class="chat-panel">
        <div class="chat-header">
          <div class="bot-info">
            <span class="bot-avatar">🤖</span>
            <span class="bot-name">合规罗盘 Bot</span>
            <span class="bot-status online"></span>
          </div>
          <div class="chat-actions">
            <button class="action-btn" @click="clearChat">🗑️ 清空</button>
          </div>
        </div>

        <div class="chat-messages" ref="messagesRef">
          <div 
            v-for="(message, index) in messages" 
            :key="index"
            class="message-item"
            :class="{ 'bot-message': message.isBot }"
          >
            <div class="message-avatar">
              {{ message.isBot ? '🤖' : '👤' }}
            </div>
            <div class="message-content">
              <div v-if="message.type === 'text'" class="text-message">
                {{ message.content }}
              </div>
              <div v-else-if="message.type === 'file'" class="file-message">
                <span class="file-icon">📄</span>
                <span class="file-name">{{ message.content }}</span>
                <span class="file-size">{{ message.size }}</span>
              </div>
              <div v-else-if="message.type === 'report'" class="report-message">
                <div class="report-header">
                  <span class="report-title">📊 风险简报</span>
                  <span class="report-time">{{ message.time }}</span>
                </div>
                <div class="report-summary">
                  <div class="summary-item high">
                    <span class="summary-icon">🚨</span>
                    <span class="summary-label">高风险</span>
                    <span class="summary-value">{{ message.riskCount.high }}</span>
                  </div>
                  <div class="summary-item medium">
                    <span class="summary-icon">⚠️</span>
                    <span class="summary-label">中风险</span>
                    <span class="summary-value">{{ message.riskCount.medium }}</span>
                  </div>
                  <div class="summary-item low">
                    <span class="summary-icon">ℹ️</span>
                    <span class="summary-label">提示</span>
                    <span class="summary-value">{{ message.riskCount.low }}</span>
                  </div>
                </div>
                <div class="report-details">
                  <div 
                    v-for="(risk, idx) in message.riskDetails" 
                    :key="idx"
                    class="risk-detail"
                    :class="risk.severity"
                  >
                    <span class="risk-icon">{{ risk.icon }}</span>
                    <span class="risk-text">{{ risk.text }}</span>
                  </div>
                </div>
                <div class="report-action">
                  <button class="btn-view-detail" @click="$router.push('/workbench')">
                    🔍 前往工作台查看详情
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-if="isProcessing" class="processing-indicator">
            <div class="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span class="processing-text">正在分析合同...</span>
          </div>
        </div>

        <div class="chat-input">
          <div class="input-actions">
            <label class="attach-btn">
              <input 
                type="file" 
                accept=".docx,.pdf"
                @change="handleFileUpload"
                class="file-upload"
              />
              📎
            </label>
          </div>
          <input 
            v-model="inputMessage"
            type="text" 
            placeholder="发送消息或上传合同文件..."
            class="message-input"
            @keyup.enter="sendMessage"
          />
          <button 
            class="send-btn" 
            :disabled="!inputMessage.trim() && !selectedFile"
            @click="sendMessage"
          >
            ➤
          </button>
        </div>
      </div>

      <div class="preview-panel">
        <div class="preview-header">
          <h3>📋 操作指引</h3>
        </div>
        <div class="guide-content">
          <div class="guide-item">
            <div class="guide-step">1️⃣</div>
            <div class="guide-text">点击附件按钮上传合同文件</div>
          </div>
          <div class="guide-item">
            <div class="guide-step">2️⃣</div>
            <div class="guide-text">Bot 自动分析并返回风险简报</div>
          </div>
          <div class="guide-item">
            <div class="guide-step">3️⃣</div>
            <div class="guide-text">点击"前往工作台"查看详细诊断</div>
          </div>
        </div>

        <div class="preview-header">
          <h3>📊 最近审查记录</h3>
        </div>
        <div class="recent-list">
          <div 
            v-for="record in recentRecords" 
            :key="record.id"
            class="recent-item"
            @click="$router.push('/workbench')"
          >
            <div class="recent-icon">📄</div>
            <div class="recent-info">
              <div class="recent-name">{{ record.name }}</div>
              <div class="recent-meta">{{ record.time }} · {{ record.riskLevel }}</div>
            </div>
            <div class="recent-badge" :class="record.severity">
              {{ record.count }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'

const selectedBot = ref('wecom')
const inputMessage = ref('')
const selectedFile = ref(null)
const isProcessing = ref(false)
const messagesRef = ref(null)

const messages = ref([
  {
    isBot: true,
    type: 'text',
    content: '您好！我是合规罗盘 Bot，帮您快速筛查合同风险。请上传合同文件开始分析。'
  }
])

const recentRecords = ref([
  { id: 1, name: '采购合同_20240115.docx', time: '10分钟前', riskLevel: '高风险', severity: 'high', count: 2 },
  { id: 2, name: '服务协议_v2.docx', time: '1小时前', riskLevel: '低风险', severity: 'low', count: 1 },
  { id: 3, name: '技术合作协议.pdf', time: '3小时前', riskLevel: '中风险', severity: 'medium', count: 3 }
])

function sendMessage() {
  if (!inputMessage.value.trim() && !selectedFile.value) return

  if (inputMessage.value.trim()) {
    messages.value.push({
      isBot: false,
      type: 'text',
      content: inputMessage.value
    })
  }

  if (selectedFile.value) {
    messages.value.push({
      isBot: false,
      type: 'file',
      content: selectedFile.value.name,
      size: formatFileSize(selectedFile.value.size)
    })
    selectedFile.value = null
  }

  inputMessage.value = ''
  
  nextTick(() => {
    scrollToBottom()
  })

  isProcessing.value = true

  setTimeout(() => {
    const mockReport = generateMockReport()
    messages.value.push(mockReport)
    isProcessing.value = false
    nextTick(() => {
      scrollToBottom()
    })
  }, 2000)
}

function handleFileUpload(event) {
  const file = event.target.files?.[0]
  if (file) {
    selectedFile.value = file
  }
}

function clearChat() {
  messages.value = [{
    isBot: true,
    type: 'text',
    content: '您好！我是合规罗盘 Bot，帮您快速筛查合同风险。请上传合同文件开始分析。'
  }]
}

function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function generateMockReport() {
  const highCount = Math.floor(Math.random() * 3) + 1
  const mediumCount = Math.floor(Math.random() * 3)
  const lowCount = Math.floor(Math.random() * 4)

  const riskDetails = []
  if (highCount > 0) {
    riskDetails.push({ severity: 'high', icon: '🚨', text: '预付款比例30%，超过行业常规标准' })
  }
  if (highCount > 1) {
    riskDetails.push({ severity: 'high', icon: '🚨', text: '争议解决地未明确约定' })
  }
  if (mediumCount > 0) {
    riskDetails.push({ severity: 'medium', icon: '⚠️', text: '违约金比例偏低，建议调整至0.3%' })
  }
  if (lowCount > 0) {
    riskDetails.push({ severity: 'low', icon: 'ℹ️', text: '质保期未明确是否包含升级服务' })
  }

  return {
    isBot: true,
    type: 'report',
    time: new Date().toLocaleTimeString('zh-CN'),
    riskCount: {
      high: highCount,
      medium: mediumCount,
      low: lowCount
    },
    riskDetails
  }
}
</script>

<style lang="scss" scoped>
.im-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.im-header {
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

.bot-select {
  padding: 0.375rem 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: white;
  font-size: 0.85rem;
}

.im-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  margin: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #f0f0f0;
}

.bot-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bot-avatar {
  font-size: 1.5rem;
}

.bot-name {
  font-weight: 600;
  color: #333;
}

.bot-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;

  &.online {
    background: #10b981;
  }
}

.action-btn {
  padding: 0.375rem 0.75rem;
  background: #f5f7fa;
  border: none;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.message-item {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;

  &.bot-message {
    flex-direction: row-reverse;

    .message-content {
      background: #f0f9ff;
      border-radius: 12px 12px 4px 12px;
    }
  }
}

.message-avatar {
  width: 36px;
  height: 36px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f5f7fa;
  border-radius: 50%;
  font-size: 1rem;
  flex-shrink: 0;
}

.message-content {
  max-width: 70%;
  padding: 0.75rem 1rem;
  background: #f5f7fa;
  border-radius: 12px 12px 12px 4px;
}

.text-message {
  font-size: 0.9rem;
  color: #333;
  line-height: 1.5;
}

.file-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.file-icon {
  font-size: 1.2rem;
}

.file-name {
  font-size: 0.85rem;
  color: #333;
}

.file-size {
  font-size: 0.75rem;
  color: #999;
}

.report-message {
  background: white !important;
  border: 1px solid #e0e0e0;
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.report-title {
  font-weight: 600;
  color: #333;
}

.report-time {
  font-size: 0.75rem;
  color: #999;
}

.report-summary {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem;
  border-radius: 8px;

  &.high {
    background: #fef2f2;
    color: #dc2626;
  }

  &.medium {
    background: #fffbeb;
    color: #d97706;
  }

  &.low {
    background: #eff6ff;
    color: #3b82f6;
  }
}

.summary-icon {
  font-size: 1.2rem;
  margin-bottom: 0.25rem;
}

.summary-label {
  font-size: 0.75rem;
}

.summary-value {
  font-size: 1.25rem;
  font-weight: 700;
}

.report-details {
  margin-bottom: 1rem;
}

.risk-detail {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  margin-bottom: 0.25rem;
  border-radius: 4px;
  font-size: 0.85rem;

  &.high {
    background: #fef2f2;
    color: #dc2626;
  }

  &.medium {
    background: #fffbeb;
    color: #d97706;
  }

  &.low {
    background: #eff6ff;
    color: #3b82f6;
  }
}

.report-action {
  text-align: center;
}

.btn-view-detail {
  padding: 0.5rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-1px);
  }
}

.processing-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
}

.typing-dots {
  display: flex;
  gap: 4px;

  span {
    width: 6px;
    height: 6px;
    background: #999;
    border-radius: 50%;
    animation: typing 1.4s infinite ease-in-out;

    &:nth-child(1) { animation-delay: 0s; }
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

@keyframes typing {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.processing-text {
  font-size: 0.85rem;
  color: #999;
}

.chat-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid #f0f0f0;
}

.input-actions {
  display: flex;
  gap: 0.25rem;
}

.attach-btn {
  width: 36px;
  height: 36px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f5f7fa;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.1rem;
  transition: background 0.2s;

  &:hover {
    background: #e8ecf0;
  }
}

.file-upload {
  display: none;
}

.message-input {
  flex: 1;
  height: 36px;
  padding: 0 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 18px;
  font-size: 0.9rem;
  outline: none;

  &:focus {
    border-color: #667eea;
  }
}

.send-btn {
  width: 36px;
  height: 36px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #5a6fd6;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.preview-panel {
  width: 300px;
  background: white;
  margin: 1rem 1rem 1rem 0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow-y: auto;
}

.preview-header {
  padding: 1rem;
  border-bottom: 1px solid #f0f0f0;

  h3 {
    font-size: 0.9rem;
    color: #333;
  }
}

.guide-content {
  padding: 1rem;
}

.guide-item {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;

  &:last-child {
    margin-bottom: 0;
  }
}

.guide-step {
  width: 24px;
  height: 24px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f0f9ff;
  color: #3b82f6;
  border-radius: 50%;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.guide-text {
  font-size: 0.85rem;
  color: #666;
  line-height: 1.4;
}

.recent-list {
  padding: 0.5rem;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #f5f7fa;
  }
}

.recent-icon {
  font-size: 1.1rem;
}

.recent-info {
  flex: 1;
  min-width: 0;
}

.recent-name {
  font-size: 0.85rem;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-meta {
  font-size: 0.7rem;
  color: #999;
}

.recent-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 500;

  &.high {
    background: #fee2e2;
    color: #dc2626;
  }

  &.medium {
    background: #fef3c7;
    color: #d97706;
  }

  &.low {
    background: #dbeafe;
    color: #3b82f6;
  }
}
</style>