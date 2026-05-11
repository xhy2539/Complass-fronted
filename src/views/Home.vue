<template>
  <div class="home-container">
    <header class="header">
      <div class="logo">
        <span class="logo-icon">🧭</span>
        <span class="logo-text">合规罗盘</span>
      </div>
      <nav class="nav">
        <router-link to="/" class="nav-item active">首页</router-link>
        <router-link to="/workbench" class="nav-item">审查工作台</router-link>
        <router-link to="/rules" class="nav-item">规则配置</router-link>
        <router-link to="/im" class="nav-item">IM极速初筛</router-link>
      </nav>
    </header>

    <main class="main-content">
      <section class="hero">
        <h1>智能合同审查平台</h1>
        <p>AI驱动的合同风险识别与合规审查</p>
        <div class="hero-actions">
          <router-link to="/workbench" class="btn btn-primary">开始审查</router-link>
          <router-link to="/im" class="btn btn-secondary">IM极速初筛</router-link>
        </div>
      </section>

      <section class="features">
        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3>极速初筛</h3>
          <p>通过企业微信/飞书Bot快速获取风险简报</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔍</div>
          <h3>精准比对</h3>
          <p>左右分栏视图，高亮定位风险点</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📋</div>
          <h3>规则配置</h3>
          <p>可视化配置私有规则库，沉淀企业经验</p>
        </div>
      </section>

      <section class="stats">
        <div class="stat-item">
          <div class="stat-value">1,200+</div>
          <div class="stat-label">合同审查</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">98%</div>
          <div class="stat-label">风险识别率</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">50+</div>
          <div class="stat-label">预置规则</div>
        </div>
      </section>

      <section class="quick-actions">
        <h2>快速开始</h2>
        <div class="action-grid">
          <div class="action-item" @click="$router.push('/workbench')">
            <div class="action-icon">📄</div>
            <span>审查合同</span>
          </div>
          <div class="action-item" @click="$router.push('/rules')">
            <div class="action-icon">⚙️</div>
            <span>配置规则</span>
          </div>
          <div class="action-item" @click="$router.push('/im')">
            <div class="action-icon">💬</div>
            <span>IM初筛</span>
          </div>
        </div>
      </section>
    </main>

    <footer class="footer">
      <p>© 2024 合规罗盘. 专注合同合规审查</p>
    </footer>
  </div>
</template>

<script setup>
</script>

<style lang="scss" scoped>
.home-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.logo-icon {
  font-size: 1.5rem;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 600;
}

.nav {
  display: flex;
  gap: 1rem;
}

.nav-item {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  color: white;
  text-decoration: none;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }

  &.active {
    background-color: rgba(255, 255, 255, 0.3);
  }
}

.main-content {
  flex: 1;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.hero {
  text-align: center;
  padding: 4rem 0;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 12px;
  margin-bottom: 2rem;
}

.hero h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: #333;
}

.hero p {
  font-size: 1.2rem;
  color: #666;
  margin-bottom: 2rem;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn {
  padding: 0.75rem 2rem;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: white;
  color: #667eea;
  border: 2px solid #667eea;
}

.btn-secondary:hover {
  background: #667eea;
  color: white;
}

.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.feature-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  text-align: center;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }
}

.feature-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  margin-bottom: 0.5rem;
  color: #333;
}

.feature-card p {
  color: #666;
  font-size: 0.9rem;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
  border-radius: 12px;
}

.stat-item {
  text-align: center;
  color: white;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
}

.stat-label {
  font-size: 0.9rem;
  opacity: 0.9;
}

.quick-actions {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.quick-actions h2 {
  margin-bottom: 1.5rem;
  color: #333;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem;
  border-radius: 8px;
  background: #f5f7fa;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #e8ecf0;
    transform: translateY(-2px);
  }
}

.action-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.footer {
  text-align: center;
  padding: 1.5rem;
  background: #333;
  color: #999;
  font-size: 0.9rem;
}
</style>