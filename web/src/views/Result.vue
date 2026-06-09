<template>
  <div class="result-page" v-if="detail">
    <div class="result-summary card text-center animate-fade-in-up">
      <div class="result-emoji">{{ emoji }}</div>
      <h2>练习结果</h2>
      <p class="text-light">{{ detail.word_list_name }}</p>

      <div class="stats-row">
        <div class="stat">
          <div class="stat-value">{{ detail.total_words }}</div>
          <div class="stat-label">总单词</div>
        </div>
        <div class="stat text-success">
          <div class="stat-value">{{ detail.correct_count }}</div>
          <div class="stat-label">正确</div>
        </div>
        <div class="stat text-error">
          <div class="stat-value">{{ detail.wrong_count }}</div>
          <div class="stat-label">错误</div>
        </div>
      </div>

      <div class="accuracy-ring" :class="accuracyClass">
        {{ accuracy }}%
      </div>
    </div>

    <!-- Wrong Words Review -->
    <div class="wrong-section mt-3" v-if="wrongWords.length > 0">
      <h3>📝 错题回顾</h3>
      <div class="wrong-list">
        <div v-for="(w, i) in wrongWords" :key="i" class="wrong-item card">
          <div class="wrong-chinese">{{ w.chinese }}</div>
          <div class="wrong-answers">
            <div class="wrong-correct">✓ {{ w.correct_english }}</div>
            <div class="wrong-user">你的回答：{{ w.user_answer }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="result-actions mt-4">
      <button class="btn btn-secondary btn-block" v-if="wrongWords.length > 0" @click="reviewWrong">
        🔄 错题重练 ({{ wrongWords.length }} 题)
      </button>
      <router-link to="/" class="btn btn-primary btn-block mt-2">🏠 返回首页</router-link>
    </div>
  </div>

  <div v-else class="text-center mt-4">
    <p>加载中...</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getPracticeDetail, getPracticeHistory, startPractice } from '../api'
import { usePracticeStore } from '../stores/practice'

const route = useRoute()
const router = useRouter()
const store = usePracticeStore()

const detail = ref<any>(null)

const wrongWords = computed(() => {
  if (!detail.value?.results) return []
  return detail.value.results.filter((r: any) => !r.is_correct)
})

const accuracy = computed(() => {
  if (!detail.value) return 0
  return detail.value.total_words > 0
    ? Math.round((detail.value.correct_count / detail.value.total_words) * 100)
    : 0
})

const emoji = computed(() => {
  if (accuracy.value >= 90) return '🌟'
  if (accuracy.value >= 70) return '👍'
  if (accuracy.value >= 50) return '💪'
  return '📚'
})

const accuracyClass = computed(() => {
  if (accuracy.value >= 80) return 'great'
  if (accuracy.value >= 60) return 'ok'
  return 'needs-work'
})

onMounted(async () => {
  try {
    const res = await getPracticeDetail(Number(route.params.sessionId))
    detail.value = res.data
  } catch (e) {
    console.error(e)
    router.replace('/history')
  }
})

async function reviewWrong() {
  if (!detail.value) return
  // Get the word list id and start a review session
  // We need to find the word_list_id from history
  try {
    const historyRes = await getPracticeHistory()
    const session = historyRes.data.find((s: any) => s.id === detail.value.id)
    if (session) {
      const result = await store.startPractice(session.word_list_id, 'review')
      if ('allCorrect' in result && result.allCorrect) {
        alert(result.message)
        return
      }
      router.push(`/practice/${store.sessionId}`)
    }
  } catch (e) {
    console.error(e)
  }
}
</script>

<style scoped>
.result-page {
  padding-top: 8px;
}

.result-emoji {
  font-size: 3.5rem;
  margin-bottom: 8px;
}

.stats-row {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin: 16px 0;
}

.stat {
  text-align: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: 800;
  font-family: var(--font-display);
}

.stat-label {
  font-size: 0.8rem;
  color: var(--color-text-light);
  font-weight: 600;
}

.accuracy-ring {
  display: inline-block;
  padding: 12px 24px;
  border-radius: var(--radius-full);
  font-size: 1.3rem;
  font-weight: 800;
  font-family: var(--font-display);
}

.accuracy-ring.great { background: var(--color-success-bg); color: #065F46; }
.accuracy-ring.ok { background: var(--color-primary-light); color: #92400E; }
.accuracy-ring.needs-work { background: var(--color-error-bg); color: #991B1B; }

.wrong-section {
  margin-bottom: 16px;
}

.wrong-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.wrong-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.wrong-chinese {
  font-size: 1.2rem;
  font-weight: 700;
  flex-shrink: 0;
}

.wrong-answers {
  flex: 1;
}

.wrong-correct {
  font-weight: 700;
  color: var(--color-success);
  font-size: 1.1rem;
}

.wrong-user {
  font-size: 0.85rem;
  color: var(--color-error);
  margin-top: 2px;
}

.result-actions {
  padding-bottom: 24px;
}
</style>
