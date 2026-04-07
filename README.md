# AI Agent 架构研究：Claude Code 与 OpenClaw 的源码深度对比

> **想要构建工业级的 AI Agent，却不知道如何落地？** 我们深入剖析了 Anthropic 官方的 **Claude Code** (极简高效的 CLI 模式) 与 **OpenClaw** (分布式企业级网关模式) 的底层运行机制，并将研究心得整理成了这份通俗易懂的文档。

---

## 🚀 为什么关注这个项目？

在 AI 技术飞速发展的今天，很多人只会调 API。但真正的 Agent 挑战在于：**如何管理超长文本？模型是怎么“记住”并“理解”之前对话的？如何精准控制成本又保证逻辑一致性？**

本仓库不讲大道理，我们直接从**源码级别**对比这两大标杆项目：

- **Claude Code (CC)**：追求极致的反馈速度、上下文利用率和开发体验（本地命令行流派）。
- **OpenClaw (OC)**：追求多平台适配、复杂的任务流调度和企业级安全性（分布式网关流派）。

通过阅读这些精选的解析文档，你将收获关于 Agent **Session (会话)**、**Context (上下文)**、**Loop (运行循环)**、**Memory (记忆)** 以及 **Subagent (子任务)** 的顶级设计模式。

## 📖 在线阅读与导读

我们为你准备了五个极具启发性的章节，点击下方链接即可通过 GitHub Pages 获取更佳的阅读体验：

👉 **[在线文档入口 (正在发布中...)](#)** 👈

### 章节速览：
1. **[01 · Session](docs/01-session.md)**：彻底搞懂消息是如何从用户输入变成模型能理解的消息队列。
2. **[02 · Context](docs/02-context.md)**：看工业级产品如何做上下文修剪、流量控制和 Prompt 缓存优化。
3. **[03 · Loop Engine](docs/03-loop-engine.md)**：Agent 后台的“思考循环”到底在转什么？一轮对话到底推理了多少次？
4. **[04 · Subagent](docs/04-subagent.md)**：当一个 Agent 搞不定时，它是如何优雅地“呼叫增援”的。
5. **[05 · Memory](docs/05-memory.md)**：Agent 的记忆是如何从碎片化的 Log 沉淀为可复用的知识。

---

## 🛠️ 如何参与研究？

你可以直接在这里阅读各章节的 `.md` 原文，也可以克隆仓库到本地，运行文档构建脚本获取本地 HTML 版：

```bash
# 1. 克隆代码 (如果你想看里面的 CC 或 OC 源码)
git clone https://github.com/dxxbb/claude-code-source-against-openclaw.git

# 2. 如果你想自己构建文档 (需要 Node.js)
cd docs
npm install
node build.js
```

希望这些分析能帮助你在构建自己的 Agent 系统时少走弯路！✨
