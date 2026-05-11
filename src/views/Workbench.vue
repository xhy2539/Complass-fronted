<template>
  <div class="workbench-container">
    <header class="workbench-header">
      <div class="header-left">
        <router-link to="/" class="logo">
          <span>🧭</span>
          <span>合规罗盘</span>
        </router-link>
      </div>
      <div class="header-center">
        <h1>合同审查工作台</h1>
      </div>
      <div class="header-right">
        <button 
          class="btn-diagnosis" 
          :disabled="store.isLoading"
          @click="store.runDiagnosis"
        >
          <span v-if="store.isLoading">诊断中...</span>
          <span v-else>🔍 重新诊断</span>
        </button>
      </div>
    </header>

    <div class="workbench-body">
      <div class="sidebar">
        <div class="diagnostics-header">
          <h2>诊断结果</h2>
          <div class="stats-badge">
            <span class="badge high">{{ store.riskCount }} 高风险</span>
            <span class="badge medium">{{ store.warningCount }} 提示</span>
          </div>
        </div>
        <div class="diagnostics-list">
          <div
            v-for="diagnostic in store.diagnosticResults"
            :key="diagnostic.id"
            class="diagnostic-item"
            :class="[diagnostic.severity, { active: store.currentDiagnostic?.id === diagnostic.id }]"
            @click="store.setCurrentDiagnostic(diagnostic)"
          >
            <div class="diagnostic-icon">
              {{ diagnostic.severity === 'high' ? '🚨' : diagnostic.severity === 'medium' ? '⚠️' : 'ℹ️' }}
            </div>
            <div class="diagnostic-content">
              <div class="diagnostic-title">{{ diagnostic.title }}</div>
              <div class="diagnostic-desc">{{ diagnostic.description }}</div>
            </div>
            <div class="diagnostic-actions">
              <button 
                class="btn-adopt" 
                @click.stop="store.acceptSuggestion(diagnostic.id)"
              >
                ✅ 采纳
              </button>
            </div>
          </div>
          <div v-if="store.diagnosticResults.length === 0" class="empty-state">
            <div class="empty-icon">🎉</div>
            <div>暂无诊断结果</div>
            <button class="btn-run" @click="store.runDiagnosis">开始诊断</button>
          </div>
        </div>
      </div>

      <div class="main-panel">
        <div class="panel-header">
          <div class="file-info">
            <span class="file-icon">📄</span>
            <span>采购合同_20240115.docx</span>
          </div>
          <div class="view-controls">
            <button 
              class="view-btn" 
              :class="{ active: viewMode === 'split' }"
              @click="viewMode = 'split'"
            >
              🔀 分栏视图
            </button>
            <button 
              class="view-btn" 
              :class="{ active: viewMode === 'single' }"
              @click="viewMode = 'single'"
            >
              📝 单页视图
            </button>
          </div>
        </div>

        <div class="document-container" ref="documentRef">
          <div class="document-text" v-html="highlightedText"></div>
        </div>

        <div v-if="store.currentDiagnostic" class="suggestion-panel">
          <div class="suggestion-header">
            <span class="suggestion-title">💡 优化建议</span>
            <button class="close-btn" @click="store.clearHighlights()">✕</button>
          </div>
          <div class="suggestion-content">
            <p>{{ store.currentDiagnostic.suggestion }}</p>
          </div>
          <div class="suggestion-actions">
            <button 
              class="btn-primary" 
              @click="store.acceptSuggestion(store.currentDiagnostic.id)"
            >
              ✅ 一键采纳建议
            </button>
            <button class="btn-secondary" @click="store.clearHighlights()">
              跳过
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>import { ref, computed, onMounted } from 'vue';
import { useContractStore } from '@/stores/contract';
const store = useContractStore();
const viewMode = ref('split');
const documentRef = ref(null);
const highlightedText = computed(() => {
 if (!store.contractText)
 return '<div class="empty-document">请先加载合同文档</div>';
 let text = store.contractText;
 const ranges = [...store.highlightedRanges].sort((a, b) => b.start - a.start);
 ranges.forEach(range => {
 const before = text.substring(0, range.start);
 const highlighted = text.substring(range.start, range.end);
 const after = text.substring(range.end);
 text = before + `<mark class="highlight">${escapeHtml(highlighted)}</mark>` + after;
 });
 return text.replace(/\n/g, '<br>');
});
function escapeHtml(text) {
 const div = document.createElement('div');
 div.textContent = text;
 return div.innerHTML;
}
onMounted(() => {
 if (!store.contractText) {
 store.loadMockData();
 }
});
</script>

<style lang="scss" scoped>
.workbench-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.workbench-header {
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

.btn-diagnosis {
  padding: 0.5rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.workbench-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 380px;
  background: white;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
}

.diagnostics-header {
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.diagnostics-header h2 {
  font-size: 1rem;
  color: #333;
  margin-bottom: 0.75rem;
}

.stats-badge {
  display: flex;
  gap: 0.5rem;
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;

  &.high {
    background: #fee2e2;
    color: #dc2626;
  }

  &.medium {
    background: #fef3c7;
    color: #d97706;
  }
}

.diagnostics-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.diagnostic-item {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;

  &.high {
    background: #fef2f2;
    border-color: #fee2e2;
  }

  &.medium {
    background: #fffbeb;
    border-color: #fef3c7;
  }

  &.low {
    background: #eff6ff;
    border-color: #dbeafe;
  }

  &.active {
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
  }

  &:hover {
    transform: translateX(4px);
  }
}

.diagnostic-icon {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
}

.diagnostic-content {
  margin-bottom: 0.5rem;
}

.diagnostic-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 0.25rem;
}

.diagnostic-desc {
  font-size: 0.85rem;
  color: #666;
  line-height: 1.4;
}

.diagnostic-actions {
  display: flex;
  justify-content: flex-end;
}

.btn-adopt {
  padding: 0.25rem 0.75rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #059669;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem 1rem;
  color: #999;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.btn-run {
  margin-top: 1rem;
  padding: 0.5rem 1.5rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: white;
  border-bottom: 1px solid #e0e0e0;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #333;
}

.view-controls {
  display: flex;
  gap: 0.5rem;
}

.view-btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;

  &.active {
    background: #667eea;
    color: white;
    border-color: #667eea;
  }

  &:hover:not(.active) {
    background: #f5f7fa;
  }
}

.document-container {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  background: #fff;
}

.document-text {
  line-height: 1.8;
  white-space: pre-wrap;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #333;
}

.highlight {
  background: linear-gradient(135deg, #fef08a 0%, #fde047 100%);
  border-radius: 2px;
  padding: 1px 2px;
}

.empty-document {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: #999;
}

.suggestion-panel {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-top: 1px solid #fcd34d;
  padding: 1rem 1.5rem;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.suggestion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.suggestion-title {
  font-weight: 600;
  color: #92400e;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: #999;
  padding: 0.25rem;
}

.suggestion-content p {
  color: #78350f;
  line-height: 1.6;
}

.suggestion-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.btn-primary {
  padding: 0.5rem 1.5rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;

  &:hover {
    background: #5a6fd6;
  }
}

.btn-secondary {
  padding: 0.5rem 1.5rem;
  background: rgba(255, 255, 255, 0.8);
  color: #667eea;
  border: 1px solid #667eea;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    background: #667eea;
    color: white;
  }
}
</style>