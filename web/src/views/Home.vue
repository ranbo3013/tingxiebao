<template>
  <div class="home">
    <!-- Hero -->
    <div class="hero animate-fade-in-up">
      <h1 class="hero-title"><span class="hero-icon">🎧</span> 听写宝</h1>
      <p class="hero-desc">中文播报 → 英文回答 → 自动批改</p>
    </div>

    <!-- Quick Start -->
    <div class="card quick-start animate-fade-in-up" style="animation-delay: 0.15s">
      <h3>🚀 快速开始</h3>

      <div class="word-list-picker mt-2" v-if="recentLists.length > 0">
        <!-- 默认显示第一个 -->
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

        <!-- 展开/收起 -->
        <button v-if="recentLists.length > 1" class="expand-toggle" @click="showMore = !showMore">
          {{ showMore ? '收起' : `展开更多 (${recentLists.length - 1})` }}
          <span :class="{ rotated: showMore }">▼</span>
        </button>

        <!-- 其余列表 -->
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
        📚 管理单词表
      </router-link>
    </div>

    <!-- Mode Selection Dialog -->
    <div class="dialog-overlay" v-if="showModeDialog" @click.self="showModeDialog = false">
      <div class="dialog animate-bounce-in">
        <h3>选择练习模式</h3>
        <p class="text-light mb-2">{{ selectedList?.name }}</p>

        <button class="mode-btn mode-full" @click="startPractice('full')">
          <span class="mode-icon">📖</span>
          <div class="mode-info">
            <strong>完整练习</strong>
            <small>按顺序练习全部单词</small>
          </div>
        </button>

        <button
          class="mode-btn mode-review"
          @click="startPractice('review')"
          :disabled="!hasHistory"
        >
          <span class="mode-icon">🔄</span>
          <div class="mode-info">
            <strong>错题重练</strong>
            <small>{{ hasHistory ? '只练上次出错的单词' : '需要先完成一次完整练习' }}</small>
          </div>
        </button>

        <button class="btn btn-ghost mt-2" @click="showModeDialog = false">取消</button>
      </div>
    </div>

    <!-- Features -->
    <div class="features">
      <h3 class="features-title">核心功能</h3>
      <div class="feature-list">
        <div class="feature-item animate-fade-in-up" v-for="(feat, i) in features" :key="i"
             :style="{ animationDelay: `${0.05 * i}s` }">
          <span class="feature-icon">{{ feat.icon }}</span>
          <span class="feature-text">{{ feat.desc }}</span>
        </div>
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

.hero {
  text-align: center;
  padding: 20px 0 16px;
}
.hero-icon { font-size: 1.8rem; }
.hero-title {
  font-size: 2rem;
  font-weight: 800;
  background: linear-gradient(135deg, #F97316, #FBBF24);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.hero-desc {
  font-size: 0.85rem;
  color: var(--color-text-light);
  margin-top: 6px;
}

/* 展开按钮 */
.expand-toggle {
  width: 100%;
  padding: 10px;
  border: none;
  background: none;
  color: var(--color-text-light);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: color 0.2s;
}
.expand-toggle:hover { color: var(--color-primary-dark); }
.expand-toggle span {
  display: inline-block; transition: transform 0.2s; font-size: 0.65rem;
}
.expand-toggle span.rotated { transform: rotate(180deg); }
.more-lists { margin-top: 4px; }

.text-light {
  color: var(--color-text-light);
  font-size: 0.9rem;
}

.quick-start {
  margin-top: 8px;
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
  font-size: 0.95rem;
  margin-bottom: 8px;
}

.list-option:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
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
  font-size: 0.8rem;
  color: var(--color-text-light);
}

.list-option-arrow {
  color: var(--color-text-light);
  font-size: 1.2rem;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: var(--color-text-light);
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
  transform: translateY(-1px);
}

.mode-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mode-full { border-left: 4px solid var(--color-primary); }
.mode-review { border-left: 4px solid var(--color-secondary); }

.mode-icon { font-size: 1.8rem; }

.mode-info {
  display: flex;
  flex-direction: column;
}

.mode-info strong { font-size: 1rem; }
.mode-info small { color: var(--color-text-light); font-size: 0.8rem; }

/* Features */
.features {
  padding: 0 0 24px;
  margin-top: 24px;
}
.features-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 10px;
}
.feature-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.feature-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--color-accent-light);
  border-radius: var(--radius-full);
}
.feature-icon {
  font-size: 0.95rem;
  flex-shrink: 0;
}
.feature-text {
  font-size: 0.8rem;
  color: var(--color-primary-dark);
  font-weight: 500;
}
</style>
