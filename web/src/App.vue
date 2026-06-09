<template>
  <div class="app-shell">
    <header class="app-header" v-if="showHeader && showBack">
      <button class="back-btn" @click="$router.back()">
        <span class="back-arrow">←</span>
      </button>
      <div class="header-spacer"></div>
    </header>

    <main class="app-main" :class="{ 'no-padding': !showHeader }">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <nav class="bottom-nav" v-if="showNav">
      <router-link to="/" class="nav-item" exact-active-class="nav-item--active">
        <span class="nav-icon">🏠</span>
        <span class="nav-label">首页</span>
      </router-link>
      <router-link to="/word-lists" class="nav-item" active-class="nav-item--active">
        <span class="nav-icon">📚</span>
        <span class="nav-label">单词表</span>
      </router-link>
      <router-link to="/history" class="nav-item" active-class="nav-item--active">
        <span class="nav-icon">📊</span>
        <span class="nav-label">记录</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const showHeader = computed(() => !['practice'].includes(route.name as string))
const showBack = computed(() => !['home'].includes(route.name as string))
const showNav = computed(() => !['practice'].includes(route.name as string))
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: var(--color-bg);
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid var(--color-border);
}

.back-btn {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.2rem;
  color: var(--color-text);
  transition: all 0.2s;
}

.back-btn:active {
  transform: scale(0.95);
  background: var(--color-primary-light);
}

.app-title {
  flex: 1;
  text-align: center;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.title-icon {
  font-size: 1.5rem;
}

.header-spacer {
  width: 40px;
}

.app-main {
  flex: 1;
  padding: 16px 20px;
  padding-bottom: 80px;
}
.app-main.no-padding {
  padding: 0;
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  display: flex;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  padding: 8px 0;
  padding-bottom: max(8px, env(safe-area-inset-bottom));
  z-index: 10;
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-decoration: none;
  color: var(--color-text-muted);
  padding: 6px 0;
  transition: color 0.2s;
}

.nav-item--active {
  color: var(--color-primary);
}

.nav-icon {
  font-size: 1.3rem;
}

.nav-label {
  font-size: 0.7rem;
  font-weight: 700;
  font-family: var(--font-heading);
}

/* Page transitions */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
