import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Word, AnswerResult } from '../api'
import * as api from '../api'

export const usePracticeStore = defineStore('practice', () => {
  // State
  const sessionId = ref<number | null>(null)
  const wordListId = ref<number | null>(null)
  const mode = ref<'full' | 'review'>('full')
  const words = ref<Word[]>([])
  const currentIndex = ref(0)
  const results = ref<Map<number, AnswerResult>>(new Map())
  const isComplete = ref(false)
  const summary = ref<api.PracticeSummary | null>(null)

  // Getters
  const currentWord = computed(() => words.value[currentIndex.value] || null)
  const totalWords = computed(() => words.value.length)
  const completedCount = computed(() => results.value.size)
  const correctCount = computed(() => Array.from(results.value.values()).filter(r => r.is_correct).length)
  const progress = computed(() => totalWords.value > 0 ? (completedCount.value / totalWords.value) * 100 : 0)
  const wrongResults = computed(() => Array.from(results.value.values()).filter(r => !r.is_correct))

  // Actions
  async function startPractice(wordListIdParam: number, practiceMode: 'full' | 'review' = 'full') {
    const res = await api.startPractice(wordListIdParam, practiceMode)

    if ('message' in res.data) {
      // All correct in review mode
      return { allCorrect: true, message: res.data.message }
    }

    const session = res.data as api.PracticeSession
    sessionId.value = session.session_id
    wordListId.value = session.word_list_id
    mode.value = practiceMode
    words.value = session.words
    currentIndex.value = 0
    results.value = new Map()
    isComplete.value = false
    summary.value = null

    return { allCorrect: false }
  }

  async function submitAnswer(userAnswer: string, answerType: 'voice' | 'type' = 'type') {
    if (!sessionId.value || !currentWord.value) return null

    const res = await api.submitAnswer(sessionId.value, currentWord.value.id, userAnswer, answerType)

    // 只保留首次答案，重试不覆盖（反映真实掌握情况）
    if (!results.value.has(currentWord.value.id)) {
      results.value.set(currentWord.value.id, res.data)
    }

    // 答对才前进，答错留在当前词让用户重试
    if (res.data.is_correct) {
      if (currentIndex.value < words.value.length - 1) {
        currentIndex.value++
      } else {
        await finishPractice()
      }
    }

    return res.data
  }

  function skipWord() {
    if (currentIndex.value < words.value.length - 1) {
      currentIndex.value++
    }
  }

  function goToWord(index: number) {
    if (index >= 0 && index < words.value.length) {
      currentIndex.value = index
    }
  }

  async function finishPractice() {
    if (!sessionId.value) return

    const res = await api.completePractice(sessionId.value)
    summary.value = res.data
    isComplete.value = true
  }

  function reset() {
    sessionId.value = null
    wordListId.value = null
    mode.value = 'full'
    words.value = []
    currentIndex.value = 0
    results.value = new Map()
    isComplete.value = false
    summary.value = null
  }

  return {
    // State
    sessionId,
    wordListId,
    mode,
    words,
    currentIndex,
    results,
    isComplete,
    summary,
    // Getters
    currentWord,
    totalWords,
    completedCount,
    correctCount,
    progress,
    wrongResults,
    // Actions
    startPractice,
    submitAnswer,
    finishPractice,
    skipWord,
    goToWord,
    reset,
  }
})
