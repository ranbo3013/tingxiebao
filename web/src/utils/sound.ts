/**
 * 听写宝音效 - 使用 Web Audio API 生成，无需外部文件
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

/**
 * 播放正确音效 - 轻快的上升音 🎉
 */
export function playCorrectSound(): void {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    // 两个音符的上升和弦
    const notes = [
      { freq: 523.25, start: 0, duration: 0.12 },    // C5
      { freq: 659.25, start: 0.10, duration: 0.15 },  // E5
      { freq: 783.99, start: 0.20, duration: 0.2 },   // G5
    ]

    for (const note of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(note.freq, now + note.start)

      gain.gain.setValueAtTime(0, now + note.start)
      gain.gain.linearRampToValueAtTime(0.3, now + note.start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.01, now + note.start + note.duration)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + note.start)
      osc.stop(now + note.start + note.duration + 0.01)
    }
  } catch {
    // 静默失败 - 音效不是关键功能
  }
}

/**
 * 播放错误音效 - 低沉的提示音 🔔
 */
export function playWrongSound(): void {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    // 两个低音形成不和谐的提示
    const notes = [
      { freq: 330, start: 0, duration: 0.15 },     // E4
      { freq: 277, start: 0.12, duration: 0.2 },   // C#4
    ]

    for (const note of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(note.freq, now + note.start)

      gain.gain.setValueAtTime(0, now + note.start)
      gain.gain.linearRampToValueAtTime(0.25, now + note.start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.01, now + note.start + note.duration)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + note.start)
      osc.stop(now + note.start + note.duration + 0.01)
    }
  } catch {
    // 静默失败
  }
}

/**
 * 播放完成音效 - 欢快的庆祝旋律 🎊
 */
export function playCompleteSound(): void {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    const notes = [
      { freq: 523.25, start: 0, duration: 0.12 },
      { freq: 659.25, start: 0.1, duration: 0.12 },
      { freq: 783.99, start: 0.2, duration: 0.12 },
      { freq: 1046.50, start: 0.35, duration: 0.3 },  // C6 延长
    ]

    for (const note of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(note.freq, now + note.start)

      gain.gain.setValueAtTime(0, now + note.start)
      gain.gain.linearRampToValueAtTime(0.3, now + note.start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.01, now + note.start + note.duration)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + note.start)
      osc.stop(now + note.start + note.duration + 0.01)
    }
  } catch {
    // 静默失败
  }
}

/**
 * 播报中文单词 - 使用浏览器 TTS
 */
/**
 * 从可用语音列表中挑选最佳女声
 */
function findBestVoice(preferred: string[], langPrefix: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null

  // 1. 在匹配语言的前提下，优先 preferred 列表中的名字
  const langVoices = voices.filter(v => v.lang.startsWith(langPrefix))
  for (const name of preferred) {
    const match = langVoices.find(v => v.name.includes(name))
    if (match) return match
  }
  // 如果精确语言没找到匹配，放宽语言前缀再试
  if (langPrefix.includes('-')) {
    const broader = langPrefix.split('-')[0]
    const broaderVoices = voices.filter(v => v.lang.startsWith(broader))
    for (const name of preferred) {
      const match = broaderVoices.find(v => v.name.includes(name))
      if (match) return match
    }
  }

  // 2. 在匹配语言中优先女声
  if (langVoices.length > 0) {
    const female = langVoices.find(v =>
      v.name.toLowerCase().includes('female') ||
      v.name.toLowerCase().includes('woman') ||
      v.name.toLowerCase().includes('girl')
    )
    if (female) return female
  }
  if (langVoices.length === 0) return null

  const female = langVoices.find(v =>
    v.name.toLowerCase().includes('female') ||
    v.name.toLowerCase().includes('woman') ||
    v.name.toLowerCase().includes('girl')
  )
  if (female) return female

  // 3. 排除明显是男声的名字
  const notMale = langVoices.find(v =>
    !v.name.toLowerCase().includes('male') &&
    !v.name.toLowerCase().includes('man') &&
    !v.name.toLowerCase().includes('boy') &&
    !v.name.toLowerCase().includes('david') &&
    !v.name.toLowerCase().includes('alex') &&
    !v.name.toLowerCase().includes('tom') &&
    !v.name.toLowerCase().includes('daniel')
  )
  return notMale || langVoices[0]
}

// 预加载语音列表（在用户首次交互时调用）
let voicesPreloaded = false
export function preloadVoices(): void {
  if (voicesPreloaded) return
  const voices = window.speechSynthesis.getVoices()
  if (voices.length > 0) voicesPreloaded = true
}

export function speakChinese(text: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      // 确保语音列表已加载
      const voices = window.speechSynthesis.getVoices()
      if (voices.length === 0) {
        // 语音未加载，延迟重试
        setTimeout(() => {
          try { speakChinese(text).then(resolve) } catch { resolve() }
        }, 200)
        return
      }

      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'zh-CN'
      utterance.rate = 0.85
      utterance.pitch = 1.0
      utterance.volume = 0.9

      const voice = findBestVoice([
        'Ting-Ting', 'Tingting', 'Lili', 'Mei-Jia', 'Sin-Ji', 'Google', 'Zhiwei', 'Ya-Ting',
      ], 'zh-CN')

      if (voice) utterance.voice = voice

      let resolved = false
      const done = () => { if (!resolved) { resolved = true; resolve() } }
      utterance.onend = done
      utterance.onerror = done

      window.speechSynthesis.speak(utterance)

      // 兜底：1.5 秒后强制 resolve
      setTimeout(done, 1500)
    } catch {
      resolve()
    }
  })
}

export function speakEnglish(text: string): void {
  try {
    // 不 cancel，避免打断中文播报
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.85
    utterance.pitch = 1.1       // 稍高音调，更清晰
    utterance.volume = 0.8

    const voice = findBestVoice(
      ['Samantha', 'Karen', 'Moira', 'Google', 'Microsoft Zira', 'Fiona', 'Susan'],
      'en'
    )
    if (voice) utterance.voice = voice

    window.speechSynthesis.speak(utterance)
  } catch {
    // 静默失败
  }
}
