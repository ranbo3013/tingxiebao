# 🎧 听写宝 (Tingxiebao)

> 让英文听写变得简单有趣 — 中小学生英文听写/听说练习工具

[![Stack](https://img.shields.io/badge/stack-Vue%203%20%2B%20Express%20%2B%20SQLite-blue)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 📋 产品需求

### 用户痛点

传统英文听写需要家长全程参与：报中文 → 听回答 → 判断对错 → 纠正。一次完整练习耗时 15-30 分钟，高频（几乎每天），且**家长的英语水平直接决定了练习质量**。

### 目标用户

| 用户 | 场景 | 痛点 |
|------|------|------|
| 忙的家长 | 没时间每天陪练 | 想解放自己的时间 |
| 英语不好的家长 | 想帮但帮不了 | 不敢开口、无法判断对错 |
| 学生 | 需要独立完成听写练习 | 缺少即时反馈和纠错 |

### 核心功能

- 🗣️ **中文播报** — 浏览器 TTS 自动报中文，替代家长口播
- 🎤 **语音回答** — Web Speech API 识别英文发音，AI 模糊匹配
- ⌨️ **打字输入** — 支持键盘输入，自动识别拼读格式（B-O-O-K）
- 🔄 **错题重练** — 自动收集错误单词，精准反复练习
- 📖 **教材预设** — 内置人教版 PEP 3-9 年级词库，按单元选择
- 📤 **Excel 上传** — 支持自定义单词表（两列：英文, 中文）
- ⏱️ **倒计时** — 15s 超时自动判错
- 🔁 **连续模式** — 自动播报+自动开麦，全程免操作

### 验收标准

- 同一个单词表，第二遍错误数 ≤ 第一遍的 50%
- 学生愿意主动打开使用，不需家长提醒

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────┐
│          Web 前端 (Vue 3)            │
│  ┌──────────┐  ┌──────────────────┐ │
│  │  Home    │  │    Practice      │ │
│  │  WordLists│  │  ┌────────────┐ │ │
│  │  History  │  │  │ Voice Input│ │ │
│  │  Result   │  │  │ Type Input │ │ │
│  └──────────┘  │  │ Result Card│ │ │
│                 │  └────────────┘ │ │
│  Pinia Store ◄──┤  Sound Utils   │ │
│  API Layer      │  Timer         │ │
│  Vue Router     │  Speech API    │ │
│                 └──────────────────┘ │
└──────────────┬──────────────────────┘
               │ REST API (JSON)
┌──────────────▼──────────────────────┐
│       Backend (Node.js + Express)    │
│                                      │
│  /api/word-lists   - 单词表 CRUD    │
│  /api/practice     - 练习会话管理   │
│  /api/textbooks    - 教材浏览导入   │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  SQLite (better-sqlite3)       │  │
│  │  word_lists / words            │  │
│  │  practice_sessions / results   │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端框架 | **Vue 3** (Composition API) | 响应式 UI |
| 构建工具 | **Vite** | 极速 HMR |
| 状态管理 | **Pinia** | 练习会话状态 |
| 路由 | **Vue Router 4** | SPA 路由 |
| HTTP 请求 | **Axios** | API 调用 |
| 后端 | **Express** (TypeScript) | RESTful API |
| 数据库 | **SQLite** (better-sqlite3) | 零配置，嵌入式 |
| 语音播报 | **Web Speech Synthesis** | 浏览器内置 TTS |
| 语音识别 | **Web Speech Recognition** | Chrome 语音识别 |
| Excel 解析 | **SheetJS (xlsx)** | .xlsx/.csv 上传 |
| 部署 | **阿里云 ECS + Nginx** | 反向代理 + 静态站 |

### 数据库 Schema

```
word_lists          words               practice_sessions      practice_results
──────────          ─────               ────────────────      ────────────────
id                  id                  id                    id
name                word_list_id        word_list_id          session_id
type (textbook/     chinese             mode (full/review)    word_id
  upload)           english             status                is_correct
textbook_version    sort_order          total_words           attempts
grade                                   correct_count         answer_type
unit                                    wrong_count           user_answer
created_at                              started_at            created_at
                                        completed_at
```

---

## 🚀 本地开发

### 环境要求

- **Node.js** >= 18
- **npm** >= 9
- **Chrome** 浏览器（语音识别需要）

### 安装与启动

```bash
# 克隆项目
cd tingxiebao

# 安装全部依赖
npm run install:all

# 同时启动前后端
npm run dev
```

| 服务 | 地址 |
|------|------|
| 前端 (Vite) | http://localhost:5173 |
| 后端 API | http://localhost:3001 |
| API 健康检查 | http://localhost:3001/api/health |

### 单独启动

```bash
npm run dev:server   # 仅后端 → :3001
npm run dev:web      # 仅前端 → :5173
```

---

## 📦 部署

### 阿里云 ECS 部署

```bash
# 1. 构建前端
cd web && npm run build        # 产出 web/dist/

# 2. 编译后端
cd server && npm run build     # 产出 server/dist/

# 3. 上传到 ECS
scp -r server/dist web/dist user@your-ecs:/opt/tingxiebao/

# 4. 服务器上启动（使用 PM2）
npm i -g pm2
pm2 start server/dist/index.js --name tingxiebao
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    root /opt/tingxiebao/web/dist;
    index index.html;

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 生产环境变量

```bash
# .env
PORT=3001
NODE_ENV=production
```

### 前置条件

- ✅ 域名 ICP 备案（个人/企业）
- ✅ HTTPS 证书（Let's Encrypt 免费）
- ✅ Chrome 或 Edge 浏览器（语音识别 API 兼容）

---

## 📂 项目结构

```
tingxiebao/
├── README.md
├── package.json               # 根 monorepo 脚本
├── docs/
│   └── decision-doc.md        # 需求决策文档
├── server/                    # 后端
│   ├── package.json
│   ├── tsconfig.json
│   ├── data/                  # SQLite 数据库文件
│   └── src/
│       ├── index.ts           # Express 入口
│       ├── database.ts        # 数据库初始化
│       ├── seed.ts            # 教材种子数据 (PEP 3-9)
│       └── routes/
│           ├── wordLists.ts   # 单词表 API
│           ├── practice.ts    # 练习 API
│           └── textbooks.ts   # 教材 API
└── web/                       # 前端
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.ts            # Vue 入口
        ├── App.vue            # 主壳 + 导航
        ├── style.css          # 全局样式
        ├── router/index.ts    # 路由
        ├── api/index.ts       # API 封装
        ├── stores/practice.ts # Pinia 练习状态
        ├── utils/sound.ts     # 音效 + TTS
        └── views/
            ├── Home.vue       # 首页
            ├── WordLists.vue  # 单词表管理
            ├── Practice.vue   # 核心练习页
            ├── Result.vue     # 练习结果
            └── History.vue    # 历史记录
```

---

## 🎯 后续规划

- [ ] 微信小程序适配（备案完成后）
- [ ] 外研版、牛津版教材词库
- [ ] 发音评分 AI（接入大模型）
- [ ] 多设备数据同步（账号系统）
- [ ] 家长端查看练习报告
- [ ] 游戏化激励（积分、成就徽章）

---

## 📄 License

MIT © 2026
