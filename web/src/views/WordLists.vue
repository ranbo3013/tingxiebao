<template>
  <div class="word-lists-page">
    <div class="page-header">
      <h2>📚 单词表</h2>
      <button class="btn btn-primary" @click="showUpload = true">
        + 上传 Excel
      </button>
    </div>

    <!-- Textbook Browser -->
    <div class="textbook-section mt-1">
      <button class="card textbook-card" @click="openTextbookBrowser">
        <div class="textbook-card-left">
          <span style="font-size:1.5rem">📖</span>
          <div>
            <strong>从教材选择</strong>
            <p class="text-light">人教版 (PEP) 七年级/八年级等</p>
          </div>
        </div>
        <span style="font-size:1.2rem">→</span>
      </button>
    </div>

    <!-- Word Lists -->
    <div v-if="lists.length > 0" class="lists">
      <div v-for="list in lists" :key="list.id" class="card list-card">
        <div class="list-info">
          <div class="list-type-badge" :class="list.type">
            {{ list.type === 'textbook' ? '📖 课本' : '📤 上传' }}
          </div>
          <h3 class="list-name">{{ list.name }}</h3>
          <div class="list-meta">
            <span>{{ list.word_count }} 个单词</span>
            <span v-if="list.grade">{{ list.grade }}</span>
          </div>
        </div>
        <div class="list-actions">
          <button class="btn btn-primary btn-sm" @click="startPractice(list)">
            ▶ 开始练习
          </button>
          <button class="btn btn-ghost btn-sm" @click="confirmDelete(list)">
            🗑️
          </button>
        </div>
      </div>
    </div>

    <div v-else class="empty-state card text-center mt-4">
      <div style="font-size: 3rem;">📭</div>
      <h3>还没有单词表</h3>
      <p class="text-light mt-1">上传一个 Excel 文件开始吧</p>
      <button class="btn btn-primary mt-2" @click="showUpload = true">📤 上传 Excel</button>
    </div>

    <!-- Upload Dialog -->
    <div class="dialog-overlay" v-if="showUpload" @click.self="showUpload = false">
      <div class="dialog animate-bounce-in">
        <h3>📤 上传单词表</h3>
        <p class="text-light mt-1 mb-2">
          Excel 格式：第一列英文单词，第二列中文释义
        </p>

        <div class="upload-zone" @click="triggerFileInput" @dragover.prevent @drop.prevent="handleDrop">
          <span style="font-size: 2rem;">📁</span>
          <p v-if="!selectedFile">点击选择文件或拖拽到此处</p>
          <p v-else>{{ selectedFile.name }}</p>
          <small class="text-light">支持 .xlsx .xls .csv</small>
        </div>

        <input
          ref="fileInput"
          type="file"
          accept=".xlsx,.xls,.csv"
          style="display:none"
          @change="handleFileSelect"
        />

        <div class="mt-2">
          <label class="input-label">单词表名称（可选）</label>
          <input v-model="uploadName" class="input" placeholder="不填则使用文件名" />
        </div>

        <button
          class="btn btn-primary btn-block mt-3"
          :disabled="!selectedFile || uploading"
          @click="doUpload"
        >
          {{ uploading ? '上传中...' : '开始上传' }}
        </button>
        <button class="btn btn-ghost mt-1" @click="showUpload = false">取消</button>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div class="dialog-overlay" v-if="showDeleteDialog" @click.self="showDeleteDialog = false">
      <div class="dialog animate-bounce-in text-center">
        <h3>删除单词表</h3>
        <p class="text-light mt-1">确定要删除 "{{ deleteTarget?.name }}" 吗？</p>
        <button class="btn btn-error btn-block mt-3" @click="doDelete">确认删除</button>
        <button class="btn btn-ghost mt-2" @click="showDeleteDialog = false">取消</button>
      </div>
    </div>

    <!-- Textbook Browser Dialog -->
    <div class="dialog-overlay" v-if="showTextbook" @click.self="showTextbook = false">
      <div class="dialog textbook-dialog animate-bounce-in">
        <h3>📖 选择教材</h3>

        <!-- Step 1: Select version -->
        <div v-if="textbookStep === 'version'">
          <p class="text-light mb-2">选择教材版本</p>
          <button v-for="tb in textbooks" :key="tb.version" class="textbook-option"
                  @click="selectTextbookVersion(tb)">
            <strong>{{ tb.versionName }}</strong>
            <small>{{ tb.grades.join('、') }}</small>
          </button>
        </div>

        <!-- Step 2: Select grade -->
        <div v-if="textbookStep === 'grade'">
          <p class="text-light mb-2">{{ selectedTextbook?.versionName }} · 选择年级</p>
          <button v-for="g in textbookGrades" :key="g" class="textbook-option"
                  @click="selectGrade(g)">
            <strong>{{ g }}</strong>
          </button>
          <button class="btn btn-ghost mt-2" @click="textbookStep = 'version'">← 返回</button>
        </div>

        <!-- Step 3: Select unit -->
        <div v-if="textbookStep === 'unit'">
          <p class="text-light mb-2">{{ selectedTextbook?.versionName }} · {{ selectedGrade }}</p>
          <div v-if="textbookUnits.length > 0" class="unit-list">
            <button v-for="u in textbookUnits" :key="u.unit" class="textbook-option unit-option"
                    @click="importUnit(u)">
              <div class="unit-info">
                <strong>{{ u.unit }}</strong>
                <small>{{ u.unitName }}</small>
              </div>
              <div class="unit-meta">
                <span class="unit-count">{{ u.wordCount }} 词</span>
                <span class="unit-semester">{{ u.semester }}</span>
              </div>
            </button>
          </div>
          <div v-else class="text-center mt-2">
            <p class="text-light">加载中...</p>
          </div>
          <button class="btn btn-ghost mt-2" @click="textbookStep = 'grade'">← 返回</button>
        </div>

        <button class="btn btn-ghost mt-2" @click="showTextbook = false">关闭</button>
      </div>
    </div>

    <!-- Practice Mode Dialog -->
    <div class="dialog-overlay" v-if="showModeDialog" @click.self="showModeDialog = false">
      <div class="dialog animate-bounce-in text-center">
        <h3>选择练习模式</h3>
        <p class="text-light mb-2">{{ practiceTarget?.name }}</p>

        <button class="mode-btn mode-full" @click="startWithMode('full')">
          <span class="mode-icon">📖</span>
          <div class="mode-info">
            <strong>完整练习</strong>
            <small>按顺序练习全部单词</small>
          </div>
        </button>

        <button
          class="mode-btn mode-review"
          @click="startWithMode('review')"
          :disabled="!hasHistory"
        >
          <span class="mode-icon">🔄</span>
          <div class="mode-info">
            <strong>错题重练</strong>
            <small>{{ hasHistory ? '只练上次出错的单词' : '需先完成一次完整练习' }}</small>
          </div>
        </button>

        <button class="btn btn-ghost mt-2" @click="showModeDialog = false">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getWordLists, uploadWordList, deleteWordList, getPracticeHistory, startPractice,
  getTextbooks, getTextbookGrades, getTextbookUnits, importTextbookUnit } from '../api'
import type { WordList, TextbookInfo, TextbookUnitSummary } from '../api'
import { usePracticeStore } from '../stores/practice'

const router = useRouter()
const store = usePracticeStore()

const lists = ref<WordList[]>([])
const showUpload = ref(false)
const selectedFile = ref<File | null>(null)
const uploadName = ref('')
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const showDeleteDialog = ref(false)
const deleteTarget = ref<WordList | null>(null)

const showModeDialog = ref(false)
const practiceTarget = ref<WordList | null>(null)
const hasHistory = ref(false)

// Textbook browser state
const showTextbook = ref(false)
const textbookStep = ref<'version' | 'grade' | 'unit'>('version')
const textbooks = ref<TextbookInfo[]>([])
const selectedTextbook = ref<TextbookInfo | null>(null)
const textbookGrades = ref<string[]>([])
const selectedGrade = ref('')
const textbookUnits = ref<TextbookUnitSummary[]>([])

onMounted(() => loadLists())

async function loadLists() {
  try {
    const res = await getWordLists()
    lists.value = res.data
  } catch (e) {
    console.error(e)
  }
}

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) {
    selectedFile.value = input.files[0]
    if (!uploadName.value) {
      uploadName.value = selectedFile.value.name.replace(/\.(xlsx|xls|csv)$/i, '')
    }
  }
}

function handleDrop(e: DragEvent) {
  const file = e.dataTransfer?.files[0]
  if (file) {
    selectedFile.value = file
    if (!uploadName.value) {
      uploadName.value = file.name.replace(/\.(xlsx|xls|csv)$/i, '')
    }
  }
}

async function doUpload() {
  if (!selectedFile.value) return
  uploading.value = true
  try {
    await uploadWordList(selectedFile.value, uploadName.value || undefined)
    showUpload.value = false
    selectedFile.value = null
    uploadName.value = ''
    await loadLists()
  } catch (e: any) {
    const msg = e.response?.data?.error || '上传失败，请检查文件格式'
    alert(msg)
  } finally {
    uploading.value = false
  }
}

function startPractice(list: WordList) {
  practiceTarget.value = list
  getPracticeHistory(list.id).then(res => {
    hasHistory.value = res.data.some((s: any) => s.status === 'completed')
    showModeDialog.value = true
  }).catch(() => {
    hasHistory.value = false
    showModeDialog.value = true
  })
}

async function startWithMode(mode: 'full' | 'review') {
  if (!practiceTarget.value) return
  showModeDialog.value = false

  const result = await store.startPractice(practiceTarget.value.id, mode)
  if ('allCorrect' in result && result.allCorrect) {
    alert(result.message)
    return
  }

  router.push(`/practice/${store.sessionId}`)
}

function confirmDelete(list: WordList) {
  deleteTarget.value = list
  showDeleteDialog.value = true
}

async function doDelete() {
  if (!deleteTarget.value) return
  try {
    await deleteWordList(deleteTarget.value.id)
    showDeleteDialog.value = false
    deleteTarget.value = null
    await loadLists()
  } catch (e) {
    console.error(e)
  }
}

// Textbook browser functions
async function openTextbookBrowser() {
  showTextbook.value = true
  textbookStep.value = 'version'
  try {
    const res = await getTextbooks()
    textbooks.value = res.data
  } catch (e) {
    console.error(e)
  }
}

async function selectTextbookVersion(tb: TextbookInfo) {
  selectedTextbook.value = tb
  try {
    const res = await getTextbookGrades(tb.version)
    textbookGrades.value = res.data
    textbookStep.value = 'grade'
  } catch (e) {
    console.error(e)
  }
}

async function selectGrade(grade: string) {
  selectedGrade.value = grade
  if (!selectedTextbook.value) return
  try {
    const res = await getTextbookUnits(selectedTextbook.value.version, grade)
    textbookUnits.value = res.data
    textbookStep.value = 'unit'
  } catch (e) {
    console.error(e)
  }
}

async function importUnit(u: TextbookUnitSummary) {
  if (!selectedTextbook.value) return
  try {
    await importTextbookUnit(
      selectedTextbook.value.version,
      u.grade,
      u.semester,
      u.unit
    )
    showTextbook.value = false
    await loadLists()
  } catch (e: any) {
    const msg = e.response?.data?.error || '导入失败'
    alert(msg)
  }
}
</script>

<style scoped>
.word-lists-page {
  padding-top: 8px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.btn-sm {
  padding: 10px 18px;
  font-size: 0.85rem;
}

.lists {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.list-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.list-info {
  flex: 1;
  min-width: 0;
}

.list-type-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  margin-bottom: 4px;
}

.list-type-badge.textbook {
  background: var(--color-primary-light);
  color: #92400E;
}

.list-type-badge.upload {
  background: var(--color-secondary-light);
  color: #065F46;
}

.list-name {
  font-size: 1.05rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-meta {
  font-size: 0.8rem;
  color: var(--color-text-light);
  display: flex;
  gap: 12px;
  margin-top: 2px;
}

.list-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

/* Upload dialog */
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
}

.upload-zone {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  padding: 32px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-zone:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.input-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--color-text-light);
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

.btn-error {
  background: var(--color-error);
  color: white;
  border-radius: var(--radius-full);
  padding: 14px 28px;
  border: none;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
}

.empty-state {
  padding: 40px 20px;
}

/* Textbook browser */
.textbook-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px dashed var(--color-secondary);
  background: var(--color-secondary-light);
  width: 100%;
  font-family: var(--font-body);
  text-align: left;
}

.textbook-card:hover {
  transform: translateY(-1px);
  border-color: var(--color-secondary);
}

.textbook-card-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.textbook-card-left strong {
  display: block;
  font-size: 0.95rem;
}

.textbook-card-left p {
  font-size: 0.8rem;
  margin-top: 2px;
}

.textbook-dialog {
  max-height: 80vh;
  overflow-y: auto;
}

.textbook-option {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-body);
  color: var(--color-text);
  margin-bottom: 8px;
  text-align: left;
}

.textbook-option:hover {
  border-color: var(--color-secondary);
  background: var(--color-secondary-light);
}

.textbook-option strong {
  display: block;
  font-size: 0.95rem;
}

.textbook-option small {
  display: block;
  color: var(--color-text-light);
  font-size: 0.8rem;
  margin-top: 2px;
}

.unit-list {
  max-height: 50vh;
  overflow-y: auto;
}

.unit-option {
  flex-wrap: wrap;
}

.unit-info {
  flex: 1;
  min-width: 0;
}

.unit-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.unit-count {
  background: var(--color-primary-light);
  color: #92400E;
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
}

.unit-semester {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
</style>
