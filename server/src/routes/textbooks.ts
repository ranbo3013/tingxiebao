import { Router, Request, Response } from 'express';
import db from '../database';
import { TEXTBOOKS, getUnitsByVersion, getUnitsByGrade, TextbookUnit } from '../seed';

const router = Router();

// GET /api/textbooks - 列出所有教材版本
router.get('/', (_req: Request, res: Response) => {
  res.json({ data: TEXTBOOKS });
});

// GET /api/textbooks/:version/grades - 获取某版本的年级列表
router.get('/:version/grades', (req: Request, res: Response) => {
  const textbook = TEXTBOOKS.find(t => t.version === req.params.version);
  if (!textbook) {
    return res.status(404).json({ error: '教材版本不存在' });
  }

  const units = getUnitsByVersion(req.params.version);
  // 从数据中提取可用的年级
  const grades = [...new Set(units.map(u => u.grade))];

  res.json({ data: grades });
});

// GET /api/textbooks/:version/units?grade=八年级 - 获取某版本某年级的所有单元
router.get('/:version/units', (req: Request, res: Response) => {
  const { version } = req.params;
  const { grade } = req.query;

  const textbook = TEXTBOOKS.find(t => t.version === version);
  if (!textbook) {
    return res.status(404).json({ error: '教材版本不存在' });
  }

  let units: TextbookUnit[];
  if (grade) {
    units = getUnitsByGrade(version, String(grade));
  } else {
    units = getUnitsByVersion(version);
  }

  // 只返回概要信息，不含具体单词
  const summaries = units.map(u => ({
    grade: u.grade,
    semester: u.semester,
    unit: u.unit,
    unitName: u.unitName,
    wordCount: u.words.length,
  }));

  res.json({ data: summaries });
});

// POST /api/textbooks/import - 将教材单元导入为单词表
router.post('/import', (req: Request, res: Response) => {
  const { version, grade, semester, unit } = req.body;

  if (!version || !grade || !semester || !unit) {
    return res.status(400).json({ error: '请指定教材版本、年级、学期和单元' });
  }

  const units = getUnitsByVersion(version);
  const targetUnit = units.find(
    u => u.grade === grade && u.semester === semester && u.unit === unit
  );

  if (!targetUnit) {
    return res.status(404).json({ error: '未找到指定单元' });
  }

  // 检查是否已经导入过
  const existingList = db.prepare(
    `SELECT * FROM word_lists
     WHERE type = 'textbook'
       AND textbook_version = ?
       AND grade = ?
       AND unit = ?`
  ).get(version, `${grade}${semester}`, unit) as any;

  if (existingList) {
    // 已存在，直接返回
    const words = db.prepare(
      'SELECT * FROM words WHERE word_list_id = ? ORDER BY sort_order'
    ).all(existingList.id);

    return res.json({
      data: {
        ...existingList,
        word_count: words.length,
        words,
        existed: true,
      }
    });
  }

  // 导入新单词表
  const insertList = db.prepare(
    `INSERT INTO word_lists (name, type, textbook_version, grade, unit)
     VALUES (?, 'textbook', ?, ?, ?)`
  );
  const insertWord = db.prepare(
    'INSERT INTO words (word_list_id, chinese, english, sort_order) VALUES (?, ?, ?, ?)'
  );

  const listName = `${grade}${semester} ${unit} ${targetUnit.unitName}`;
  const gradeStr = `${grade}${semester}`;

  const result = db.transaction(() => {
    const { lastInsertRowid } = insertList.run(listName, version, gradeStr, unit);
    targetUnit.words.forEach((w, i) => {
      insertWord.run(lastInsertRowid, w.chinese, w.english, i);
    });
    return lastInsertRowid;
  })();

  const created = db.prepare(`
    SELECT wl.*, COUNT(w.id) as word_count
    FROM word_lists wl
    LEFT JOIN words w ON w.word_list_id = wl.id
    WHERE wl.id = ?
    GROUP BY wl.id
  `).get(result);

  res.status(201).json({ data: { ...created, existed: false } });
});

export default router;
