import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 30000,
})

// ===== Word Lists =====

export interface WordList {
  id: number
  name: string
  type: 'textbook' | 'upload'
  textbook_version?: string
  grade?: string
  unit?: string
  word_count: number
  created_at: string
}

export interface Word {
  id: number
  word_list_id: number
  chinese: string
  english: string
  sort_order: number
}

export function getWordLists(): Promise<{ data: WordList[] }> {
  return api.get('/word-lists').then(r => r.data)
}

export function getWordList(id: number): Promise<{ data: WordList & { words: Word[] } }> {
  return api.get(`/word-lists/${id}`).then(r => r.data)
}

export function uploadWordList(file: File, name?: string): Promise<{ data: WordList }> {
  const form = new FormData()
  form.append('file', file)
  if (name) form.append('name', name)
  return api.post('/word-lists/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export function deleteWordList(id: number): Promise<any> {
  return api.delete(`/word-lists/${id}`).then(r => r.data)
}

// ===== Practice =====

export interface PracticeSession {
  session_id: number
  word_list_id: number
  mode: 'full' | 'review'
  total_words: number
  words: Word[]
  correct_count?: number
  wrong_count?: number
  accuracy?: number
  status?: string
}

export interface AnswerResult {
  is_correct: boolean
  correct_answer: string
  user_answer: string
  chinese: string
}

export interface PracticeSummary {
  session_id: number
  total_words: number
  correct_count: number
  wrong_count: number
  accuracy: number
  wrong_words: any[]
  results: any[]
}

export function startPractice(word_list_id: number, mode: 'full' | 'review' = 'full'): Promise<{ data: PracticeSession | { message: string } }> {
  return api.post('/practice/start', { word_list_id, mode }).then(r => r.data)
}

export function submitAnswer(session_id: number, word_id: number, user_answer: string, answer_type: 'voice' | 'type' = 'type'): Promise<{ data: AnswerResult }> {
  return api.post('/practice/answer', { session_id, word_id, user_answer, answer_type }).then(r => r.data)
}

export function completePractice(session_id: number): Promise<{ data: PracticeSummary }> {
  return api.post(`/practice/${session_id}/complete`).then(r => r.data)
}

export function getPracticeHistory(word_list_id?: number): Promise<{ data: any[] }> {
  const params = word_list_id ? { word_list_id } : {}
  return api.get('/practice/history', { params }).then(r => r.data)
}

export function getPracticeDetail(session_id: number): Promise<{ data: any }> {
  return api.get(`/practice/${session_id}/detail`).then(r => r.data)
}

// ===== Textbooks =====

export interface TextbookInfo {
  version: string
  versionName: string
  grades: string[]
}

export interface TextbookUnitSummary {
  grade: string
  semester: string
  unit: string
  unitName: string
  wordCount: number
}

export function getTextbooks(): Promise<{ data: TextbookInfo[] }> {
  return api.get('/textbooks').then(r => r.data)
}

export function getTextbookGrades(version: string): Promise<{ data: string[] }> {
  return api.get(`/textbooks/${version}/grades`).then(r => r.data)
}

export function getTextbookUnits(version: string, grade?: string): Promise<{ data: TextbookUnitSummary[] }> {
  const params = grade ? { grade } : {}
  return api.get(`/textbooks/${version}/units`, { params }).then(r => r.data)
}

export function importTextbookUnit(
  version: string, grade: string, semester: string, unit: string
): Promise<{ data: WordList & { existed: boolean } }> {
  return api.post('/textbooks/import', { version, grade, semester, unit }).then(r => r.data)
}
