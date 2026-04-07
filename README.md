# AI Agent Runtime 架构研究：Claude Code 与 OpenClaw 的源码比对分析

本项目通过对 Claude Code (v0.2.29) 与 OpenClaw 的源码实现进行对照分析，解析了 AI Agent 在 Session 管理、Context 治理、Loop 执行引擎等核心环节的技术决策。文档重点讨论了不同工程约束（单机 CLI 终端 vs. 分布式多通道网关）对 Agent 运行时设计的具体影响。

---

## 🔬 架构分析维度

文档从以下四个维度出发，拆解了 Agent 运行时的底层逻辑实现：

### 1. 会话记录转换 (Session Transformation)
分析了消息从用户输入映射到模型 Message 数组的全过程。对比了 Claude Code 的短链结构（4 步）与 OpenClaw 在处理 IM 路由、会话新鲜度（Freshness）及路由分发时的长链结构（7 步），揭示了多通道接入带来的架构开销。

### 2. 上下文与缓存优化 (Context & Cache)
讨论了 Claude Code 如何通过在 System Prompt 中设置缓存分界线（Dynamic/Static Boundary）来提升 Prompt Cache 的利用率，以及 OpenClaw 如何通过可插拔的 `ContextEngine` 接口实现灵活的上下文裁剪与 Token 预算（Budget）管理。

### 3. 执行循环模式 (Loop Engine)
比对了两种不同的执行流模式：Claude Code 采用的异步生成器（AsyncGenerator）与流式并发工具执行（降低首字延迟）；以及 OpenClaw 基于事件驱动的回调机制，用于支持更复杂的生命周期钩子（Hooks）。

### 4. 记忆系统的应用假设 (Memory Patterns)
探讨了基于全量注入（Total Injection）的本地记忆方案与基于向量检索（Vector Search）的共享记忆方案。分析了数据规模（Data Scale）假设如何直接影响 Memory Slot 的设计与其 Consolidation（巩固）策略。

---

## 📂 文档目录

分析心得已按功能模块整理为五个专题文件：

| 专题 | 分析重点 | 在线阅读 (GitHub Pages) |
| :--- | :--- | :--- |
| **01 · Session** | 多通道路由映射与会话状态迁移 | [阅读文档](https://dxxbb.github.io/claude-code-source-against-openclaw/01-session.html) |
| **02 · Context** | 缓存分区设计与工具日志的预算管理策略 | [阅读文档](https://dxxbb.github.io/claude-code-source-against-openclaw/02-context.html) |
| **03 · Loop** | 轮询执行、流式并发与错误自动恢复机制 | [阅读文档](https://dxxbb.github.io/claude-code-source-against-openclaw/03-loop-engine.html) |
| **04 · Subagent** | 任务分叉、上下文隔离隔离及结果回传谱系 | [阅读文档](https://dxxbb.github.io/claude-code-source-against-openclaw/04-subagent.html) |
| **05 · Memory** | 记录提炼、异步巩固与 Session Memory 补偿设计 | [阅读文档](https://dxxbb.github.io/claude-code-source-against-openclaw/05-memory.html) |

---

## 🛠️ 项目说明

本仓库包含 Claude Code 与 OpenClaw 的精简源码副本，分析内容为基于源码的独立技术研究结论。你可以在本地运行以下脚本以重新生成 HTML 版文档：

```bash
cd docs
npm install
node build.js
```

> 技术分析应当剥开概念的外壳。Agent 架构的本质在于对条件判断、上下文裁剪以及执行流序列的分层治理。
