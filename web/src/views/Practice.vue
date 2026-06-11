<template>
  <div class="practice-page">
    <!-- 顶部：进度 + 退出 -->
    <div class="top-bar">
      <button class="quit-btn" @click="quitPractice">✕</button>
      <div class="progress-wrap">
        <div class="progress-fill" :style="{ width: `${store.progress}%` }"></div>
      </div>
      <span :class="['countdown', { urgent: countdown <= 5 }]">{{ countdown }}s</span>
      <span class="progress-num">{{ store.completedCount }}/{{ store.totalWords }}</span>
    </div>

    <!-- 上一个/下一个 切换 -->
    <div class="nav-arrows" v-if="store.currentWord && !store.isComplete && !showingResult">
      <button class="arrow-btn" :disabled="store.currentIndex === 0" @click="goToWord(store.currentIndex - 1)">◀</button>
      <button class="arrow-btn" :disabled="store.currentIndex >= store.totalWords - 1" @click="goToWord(store.currentIndex + 1)">▶</button>
    </div>

    <!-- 中文单词 -->
    <div class="word-zone" v-if="store.currentWord && !store.isComplete && !showingResult">
      <div class="word-chinese" :key="store.currentWord.id">{{ store.currentWord.chinese }}</div>
      <div class="word-hint-row" v-if="showHint">
        <span class="hint-badge">{{ store.currentWord.english.length }} 字母</span>
        <span class="hint-badge hint-mask">{{ maskedEnglish }}</span>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="input-zone" v-if="store.currentWord && !store.isComplete && !showingResult">
      <div v-if="inputMode === 'type'" class="type-row">
        <input ref="typeInput" v-model="typedAnswer" class="type-input"
          placeholder="输入英文..." autocomplete="off" autocapitalize="off" spellcheck="false"
          @keyup.enter="submitTypedAnswer" />
        <button class="submit-btn" @click="submitTypedAnswer" :disabled="!typedAnswer.trim()">✓</button>
      </div>

      <div v-if="inputMode === 'voice'" class="voice-zone">
        <button :class="['mic-btn', { recording: isRecording }]" @click="toggleRecording">
          <span class="mic-icon">{{ isRecording ? '🔴' : '🎤' }}</span>
        </button>
      </div>

      <div class="switch-row">
        <button :class="{ active: inputMode === 'type' }" @click="inputMode = 'type'" title="打字">⌨️</button>
        <button :class="{ active: inputMode === 'voice' }" @click="inputMode = 'voice'" title="语音">🎤</button>
        <button :class="{ active: continuousMode }" @click="continuousMode = !continuousMode" title="连续模式">🔁</button>
        <button class="hint-toggle" @click="toggleHint" title="提示">{{ showHint ? '💡' : '◉' }}</button>
      </div>
    </div>

    <!-- 结果浮层 -->
    <div class="result-overlay" v-if="showingResult && lastResult" @click="onResultTap">
      <div :class="['result-card', lastResult.is_correct ? 'is-correct' : 'is-wrong']">
        <div class="result-emoji">{{ lastResult.is_correct ? '✅' : '❌' }}</div>
        <div class="result-cn">{{ lastResult.chinese }}</div>
        <div class="result-en">{{ lastWasSpell ? formatSpellAnswer(lastResult.correct_answer) : lastResult.correct_answer }}</div>
        <div v-if="!lastResult.is_correct" class="result-yours">
          {{ inputMode === 'voice' ? '听到的是' : '你写的是' }}
          <b>{{ voiceRawResult || lastResult.user_answer }}</b>
          <span v-if="inputMode === 'voice' && voiceRawResult && normalizeAnswer(voiceRawResult) !== lastResult.user_answer.toLowerCase()" class="result-matched-as">
            → 匹配为 {{ lastResult.user_answer }}
          </span>
        </div>
        <!-- 发音得分 -->
        <div v-if="inputMode === 'voice'" class="result-score">
          <div class="score-ring" :style="{ '--pct': pronunciationScore / 100 }">
            <span class="score-num">{{ pronunciationScore }}</span>
          </div>
          <span class="score-label">发音分</span>
        </div>
        <!-- 录音回放 -->
        <audio v-if="recordedAudio" :src="recordedAudio" controls class="audio-player" @click.stop></audio>
        <div class="result-action-hint" v-if="!lastResult.is_correct">
          点击重试 · 双击跳过
        </div>
      </div>
    </div>

    <!-- 完成弹窗 -->
    <div class="result-overlay" v-if="store.isComplete && store.summary">
      <div class="result-card is-done">
        <div class="done-emoji">{{ accuracyEmoji }}</div>
        <div class="done-title">练习完成!</div>
        <div class="done-stats">
          <span class="done-stat green">{{ store.correctCount }} ✓</span>
          <span class="done-stat red" v-if="store.wrongResults.length > 0">{{ store.wrongResults.length }} ✗</span>
        </div>
        <div class="done-accuracy">{{ store.totalWords > 0 ? Math.round(store.correctCount / store.totalWords * 100) : 0 }}%</div>
        <div class="done-actions">
          <button v-if="store.summary.wrong_count > 0" class="done-btn primary" @click="reviewWrong">错题重练</button>
          <button class="done-btn ghost" @click="goHome">返回首页</button>
        </div>
      </div>
    </div>

    <!-- 退出确认 -->
    <div class="result-overlay" v-if="showQuitDialog">
      <div class="dialog-sm">
        <p>确定退出？进度不会保存</p>
        <div class="dialog-actions">
          <button class="done-btn ghost" @click="showQuitDialog = false">继续</button>
          <button class="done-btn danger" @click="confirmQuit">退出</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePracticeStore } from '../stores/practice'
import type { AnswerResult } from '../api'
import { playCorrectSound, playWrongSound, playCompleteSound, speakChinese, speakEnglish } from '../utils/sound'

interface SpeechRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
}

const router = useRouter()
const store = usePracticeStore()

const inputMode = ref<'type' | 'voice'>('voice')
const typedAnswer = ref('')
const rawAnswer = ref('')
const voiceRawResult = ref('')  // 语音识别原始结果，用于错误时展示
const typeInput = ref<HTMLInputElement | null>(null)
const isRecording = ref(false)
const showingResult = ref(false)
const lastResult = ref<AnswerResult | null>(null)
const lastWasSpell = ref(false)
const continuousMode = ref(true)
const showHint = ref(false)
const showQuitDialog = ref(false)
const autoNextTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const countdown = ref(15)
let countdownTimer: ReturnType<typeof setInterval> | null = null

let recognition: SpeechRecognition | null = null
let restartCount = 0

// 录音
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
const recordedAudio = ref<string | null>(null)
const pronunciationScore = ref(0)

async function startMediaRecorder() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(stream)
    audioChunks = []
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data) }
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' })
      if (recordedAudio.value) URL.revokeObjectURL(recordedAudio.value)
      recordedAudio.value = URL.createObjectURL(blob)
    }
    mediaRecorder.start()
  } catch { /* 权限问题静默失败 */ }
}

function stopMediaRecorder() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop()
  }
}

onMounted(() => {
  document.documentElement.style.overflow = 'hidden'
  if (!store.sessionId) { router.replace('/'); return }

  if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    recognition = new SR()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 5
    recognition.continuous = false
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      if (e.results.length > 0) handleVoiceResult(e.results[0])
    }
    recognition.onerror = (e: any) => {
      console.error('[Speech]', e.error, e.message)
      isRecording.value = false
      if (e.error === 'not-allowed') alert('请允许浏览器使用麦克风权限')
      else if (e.error === 'no-speech') { /* 静默重试 */ }
      else if (e.error === 'network') alert('语音识别需要网络连接')
      else if (e.error !== 'aborted') alert('语音识别错误: ' + e.error)
    }
    recognition.onend = () => {
      isRecording.value = false
      // 自动重开：仅在连续模式 + 等待输入时，且限制重启次数防止死循环
      if (!showingResult.value && !store.isComplete && inputMode.value === 'voice' && restartCount < 3) {
        setTimeout(() => {
          if (!showingResult.value && !store.isComplete && inputMode.value === 'voice' && !isRecording.value && countdown.value > 0) {
            restartCount++
            isRecording.value = true
            recognition?.start()
          }
        }, 500)
      }
    }
  } else {
    console.warn('[Speech] 浏览器不支持语音识别')
  }

  nextTick(async () => {
    if (store.currentWord) await speakChinese(store.currentWord.chinese)
    if (store.isComplete) return
    startCountdown()
    if (inputMode.value === 'voice') {
      isRecording.value = true
      recognition?.start()
    }
  })
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.documentElement.style.overflow = ''
  document.removeEventListener('keydown', handleKeydown)
  if (autoNextTimer.value) clearTimeout(autoNextTimer.value)
  stopCountdown()
  recognition?.abort()
})

// ===== 计算属性 =====
const maskedEnglish = computed(() => {
  if (!store.currentWord) return ''
  const w = store.currentWord.english
  if (w.length <= 2) return w[0] + '_'.repeat(w.length - 1)
  const show = Math.ceil(w.length / 3)
  return w.split('').map((c, i) => i < show ? c : '_').join('')
})

const accuracyEmoji = computed(() => {
  const a = store.totalWords > 0 ? Math.round(store.correctCount / store.totalWords * 100) : 0
  if (a >= 90) return '🌟'
  if (a >= 70) return '👍'
  if (a >= 50) return '💪'
  return '📚'
})

// ===== 回答逻辑 =====
function normalizeAnswer(input: string): string {
  return expandAbbrs(input).replace(/[^a-zA-Z]/g, '').toLowerCase()
}

function isSpellFormat(input: string): boolean {
  return /[a-zA-Z]\s*[-]\s*[a-zA-Z]/.test(input) ||
         /^[a-zA-Z](\s+[a-zA-Z]){2,}$/.test(input.trim())
}

function formatSpellAnswer(word: string): string {
  return word.split('').join('-').toUpperCase()
}

async function submitTypedAnswer() {
  if (!typedAnswer.value.trim() || showingResult.value) return
  rawAnswer.value = typedAnswer.value.trim()
  // 先隐藏单词区，防止 store 切词后闪现
  showingResult.value = true
  const result = await store.submitAnswer(normalizeAnswer(rawAnswer.value), 'type')
  if (result) settleResult(result)
  else showingResult.value = false
}

function toggleRecording() {
  if (!recognition) { alert('请使用 Chrome 浏览器'); return }
  if (isRecording.value) {
    recognition.stop()
    stopMediaRecorder()
  } else {
    restartCount = 0
    window.speechSynthesis.cancel()
    isRecording.value = true
    recordedAudio.value = null
    startMediaRecorder()
    recognition.start()
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.code !== 'Space' || inputMode.value !== 'voice' || showingResult.value || store.isComplete) return
  e.preventDefault()
  if (isRecording.value) {
    recognition?.stop()
  } else {
    window.speechSynthesis.cancel()
    isRecording.value = true
    recognition?.start()
  }
}

// 数字 → 英文单词（语音识别常把单词识别成数字）
const NUMBER_WORDS: Record<string, string> = {
  '0':'zero','1':'one','2':'two','3':'three','4':'four','5':'five',
  '6':'six','7':'seven','8':'eight','9':'nine','10':'ten',
  '11':'eleven','12':'twelve','13':'thirteen','14':'fourteen',
  '15':'fifteen','16':'sixteen','17':'seventeen','18':'eighteen',
  '19':'nineteen','20':'twenty','30':'thirty','40':'forty',
  '50':'fifty','60':'sixty','70':'seventy','80':'eighty',
  '90':'ninety','100':'hundred',
}
function expandNumbers(text: string): string {
  const keys = Object.keys(NUMBER_WORDS).sort((a, b) => Number(b) - Number(a))
  let result = text
  for (const num of keys) {
    result = result.replace(new RegExp(`\\b${num}\\b`, 'g'), NUMBER_WORDS[num])
  }
  return result
}

/** 语音识别结果处理：取多个候选，逐个匹配 */
function handleVoiceResult(result: SpeechRecognitionResult) {
  const candidates: string[] = []
  for (let i = 0; i < result.length; i++) {
    const raw = result[i].transcript.trim()
    candidates.push(raw)
    const expanded = expandNumbers(raw)
    if (expanded !== raw) candidates.push(expanded)
  }
  const unique = [...new Set(candidates)]
  const best = pickBestMatch(unique)
  rawAnswer.value = best
  voiceRawResult.value = unique[0]
  showingResult.value = true
  store.submitAnswer(normalizeAnswer(best), 'voice').then(r => {
    if (r) settleResult(r)
    else { showingResult.value = false; voiceRawResult.value = '' }
  })
}

/** 常见缩写 → 全称 */
const ABBREVIATIONS: Record<string, string> = {
  sth: 'something', sb: 'somebody', sbd: 'somebody',
  etc: 'etcetera', vs: 'versus', dept: 'department',
  info: 'information', app: 'application', ad: 'advertisement',
  exam: 'examination', phone: 'telephone', bike: 'bicycle',
  math: 'mathematics', gym: 'gymnasium', lab: 'laboratory',
  photo: 'photograph', tv: 'television',
}
function expandAbbrs(text: string): string {
  return text.split(/\s+/).map(w => {
    const clean = w.replace(/[^a-zA-Z]/g, '').toLowerCase()
    return ABBREVIATIONS[clean] || w
  }).join(' ')
}

/** 展开 "/" 替代项 */
function expandAlternatives(text: string): string[] {
  text = expandAbbrs(text)
  const tokens = text.split(/\s+/)
  const parts = tokens.map(t => t.includes('/') ? t.split('/') : [t])
  function combine(arrays: string[][], i: number, cur: string[]): string[] {
    if (i === arrays.length) return [cur.join(' ')]
    const r: string[] = []
    for (const item of arrays[i]) r.push(...combine(arrays, i + 1, [...cur, item]))
    return r
  }
  return combine(parts, 0, [])
}

/** 在候选识别结果中选最接近目标单词的 */
function pickBestMatch(candidates: string[]): string {
  if (!store.currentWord) return candidates[0] || ''
  const targets = expandAlternatives(store.currentWord.english).map(t => normalizeAnswer(t))

  // 1. 精确匹配任一替代项
  for (const c of candidates) {
    if (targets.includes(normalizeAnswer(c))) return c
  }

  // 2. 模糊匹配：对每个替代项计算编辑距离
  let best = candidates[0] || ''
  let bestScore = Infinity
  for (const c of candidates) {
    const clean = normalizeAnswer(c)
    if (!clean) continue
    for (const target of targets) {
      const dist = levenshtein(clean, target)
      if (dist < bestScore) { bestScore = dist; best = c }
      if (clean[0] === target[0] && Math.abs(clean.length - target.length) <= 1 && dist <= 2) {
        return c
      }
    }
  }

  return best
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1
    }
  }
  return dp[m][n]
}

function startCountdown() {
  stopCountdown()
  countdown.value = 15
  
  // 语音模式下：倒计时开始即开启麦克风
  if (inputMode.value === 'voice' && recognition && !isRecording.value) {
    isRecording.value = true
    try { recognition.start() } catch(e: any) { console.warn('[Speech] start failed:', e.message) }
  }
  
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      // 倒计时结束：停止识别
      if (inputMode.value === 'voice' && isRecording.value) {
        recognition?.stop()
        isRecording.value = false
      }
      stopCountdown()
      handleTimeout()
    }
  }, 1000)
}

function stopCountdown() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
}

async function handleTimeout() {
  if (showingResult.value || store.isComplete) return
  rawAnswer.value = ''
  showingResult.value = true
  const result = await store.submitAnswer('', inputMode.value)
  if (result) settleResult(result)
}

function settleResult(result: AnswerResult) {
  stopCountdown()
  stopMediaRecorder()
  lastResult.value = result
  typedAnswer.value = ''
  lastWasSpell.value = isSpellFormat(rawAnswer.value)

  // 语音模式计算发音得分
  if (inputMode.value === 'voice' && rawAnswer.value) {
    const userClean = normalizeAnswer(rawAnswer.value)
    const correctClean = result.correct_answer.replace(/[^a-zA-Z]/g, '').toLowerCase()
    const dist = levenshtein(userClean, correctClean)
    pronunciationScore.value = result.is_correct
      ? (dist === 0 ? 100 : dist === 1 ? 85 : dist === 2 ? 70 : 60)
      : Math.max(10, 50 - dist * 10)
  }

  rawAnswer.value = ''

  if (result.is_correct) {
    playCorrectSound()
  } else {
    playWrongSound()
    // 答错时朗读正确答案，帮助学生纠正
    speakEnglish(result.correct_answer)
  }

  if (result.is_correct) {
    autoNextTimer.value = setTimeout(() => advanceFromResult(), 1200)
  }
}

async function advanceFromResult() {
  showingResult.value = false
  lastResult.value = null
  if (store.isComplete) return

  // 播报中文，等待播放完成
  if (store.currentWord) await speakChinese(store.currentWord.chinese)
  if (showingResult.value || store.isComplete) return  // 期间可能被中断

  startCountdown()
  if (inputMode.value === 'type') {
    nextTick(() => typeInput.value?.focus())
  } else if (inputMode.value === 'voice') {
    isRecording.value = true
    recognition?.start()
  }
}

// 结果浮层点击
let resultClickTimer: ReturnType<typeof setTimeout> | null = null
function onResultTap() {
  if (!lastResult.value) return

  if (lastResult.value.is_correct) {
    // 答对：点快了就立即前进
    if (autoNextTimer.value) clearTimeout(autoNextTimer.value)
    advanceFromResult()
  } else {
    // 答错：单击重试，双击跳过
    if (resultClickTimer) {
      clearTimeout(resultClickTimer)
      resultClickTimer = null
      store.skipWord()
      advanceFromResult()
    } else {
      resultClickTimer = setTimeout(() => {
        resultClickTimer = null
        showingResult.value = false
        lastResult.value = null
        typedAnswer.value = ''
        voiceRawResult.value = ''
        startCountdown()
        // 语音模式自动开启麦克风
        if (inputMode.value === 'voice' && recognition) {
          window.speechSynthesis.cancel()
          isRecording.value = true
          recognition.start()
        }
      }, 350)
    }
  }
}

async function goToWord(index: number) {
  stopCountdown()
  recognition?.abort()
  isRecording.value = false
  store.goToWord(index)
  nextTick(async () => {
    if (store.currentWord) await speakChinese(store.currentWord.chinese)
    startCountdown()
    if (inputMode.value === 'voice') {
      isRecording.value = true
      recognition?.start()
    }
  })
}

function toggleHint() { showHint.value = !showHint.value }
function quitPractice() { showQuitDialog.value = true }
function confirmQuit() { store.reset(); router.replace('/') }
async function reviewWrong() {
  if (!store.wordListId) return
  const result = await store.startPractice(store.wordListId, 'review')
  if ('allCorrect' in result && result.allCorrect) {
    alert(result.message)
    router.replace('/')
    return
  }
  // 重置本地状态，触发新一轮练习
  showingResult.value = false
  lastResult.value = null
  voiceRawResult.value = ''
  nextTick(async () => {
    if (store.currentWord) await speakChinese(store.currentWord.chinese)
    if (store.isComplete) return
    startCountdown()
    if (inputMode.value === 'voice') {
      isRecording.value = true
      recognition?.start()
    }
  })
}

function goHome() { store.reset(); router.replace('/') }

watch(inputMode, () => {
  if (!showingResult.value && !store.isComplete) startCountdown()
})

watch(() => store.isComplete, (done) => {
  if (done) setTimeout(() => playCompleteSound(), 300)
})
</script>

<style scoped>
.practice-page {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}
@media (min-width: 481px) {
  .practice-page {
    left: 50%; transform: translateX(-50%);
    max-width: 480px;
    top: 20px; bottom: 20px;
    border-radius: var(--radius-xl);
    box-shadow: 0 20px 60px rgba(249,115,22,0.15);
  }
}

/* ===== 顶部栏 ===== */
.top-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  flex-shrink: 0;
}
.quit-btn {
  width: 36px; height: 36px;
  border: none; border-radius: 50%;
  background: rgba(0,0,0,0.05);
  font-size: 1rem; color: #999;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.progress-wrap {
  flex: 1; height: 6px;
  background: var(--color-primary-light); border-radius: 3px; overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-cta));
  border-radius: 3px; transition: width 0.3s;
}
.countdown {
  font-size: 0.85rem; font-weight: 800; color: var(--color-cta);
  min-width: 32px; text-align: center;
  transition: color 0.3s;
}
.countdown.urgent { color: #EF4444; animation: countdownPulse 0.6s infinite; }
@keyframes countdownPulse {
  0%,100% { opacity: 1; }
  50% { opacity: 0.3; }
}
/* 上一个/下一个 */
.nav-arrows {
  display: flex; justify-content: center; gap: 16px;
  padding: 4px 0 0; flex-shrink: 0;
}
.arrow-btn {
  width: 36px; height: 28px;
  border: 1px solid var(--color-border); border-radius: 8px;
  background: var(--color-surface);
  font-size: 0.75rem; color: var(--color-text-secondary);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.arrow-btn:disabled { opacity: 0.25; cursor: default; }
.arrow-btn:active:not(:disabled) { background: var(--color-primary-light); }

.progress-num {
  font-size: 0.8rem; font-weight: 700; color: var(--color-cta);
  white-space: nowrap; min-width: 36px; text-align: right;
}

/* ===== 单词区 ===== */
.word-zone {
  flex: 0 0 auto;
  text-align: center;
  padding: 12px 20px 0;
}
.word-chinese {
  font-size: 3.5rem;
  font-weight: 800;
  color: var(--color-text);
  letter-spacing: 0.05em;
}
.word-hint-row {
  display: flex; justify-content: center; gap: 10px; margin-top: 12px;
}
.hint-badge {
  padding: 4px 12px; border-radius: 20px;
  font-size: 0.8rem; font-weight: 700;
  background: var(--color-primary-light); color: var(--color-primary-dark);
}
.hint-mask {
  font-family: monospace; letter-spacing: 0.15em;
}

/* ===== 输入区 ===== */
.input-zone {
  flex: 1;
  display: flex; flex-direction: column;
  padding: 0 20px;
}
.type-row {
  flex: 1; display: flex; align-items: flex-start; gap: 10px; padding-top: 16px;
}
.type-input {
  flex: 1;
  padding: 16px 20px;
  border: 2px solid var(--color-border); border-radius: 16px;
  font-size: 1.4rem; text-align: center;
  background: #fff; color: var(--color-text);
  outline: none; transition: border-color 0.2s;
  letter-spacing: 0.05em;
}
.type-input:focus { border-color: var(--color-primary); }
.submit-btn {
  width: 56px; height: 56px;
  border: none; border-radius: 16px;
  background: var(--color-primary); color: #fff;
  font-size: 1.4rem; font-weight: 700;
  cursor: pointer; flex-shrink: 0;
  transition: all 0.15s;
}
.submit-btn:active { transform: scale(0.95); }
.submit-btn:disabled { opacity: 0.3; }

/* 语音区 */
.voice-zone {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 20px;
}
.mic-btn {
  width: 140px; height: 140px;
  border-radius: 50%;
  border: 3px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-outer);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s ease-out;
}
.mic-btn:active {
  box-shadow: var(--shadow-pressed);
  transform: scale(0.96);
}
.mic-btn.recording {
  border-color: var(--color-error); background: var(--color-error-bg);
  transform: scale(1.06); animation: micPulse 1.2s infinite;
}
@keyframes micPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.3); }
  50% { box-shadow: 0 0 0 16px rgba(239,68,68,0); }
}
.mic-icon { font-size: 3rem; }
kbd {
  display: inline-block; padding: 1px 7px; background: #fff; border: 1px solid #ddd;
  border-radius: 4px; font-family: monospace; font-size: 0.75rem; margin: 0 3px;
}

/* 底部切换 */
.switch-row {
  display: flex; justify-content: center; gap: 6px;
  padding: 12px 0 20px; flex-shrink: 0;
}
.switch-row button {
  min-width: 44px; min-height: 44px;
  border: 2px solid var(--color-border); border-radius: var(--radius-sm);
  background: var(--color-surface);
  box-shadow: var(--shadow-outer);
  font-size: 1rem;
  cursor: pointer; transition: all 0.2s ease-out;
}
.switch-row button:active {
  box-shadow: var(--shadow-pressed);
  transform: scale(0.96);
}
.switch-row button.active { background: var(--color-primary); color: #fff; border-color: var(--color-primary-dark); }
.hint-toggle { width: auto !important; padding: 0 12px !important; font-size: 0.85rem !important; }

/* ===== 结果浮层 ===== */
.result-overlay {
  position: absolute; inset: 0;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 18vh;
  background: rgba(255,247,237,0.94);
  backdrop-filter: blur(4px);
  z-index: 20; padding-left: 24px; padding-right: 24px;
}
.result-card {
  text-align: center; padding: 32px 28px;
  border-radius: 24px; width: 100%; max-width: 320px;
}
.result-card.is-correct { background: var(--color-success-bg); border: 2px solid var(--color-success); box-shadow: var(--shadow-outer); }
.result-card.is-wrong { background: var(--color-error-bg); border: 2px solid var(--color-error); box-shadow: var(--shadow-outer); }
.result-card.is-done { background: var(--color-surface); border: 2px solid var(--color-border); box-shadow: var(--shadow-outer); }

.result-emoji { font-size: 3rem; margin-bottom: 8px; }
.result-cn { font-size: 1.3rem; color: var(--color-text-secondary); margin-bottom: 4px; }
.result-en { font-size: 2.2rem; font-weight: 800; color: var(--color-text); }
.result-yours { margin-top: 10px; font-size: 0.9rem; color: #EF4444; }
.result-yours b { text-decoration: line-through; }
.result-score { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; }
.score-ring {
  width: 44px; height: 44px;
  border-radius: 50%;
  background: conic-gradient(var(--color-primary) calc(var(--pct) * 360deg), var(--color-primary-light) 0);
  display: flex; align-items: center; justify-content: center;
}
.score-num { font-size: 0.9rem; font-weight: 800; color: var(--color-text); }
.score-label { font-size: 0.75rem; color: var(--color-text-secondary); }
.audio-player { margin-top: 10px; width: 100%; height: 36px; border-radius: 10px; }
.result-action-hint { margin-top: 12px; font-size: 0.75rem; color: var(--color-text-muted); }

/* 完成 */
.done-emoji { font-size: 3.5rem; }
.done-title { font-size: 1.4rem; font-weight: 800; margin: 8px 0; }
.done-stats { display: flex; gap: 16px; justify-content: center; margin-bottom: 4px; }
.done-stat { font-weight: 700; font-size: 1.1rem; }
.done-stat.green { color: #10B981; }
.done-stat.red { color: #EF4444; }
.done-accuracy {
  display: inline-block; margin: 12px 0;
  padding: 6px 20px; border-radius: 20px;
  font-size: 1.3rem; font-weight: 800;
  background: var(--color-primary-light); color: var(--color-primary-dark);
}
.done-actions { display: flex; gap: 10px; margin-top: 16px; justify-content: center; }
.done-btn {
  padding: 10px 22px; border-radius: 20px; border: none;
  font-size: 0.9rem; font-weight: 700; cursor: pointer;
}
.done-btn.primary { background: var(--color-primary); color: #fff; border-radius: var(--radius-sm); }
.done-btn.ghost { background: transparent; color: var(--color-text-secondary); }
.done-btn.danger { background: var(--color-error); color: #fff; border-radius: var(--radius-sm); }

/* 小弹窗 */
.dialog-sm {
  background: #fff; padding: 24px; border-radius: 20px;
  text-align: center; border: 2px solid var(--color-border);
}
.dialog-sm p { margin-bottom: 16px; font-weight: 700; }
.dialog-actions { display: flex; gap: 10px; justify-content: center; }
</style>
