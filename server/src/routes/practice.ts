import { Router, Request, Response } from 'express';
import db from '../database';

const router = Router();

/** 常见缩写展开 */
const ABBREVIATIONS: Record<string, string> = {
  sth: 'something', sb: 'somebody', sbd: 'somebody',
  etc: 'etcetera', vs: 'versus', dept: 'department',
  info: 'information', app: 'application', ad: 'advertisement',
  exam: 'examination', phone: 'telephone', bike: 'bicycle',
  math: 'mathematics', gym: 'gymnasium', lab: 'laboratory',
  photo: 'photograph', tv: 'television',
}

function expandAbbreviations(text: string): string {
  return text.split(/\s+/).map(w => {
    const clean = w.replace(/[^a-zA-Z]/g, '').toLowerCase()
    return ABBREVIATIONS[clean] || w
  }).join(' ')
}

/** 展开 "/" 替代项、 "=" 等价表达和 "()" 可选部分：
 *   "a/the secret"                     → ["a secret", "the secret"]
 *   "hurry to do sth = do sth in hurry" → ["hurry to do something", "do something in hurry"]
 *   "hurry up (with sth)"              → ["hurry up", "hurry up with something"]
 */
function expandAlternatives(text: string): string[] {
  // 先提取 "()" 可选段（在 expandAbbreviations 之前，避免括号被吞掉）
  const optionalMap: string[] = []
  text = text.replace(/\(([^)]+)\)/g, (_, content) => {
    const idx = optionalMap.length
    optionalMap.push(content)
    return ` [OPTIONAL:${idx}] `
  })

  // 再展开缩写
  text = expandAbbreviations(text)

  function combine(arrays: string[][], index: number, current: string[]): string[] {
    if (index === arrays.length) return [current.join(' ')]
    const results: string[] = []
    for (const item of arrays[index]) {
      results.push(...combine(arrays, index + 1, [...current, item]))
    }
    return results
  }

  // 按 "=" 拆分等价表达，每部分分别处理
  const equalParts = text.split('=').map(s => s.trim())
  const allResults: string[] = []

  for (const eqPart of equalParts) {
    const tokens = eqPart.split(/\s+/)
    const parts = tokens.map(t => {
      // 处理可选部分标记
      const optMatch = t.match(/^\[OPTIONAL:(\d+)\]$/)
      if (optMatch) {
        const content = optionalMap[Number(optMatch[1])]
        const expanded = expandAbbreviations(content)
        // 可选：带或不带
        return [expanded, '']
      }
      return t.includes('/') ? t.split('/') : [t]
    })
    allResults.push(...combine(parts, 0, []))
  }

  // 清理：去除首尾空格、合并多余空格、过滤空结果
  return allResults.map(r => r.replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ')).filter(Boolean)
}

// POST /api/practice/start - Start a new practice session
router.post('/start', (req: Request, res: Response) => {
  const { word_list_id, mode = 'full' } = req.body;

  if (!word_list_id) {
    return res.status(400).json({ error: '请选择单词表' });
  }

  const wordList = db.prepare('SELECT * FROM word_lists WHERE id = ?').get(word_list_id);
  if (!wordList) {
    return res.status(404).json({ error: '单词表不存在' });
  }

  // Get words for this session
  let words: any[];
  if (mode === 'review') {
    // Review mode: get words that were wrong in the last completed session
    const lastSession = db.prepare(
      `SELECT id FROM practice_sessions
       WHERE word_list_id = ? AND status = 'completed'
       ORDER BY completed_at DESC LIMIT 1`
    ).get(word_list_id);

    if (!lastSession) {
      return res.status(400).json({
        error: '没有找到已完成练习记录，请先完成一次完整练习',
        fallback_mode: 'full'
      });
    }

    const wrongWordIds = db.prepare(
      `SELECT DISTINCT word_id FROM practice_results
       WHERE session_id = ? AND is_correct = 0`
    ).all((lastSession as any).id).map((r: any) => r.word_id);

    if (wrongWordIds.length === 0) {
      return res.json({
        data: { message: '太棒了！上一次练习全部正确，没有需要复习的单词！' }
      });
    }

    words = db.prepare(
      `SELECT * FROM words WHERE word_list_id = ? AND id IN (${wrongWordIds.map(() => '?').join(',')}) ORDER BY sort_order`
    ).all(word_list_id, ...wrongWordIds);
  } else {
    // Full mode: get all words
    words = db.prepare(
      'SELECT * FROM words WHERE word_list_id = ? ORDER BY sort_order'
    ).all(word_list_id);
  }

  if (words.length === 0) {
    return res.status(400).json({ error: '单词表为空' });
  }

  // Create session
  const session = db.prepare(`
    INSERT INTO practice_sessions (word_list_id, mode, total_words)
    VALUES (?, ?, ?)
  `).run(word_list_id, mode, words.length);

  res.status(201).json({
    data: {
      session_id: Number(session.lastInsertRowid),
      word_list_id,
      mode,
      total_words: words.length,
      words,
    }
  });
});

// POST /api/practice/answer - Submit an answer for the current word
router.post('/answer', (req: Request, res: Response) => {
  const { session_id, word_id, user_answer, answer_type = 'type' } = req.body;

  if (!session_id || !word_id || user_answer === undefined) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  // Get the correct answer
  const word = db.prepare('SELECT * FROM words WHERE id = ?').get(word_id) as any;
  if (!word) {
    return res.status(404).json({ error: '单词不存在' });
  }

  // Check if answer matches — support "/" alternatives, "=" equivalents, and "()" optional parts
  const userClean = String(user_answer).replace(/[^a-zA-Z]/g, '').toLowerCase();
  const isCorrect = expandAlternatives(word.english).some(
    alt => alt.replace(/[^a-zA-Z]/g, '').toLowerCase() === userClean
  );

  // Record the result
  db.prepare(`
    INSERT INTO practice_results (session_id, word_id, is_correct, answer_type, user_answer)
    VALUES (?, ?, ?, ?, ?)
  `).run(session_id, word_id, isCorrect ? 1 : 0, answer_type, String(user_answer));

  // Update session counts
  if (isCorrect) {
    db.prepare('UPDATE practice_sessions SET correct_count = correct_count + 1 WHERE id = ?').run(session_id);
  } else {
    db.prepare('UPDATE practice_sessions SET wrong_count = wrong_count + 1 WHERE id = ?').run(session_id);
  }

  res.json({
    data: {
      is_correct: isCorrect,
      correct_answer: word.english,
      user_answer: String(user_answer),
      chinese: word.chinese,
    }
  });
});

// POST /api/practice/:id/complete - Complete a practice session
router.post('/:id/complete', (req: Request, res: Response) => {
  const session = db.prepare('SELECT * FROM practice_sessions WHERE id = ?').get(req.params.id) as any;
  if (!session) {
    return res.status(404).json({ error: '练习记录不存在' });
  }

  db.prepare(`
    UPDATE practice_sessions
    SET status = 'completed', completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.params.id);

  // Get summary
  const results = db.prepare(`
    SELECT pr.*, w.chinese, w.english as correct_english
    FROM practice_results pr
    JOIN words w ON w.id = pr.word_id
    WHERE pr.session_id = ?
    ORDER BY pr.created_at
  `).all(req.params.id);

  const wrongWords = results.filter((r: any) => !r.is_correct);

  res.json({
    data: {
      session_id: Number(session.id),
      total_words: session.total_words,
      correct_count: session.correct_count,
      wrong_count: session.wrong_count,
      accuracy: session.total_words > 0
        ? Math.round((session.correct_count / session.total_words) * 100)
        : 0,
      wrong_words: wrongWords,
      results,
    }
  });
});

// GET /api/practice/history - Get practice history
router.get('/history', (req: Request, res: Response) => {
  const { word_list_id } = req.query;

  let query = `
    SELECT ps.*, wl.name as word_list_name
    FROM practice_sessions ps
    JOIN word_lists wl ON wl.id = ps.word_list_id
  `;
  const params: any[] = [];

  if (word_list_id) {
    query += ' WHERE ps.word_list_id = ?';
    params.push(word_list_id);
  }

  query += ' ORDER BY ps.started_at DESC LIMIT 50';

  const sessions = db.prepare(query).all(...params);
  res.json({ data: sessions });
});

// GET /api/practice/:id/detail - Get detailed results of a session
router.get('/:id/detail', (req: Request, res: Response) => {
  const session = db.prepare(`
    SELECT ps.*, wl.name as word_list_name
    FROM practice_sessions ps
    JOIN word_lists wl ON wl.id = ps.word_list_id
    WHERE ps.id = ?
  `).get(req.params.id) as any;

  if (!session) {
    return res.status(404).json({ error: '练习记录不存在' });
  }

  const results = db.prepare(`
    SELECT pr.*, w.chinese, w.english as correct_english
    FROM practice_results pr
    JOIN words w ON w.id = pr.word_id
    WHERE pr.session_id = ?
    ORDER BY pr.created_at
  `).all(req.params.id);

  res.json({ data: { ...session, results } });
});

export default router;
