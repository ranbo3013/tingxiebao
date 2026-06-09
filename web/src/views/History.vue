<template>
  <div class="history-page">
    <h2>📊 练习记录</h2>

    <div v-if="sessions.length > 0" class="history-list mt-2">
      <router-link
        v-for="session in sessions"
        :key="session.id"
        :to="`/result/${session.id}`"
        class="history-item card"
      >
        <div class="history-left">
          <div class="history-list-name">{{ session.word_list_name }}</div>
          <div class="history-meta">
            <span :class="session.mode === 'review' ? 'badge-review' : 'badge-full'">
              {{ session.mode === 'review' ? '🔄 错题重练' : '📖 完整练习' }}
            </span>
            <span class="history-date">{{ formatDate(session.started_at) }}</span>
          </div>
        </div>
        <div class="history-right">
          <div class="history-score" :class="scoreClass(session)">
            {{ calcAccuracy(session) }}%
          </div>
          <span class="history-arrow">→</span>
        </div>
      </router-link>
    </div>

    <div v-else class="empty-state card text-center mt-4">
      <div style="font-size: 3rem;">📭</div>
      <h3>还没有练习记录</h3>
      <p class="text-light mt-1">完成一次练习后，记录会显示在这里</p>
      <router-link to="/" class="btn btn-primary mt-2">去练习</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getPracticeHistory } from '../api'

const sessions = ref<any[]>([])

onMounted(async () => {
  try {
    const res = await getPracticeHistory()
    sessions.value = res.data.filter((s: any) => s.status === 'completed')
  } catch (e) {
    console.error(e)
  }
})

function calcAccuracy(session: any): number {
  if (session.total_words === 0) return 0
  return Math.round((session.correct_count / session.total_words) * 100)
}

function scoreClass(session: any): string {
  const acc = calcAccuracy(session)
  if (acc >= 80) return 'score-great'
  if (acc >= 60) return 'score-ok'
  return 'score-low'
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'Z')
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))

  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours} 小时前`
  if (hours < 48) return '昨天'
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.history-page {
  padding-top: 8px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-decoration: none;
  color: var(--color-text);
  transition: transform 0.2s;
}

.history-item:hover {
  transform: translateX(4px);
}

.history-left {
  flex: 1;
  min-width: 0;
}

.history-list-name {
  font-weight: 700;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.badge-full, .badge-review {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.badge-full { background: var(--color-primary-light); color: #92400E; }
.badge-review { background: var(--color-secondary-light); color: #065F46; }

.history-date {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.history-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.history-score {
  font-size: 1.3rem;
  font-weight: 800;
  font-family: var(--font-display);
}

.score-great { color: var(--color-success); }
.score-ok { color: var(--color-primary-dark); }
.score-low { color: var(--color-error); }

.history-arrow {
  color: var(--color-text-muted);
}

.empty-state {
  padding: 40px 20px;
}
</style>
