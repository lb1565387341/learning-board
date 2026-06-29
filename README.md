# 📚 learning-board · 多课程学习看板引擎

一个由 **AI 驱动**的多课程学习管理系统。AI 作为老师授课，自动生成课程内容/速记卡/思维导图，并实时更新 Web 看板。

## ✨ 特点

### 🎓 AI 老师授课
- 每节课由 AI 老师讲解（课前复习 → 新课 → 课后验收）
- 课程内容直接以 Markdown 形式写入课程数据
- AI 自动生成速记卡、超快记忆问答、思维导图

### 📊 实时 Web 看板
- 进度环形图：直观展示课程整体完成率
- 每课 4 个 Tab：
  - **📖 课程内容** — 完整课堂笔记
  - **📝 速记卡** — 核心知识点汇总
  - **⚡ 超快记忆** — 问答形式，快速复习
  - **🌳 思维导图** — 脑图可视化（支持移动端缩放平移）

### 🧩 多课程支持
- 每门课放在 `courses/<course-id>/` 子目录
- 根路径显示所有课程列表
- 通过 `?course=<id>&token=<token>` 切换课程

### 📦 归档友好
- 纯静态数据结构（JSON + Markdown），Git 可追溯
- 一键 `git push` 即可备份/分享
- 服务端轻量（Node.js 零依赖框架）

## 🗂 目录结构

```
learning-board/
├── server.js           # 根级 Web 服务器（多课程引擎）
├── board.json          # 课程注册表
├── package.json        # Node 依赖（d3 + markmap）
├── .gitignore
├── README.md
└── courses/
    └── redis/          # 示例：Redis 课程
        ├── 课程数据.json   # 课程完整数据（章节/课时/内容/思维导图）
        ├── 速记卡.md       # 纯文本速记卡（离线可读）
        ├── server.js       # 每个课程独立引擎（也可独立运行）
        └── 看板.html        # 旧版静态看板
```

## 🚀 快速开始

```bash
# 安装依赖
cd learning-board
npm install

# 启动（默认 5002 端口）
node server.js

# 访问
# 课程列表 → http://localhost:5002/
# Redis课程 → http://localhost:5002/?course=redis&token=redis2024
```

## ➕ 添加新课

1. 创建 `courses/<course-id>/` 目录
2. 在 `board.json` 注册：

```json
{
  "courses": [
    {
      "id": "mysql",
      "title": "MySQL 进阶",
      "icon": "🗄️",
      "student": "刘哥",
      "token": "mysql2024",
      "dataFile": "courses/mysql/课程数据.json"
    }
  ]
}
```

3. 创建 `courses/mysql/课程数据.json`（参考 Redis 课程的数据格式）
4. 重启 server，课程自动出现在列表

## 🤖 如何配合 AI 使用（推荐工作流）

### 作为 AI 助理使用

让 AI 助手充当老师，按以下流程教学：

1. **加载课程数据** — AI 读取 `课程数据.json` 了解当前进度
2. **课前复习** — 抽查上节课速记卡中的问答
3. **授课** — AI 讲解新课程内容并写入 `lecture` 字段
4. **生成沉淀** — AI 自动填充 `note`（速记卡）、`quick`（超快记忆）、`mindmap`（思维导图）
5. **验收** — 课后 3 问巩固
6. **更新状态** — 把上节课标记 `done`，本节标记 `current`
7. **重启服务器** — 确认看板已更新
8. **推送到 GitHub** — `git add . && git commit -m "第 N 课" && git push`

### 数据格式参考

每课数据在 `课程数据.json` 中的 lessons 数组里：

```json
{
  "id": 2,
  "title": "Hash：ziplist → hashtable 升级条件",
  "status": "current",
  "lecture": "## 课程内容 Markdown...",
  "note": "速记卡 Markdown...",
  "quick": [
    { "q": "Hash 的两种编码是什么？", "a": "ziplist（小数据省内存）和 hashtable（大数据 O(1)）" }
  ],
  "mindmap": "# 思维导图 Markdown..."
}
```

## 📝 License

MIT
