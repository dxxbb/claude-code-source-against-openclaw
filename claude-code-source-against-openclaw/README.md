那你把这个工程 push 吧
# Claude Code Source Against OpenClaw

这是一个深度对照解读 AI Agent 运行时（Runtime）底层架构的研究工程。本项目将当下最具代表性的两种流派——**单体 CLI Agent (Claude Code)** 与 **分布式多模态 Agent 网关 (OpenClaw)**——从源码级别进行了并置比对，提取它们在上下文管理、并发任务调度和记忆巩固上的本质差异。

## 目录结构说明

本仓库包含三大核心的源码与自动化文档模块，彼此紧密关联：

### 1. 源架构对照组
- **`claude-code/`** (前身为 `03-claude-code-runnable`)
  Anthropic 官方第一方桌面 CLI 工具 `claude-code` (`v0.2.29`) 的逆向与可执行工程。它的设计代表了以极简、独立会话、物理文件依赖为主导的高效黑盒模式。

- **`openclaw/`**
  开源领域先进的多通道 Agent 运行时系统。它的设计代表了以 Coordinator 调度机制为主、支持飞书/Slack等多端跨通道（Workflow）协同的网络态/企业级 Agent 方案。

- **`pi-mono/`**
  OpenClaw 依赖的底层 SDK (类似 Agent 基础设施层)，其中封装了多模态记忆管理和分布式树状会话（Transcript Tree）的恢复。

### 2. 对抗解析文档系统 (Docs)
- **`docs/`**
  位于此目录下的正是项目的精髓：一套系统性的结构演练白皮书。
  
  所有的知识总结被解耦为 01 到 05 的 Markdown (`.md`) 原生文件，严格对应 Agent 调度的生命周期：
  1. `01-session.md`: 系统如何确定“当前是在沟通哪件事”？
  2. `02-context.md`: LLM 看到的 prompt 上下文是如何被防线组装出来的？
  3. `03-loop-engine.md`: 触发器之后的轮询（Ask/Talk/Think）如何流转？
  4. `04-subagent.md`: 当需要协同排查时，Agent 如何通过 Fork 派生子进程和应对安全冲突？
  5. `05-memory.md`: 长期的状态与摘要如何沉淀？

## 文档在线构建使用指南

我们采用了一套极简的工作流，让你既能拥有 `.md` 的纯净编辑体验，又能拥有高质感“学术白皮书”的网页阅读体验。

本工程附带了一个利用 Node 自动无损渲染 HTML 及现代排版的流程。当你在 `docs/` 修改了上述 `.md` 文件后，无需手动复制即可重新生成静态文档网页。

**快速重新构建文档:**
\`\`\`bash
cd docs
# 安装依赖 (首次使用)
npm install
# 重新生成网页
node build.js
\`\`\`

随后即可打开 `docs/index.html` 体验完整、具备高对比度和学术风格渲染的网页阅读。

---
*“在架构师的眼中，没有魔法。Agent 的智慧只是无数条件检查、上下文修剪与树状分支的排列组合。”*
