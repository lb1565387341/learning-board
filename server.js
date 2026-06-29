const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5002;
const BOARD_FILE = path.join(__dirname, 'board.json');
const COURSES_DIR = path.join(__dirname, 'courses');

// Shared lib directory (node_modules at root)
const LIB_DIR = path.join(__dirname, 'node_modules');

// Lib file map
const LIB_MAP = {
  'd3.min.js': path.join(LIB_DIR, 'd3/dist/d3.min.js'),
  'markmap-lib.js': path.join(LIB_DIR, 'markmap-lib/dist/browser/index.iife.js'),
  'markmap-view.js': path.join(LIB_DIR, 'markmap-view/dist/browser/index.js'),
};

function loadBoard() {
  try { return JSON.parse(fs.readFileSync(BOARD_FILE, 'utf-8')); }
  catch { return { courses: [] }; }
}

function saveBoard(data) {
  fs.writeFileSync(BOARD_FILE, JSON.stringify(data, null, 2));
}

function loadCourseData(courseId) {
  const board = loadBoard();
  const course = board.courses.find(c => c.id === courseId);
  if (!course) return null;
  const dataPath = path.join(__dirname, course.dataFile);
  try { return { course, data: JSON.parse(fs.readFileSync(dataPath, 'utf-8')) }; }
  catch { return null; }
}

function saveCourseData(courseId, data) {
  const board = loadBoard();
  const course = board.courses.find(c => c.id === courseId);
  if (!course) return false;
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(path.join(__dirname, course.dataFile), JSON.stringify(data, null, 2));
  return true;
}

function mdToHtml(text) {
  if (!text) {
    return '<p style="color:#8b949e;text-align:center;padding:40px 0;">📝 暂无内容，等课程开始后生成。</p>';
  }
  if (Array.isArray(text)) {
    if (text.length === 0) {
      return '<p style="color:#8b949e;text-align:center;padding:40px 0;">📝 暂无内容，等课程开始后生成。</p>';
    }
    let html = '';
    text.forEach(item => {
      const q = item.q || '';
      const a = item.a || '';
      html += `<div class="qa-card"><div class="qa-q" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')"><span class="qa-arrow">▶</span>${q}</div><div class="qa-a">${a}</div></div>`;
    });
    return html;
  }
  if (typeof text !== 'string') {
    text = String(text);
  }
  if (text === '暂无内容，等课程开始后生成。' || text.startsWith('暂无内容')) {
    return '<p style="color:#8b949e;text-align:center;padding:40px 0;">📝 暂无内容，等课程开始后生成。</p>';
  }
  let html = '';
  const lines = text.split('\n');
  let inCode = false;
  lines.forEach(line => {
    if (line.startsWith('```')) {
      if (inCode) { html += '</code></pre>\n'; inCode = false; }
      else { html += '<pre class="code-block"><code>'; inCode = true; }
      return;
    }
    if (inCode) { html += line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '\n'; return; }
    if (line.startsWith('### ')) { html += '<h4>' + line.slice(4) + '</h4>\n'; return; }
    if (line.startsWith('## ')) { html += '<h3>' + line.slice(3) + '</h3>\n'; return; }
    if (line.startsWith('# ')) { html += '<h2>' + line.slice(2) + '</h2>\n'; return; }
    if (line.startsWith('- ')) { html += '<li>' + line.slice(2) + '</li>\n'; return; }
    if (line.startsWith('> ')) { html += '<blockquote>' + line.slice(2) + '</blockquote>\n'; return; }
    if (line.startsWith('---')) { html += '<hr>\n'; return; }
    if (line.startsWith('| ')) {
      if (line.includes('---')) return;
      html += '<tr>' + line.split('|').filter(c => c.trim()).map(c => '<td>' + c.trim() + '</td>').join('') + '</tr>\n';
      return;
    }
    if (line === '') { html += '<br>\n'; return; }
    let processed = line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
    html += '<p>' + processed + '</p>\n';
  });
  if (inCode) html += '</code></pre>\n';
  return html;
}

function renderCoursePage(course, data) {
  const total = data.chapters.reduce((s, ch) => s + ch.lessons.length, 0);
  const done = data.chapters.reduce((s, ch) => s + ch.lessons.filter(l => l.status === 'done').length, 0);
  const current = data.chapters.reduce((s, ch) => s + ch.lessons.filter(l => l.status === 'current').length, 0);
  const pending = total - done - current;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;

  const mindmaps = {};
  data.chapters.forEach(ch => ch.lessons.forEach(l => {
    if (l.mindmap) mindmaps[l.id] = l.mindmap;
  }));

  let chaptersHtml = '';
  data.chapters.forEach((ch, ci) => {
    const chLetter = String.fromCharCode(65 + ci);
    const allDone = ch.lessons.every(l => l.status === 'done');
    const hasLesson = ch.lessons.some(l => l.status === 'current');
    const tag = allDone ? '✅' : (hasLesson ? '📖' : '⏳');
    const doneCount = ch.lessons.filter(l => l.status === 'done').length;
    let lessonsHtml = '';
    ch.lessons.forEach((l, li) => {
      const statusMap = { done: 'tag-done', current: 'tag-current', pending: 'tag-pending' };
      const tagText = { done: '✅ 已通过', current: '📖 进行中', pending: '⏳ 未开始' };
      const lecture = mdToHtml(l.lecture);
      const note = mdToHtml(l.note);
      const quick = mdToHtml(l.quick);

      lessonsHtml += `<div class="lesson-block" data-lesson-id="${l.id}">
  <div class="lesson-header" onclick="this.nextElementSibling.classList.toggle('open'); this.closest('.chapter-body').classList.add('open');">
    <span class="lesson-tag ${statusMap[l.status]}">${tagText[l.status]}</span>
    <span class="lesson-title">${chLetter}${li + 1}. ${l.title}</span>
    <span class="lesson-chevron">▶</span>
  </div>
  <div class="lesson-detail">
    <div class="detail-tabs">
      <button class="detail-tab active" onclick="switchDetailTab(this,'lecture',${l.id})">📖 课程内容</button>
      <button class="detail-tab" onclick="switchDetailTab(this,'note',${l.id})">📝 速记卡</button>
      <button class="detail-tab" onclick="switchDetailTab(this,'quick',${l.id})">⚡ 超快记忆</button>
      <button class="detail-tab" onclick="switchDetailTab(this,'mindmap',${l.id})">🌳 思维导图</button>
    </div>
    <div class="detail-content detail-lecture active">${lecture}</div>
    <div class="detail-content detail-note">${note}</div>
    <div class="detail-content detail-quick">${quick}</div>
    <div class="detail-content detail-mindmap">
      <div class="mindmap-container" id="mindmap-${l.id}"><svg></svg></div>
    </div>
  </div>
</div>`;
    });

    chaptersHtml += `<div class="chapter">
  <div class="chapter-title" onclick="this.nextElementSibling.classList.toggle('open')">
    <span>${tag}</span>
    <span>第${chLetter}章 ${ch.name}</span>
    <span class="ch-pct">${doneCount}/${ch.lessons.length}</span>
  </div>
  <div class="chapter-body">
    ${lessonsHtml}
  </div>
</div>`;
  });

  // List all courses for the nav bar
  const board = loadBoard();
  let courseNav = '';
  board.courses.forEach(c => {
    const active = c.id === course.id ? 'active' : '';
    courseNav += `<a class="course-nav-item ${active}" href="/?course=${c.id}&token=${c.token}">${c.icon} ${c.title}</a>`;
  });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>${course.title}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif; background:#0d1117; color:#e6edf3; }
  .container { max-width:720px; margin:0 auto; padding:20px 14px; }

  .course-nav { display:flex; gap:8px; margin-bottom:16px; overflow-x:auto; flex-wrap:wrap; }
  .course-nav-item { display:inline-block; padding:8px 14px; border-radius:8px; font-size:13px; font-weight:500; background:#161b22; border:1px solid #21262d; color:#8b949e; text-decoration:none; white-space:nowrap; }
  .course-nav-item.active { background:#3d2e00; border-color:#f7c948; color:#f7c948; }
  .course-nav-item:hover { background:#1c2128; }

  .header { margin-bottom:16px; }
  .header h1 { font-size:20px; font-weight:700; color:#f0f6fc; }
  .header .subtitle { font-size:11px; color:#484f58; margin-top:2px; }
  .header .meta { font-size:11px; color:#484f58; margin-top:4px; }

  .ring-wrap { display:flex; align-items:center; gap:16px; margin-bottom:20px; }
  .ring { position:relative; width:80px; height:80px; flex-shrink:0; }
  .ring svg { width:80px; height:80px; transform:rotate(-90deg); }
  .ring .bg { fill:none; stroke:#21262d; stroke-width:8; }
  .ring .fg { fill:none; stroke:#f7c948; stroke-width:8; stroke-linecap:round; transition:stroke-dashoffset .4s; }
  .ring .center { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:20px; font-weight:700; color:#f7c948; }
  .ring .center span { font-size:11px; color:#8b949e; }
  .stats { display:flex; gap:8px; flex-wrap:wrap; }
  .stat-box { background:#161b22; border:1px solid #21262d; border-radius:8px; padding:10px 8px; text-align:center; min-width:60px; }
  .stat-box .num { font-size:18px; font-weight:700; }
  .stat-box .label { font-size:10px; color:#8b949e; margin-top:2px; }
  .green { color:#3fb950; } .yellow { color:#f7c948; } .gray { color:#484f58; } .blue { color:#58a6ff; }

  .chapter { margin-bottom:12px; border:1px solid #21262d; border-radius:8px; overflow:hidden; background:#161b22; }
  .chapter-title { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; cursor:pointer; font-weight:600; font-size:14px; user-select:none; gap:8px; }
  .chapter-title:hover { background:#1c2128; }
  .ch-pct { font-size:12px; color:#8b949e; }
  .chapter-body { max-height:0; overflow:hidden; transition:max-height .2s; }
  .chapter-body.open { max-height:8000px; }
  .lesson-block { border-top:1px solid #21262d; }
  .lesson-block:first-child { border-top:none; }
  .lesson-header { display:flex; align-items:center; gap:10px; padding:12px 16px; cursor:pointer; user-select:none; }
  .lesson-header:hover { background:#1c2128; }
  .lesson-tag { font-size:11px; }
  .tag-done { color:#3fb950; }
  .tag-current { color:#f7c948; }
  .tag-pending { color:#484f58; }
  .lesson-title { font-size:14px; flex:1; }
  .lesson-chevron { font-size:10px; color:#484f58; transition:transform .15s; }
  .lesson-detail { display:none; border-top:1px solid #21262d; background:#0d1117; }
  .lesson-detail.open { display:block; }

  .detail-tabs { display:flex; border-bottom:1px solid #21262d; background:#161b22; overflow-x:auto; }
  .detail-tab { padding:10px 14px; font-size:13px; font-weight:500; background:transparent; border:none; color:#8b949e; cursor:pointer; border-bottom:2px solid transparent; white-space:nowrap; flex-shrink:0; }
  .detail-tab.active { color:#f7c948; border-bottom-color:#f7c948; }
  .detail-content { display:none; padding:16px 18px; font-size:14px; line-height:1.7; overflow-x:auto; }
  .detail-content.active { display:block; }

  .detail-lecture h2 { font-size:18px; margin:16px 0 8px; color:#f7c948; }
  .detail-lecture h3 { font-size:15px; margin:12px 0 6px; }
  .detail-lecture h4 { font-size:14px; margin:10px 0 4px; color:#e6edf3; }
  .detail-lecture hr { border:none; border-top:1px solid #30363d; margin:16px 0; }
  .detail-lecture p { margin:6px 0; }
  .detail-lecture li { margin:4px 0 4px 18px; }
  .detail-lecture blockquote { border-left:3px solid #f7c948; padding-left:14px; color:#8b949e; margin:10px 0; font-size:13px; }
  .detail-lecture .code-block { background:#0d1117; border:1px solid #30363d; border-radius:6px; padding:14px; overflow-x:auto; margin:10px 0; font-size:13px; line-height:1.5; color:#f0f6fc; }
  .detail-lecture table { border-collapse:collapse; margin:10px 0; font-size:13px; width:100%; }
  .detail-lecture th, .detail-lecture td { border:1px solid #30363d; padding:6px 10px; text-align:left; }
  .detail-lecture th { background:#161b22; color:#f7c948; }

  .detail-note h2 { font-size:17px; margin:14px 0 8px; color:#f7c948; }
  .detail-note h3 { font-size:15px; margin:12px 0 6px; }
  .detail-note hr { border:none; border-top:1px solid #30363d; margin:16px 0; }
  .detail-note p { margin:6px 0; }
  .detail-note li { margin:4px 0 4px 18px; }
  .detail-note .code-block { background:#0d1117; border:1px solid #30363d; border-radius:6px; padding:14px; overflow-x:auto; margin:10px 0; font-size:13px; line-height:1.5; color:#f0f6fc; }
  .detail-note table { border-collapse:collapse; margin:10px 0; font-size:13px; width:100%; }
  .detail-note th, .detail-note td { border:1px solid #30363d; padding:6px 10px; text-align:left; }
  .detail-note th { background:#161b22; }

  .qa-card { border:1px solid #30363d; border-radius:6px; margin-bottom:6px; overflow:hidden; }
  .qa-q { padding:12px 14px; cursor:pointer; font-size:13px; font-weight:500; display:flex; align-items:center; gap:8px; user-select:none; }
  .qa-q:hover { background:#161b22; }
  .qa-q .qa-arrow { font-size:10px; color:#8b949e; transition:transform .15s; }
  .qa-q.open .qa-arrow { transform:rotate(90deg); }
  .qa-a { display:none; padding:0 14px 12px 34px; font-size:13px; color:#f7c948; line-height:1.5; }
  .qa-a.open { display:block; }

  .mindmap-container { width:100%; min-height:400px; background:#ffffff; border-radius:8px; }
  .mindmap-container svg { display:block; }
  .mindmap-container .markmap-foreign { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif !important; }
  .mindmap-container .markmap-foreign p { margin:0; font-size:12px; line-height:1.4; }
  .mindmap-container .markmap-foreign strong { font-weight:600; color:#f7c948; }
  .detail-mindmap.active { overflow:hidden !important; }

  .footer { text-align:center; margin-top:32px; font-size:11px; color:#21262d; }

  @media (max-width:600px) {
    .container { padding:12px 8px; }
    .header h1 { font-size:17px; }
    .header .meta { font-size:10px; }
    .stats { gap:4px; }
    .stat-box { padding:8px 6px; min-width:50px; }
    .stat-box .num { font-size:16px; }
    .stat-box .label { font-size:9px; }
    .ring-wrap { gap:10px; }
    .ring { width:60px; height:60px; }
    .ring svg { width:60px; height:60px; }
    .ring .center { font-size:16px; }
    .chapter-title { padding:10px 12px; font-size:13px; }
    .lesson-header { padding:10px 12px; }
    .lesson-title { font-size:12px; }
    .detail-tab { padding:8px 8px; font-size:11px; }
    .detail-content { padding:10px 12px; font-size:13px; }
    .detail-lecture h2 { font-size:15px; }
    .detail-lecture h3 { font-size:13px; }
    .detail-lecture .code-block { font-size:11px; padding:10px; }
    .detail-lecture table { font-size:11px; }
    .detail-lecture th, .detail-lecture td { padding:4px 6px; }
    .detail-note h2 { font-size:14px; }
    .qa-q { font-size:12px; padding:10px 12px; }
    .qa-a { font-size:12px; padding:0 12px 10px 30px; }
  }
  @media (max-width:400px) {
    .stat-box .num { font-size:14px; }
    .detail-tab { padding:6px 6px; font-size:10px; }
    .lesson-title { font-size:11px; }
    .ring { width:50px; height:50px; }
    .ring svg { width:50px; height:50px; }
    .ring .center { font-size:13px; }
    .mindmap-container svg { height:250px !important; }
  }
</style>
<script src="/lib/d3.min.js"></script>
<script src="/lib/markmap-lib.js"></script>
<script src="/lib/markmap-view.js"></script>
</head>
<body>
<div class="container">

  <div class="course-nav">${courseNav}</div>

  <div class="header">
    <h1>${course.icon} ${course.title}</h1>
    <div class="subtitle">${course.student || ''}</div>
    <div class="meta" id="lastUpdate">${new Date(data.lastUpdated).toLocaleString('zh-CN')}</div>
  </div>

  <div class="ring-wrap">
    <div class="ring">
      <svg viewBox="0 0 100 100">
        <circle class="bg" cx="50" cy="50" r="42"/>
        <circle class="fg" cx="50" cy="50" r="42" stroke-dasharray="263.89" stroke-dashoffset="${263.89-(pct/100)*263.89}"/>
      </svg>
      <div class="center">${pct}<span>%</span></div>
    </div>
    <div class="stats" style="flex:1;">
      <div class="stat-box"><div class="num green">${done}</div><div class="label">✅ 已通过</div></div>
      <div class="stat-box"><div class="num yellow">${current}</div><div class="label">📖 进行中</div></div>
      <div class="stat-box"><div class="num gray">${pending}</div><div class="label">⏳ 未开始</div></div>
      <div class="stat-box"><div class="num blue">${total}</div><div class="label">📋 总课数</div></div>
    </div>
  </div>

  <div id="chapters">${chaptersHtml}</div>

  <div class="footer">${new Date(data.lastUpdated).toLocaleString('zh-CN')} · 每完成一课自动更新</div>
</div>

<script>
  const mindmapData = ${JSON.stringify(mindmaps)};
  let mindmapRendered = {};

  function switchDetailTab(btn, tab, lessonId) {
    const block = btn.closest('.lesson-detail');
    block.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    block.querySelectorAll('.detail-content').forEach(c => {
      c.classList.remove('active');
      c.style.overflowX = '';
    });
    btn.classList.add('active');
    const content = block.querySelector('.detail-' + tab);
    content.classList.add('active');
    if (tab === 'mindmap') {
      content.style.overflowX = 'hidden';
    }
    if (tab === 'mindmap' && lessonId && mindmapData[lessonId]) {
      if (!mindmapRendered[lessonId]) {
        renderMindmap(lessonId);
      } else {
        const container = document.getElementById('mindmap-' + lessonId);
        if (container) {
          const svg = container.querySelector('svg');
          if (svg) {
            const isMobile = window.innerWidth < 768;
            svg.style.width = '100%';
            svg.style.height = isMobile ? (window.innerHeight * 0.65 + 'px') : '420px';
          }
        }
      }
    }
  }

  async function renderMindmap(lessonId) {
    const container = document.getElementById('mindmap-' + lessonId);
    if (!container) return;
    const md = mindmapData[lessonId];
    if (!md) {
      container.innerHTML = '<p style="color:#8b949e;text-align:center;padding:40px 0;">暂无思维导图内容。</p>';
      return;
    }
    try {
      const { Transformer, builtInPlugins } = markmap;
      const transformer = new Transformer(builtInPlugins);
      const svg = container.querySelector('svg');
      if (!svg) return;
      const root = transformer.transform(md).root;
      const isMobile = window.innerWidth < 768;
      svg.style.width = '100%';
      svg.style.height = isMobile ? (window.innerHeight * 0.65 + 'px') : '420px';
      const mm = new markmap.Markmap(svg, {
        colorFreezeLevel: 2,
        spacingHorizontal: isMobile ? 10 : 18,
        spacingVertical: isMobile ? 3 : 5,
        fitRatio: 0.95,
        zoom: true,
        pan: true,
      });
      await mm.setData(root);
      await mm.fit();
      mindmapRendered[lessonId] = true;
    } catch(e) {
      container.innerHTML = '<p style="color:#f0883e;text-align:center;padding:40px 0;">思维导图渲染出错：' + e.message + '</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.lesson-block').forEach(block => {
      if (block.querySelector('.tag-current')) {
        block.querySelector('.lesson-detail').classList.add('open');
        const chapterBody = block.closest('.chapter-body');
        if (chapterBody) chapterBody.classList.add('open');
      }
    });
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      Object.keys(mindmapRendered).forEach(id => {
        const container = document.getElementById('mindmap-' + id);
        if (!container) return;
        const content = container.closest('.detail-content');
        if (content && content.classList.contains('active')) {
          const svg = container.querySelector('svg');
          if (svg) {
            const isMobile = window.innerWidth < 768;
            svg.style.height = isMobile ? (window.innerHeight * 0.65 + 'px') : '420px';
          }
        }
      });
    }, 300);
  });
</script>
</body>
</html>`;
}

function renderCourseList() {
  const board = loadBoard();
  let cards = '';
  board.courses.forEach(c => {
    cards += `<a class="course-card" href="/?course=${c.id}&token=${c.token}">
  <div class="course-card-icon">${c.icon}</div>
  <div class="course-card-title">${c.title}</div>
  <div class="course-card-student">${c.student || ''}</div>
</a>`;
  });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>学习看板</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif; background:#0d1117; color:#e6edf3; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; }
  .container { max-width:600px; width:100%; }
  h1 { font-size:24px; font-weight:700; margin-bottom:8px; }
  .desc { font-size:13px; color:#8b949e; margin-bottom:28px; }
  .course-card { display:flex; flex-direction:column; align-items:center; gap:8px; padding:28px; background:#161b22; border:1px solid #30363d; border-radius:12px; text-decoration:none; color:#e6edf3; transition:border-color .15s; margin-bottom:12px; }
  .course-card:hover { border-color:#f7c948; }
  .course-card-icon { font-size:36px; }
  .course-card-title { font-size:18px; font-weight:600; }
  .course-card-student { font-size:12px; color:#8b949e; }
  .footer { text-align:center; margin-top:24px; font-size:11px; color:#21262d; }
</style>
</head>
<body>
<div class="container">
  <h1>📚 学习看板</h1>
  <div class="desc">选择课程</div>
  ${cards}
  <div class="footer">学习看板引擎 · GitHub: learning-board</div>
</div>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Serve lib files
  if (url.pathname.startsWith('/lib/')) {
    const libName = url.pathname.replace('/lib/', '');
    if (LIB_MAP[libName]) {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(fs.readFileSync(LIB_MAP[libName]));
      return;
    }
    res.writeHead(404); res.end('Not found');
    return;
  }

  const courseId = url.searchParams.get('course');
  const token = url.searchParams.get('token');

  // Course list page if no course specified
  if (!courseId) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderCourseList());
    return;
  }

  // Load course
  const result = loadCourseData(courseId);
  if (!result) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('课程不存在');
    return;
  }

  const { course, data } = result;

  // Token validation
  if (token !== course.token) {
    res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('401 Unauthorized\n\n请输入正确的 token 访问');
    return;
  }

  // API: update course data
  if (url.pathname === '/api/update' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const { lessonId, status, lecture, note, quick, mindmap } = JSON.parse(body);
        const courseData = loadCourseData(courseId);
        if (!courseData) { res.writeHead(404); res.end('Not found'); return; }
        let found = false;
        courseData.data.chapters.forEach(ch => ch.lessons.forEach(l => {
          if (l.id === lessonId) {
            if (status) l.status = status;
            if (lecture !== undefined) l.lecture = lecture;
            if (note !== undefined) l.note = note;
            if (quick !== undefined) l.quick = quick;
            if (mindmap !== undefined) l.mindmap = mindmap;
            found = true;
          }
        }));
        if (!found) { res.writeHead(404); res.end('Not found'); return; }
        saveCourseData(courseId, courseData.data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch(e) {
        res.writeHead(400); res.end('Bad request');
      }
    });
    return;
  }

  // API: get course data
  if (url.pathname === '/api/data') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // Serve course page
  if (url.pathname === '/' || url.pathname === '') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderCoursePage(course, data));
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 学习看板引擎 → http://0.0.0.0:${PORT}`);
  console.log(`   Redis课程 → http://0.0.0.0:${PORT}/?course=redis&token=redis2024`);
});
