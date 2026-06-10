<template>
  <div class="home">
    <!-- 吉祥物 + Hero -->
    <div class="hero animate-fade-in-up">
      <div class="mascot-hero">🐱</div>
      <h1 class="hero-title">听写宝</h1>
      <p class="hero-subtitle">一起学单词吧！ 🌟</p>
    </div>

    <!-- 快速开始 -->
    <div class="card quick-start animate-fade-in-up" style="animation-delay: 0.15s">
      <h3>🎮 开始玩</h3>

      <div class="word-list-picker mt-2" v-if="recentLists.length > 0">
        <button class="list-option" @click="selectMode(recentLists[0])">
          <div class="list-option-info">
            <span class="list-option-icon">📝</span>
            <div>
              <div class="list-option-name">{{ recentLists[0].name }}</div>
              <div class="list-option-meta">{{ recentLists[0].word_count }} 个单词</div>
            </div>
          </div>
          <span class="list-option-arrow">→</span>
        </button>

        <button v-if="recentLists.length > 1" class="expand-toggle" @click="showMore = !showMore">
          {{ showMore ? '收起' : `再看看 (${recentLists.length - 1})` }}
          <span :class="{ rotated: showMore }">▼</span>
        </button>

        <div v-if="showMore" class="more-lists">
          <button
            v-for="list in recentLists.slice(1)"
            :key="list.id"
            class="list-option"
            @click="selectMode(list)"
          >
            <div class="list-option-info">
              <span class="list-option-icon">📝</span>
              <div>
                <div class="list-option-name">{{ list.name }}</div>
                <div class="list-option-meta">{{ list.word_count }} 个单词</div>
              </div>
            </div>
            <span class="list-option-arrow">→</span>
          </button>
        </div>
      </div>

      <div class="empty-state" v-else>
        <p>还没有单词表，先上传一个吧</p>
      </div>

      <router-link to="/word-lists" class="btn btn-outline btn-block mt-2">
        📚 我的词表
      </router-link>
    </div>

    <!-- 模式选择弹窗 -->
    <div class="dialog-overlay" v-if="showModeDialog" @click.self="showModeDialog = false">
      <div class="dialog animate-bounce-in">
        <h3>🎯 想怎么练呀？</h3>
        <p class="text-light mb-2">{{ selectedList?.name }}</p>

        <button class="mode-btn mode-full" @click="startPractice('full')">
          <span class="mode-icon">📖</span>
          <div class="mode-info">
            <strong>全部练一遍</strong>
            <small>按顺序练习所有单词</small>
          </div>
        </button>

        <button
          class="mode-btn mode-review"
          @click="startPractice('review')"
          :disabled="!hasHistory"
        >
          <span class="mode-icon">🔄</span>
          <div class="mode-info">
            <strong>错题再练</strong>
            <small>{{ hasHistory ? '只练上次出错的词' : '先练一次再来吧' }}</small>
          </div>
        </button>

        <button class="btn btn-ghost mt-2" @click="showModeDialog = false">再想想 🤔</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getWordLists, getPracticeHistory, startPractice as apiStartPractice } from '../api'
import type { WordList } from '../api'
import { usePracticeStore } from '../stores/practice'

const router = useRouter()
const store = usePracticeStore()

const recentLists = ref<WordList[]>([])
const showMore = ref(false)
const showModeDialog = ref(false)
const selectedList = ref<WordList | null>(null)
const hasHistory = ref(false)

const features = [
  { icon: '🗣️', desc: '中文播报' },
  { icon: '🎤', desc: '语音回答' },
  { icon: '⌨️', desc: '打字输入' },
  { icon: '🔤', desc: '拼读模式' },
  { icon: '🔄', desc: '错题重练' },
  { icon: '📤', desc: '上传词表' },
]

onMounted(async () => {
  try {
    const res = await getWordLists()
    recentLists.value = res.data.slice(0, 5)
  } catch (e) {
    console.error('Failed to load word lists:', e)
  }
})

function selectMode(list: WordList) {
  selectedList.value = list
  // Check if has history for review mode
  getPracticeHistory(list.id).then(res => {
    hasHistory.value = res.data.some((s: any) => s.status === 'completed')
    showModeDialog.value = true
  }).catch(() => {
    hasHistory.value = false
    showModeDialog.value = true
  })
}

async function startPractice(mode: 'full' | 'review') {
  if (!selectedList.value) return
  showModeDialog.value = false

  const result = await store.startPractice(selectedList.value.id, mode)
  if ('allCorrect' in result && result.allCorrect) {
    alert(result.message)
    return
  }

  router.push(`/practice/${store.sessionId}`)
}
</script>

<style scoped>
.home {
  padding-top: 8px;
}

/* ===== Hero ===== */
.hero {
  text-align: center;
  padding: 24px 0 20px;
}
.mascot-hero {
  font-size: 4.5rem;
  display: inline-block;
  animation: bounce 2s ease-in-out infinite;
  filter: drop-shadow(0 6px 12px rgba(249,115,22,0.2));
}
.hero-title {
  font-size: 2.2rem;
  font-weight: 800;
  background: linear-gradient(135deg, #F97316, #FBBF24);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-top: -8px;
}
.hero-subtitle {
  font-size: 1rem;
  color: var(--color-text-secondary);
  margin-top: 6px;
  font-weight: 600;
  font-family: var(--font-heading);
}

/* 展开按钮 */
.expand-toggle {
  width: 100%;
  padding: 10px;
  border: none;
  background: none;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: color 0.2s;
  font-family: var(--font-heading);
}
.expand-toggle:hover { color: var(--color-primary-dark); }
.expand-toggle span {
  display: inline-block; transition: transform 0.2s; font-size: 0.7rem;
}
.expand-toggle span.rotated { transform: rotate(180deg); }
.more-lists { margin-top: 4px; }

.text-light {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.list-option {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--color-bg);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-body);
  color: var(--color-text);
  font-size: 1rem;
  margin-bottom: 8px;
  font-weight: 600;
}

.list-option:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  transform: translateX(4px);
}

.list-option-info {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
}

.list-option-icon {
  font-size: 1.5rem;
}

.list-option-name {
  font-weight: 700;
}

.list-option-meta {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.list-option-arrow {
  color: var(--color-text-secondary);
  font-size: 1.2rem;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: var(--color-text-secondary);
}

/* Dialog */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
}

.dialog {
  background: var(--color-surface);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 28px 24px;
  width: 100%;
  max-width: 480px;
  text-align: center;
}

.mode-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-body);
  color: var(--color-text);
  background: var(--color-bg);
  margin-bottom: 10px;
  text-align: left;
}

.mode-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(249,115,22,0.12);
}

.mode-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mode-full { border-left: 5px solid var(--color-primary); }
.mode-review { border-left: 5px solid var(--color-purple); }

.mode-icon { font-size: 2rem; }

.mode-info {
  display: flex;
  flex-direction: column;
}

.mode-info strong { font-size: 1.05rem; }
.mode-info small { color: var(--color-text-secondary); font-size: 0.85rem; }
</style>
