import express from 'express';
import cors from 'cors';
import path from 'path';
import { initializeDatabase } from './database';
import wordListsRouter from './routes/wordLists';
import practiceRouter from './routes/practice';
import textbooksRouter from './routes/textbooks';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
import fs from 'fs';
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initialize database
initializeDatabase();

// API Routes
app.use('/api/word-lists', wordListsRouter);
app.use('/api/practice', practiceRouter);
app.use('/api/textbooks', textbooksRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', name: 'tingxiebao-server', version: '0.1.0' });
});

// Serve static files in production (web frontend)
if (process.env.NODE_ENV === 'production') {
  const webDist = path.join(__dirname, '..', 'web', 'dist');
  app.use(express.static(webDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[Server] 听写宝服务端已启动 → http://localhost:${PORT}`);
  console.log(`[Server] API 健康检查 → http://localhost:${PORT}/api/health`);
});

export default app;
