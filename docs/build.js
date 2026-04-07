const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

// Configure marked to format headings, handle tables
marked.setOptions({
  gfm: true,
  breaks: true
});

const chapters = [
  { file: '01-session.md', title: '01-Session', out: '01-session.html' },
  { file: '02-context.md', title: '02-Context', out: '02-context.html' },
  { file: '03-loop-engine.md', title: '03-Loop Engine', out: '03-loop-engine.html' },
  { file: '04-subagent.md', title: '04-Subagent', out: '04-subagent.html' },
  { file: '05-memory.md', title: '05-Memory', out: '05-memory.html' },
];

function generateNav(activeFilename) {
  let nav = `
    <aside class="sidebar">
      <a href="index.html" class="sidebar-brand">Agent Loop 导读</a>
      <nav>
        <ul>
          <li class="nav-item">
            <a href="index.html" class="nav-link ${activeFilename === 'index.html' ? 'active' : ''}">00 · 导言</a>
          </li>
  `;
  
  for (const ch of chapters) {
    const active = (ch.out === activeFilename) ? 'active' : '';
    const label = ch.title.replace('-', ' · ');
    nav += `          <li class="nav-item"><a href="${ch.out}" class="nav-link ${active}">${label}</a></li>\n`;
  }
  
  nav += `
        </ul>
      </nav>
    </aside>
  `;
  return nav;
}

function buildHtml(title, activeFilename, contentHtml) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="docs-container">
    ${generateNav(activeFilename)}
    <main class="main-content">
      <div class="content-wrapper markdown-body">
        ${contentHtml}
      </div>
    </main>
  </div>
  
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    document.addEventListener("DOMContentLoaded", () => {
      // Convert marked's code blocks to mermaid divs
      const codeBlocks = document.querySelectorAll('code.language-mermaid');
      codeBlocks.forEach(block => {
        const pre = block.parentElement;
        const div = document.createElement('div');
        div.className = 'mermaid';
        div.textContent = block.textContent;
        pre.parentNode.replaceChild(div, pre);
      });
      // Handle blockquotes starting with [!IMPORTANT] etc.
      const blockquotes = document.querySelectorAll('blockquote');
      blockquotes.forEach(bq => {
        const match = bq.innerHTML.match(/\\[\\!(.*)\\]/);
        if (match) {
          bq.innerHTML = bq.innerHTML.replace(/\\[\\!(.*)\\]/, '<strong>$1</strong><br/>');
          bq.classList.add('insight-card');
        }
      });
      
      mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
    });
  </script>
</body>
</html>`;
}

// Build Chapter Files
for (const ch of chapters) {
  const mdPath = path.join(__dirname, ch.file);
  const outPath = path.join(__dirname, ch.out);
  if (fs.existsSync(mdPath)) {
    const mdContent = fs.readFileSync(mdPath, 'utf-8');
    const htmlContent = marked.parse(mdContent);
    const finalHtml = buildHtml(ch.title, ch.out, htmlContent);
    fs.writeFileSync(outPath, finalHtml);
    console.log(`Built ${ch.out} from ${ch.file}`);
  } else {
    console.warn(`File not found: ${ch.file}`);
  }
}

// Build Index.html
const indexMd = `
# Claude Code / OpenClaw Agent Runtime 架构导读

> **“Agent 的核心是一个 Loop。先把 Loop 和 Context 边界讲清楚，再向下拆解 Session 与 Memory。”**

本册子是一份面向高阶开发者的技术剖析，我们深入 \`v2.1.88\` 等源码核心，解构了行业领先的 AI Agent —— Claude Code 与 OpenClaw 的执行时逻辑（Runtime）。

## 核心洞察

在此前的各种科普中，Agent 被普遍视作一种“能思考循环”的实体。但一旦你深入到工程细节，你会发现大模型的每一次执行上下文才是 Agent 的真正血液。

本册子分为五个篇章，严格从用户敲击 Enter 键开始，直到 Agent 将结果持久化结束：

- [01 · Session：从用户到模型的映射链](./01-session.html)
- [02 · Context：模型那一端看到的「真相」](./02-context.html)
- [03 · Loop Engine：一轮对话里到底发生了多少次推理？](./03-loop-engine.html)
- [04 · Subagent：Claude Code 如何将自己"一分为多"](./04-subagent.html)
- [05 · Memory：Agent 的跨对话记忆](./05-memory.html)

## 为什么要做这样的解析？

你会发现 Claude Code （CC）与 OpenClaw （OC）采用了截然相反的哲学。
CC 是一个本地 CLI 工具，极端注重本地上下文的缓存命中率和低延迟交互；
而 OC 则是一套基于企业级 IM 体系与多工作流（Workflow）调度理念建立起来的网络态 Agent 运行时。

两种哲学的碰撞，在 Context 构建和 Subagent 并发隔离上尤为灿烂。在接下来的章节中，我们将为你逐层剥开它们的设计核心。
`;

const indexHtmlContent = marked.parse(indexMd);
const indexFinalHtml = buildHtml("Agent Loop 导读", "index.html", indexHtmlContent);
fs.writeFileSync(path.join(__dirname, 'index.html'), indexFinalHtml);
console.log('Built index.html');

