import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import path from 'path';
import db from '../database';

const router = Router();

// Configure multer for Excel file uploads
const upload = multer({
  dest: path.join(__dirname, '..', 'uploads'),
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('只支持 .xlsx .xls .csv 格式的文件'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// GET /api/word-lists - List all word lists
router.get('/', (_req: Request, res: Response) => {
  const lists = db.prepare(`
    SELECT wl.*,
      COUNT(w.id) as word_count
    FROM word_lists wl
    LEFT JOIN words w ON w.word_list_id = wl.id
    GROUP BY wl.id
    ORDER BY wl.created_at DESC
  `).all();

  res.json({ data: lists });
});

// GET /api/word-lists/:id - Get a word list with all words
router.get('/:id', (req: Request, res: Response) => {
  const list = db.prepare('SELECT * FROM word_lists WHERE id = ?').get(req.params.id);
  if (!list) {
    return res.status(404).json({ error: '单词表不存在' });
  }

  const words = db.prepare(
    'SELECT * FROM words WHERE word_list_id = ? ORDER BY sort_order'
  ).all(req.params.id);

  res.json({ data: { ...list, words } });
});

// POST /api/word-lists/upload - Upload Excel file and create word list
router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    const name = req.body.name || path.basename(req.file.originalname, path.extname(req.file.originalname));

    // Parse Excel file
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Find the data rows (skip header row, look for columns with Chinese and English)
    const words: { chinese: string; english: string }[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;

      const english = String(row[0] || '').trim();
      const chinese = String(row[1] || '').trim();

      if (chinese && english) {
        words.push({ chinese, english });
      }
    }

    if (words.length === 0) {
      return res.status(400).json({ error: '未能从文件中解析到单词数据，请确保第一列为英文单词，第二列为中文释义' });
    }

    // Insert word list and words in a transaction
    const insertList = db.prepare(
      "INSERT INTO word_lists (name, type) VALUES (?, 'upload')"
    );
    const insertWord = db.prepare(
      'INSERT INTO words (word_list_id, chinese, english, sort_order) VALUES (?, ?, ?, ?)'
    );

    const result = db.transaction(() => {
      const { lastInsertRowid } = insertList.run(name);
      for (let i = 0; i < words.length; i++) {
        insertWord.run(lastInsertRowid, words[i].chinese, words[i].english, i);
      }
      return lastInsertRowid;
    })();

    const created = db.prepare(`
      SELECT wl.*, COUNT(w.id) as word_count
      FROM word_lists wl
      LEFT JOIN words w ON w.word_list_id = wl.id
      WHERE wl.id = ?
      GROUP BY wl.id
    `).get(result);

    res.status(201).json({ data: created });
  } catch (err: any) {
    console.error('[Upload Error]', err);
    res.status(500).json({ error: err.message || '文件处理失败' });
  }
});

// DELETE /api/word-lists/:id - Delete a word list
router.delete('/:id', (req: Request, res: Response) => {
  const list = db.prepare('SELECT * FROM word_lists WHERE id = ?').get(req.params.id);
  if (!list) {
    return res.status(404).json({ error: '单词表不存在' });
  }

  db.prepare('DELETE FROM word_lists WHERE id = ?').run(req.params.id);
  res.json({ data: { message: '已删除' } });
});

export default router;
