# AI Agent Runtime 架构研究：Claude Code 与 OpenClaw 的对照分析

本项目是一个面向 Agent 开发者与系统架构师的源码审计工程。通过对 **Claude Code (CC)** 与 **OpenClaw (OC)** 的底层协议及执行逻辑进行深度拆解，我们试图回答一个核心问题：**在真实的生产环境下，一个高性能、可扩展且具备鲁棒性的 Agent 运行时（Runtime）到底应该如何设计？**

---

## 🔬 核心研究价值

当下的 AI 应用开发往往过度依赖模型 API 的调用，而忽略了支撑这些调用的“运行时系统”。通过本项目的源码级比对，我们提炼出了以下核心洞察：

### 1. 会话映射的复杂性 (Session Mapping)
- **Insight**: 分布式网关 (OC) 的会话映射链条（7步）远比本地 CLI (CC) 的链条（4步）复杂。这揭示了在处理多渠道 IM 接入、会话新鲜度（Freshness）策略以及多 Agent 路由时的架构开销与设计权衡。

### 2. 上下文工程与缓存经济学 (Context Optimization)
- **Insight**: 剖析 Claude Code 如何通过在 System Prompt 中设置“动静界限 (Dynamic/Static Boundary)”来最大化 Prompt Cache 的命中率，从而在保证 60KB+ 工具 Schema 完整投递的同时，大幅降低 API 成本与延迟。

### 3. 流式工具执行与延迟优化 (Loop Engine)
- **Insight**: 对比 CC 的“激进流式并发”模式（即模型未输出完整的 JSON 前即开始预执行工具）与 OC 的“事件驱动 Hook 模式”。理解延迟感知型设计与可观测性设计之间的冲突点。

### 4. 记忆系统的体量假设 (Memory Philosophy)
- **Insight**: 探讨“无意识全量注入 (CC)”与“有意识向量检索 (OC)”背后的数据规模假设。理解为什么不同场景下对“记忆”的持久化与 Consolidation 策略会有本质的区别。

---

## 📂 文档导读

所有的分析心得已按 Agent 调度的生命周期整理为以下五个专题：

| 章节 | 核心解析点 | 在线阅读 (GitHub Pages) |
| :--- | :--- | :--- |
| **01 · Session** | 用户直觉到模型消息的映射全过程 | [阅读文档](https://dxxbb.github.io/claude-code-source-against-openclaw/01-session.html) |
| **02 · Context** | 静态/动态分界、Tombstone 机制与自动摘要策略 | [阅读文档](https://dxxbb.github.io/claude-code-source-against-openclaw/02-context.html) |
| **03 · Loop** | 推理轮询、并发工具调度与错误自动恢复优先级 | [阅读文档](https://dxxbb.github.io/claude-code-source-against-openclaw/03-loop-engine.html) |
| **04 · Subagent** | 任务分叉 (Fork)、上下文隔离与结果回传谱系 | [阅读文档](https://dxxbb.github.io/claude-code-source-against-openclaw/04-subagent.html) |
| **05 · Memory** | 会话记忆、持久化提炼与周期性巩固 (Consolidation) | [阅读文档](https://dxxbb.github.io/claude-code-source-against-openclaw/05-memory.html) |

---

## 🛠️ 关于本项目

本项目并非这两个工具的官方文档，而是一份基于 **Claude Code (v0.2.29)** 和 **OpenClaw (v1.x)** 源码的独立审计分析。你可以直接阅读 `docs/` 下的源文件，或通过 `node build.js` 在本地重新生成 HTML 文档。

> “在架构师的眼中，没有魔法。Agent 的智慧只是无数条件检查、上下文修剪与树状分支的排列组合。”
