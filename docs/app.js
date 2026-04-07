const CLAUDE_REPO =
  "https://github.com/dxxbb/civil-engineering-cloud-claude-code-source-v2.1.88/blob/main";
const OPENCLAW_REPO = "https://github.com/openclaw/openclaw/blob/main";
const PI_MONO_REPO = "https://github.com/badlogic/pi-mono/blob/main";
const OPENCLAW_RUNTIME = "OpenClaw Agent Runtime";

const LOOP_STEPS = [
  {
    id: "entry",
    number: "01",
    title: "Session 边界",
    summary: "先定会话边界，再把这条会话还原成模型这一轮真正能看到的历史。",
    concepts: ["loop", "session"],
  },
  {
    id: "context",
    number: "02",
    title: "Context 组装",
    summary: "这一轮真正送进模型的上下文在这里定下来。",
    concepts: ["context", "cache", "memory"],
  },
  {
    id: "sampling",
    number: "03",
    title: "回合引擎",
    summary: "主循环怎么调模型、怎么发现 tool call、怎么推进下一轮。",
    concepts: ["loop", "streaming"],
  },
  {
    id: "tools",
    number: "04",
    title: "工具运行层",
    summary: "搜索、读文件、跑命令都在这里执行，并把结果送回 loop。",
    concepts: ["tools", "search", "cache"],
  },
  {
    id: "subagent",
    number: "05",
    title: "Subagent",
    summary: "主任务过大时，怎样把一部分工作拆进独立上下文。",
    concepts: ["subagent", "isolation"],
  },
  {
    id: "finish",
    number: "06",
    title: "收尾与记忆",
    summary: "什么时候结束，什么时候继续，什么时候写回记忆。",
    concepts: ["memory", "compaction", "finish"],
  },
];

const LOOP_PYRAMID = {
  parts: [
    {
      id: "entry",
      title: "Session 边界",
      summary: "这里先回答：用户说的“这次对话”到底怎样变成系统里的 session，再怎样变成模型这一轮能看到的上下文。",
      ccPath:
        "`switchSession()` 选当前 transcript 线程，`recordTranscript()` 落盘，`messagesForQuery` 才是模型这一轮真正看到的东西。",
      ocPath:
        "`resolveSessionKey()` 先选会话桶，`resolveSession()` 再解出 runtime session，`SessionManager.buildSessionContext()` 才产出模型上下文。",
      diff:
        "Claude Code 的 session 更接近一条 transcript 线程。OpenClaw Agent Runtime 的 session 至少分成 routing bucket、runtime session、model-visible context 三层。",
      comment:
        "session 真正难的不是路径，而是会话边界怎样一路传到模型这一轮真正读取的 messages。",
    },
    {
      id: "context",
      title: "Context 组装",
      summary: "这一层决定模型本轮到底能看到哪些消息、哪些文件、哪些记忆。",
      ccPath: "`applyToolResultBudget()`、`microcompact()`、`autocompact()`。",
      ocPath:
        "`resolveSkillsPromptForRun()`、`resolveBootstrapContextForRun()`、`buildEmbeddedSystemPrompt()`。",
      diff:
        "Claude Code 主要直接改消息数组。OpenClaw Agent Runtime 主要组 system prompt 和 bootstrap context。",
      comment: "上下文这一层最容易解释“为什么模型这轮会这么答”。",
    },
    {
      id: "sampling",
      title: "回合引擎",
      summary: "这一层是 loop 的引擎：调模型拿回复、识别 tool call、判断要不要继续。",
      ccPath: "`deps.callModel(...)` 直接写在 `queryLoop()` 里。",
      ocPath:
        "`activeSession.prompt(...)` -> Pi SDK `Agent.prompt()` -> `runAgentLoop()` -> `runLoop()`。",
      diff:
        "Claude Code 自己实现 turn loop。OpenClaw Agent Runtime 把 turn loop 交给 Pi SDK。",
      comment: "先把回合引擎找准，左右对比才会在同一个层面上。",
    },
    {
      id: "tools",
      title: "工具运行层",
      summary: "搜索、读文件、执行命令都只是工具层的一部分，重点是工具结果怎么回到 loop。",
      ccPath: "`runTools()` + `getAttachmentMessages()`。",
      ocPath:
        "`createOpenClawCodingTools()` -> Pi SDK `executeToolCalls()` -> `subscribeEmbeddedPiSession()`。",
      diff:
        "Claude Code 直接在主循环里跑工具。OpenClaw Agent Runtime 负责准备工具和事件桥，Pi SDK 负责工具循环。",
      comment: "看工具层时，重点不是工具多不多，而是结果怎么推进下一轮。",
    },
    {
      id: "subagent",
      title: "Subagent",
      summary: "主任务太大时，主 loop 会把一部分工作拆进独立上下文。",
      ccPath: "`AgentTool.tsx`、`runAgent()`、worktree 隔离。",
      ocPath: "`sessions_spawn`、`subagent-spawn.ts`、child session。",
      diff:
        "Claude Code 重点是本地隔离和后台执行。OpenClaw Agent Runtime 重点是 child session 和 lifecycle 管理。",
      comment: "子代理这一层要看清边界，不然很容易把 fork、background、child session 混在一起。",
    },
    {
      id: "finish",
      title: "收尾与记忆",
      summary: "主循环在这里决定真正结束，还是先做 recovery、compaction、memory flush。",
      ccPath: "`!needsFollowUp` 分支、`handleStopHooks()`、`extractSessionMemory()`。",
      ocPath: "`runMemoryFlushIfNeeded()`、`waitForAgentJob()`、memory files。",
      diff:
        "Claude Code 把 no-follow-up、recovery、stop hooks 写在一个结束分支里。OpenClaw Agent Runtime 把 memory flush 和 lifecycle end 贴得更近。",
      comment: "长会话能不能稳，最后看这一层怎么收尾。",
    },
  ],
};

const CORE_LOOP = {
  title: "先把一次任务执行的整体 loop 看完整",
  body:
    "这一层先只看总图。先回答一次任务怎么开始、怎么推进、怎么结束。下面再拆 session、context、tools、subagent、memory。",
  story:
    "用户把一个开发任务丢给 agent：让它在仓库里定位问题，读文件、搜代码、必要时跑命令或开子代理，最后返回结果。这一整段执行，在两边本质上都是一条 loop。",
  track:
    "接任务 -> 进入当前会话 -> 组本轮上下文 -> 调模型拿回复 -> 执行工具 -> 决定继续还是结束",
  claude: {
    title: "Claude Code · 顶层总图伪代码",
    meta: "对应真实函数：`queryLoop()`。下面这块是总图伪代码，不是 TS 原样代码。",
    url: `${CLAUDE_REPO}/03-claude-code-runnable/src/query.ts#L241`,
    note: "`queryLoop()` 既是入口，也是主循环本体。",
    code: `async function* queryLoop(...) {
  let state = initState(...);

  while (true) {
    // 01/02: 把当前 session state 整理成这一轮要送进模型的消息
    const messagesForQuery = prepareMessages(state);

    // 03: 调模型，拿回这一轮的 assistant / tool_use / stop reason
    const modelStream = deps.callModel(...);
    collectModelOutput(modelStream);

    if (!needsFollowUp) {
      // 06: 这一轮已经能结束，直接退出
      return { reason: "completed" };
    }

    // 04: 跑工具，把结果收回来
    const toolResults = collectToolResults(await runTools(...));

    // 05: 用新结果重建 state，进入下一轮
    state = {
      ...state,
      messages: [...messagesForQuery, ...assistantMessages, ...toolResults],
      transition: { reason: "next_turn" },
    };
  }
}`,
  },
  openclaw: {
    title: `${OPENCLAW_RUNTIME} · 顶层总图伪代码`,
    meta: "对应真实函数链：`activeSession.prompt()` -> `Agent.prompt()` -> `runLoop()`。下面这块是总图伪代码，不是 TS 原样代码。",
    url: `${PI_MONO_REPO}/packages/agent/src/agent-loop.ts#L95`,
    note:
      "OpenClaw 负责把任务接进运行时；真正的主循环在 Pi SDK 的 `runAgentLoop()` / `runLoop()`。",
    code: `async function runOpenClawTask(...) {
  // 01: 先把当前任务送进 OpenClaw + Pi 这套 runtime
  await activeSession.prompt(...);
}

async function runLoop(...) {
  while (true) {
    // 02: 组这一轮的 steering / follow-up messages
    const pendingMessages = await getSteeringMessages();

    // 03: 调模型，拿回这一轮回复
    const message = await streamAssistantResponse(...);

    if (message.stopReason === "error" || message.stopReason === "aborted") {
      await emit({ type: "agent_end", messages: newMessages });
      return;
    }

    // 04: 如果模型发了 tool calls，就跑工具
    if (toolCalls.length > 0) {
      await executeToolCalls(...);
    }

    // 05: 有 follow-up 就继续下一轮
    if ((await getFollowUpMessages()).length > 0) {
      continue;
    }

    // 06: 没有 follow-up，就结束
    break;
  }

  await emit({ type: "agent_end", messages: newMessages });
}`,
  },
  steps: [
    {
      number: "01",
      title: "接任务，进入当前会话",
      cc: "Claude Code 在进入 `queryLoop()` 前已经带上当前 session state、messages 和 system prompt。",
      oc: `${OPENCLAW_RUNTIME} 先 resolve session / workspace，再用 \`activeSession.prompt(...)\` 把任务送进 runtime。`,
    },
    {
      number: "02",
      title: "组这一轮要送进去的上下文",
      cc: "Claude Code 直接从当前 state 组 `messagesForQuery`。",
      oc: `${OPENCLAW_RUNTIME} 先准备 steering / follow-up / bootstrap messages，再交给 Pi SDK 跑这一轮。`,
    },
    {
      number: "03",
      title: "调模型，拿这一轮回复",
      cc: "`deps.callModel(...)` 就在 `queryLoop()` 里。",
      oc: "真正的模型回合在 Pi SDK `runLoop()` 里，由 `streamAssistantResponse(...)` 推进。",
    },
    {
      number: "04",
      title: "执行工具，把结果收回来",
      cc: "`runTools()` 跑完之后，工具结果直接回到本轮 state。",
      oc: "Pi SDK 用 `executeToolCalls()` 跑工具；OpenClaw 自己负责工具准备和事件桥。",
    },
    {
      number: "05",
      title: "决定要不要继续下一轮",
      cc: "只要还有 follow-up，就写回 `transition: { reason: \"next_turn\" }` 继续。",
      oc: "只要还有 follow-up messages，Pi SDK 就继续下一轮。",
    },
    {
      number: "06",
      title: "结束并收尾",
      cc: "`!needsFollowUp` 时直接返回终态。",
      oc: "没有 follow-up 时跳出 loop，并发 `agent_end`。",
    },
  ],
  sources: [
    {
      title: "Claude Code · queryLoop()",
      note: "主循环入口和主循环本体都在这里。",
      url: `${CLAUDE_REPO}/03-claude-code-runnable/src/query.ts#L241`,
    },
    {
      title: `${OPENCLAW_RUNTIME} · run/attempt.ts`,
      note: "`activeSession.prompt(...)` 是进入 Pi SDK 的边界。",
      url: `${OPENCLAW_REPO}/src/agents/pi-embedded-runner/run/attempt.ts#L1653`,
    },
    {
      title: "Pi SDK · runAgentLoop() / runLoop()",
      note: "真正的主循环在这里推进。",
      url: `${PI_MONO_REPO}/packages/agent/src/agent-loop.ts#L95`,
    },
  ],
  comment:
    "这一层只回答一个问题：一次任务执行整体怎么跑完。先把这条线看顺，后面再问每一段为什么这样设计、代码落在哪。",
};

const LOOP_SKELETON = [
  {
    id: "claude",
    title: "Claude Code · 主 loop 真在 queryLoop()",
    body:
      "这边可以直接看到主 loop 的真实落点。Claude Code 的主要状态推进就在 `query.ts` 的 `queryLoop()` 里。",
    kind: "真实函数片段",
    panels: [
      {
        header: "query.ts · queryLoop() 入口",
        meta: "query.ts:241-307",
        note: "这里定义了跨轮次 state，并进入 `while (true)`。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/query.ts#L241`,
        code: `async function* queryLoop(
  params: QueryParams,
  consumedCommandUuids: string[],
): AsyncGenerator<
  | StreamEvent
  | RequestStartEvent
  | Message
  | TombstoneMessage
  | ToolUseSummaryMessage,
  Terminal
> {
  const {
    systemPrompt,
    userContext,
    systemContext,
    canUseTool,
    fallbackModel,
    querySource,
    maxTurns,
    skipCacheWrite,
  } = params
  const deps = params.deps ?? productionDeps()

  let state: State = {
    messages: params.messages,
    toolUseContext: params.toolUseContext,
    maxOutputTokensOverride: params.maxOutputTokensOverride,
    autoCompactTracking: undefined,
    stopHookActive: undefined,
    maxOutputTokensRecoveryCount: 0,
    hasAttemptedReactiveCompact: false,
    turnCount: 1,
    pendingToolUseSummary: undefined,
    transition: undefined,
  }

  using pendingMemoryPrefetch = startRelevantMemoryPrefetch(
    state.messages,
    state.toolUseContext,
  )

  while (true) {`,
      },
      {
        header: "query.ts · 模型调用",
        meta: "query.ts:650-705",
        note: "真正的模型调用就发生在这个 `for await` 里。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/query.ts#L650`,
        code: `let attemptWithFallback = true

queryCheckpoint('query_api_loop_start')
try {
  while (attemptWithFallback) {
    attemptWithFallback = false
    try {
      let streamingFallbackOccured = false
      queryCheckpoint('query_api_streaming_start')
      for await (const message of deps.callModel({
        messages: prependUserContext(messagesForQuery, userContext),
        systemPrompt: fullSystemPrompt,
        thinkingConfig: toolUseContext.options.thinkingConfig,
        tools: toolUseContext.options.tools,
        signal: toolUseContext.abortController.signal,
        options: {
          async getToolPermissionContext() {
            const appState = toolUseContext.getAppState()
            return appState.toolPermissionContext
          },
          model: currentModel,
          fallbackModel,
          querySource,
          agents: toolUseContext.options.agentDefinitions.activeAgents,`,
      },
      {
        header: "query.ts · 工具执行",
        meta: "query.ts:1380-1409",
        note: "有 `tool_use` 时，`runTools()` 的结果会被回填到 `toolResults` 和 `toolUseContext`。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/query.ts#L1380`,
        code: `const toolUpdates = streamingToolExecutor
  ? streamingToolExecutor.getRemainingResults()
  : runTools(toolUseBlocks, assistantMessages, canUseTool, toolUseContext)

for await (const update of toolUpdates) {
  if (update.message) {
    yield update.message

    if (
      update.message.type === 'attachment' &&
      update.message.attachment.type === 'hook_stopped_continuation'
    ) {
      shouldPreventContinuation = true
    }

    toolResults.push(
      ...normalizeMessagesForAPI(
        [update.message],
        toolUseContext.options.tools,
      ).filter(_ => _.type === 'user'),
    )
  }
  if (update.newContext) {
    updatedToolUseContext = {
      ...update.newContext,
      queryTracking,
    }
  }
}
queryCheckpoint('query_tool_execution_end')`,
      },
      {
        header: "query.ts · 进入下一轮",
        meta: "query.ts:1718-1728",
        note: "这一段把新 state 写回去，然后继续下一轮。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/query.ts#L1718`,
        code: `autoCompactTracking: tracking,
turnCount: nextTurnCount,
maxOutputTokensRecoveryCount: 0,
hasAttemptedReactiveCompact: false,
pendingToolUseSummary: nextPendingToolUseSummary,
maxOutputTokensOverride: undefined,
stopHookActive,
transition: { reason: 'next_turn' },
}
state = next
} // while (true)
}`,
      },
    ],
  },
  {
    id: "openclaw",
    title: `${OPENCLAW_RUNTIME} · loop = OpenClaw 入口 + Pi SDK loop body`,
    body:
      `${OPENCLAW_RUNTIME} 要一起看两部分。OpenClaw 负责 session、workspace、队列和事件桥；Pi SDK 负责 \`prompt()\`、\`runAgentLoop()\`、\`runLoop()\` 和工具循环。`,
    kind: "真实文件链",
    panels: [
      {
        header: "OpenClaw · 把 Pi SDK 接进来",
        meta: "attempt.ts:3-9 + docs/zh-CN/pi.md:174-206",
        note: `这一层先导入 Pi SDK，再通过 \`createAgentSession()\` 和 \`session.prompt()\` 进入完整 agent loop。`,
        url: `${OPENCLAW_REPO}/src/agents/pi-embedded-runner/run/attempt.ts#L3`,
        code: `import type { AgentMessage, StreamFn } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from "@mariozechner/pi-coding-agent";

// docs/zh-CN/pi.md 也写得很直接：
// 在 runEmbeddedAttempt() 内部，会使用 pi SDK
// const { session } = await createAgentSession(...)
// 完成设置后，会向会话发送提示：
// await session.prompt(effectivePrompt, { images: imageResult.images });
// SDK 会处理完整的智能体循环：发送给 LLM、执行工具调用、流式返回响应。`,
      },
      {
        header: "Pi SDK · createAgentSession()",
        meta: "pi-mono/sdk.ts:174-361",
        note: "这里把 Agent、AgentSession、resource loader、session manager 接起来。",
        url: `${PI_MONO_REPO}/packages/coding-agent/src/core/sdk.ts#L174`,
        code: `export async function createAgentSession(options = {}) {
  const cwd = options.cwd ?? process.cwd()
  const settingsManager = options.settingsManager ?? SettingsManager.create(cwd, agentDir)
  const sessionManager = options.sessionManager ?? SessionManager.create(...)

  if (!resourceLoader) {
    resourceLoader = new DefaultResourceLoader({ cwd, agentDir, settingsManager })
    await resourceLoader.reload()
  }

  agent = new Agent({
    initialState: { systemPrompt: "", model, thinkingLevel, tools: [] },
    streamFn: async (model, context, options) => streamSimple(model, context, ...),
    sessionId: sessionManager.getSessionId(),
    ...
  })

  const session = new AgentSession({
    agent,
    sessionManager,
    settingsManager,
    cwd,
    resourceLoader,
    ...
  })

  return { session, extensionsResult, modelFallbackMessage }
}`,
      },
      {
        header: "Pi SDK · Agent.prompt() -> runAgentLoop()",
        meta: "pi-mono/agent.ts:310-389",
        note: "OpenClaw 调的 `activeSession.prompt(...)`，最后会走到这里。",
        url: `${PI_MONO_REPO}/packages/agent/src/agent.ts#L310`,
        code: `async prompt(input: string | AgentMessage | AgentMessage[], images?: ImageContent[]) {
  if (this.activeRun) {
    throw new Error("Agent is already processing a prompt.")
  }

  const messages = this.normalizePromptInput(input, images)
  await this.runPromptMessages(messages)
}

private async runPromptMessages(messages: AgentMessage[]) {
  await this.runWithLifecycle(async (signal) => {
    await runAgentLoop(
      messages,
      this.createContextSnapshot(),
      this.createLoopConfig(),
      (event) => this.processEvents(event),
      signal,
      this.streamFn,
    )
  })
}`,
      },
      {
        header: "Pi SDK · runLoop()",
        meta: "pi-mono/agent-loop.ts:95-231",
        note: "真正的 loop body 在这里，不在 OpenClaw 本仓库里。",
        url: `${PI_MONO_REPO}/packages/agent/src/agent-loop.ts#L95`,
        code: `export async function runAgentLoop(prompts, context, config, emit, signal, streamFn) {
  const newMessages = [...prompts]
  const currentContext = { ...context, messages: [...context.messages, ...prompts] }

  await emit({ type: "agent_start" })
  await emit({ type: "turn_start" })
  await runLoop(currentContext, newMessages, config, signal, emit, streamFn)
  return newMessages
}

async function runLoop(currentContext, newMessages, config, signal, emit, streamFn) {
  let pendingMessages = (await config.getSteeringMessages?.()) || []

  while (true) {
    let hasMoreToolCalls = true

    while (hasMoreToolCalls || pendingMessages.length > 0) {
      const message = await streamAssistantResponse(currentContext, config, signal, emit, streamFn)
      const toolCalls = message.content.filter((c) => c.type === "toolCall")
      hasMoreToolCalls = toolCalls.length > 0
      ...
    }
    ...
  }
}`,
      },
      {
        header: "Pi SDK · executeToolCalls()",
        meta: "pi-mono/agent-loop.ts:336-430",
        note: "工具循环也在 Pi SDK 里，由 `executeToolCalls()` 继续推进。",
        url: `${PI_MONO_REPO}/packages/agent/src/agent-loop.ts#L336`,
        code: `if (hasMoreToolCalls) {
  toolResults.push(...(await executeToolCalls(currentContext, message, config, signal, emit)))
  for (const result of toolResults) {
    currentContext.messages.push(result)
    newMessages.push(result)
  }
}

async function executeToolCalls(currentContext, assistantMessage, config, signal, emit) {
  const toolCalls = assistantMessage.content.filter((c) => c.type === "toolCall")

  if (config.toolExecution === "sequential") {
    return executeToolCallsSequential(currentContext, assistantMessage, toolCalls, config, signal, emit)
  }

  return executeToolCallsParallel(currentContext, assistantMessage, toolCalls, config, signal, emit)
}`,
      },
      {
        header: "agent-loop.md · 官方高层定义",
        meta: "agent-loop.md:25-43",
        note: `${OPENCLAW_RUNTIME} 自己就把 loop 定义成一条运行链，而不是单个函数。`,
        url: `${OPENCLAW_REPO}/docs/concepts/agent-loop.md#L25`,
        code: `1. agent RPC validates params, resolves session (sessionKey/sessionId), persists session metadata, returns { runId, acceptedAt } immediately.
2. agentCommand runs the agent:
   - resolves model + thinking/verbose defaults
   - loads skills snapshot
   - calls runEmbeddedPiAgent (pi-agent-core runtime)
   - emits lifecycle end/error if the embedded loop does not emit one
3. runEmbeddedPiAgent:
   - serializes runs via per-session + global queues
   - resolves model + auth profile and builds the pi session
   - subscribes to pi events and streams assistant/tool deltas
4. subscribeEmbeddedPiSession bridges pi-agent-core events to OpenClaw agent stream
5. agent.wait uses waitForAgentJob`,
      },
      {
        header: "agent-command.ts · session / workspace 准备",
        meta: "agent-command.ts:255-293",
        note: `${OPENCLAW_RUNTIME} 在这一层先把 session、workspace、runId 解出来，再进入 embedded runner。`,
        url: `${OPENCLAW_REPO}/src/agents/agent-command.ts#L255`,
        code: `const sessionResolution = resolveSession({
  cfg,
  to: opts.to,
  sessionId: opts.sessionId,
  sessionKey: opts.sessionKey,
  agentId: agentIdOverride,
});

const {
  sessionId,
  sessionKey,
  sessionEntry: sessionEntryRaw,
  sessionStore,
  storePath,
  isNewSession,
  persistedThinking,
  persistedVerbose,
} = sessionResolution;

const workspace = await ensureAgentWorkspace({
  dir: workspaceDirRaw,
  ensureBootstrapFiles: !agentCfg?.skipBootstrap,
});
const workspaceDir = workspace.dir;
const runId = opts.runId?.trim() || sessionId;`,
      },
      {
        header: "attempt.ts · 真的把 pi session 建出来",
        meta: "attempt.ts:776-895",
        note: `${OPENCLAW_RUNTIME} 在这里打开 \`SessionManager\`，然后调用 \`createAgentSession()\`。从这一步开始，完整 runtime 已经进入 pi session core。`,
        url: `${OPENCLAW_REPO}/src/agents/pi-embedded-runner/run/attempt.ts#L777`,
        code: `sessionManager = guardSessionManager(SessionManager.open(params.sessionFile), {
  agentId: sessionAgentId,
  sessionKey: params.sessionKey,
  inputProvenance: params.inputProvenance,
  allowSyntheticToolResults: transcriptPolicy.allowSyntheticToolResults,
  allowedToolNames,
});

await prepareSessionManagerForRun({
  sessionManager,
  sessionFile: params.sessionFile,
  hadSessionFile,
  sessionId: params.sessionId,
  cwd: effectiveWorkspace,
});

({ session } = await createAgentSession({
  cwd: resolvedWorkspace,
  agentDir,
  authStorage: params.authStorage,
  modelRegistry: params.modelRegistry,
  model: params.model,
  thinkingLevel: mapThinkingLevel(params.thinkLevel),
  tools: builtInTools,
  customTools: allCustomTools,
  sessionManager,
  settingsManager,
  resourceLoader,
}));
applySystemPromptOverrideToSession(session, systemPromptText);`,
      },
      {
        header: "attempt.ts · runtime 改写 pi 的 streamFn",
        meta: "attempt.ts:937-1141",
        note: `${OPENCLAW_RUNTIME} 不会重写 pi loop 本体，但会在 pi 的 \`streamFn\` 外面包很多适配层，处理 provider、tool call、recovery、timeout。`,
        url: `${OPENCLAW_REPO}/src/agents/pi-embedded-runner/run/attempt.ts#L957`,
        code: `const defaultSessionStreamFn = activeSession.agent.streamFn;
const providerStreamFn = registerProviderStreamForModel({
  model: params.model,
  cfg: params.config,
  agentDir,
  workspaceDir: effectiveWorkspace,
});

activeSession.agent.streamFn = resolveEmbeddedAgentStreamFn({
  currentStreamFn: defaultSessionStreamFn,
  providerStreamFn,
  shouldUseWebSocketTransport,
  wsApiKey,
  sessionId: params.sessionId,
  signal: runAbortController.signal,
  model: params.model,
  authStorage: params.authStorage,
});

activeSession.agent.streamFn = wrapStreamFnSanitizeMalformedToolCalls(...)
activeSession.agent.streamFn = wrapStreamFnTrimToolCallNames(...)
activeSession.agent.streamFn = wrapAnthropicStreamWithRecovery(...)
activeSession.agent.streamFn = wrapStreamFnHandleSensitiveStopReason(...)
activeSession.agent.streamFn = streamWithIdleTimeout(...)`,
      },
      {
        header: "run.ts · session lane / global lane",
        meta: "run.ts:99-120",
        note: `${OPENCLAW_RUNTIME} 先把同一 session 的 run 串行化，再进入真正的 attempt。`,
        url: `${OPENCLAW_REPO}/src/agents/pi-embedded-runner/run.ts#L99`,
        code: `export async function runEmbeddedPiAgent(
  params: RunEmbeddedPiAgentParams,
): Promise<EmbeddedPiRunResult> {
  const sessionLane = resolveSessionLane(params.sessionKey?.trim() || params.sessionId);
  const globalLane = resolveGlobalLane(params.lane);
  const enqueueGlobal =
    params.enqueue ?? ((task, opts) => enqueueCommandInLane(globalLane, task, opts));
  const enqueueSession =
    params.enqueue ?? ((task, opts) => enqueueCommandInLane(sessionLane, task, opts));

  return enqueueSession(() =>
    enqueueGlobal(async () => {
      const started = Date.now();`,
      },
      {
        header: "run/attempt.ts · 事件桥接",
        meta: "attempt.ts:1335-1367",
        note: `${OPENCLAW_RUNTIME} 在这里订阅 pi session 事件，把完整 runtime 的执行过程回流成 \`assistant/tool/lifecycle\` 流。`,
        url: `${OPENCLAW_REPO}/src/agents/pi-embedded-runner/run/attempt.ts#L1336`,
        code: `const subscription = subscribeEmbeddedPiSession({
  session: activeSession,
  runId: params.runId,
  hookRunner: getGlobalHookRunner() ?? undefined,
  verboseLevel: params.verboseLevel,
  reasoningMode: params.reasoningLevel ?? "off",
  toolResultFormat: params.toolResultFormat,
  shouldEmitToolResult: params.shouldEmitToolResult,
  shouldEmitToolOutput: params.shouldEmitToolOutput,
  onToolResult: params.onToolResult,
  onReasoningStream: params.onReasoningStream,
  onReasoningEnd: params.onReasoningEnd,
  onBlockReply: params.onBlockReply,
  onBlockReplyFlush: params.onBlockReplyFlush,
  onPartialReply: params.onPartialReply,
  onAssistantMessageStart: params.onAssistantMessageStart,
  onAgentEvent: params.onAgentEvent,
  config: params.config,
  sessionKey: sandboxSessionKey,
  sessionId: params.sessionId,
  agentId: sessionAgentId,
});

const {
  assistantTexts,
  toolMetas,
  unsubscribe,
  waitForCompactionRetry,
  isCompactionInFlight,
} = subscription;`,
      },
      {
        header: "run/attempt.ts · 真正触发模型执行",
        meta: "attempt.ts:1649-1713",
        note: "这里真正调用的是 pi session 的 `prompt()`。模型回合、tool call 循环会继续进入 Pi SDK 的 `Agent.prompt() -> runAgentLoop() -> runLoop()`，runtime 在外面等结果并处理 compaction retry。",
        url: `${OPENCLAW_REPO}/src/agents/pi-embedded-runner/run/attempt.ts#L1653`,
        code: `if (imageResult.images.length > 0) {
  await abortable(activeSession.prompt(effectivePrompt, { images: imageResult.images }));
} else {
  await abortable(activeSession.prompt(effectivePrompt));
}

const compactionRetryWait = yieldAborted
  ? { timedOut: false }
  : await waitForCompactionRetryWithAggregateTimeout({
      waitForCompactionRetry,
      abortable,
      aggregateTimeoutMs: COMPACTION_RETRY_AGGREGATE_TIMEOUT_MS,
    });`,
      },
    ],
  },
];

const PHASES = [
  {
    id: "entry",
    number: "01",
    title: "Session 边界",
    summary:
      "先把这些词分开：用户看到的对话、外部 IM 对话身份、sessionKey/sessionId、session store/sessionFile、模型 history。它们在两边不是同一层。",
    story:
      "用户只会说“我还在这条对话里继续聊”。系统内部真正要决定的是：这句话先归到哪条外部对话、这次该复用哪个 session、要写到哪份本地记录、最后模型这一轮到底读哪段 history。",
    why:
      "session 这一节最容易写浅，因为很多函数都在碰 session。真正该讲的不是函数表，而是这些概念怎样一层一层映射。",
    same:
      "两边都不会把“用户看到的对话”原样送给模型。中间都要经过会话边界、持久化记录、历史整理。",
    diff:
      `Claude Code 这条链短，重点是一条 transcript 线程怎样变成 \`messagesForQuery\`。${OPENCLAW_RUNTIME} 这条链长，先有 IM route 和 \`sessionKey\`，再有 freshness、\`sessionId\`、\`sessionFile\`，最后才有 \`buildSessionContext().messages\`。`,
    diagramLanes: [
      {
        label: "Claude Code",
        lead: "短链。没有外层 IM route，主线基本围绕当前 transcript 线程展开。",
        nodes: [
          {
            tag: "用户层",
            title: "用户看到的对话",
            body: "用户觉得自己还在同一条本地对话里继续说话。",
          },
          {
            tag: "会话层",
            title: "sessionId + sessionProjectDir",
            body: "决定当前主线程 transcript 属于哪个 session、落在哪个项目目录。",
          },
          {
            tag: "文件层",
            title: "transcript / sidechain",
            body: "主线程写主 transcript，子代理写当前 session 目录下的 sidechain transcript。",
          },
          {
            tag: "运行层",
            title: "in-memory messages",
            body: "当前回合继续在这条消息链上做 compact、budget、memory 注入。",
          },
          {
            tag: "模型层",
            title: "messagesForQuery",
            body: "模型真正读到的是本轮整理后的 message list。",
          },
        ],
        note: "CC 里最容易混的，是把 transcript 原样当成模型 history。真实进入模型的是 `messagesForQuery`。",
      },
      {
        label: OPENCLAW_RUNTIME,
        lead: "长链。先 route，再 sessionKey，再 freshness，再 runtime session，最后才到模型 history。",
        nodes: [
          {
            tag: "用户层",
            title: "用户看到的对话",
            body: "用户只知道自己还在飞书/Slack/Telegram 的同一条对话里继续说话。",
          },
          {
            tag: "路由层",
            title: "IM 对话身份",
            body: "`channel / account / peer / thread` 先决定消息来自哪条外部对话。",
          },
          {
            tag: "路由层",
            title: "route + sessionKey",
            body: "`resolveAgentRoute()` 和 `resolveSessionKey()` 先把消息归到某个 agent 的某个会话桶。",
          },
          {
            tag: "复用层",
            title: "freshness",
            body: "`daily / idle` 逻辑决定当前 `sessionKey` 是否继续沿用旧 `sessionId`。",
          },
          {
            tag: "运行层",
            title: "sessionId",
            body: "这是这次真正跑起来的 runtime session ID。",
          },
          {
            tag: "持久化层",
            title: "sessionStore + sessionFile",
            body: "store 记元数据，sessionFile 记 transcript tree；两者不是一回事。",
          },
          {
            tag: "模型层",
            title: "buildSessionContext().messages",
            body: "Pi 还原当前 branch 后，产出模型本轮真正看到的 history。",
          },
        ],
        note: "龙虾里最容易混的，是把 `sessionKey`、`sessionId`、`sessionFile`、模型 history 当成同一个东西。它们是四层。",
      },
    ],
    flowMaps: [
      {
        label: "Claude Code",
        lead:
          "CC 没有外层 IM route。主线短：用户继续聊 -> 当前 sessionId -> transcript 线程 -> in-memory messages -> messagesForQuery。",
        steps: [
          {
            title: "用户继续在当前对话里说话",
            body: "用户主观上看到的是同一条本地会话线程继续往下长。",
          },
          {
            title: "当前 sessionId 决定主线程",
            body: "`sessionId + sessionProjectDir` 决定当前 transcript 文件在哪个项目目录下。",
          },
          {
            title: "用户消息先写进 transcript",
            body: "`recordTranscript()` 在真正调模型前就把这轮用户消息落盘，方便 `/resume`。",
          },
          {
            title: "主线程消息链继续增长",
            body: "compact、tool result budget、memory 注入，都是在这条消息链上继续改写本轮上下文。",
          },
          {
            title: "`messagesForQuery` 才是模型 history",
            body: "模型不读 transcript 原样，真正送进去的是整理后的 `messagesForQuery`。",
          },
        ],
      },
      {
        label: OPENCLAW_RUNTIME,
        lead:
          "龙虾的主线更长：用户继续聊 -> IM route -> sessionKey -> freshness -> sessionId -> sessionStore/sessionFile -> buildSessionContext().messages。",
        steps: [
          {
            title: "用户先落在外部 IM 对话里",
            body: "先有 channel、account、peer、thread 这层外部身份，然后系统才谈 session。",
          },
          {
            title: "route 先选 agent 和 mainSessionKey",
            body: "`resolveAgentRoute()` 先把消息送到某个 agent，并给出当前 route 的 `sessionKey/mainSessionKey`。",
          },
          {
            title: "`sessionKey` 决定会话桶",
            body: "direct chat、group/channel、thread、显式 key，会得到不同的 session bucket。",
          },
          {
            title: "freshness 决定是否复用旧 sessionId",
            body: "`daily` / `idle` 以及 direct/group/thread 类型，会决定这次是否继续沿用旧 runtime session。",
          },
          {
            title: "sessionStore 和 sessionFile 分层持久化",
            body: "store 记运行态和元数据，`sessionFile` 记 transcript tree；两层分开维护。",
          },
          {
            title: "`buildSessionContext().messages` 才是模型 history",
            body: "Pi 会沿当前 leaf 还原当前 branch，再处理 compaction 和 branch summary，最后得到模型可见消息。",
          },
        ],
      },
    ],
    summaryCards: [
      {
        title: "用户层",
        body:
          "先区分“用户觉得还是同一条对话”这层直觉，和系统内部真正用来复用 session 的键。",
      },
      {
        title: "路由与复用层",
        body:
          "OpenClaw 先 route，再决定 sessionKey，再看 freshness；Claude Code 直接围绕当前 sessionId 切线程。",
      },
      {
        title: "持久化层",
        body:
          "Claude Code 主要是一条 transcript 线程；OpenClaw 额外拆出 session store，transcript 还要交给 Pi 的 SessionManager 解析。",
      },
      {
        title: "模型层",
        body:
          "最终真正送进模型的，两边都不是 session 文件原样，而是本轮整理后的 message list。",
      },
    ],
    mappingRows: [
      {
        title: "用户看到的对话",
        role: "这是人主观上认作“还在同一条会话里”的边界。",
        cc: "默认几乎就等于当前 transcript 线程。用户直觉和系统 session 边界离得很近。",
        oc: "还不是 runtime session，只是外部对话继续发生的直觉。后面还要继续映射。",
      },
      {
        title: "外部对话身份",
        role: "这层回答“消息来自哪”。典型字段是 channel、account、peer、thread。",
        cc: "基本没有这一层。CC 不是先接 IM route，再做 session。",
        oc: "`resolveAgentRoute()` 先用这层身份来决定 agentId、sessionKey、mainSessionKey。",
      },
      {
        title: "会话桶 / 路由身份",
        role: "这层回答“这句话该归到哪类会话里”。",
        cc: "没有单独的 session bucket，直接围绕当前 `sessionId` 这一条线程跑。",
        oc: "`sessionKey` 就是这一层。它不等于模型 history，也不保证永远对应同一个 sessionId。",
      },
      {
        title: "会不会开新 session",
        role: "这层回答“这次还是旧 session，还是已经应该新开”。",
        cc: "默认没有自动时间切分。主要靠 `/clear`、`/resume` 这种显式动作切边界。",
        oc: "`evaluateSessionFreshness()` 会按 daily/idle 和 direct/group/thread 类型决定是否继续沿用旧 `sessionId`。",
      },
      {
        title: "运行时 session 身份",
        role: "这是本轮真正跑起来的会话实例 ID。",
        cc: "就是当前 `sessionId`。",
        oc: "也是 `sessionId`，但它只是某个 `sessionKey` 之下的具体 runtime session。",
      },
      {
        title: "本地持久化",
        role: "这层回答“历史和元数据分别写到哪”。",
        cc: "主线程写 `{projectDir}/{sessionId}.jsonl`；子代理写当前 session 目录下的 sidechain transcript。",
        oc: "session store 记元数据；`sessionFile` 记 transcript tree。两层不是一回事。",
      },
      {
        title: "工作目录 / 项目目录",
        role: "这是运行环境，不等于 session identity。",
        cc: "`sessionProjectDir` 只管当前 transcript 在哪个项目目录里，`cwd/projectRoot` 还要另外看。",
        oc: "`workspaceDir` 由 agent workspace 决定，不等于 `sessionFile`，也不等于 `sessionKey`。",
      },
      {
        title: "用户手动动作",
        role: "这层是用户显式切会话、切边界的入口。",
        cc: "`/clear` 新开 `sessionId`；`/resume` 用 `switchSession(...)` 切回旧线程。",
        oc: "显式 `sessionKey` / `sessionId` 会覆盖默认匹配；session tools 还能直接 patch/delete 某条 session。",
      },
      {
        title: "subagent / child session",
        role: "父会话怎样派生子会话，这层决定父子谱系和隔离方式。",
        cc: "子代理是父 session 目录下的 sidechain transcript，另用 `parentSessionId` 做谱系关联。",
        oc: "直接新建 `childSessionKey` / `sessionId`，并记录 `spawnedBy`、`parentSessionKey`、`spawnDepth`。",
      },
      {
        title: "模型看到的 history",
        role: "这才是最终真正送进模型的上下文。",
        cc: "`messagesForQuery`。",
        oc: "`buildSessionContext().messages`。",
      },
    ],
    conceptInventory: [
      {
        name: "用户看到的对话",
        body: "人主观上理解的“我还在同一条会话里继续聊”。这层是入口直觉，不是模型输入。",
        cc: "基本就贴着当前 transcript 线程走，用户的直觉和系统边界离得很近。",
        oc: "只是最外层直觉。后面还要先过 IM route、sessionKey、runtime session，才会落到模型上下文。",
      },
      {
        name: "IM 对话身份",
        body: "飞书/Slack/Telegram 一类外部对话身份：channel、account、peer、thread。",
        cc: "基本没有这一层。CC 不是先接 IM route，再做 session。",
        oc: "有，而且很重要。route 会先根据 channel/account/peer/thread 算出 sessionKey / mainSessionKey。",
      },
      {
        name: "agent route / mainSessionKey",
        body: "这是龙虾先做的一层：消息先被路由到哪个 agent，以及当前 route 的主会话键是什么。",
        cc: "主线程没有这一层。进入 teammate/subagent 是显式工具调用，不是 IM route。",
        oc: "`resolveAgentRoute()` 先给出 agentId、sessionKey、mainSessionKey，这一层先于 runtime session。",
      },
      {
        name: "显式 sessionKey / sessionId",
        body: "这是用户或调用方显式指定会话边界的入口。",
        cc: "主要是 `/resume` 切旧 session、`/clear` 开新 session。",
        oc: "显式 sessionKey 优先；显式 sessionId 会反查 store，尽量复用已有 runtime session。",
      },
      {
        name: "sessionKey",
        body: "外层会话桶，用来表达“这条外部消息应归到哪类会话里”。",
        cc: "没有单独这一层。",
        oc: "有。direct chat、group/channel、thread、subagent、acp 都可能得到不同形状的 sessionKey。",
      },
      {
        name: "时间/重置策略",
        body: "决定旧会话还能不能继续沿用，还是应该开新会话。",
        cc: "默认没有自动按时间切 session。主要靠 `/clear`、`/resume` 这种显式动作切换。",
        oc: "有。`daily` / `idle`，并且可按 direct/group/thread/channel 细分。它直接影响同一个 sessionKey 是否沿用旧 sessionId。",
      },
      {
        name: "sessionId",
        body: "当前运行中的具体会话实例 ID。",
        cc: "就是当前主线程会话 ID，直接对应 transcript 文件名。",
        oc: "是 runtime session ID。它在同一个 sessionKey 下可以轮换，不等于外层会话桶。",
      },
      {
        name: "session store entry",
        body: "会话的元数据层。这里一般记运行态、模型、token、cost、spawn lineage。",
        cc: "没有单独的 session store 文件层，主线程状态更多贴着 transcript 和内存状态走。",
        oc: "`SessionEntry` 很重，里面记 `sessionId/sessionFile/spawnedBy/spawnDepth/model/cost/...` 等大量运行信息。",
      },
      {
        name: "transcript / sessionFile",
        body: "真正落盘的会话记录文件。",
        cc: "主线程就是 `{projectDir}/{sessionId}.jsonl`；子代理另写 sidechain transcript。",
        oc: "`sessionFile` 由 `resolveSessionTranscriptFile()` 决定，后面再交给 Pi `SessionManager` 打开和解析。",
      },
      {
        name: "项目目录 / workspaceDir",
        body: "运行目录和 transcript 目录不是一回事，要分开看。",
        cc: "`sessionProjectDir` 只解决 transcript 在哪个项目目录，和当前 `cwd/projectRoot` 不是同一层。",
        oc: "`workspaceDir` 由 agent workspace 决定，`sessionFile` 只是会话记录文件，不代表实际工作目录。",
      },
      {
        name: "用户手动动作",
        body: "用户显式改变会话边界的操作，比如 clear、resume、显式指定 sessionKey/sessionId。",
        cc: "`/clear` 会 `regenerateSessionId()` 开新线程；`/resume` 会 `switchSession(...)` 切回旧线程。",
        oc: "显式 `sessionKey` / `sessionId` 输入会覆盖默认匹配；session tools 也能直接 patch/delete 某条 session。",
      },
      {
        name: "subagent / child session",
        body: "主会话派生出子会话时，父子关系、隔离边界和持久化方式都要说清楚。",
        cc: "子代理写的是当前 session 下面的 sidechain transcript，另有 `parentSessionId` 做谱系关联。",
        oc: "直接是新的 child sessionKey / sessionId，并记录 `spawnedBy`、`parentSessionKey`、`spawnDepth`。",
      },
      {
        name: "模型看到的 history",
        body: "最关键的一层：模型本轮实际读到的消息序列。",
        cc: "`messagesForQuery`。",
        oc: "`buildSessionContext().messages`。",
      },
      {
        name: "branch / compaction",
        body: "历史不是原样回放。分叉和压缩都会改变模型这轮实际看到的 history。",
        cc: "仍是单线程 transcript，但 compact、budget、memory 注入会改这轮实际送进去的消息数组。",
        oc: "是 tree 结构。当前 leaf、branch_summary、compaction 都会参与重建模型可见 history。",
      },
    ],
    questionRows: [
      {
        title: "这句话先落到哪",
        cc: "默认就落在当前 `sessionId` 对应的 transcript 线程里，没有外层 IM route 这一层。",
        oc: "先经过 `resolveAgentRoute()` 和 `resolveSessionKey()`。真正先落的是某个 agent 的某个 `sessionKey`。",
      },
      {
        title: "什么时候会切成新 session",
        cc: "主要靠显式动作。`/clear` 新开 `sessionId`；`/resume` 切回旧 `sessionId`。",
        oc: "同一个 `sessionKey` 下也可能换新的 `sessionId`。关键判断来自 `evaluateSessionFreshness()` 的 daily/idle 逻辑。",
      },
      {
        title: "文件和元数据各落到哪",
        cc: "主线程主要是一条 transcript；子代理在同一个 session 目录下再写 sidechain transcript。",
        oc: "session store 记元数据，`sessionFile` 记 transcript tree。store 和 transcript 是两层东西。",
      },
      {
        title: "模型最终看到的是哪一段 history",
        cc: "不是 transcript 原样，是本轮整理后的 `messagesForQuery`。",
        oc: "不是 sessionFile 原样，是 Pi `buildSessionContext()` 从当前 branch 还原出来的 `messages`。",
      },
    ],
    scenarioRows: [
      {
        title: "普通 direct chat 连续发消息",
        cc: "继续落在当前 sessionId 对应的 transcript 线程里，除非用户显式 `/resume` 到别的 session，或者 `/clear` 开新线程。",
        oc: "默认 direct chat 会 canonical 到 main bucket；随后再看 freshness policy，决定沿用旧 sessionId 还是新开 sessionId。",
      },
      {
        title: "group / channel / thread 这类外部场景",
        cc: "没有这一层外部路由语义。CC 的 session 主要就是本地会话线程。",
        oc: "group/channel 会保留独立 bucket；thread 还会叠 thread suffix，并能反查 parent sessionKey。",
      },
      {
        title: "显式切会话",
        cc: "`/resume` 直接 `switchSession(...)` 切到旧 transcript；`/clear` 直接 `regenerateSessionId(...)` 开新 session。",
        oc: "显式 `sessionKey` 优先；显式 `sessionId` 会反查已有 store entry，优先复用已经存在的 runtime session。",
      },
      {
        title: "subagent 派生子会话",
        cc: "子代理沿当前 session 目录再开 sidechain transcript，父子关系主要靠 `parentSessionId` 和 agent sidechain 路径表达。",
        oc: "会直接新建 `childSessionKey` / `sessionId`，再把 `spawnedBy`、`parentSessionKey`、`spawnDepth` 补到 session store。",
      },
      {
        title: "历史很长、或者中间发生分叉",
        cc: "仍然是一条 transcript 线程。只是模型这轮只读 compact 之后整理出的 `messagesForQuery`。",
        oc: "不是整份 transcript 原样回放。Pi `SessionManager` 会沿当前 leaf 回溯 path，再处理 compaction 和 branch_summary，最后才还原成模型 history。",
      },
    ],
    ccPoints: [
      "CC 的 session 可以先粗暴地理解成：当前 `sessionId` 指向的一条 transcript 线程。",
      "`sessionProjectDir` 只管 transcript 在哪个项目目录里；`cwd`、`projectRoot`、worktree 仍然是另一层状态。",
      "`/clear` 明确开新 `sessionId`，`/resume` 明确切回旧 `sessionId`，所以边界主要靠显式动作。",
      "子代理不是新建一套外层 session route，而是在当前 session 目录下写 sidechain transcript，并保留 `parentSessionId` 谱系。",
      "模型真正读的是 `messagesForQuery`，不是 transcript 原样。",
    ],
    ocPoints: [
      "龙虾一定要先看外层 IM route。没有 `channel/account/peer/thread -> route` 这层，后面的 session 逻辑就会看歪。",
      "`sessionKey` 是外层会话桶；`sessionId` 是当前 runtime session。两者不是同一个抽象层。",
      "`evaluateSessionFreshness()` 会按 reset policy 决定同一个 `sessionKey` 是否继续沿用旧 `sessionId`。",
      "`SessionEntry` 是元数据层，`sessionFile` 是 transcript 层；workspaceDir 还要再另外看。",
      "subagent 会直接开新的 `childSessionKey` / `sessionId`，不会像 CC 那样只是在父 session 目录下加 sidechain。",
      "模型真正读的是 Pi `buildSessionContext()` 还原出来的当前 branch messages。",
    ],
    ccHeader: "Claude Code · session 线程、sidechain、模型 history",
    ccCode: `// 当前主线程会话：sessionId + sessionProjectDir
const transcriptPath = getTranscriptPath()

// /clear：显式开新 session
regenerateSessionId({ setCurrentAsParent: true })

// /resume：显式切回旧 session
switchSession(sessionId, projectDir)

// 用户消息先写盘，保证中断后还能 resume
await recordTranscript(messages)

// 子代理不是新的外层 route，而是当前 session 目录下的 sidechain
const sidechainPath = getAgentTranscriptPath(agentId)

// 模型真正读的是整理后的本轮 history
let messagesForQuery = [...getMessagesAfterCompactBoundary(messages)]
messagesForQuery = await applyToolResultBudget(messagesForQuery, ...)

await deps.callModel({
  messages: prependUserContext(messagesForQuery, userContext),
  ...
})`,
    ocHeader: `${OPENCLAW_RUNTIME} · IM route、sessionKey、freshness、SessionManager`,
    ocCode: `// 先从 IM 对话身份算 route
const route = resolveAgentRoute({
  channel,
  accountId,
  peer,
  parentPeer,
  ...
})

// 再从显式 key / 默认 scope 得到 sessionKey
const { sessionKey } = resolveSessionKeyForRequest({
  cfg,
  to,
  sessionKey,
  sessionId,
  agentId,
})

// freshness 决定同一个 sessionKey 是否复用旧 sessionId
const { sessionId, sessionEntry } = resolveSession(...)

// runtime session 再映射到 transcript file
const { sessionFile } = await resolveSessionTranscriptFile({
  sessionId,
  sessionKey,
  sessionEntry,
  ...
})

// 模型真正读的是当前 branch 还原出的 messages
const sessionManager = SessionManager.open(sessionFile)
const sessionContext = sessionManager.buildSessionContext()
await activeSession.prompt(body)`,
    comment:
      "session 这一块最容易混的，是把“用户看到的对话”“runtime session”“模型 history”当成同一个词。Claude Code 只是把这几层压得更近；龙虾把它们拆得更开。",
    sources: [
      {
        title: `${OPENCLAW_RUNTIME} · resolve-route.ts`,
        note: "IM route 的起点在这里：channel/account/peer/thread 先被映射成 agentId、sessionKey、mainSessionKey。",
        url: `${OPENCLAW_REPO}/src/routing/resolve-route.ts#L631`,
      },
      {
        title: "Claude Code · state.ts",
        note: "`regenerateSessionId()`、`switchSession()`、`sessionProjectDir` 都在这里，主线程 session 边界从这里切。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/bootstrap/state.ts#L435`,
      },
      {
        title: "Claude Code · QueryEngine.ts",
        note: "这里明说了：用户消息先 `recordTranscript()`，再进入 query loop。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/QueryEngine.ts#L436`,
      },
      {
        title: "Claude Code · sessionStorage.ts",
        note: "`getTranscriptPath()` 用当前 sessionId + sessionProjectDir 定 transcript 路径；`getAgentTranscriptPath()` 负责 sidechain transcript。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/utils/sessionStorage.ts#L202`,
      },
      {
        title: "Claude Code · sessionStorage.ts · recordTranscript()",
        note: "`recordTranscript()` 是真正把当前会话线程写进 JSONL 的地方。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/utils/sessionStorage.ts#L1408`,
      },
      {
        title: "Claude Code · clear/conversation.ts",
        note: "`/clear` 会显式新开 `sessionId`，并把旧 session 记成 parent lineage。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/commands/clear/conversation.ts#L49`,
      },
      {
        title: "Claude Code · sessionRestore.ts",
        note: "`/resume` 在这里 `switchSession(...)` 切回旧线程，并 adopt 已有 transcript。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/utils/sessionRestore.ts#L409`,
      },
      {
        title: "Claude Code · spawnInProcess.ts",
        note: "`parentSessionId` 在这里挂到 teammate/subagent 谱系上。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/utils/swarm/spawnInProcess.ts#L125`,
      },
      {
        title: "Claude Code · query.ts · messagesForQuery",
        note: "`messagesForQuery` 先从当前消息链整理出来；模型读的是它，不是 transcript 原样。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/query.ts#L365`,
      },
      {
        title: "Claude Code · query.ts · prependUserContext()",
        note: "真正送进模型的，是 `prependUserContext(messagesForQuery, userContext)` 之后的结果。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/query.ts#L660`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · session-key.ts`,
        note: "`resolveSessionKey()` 在这里把 direct chat、group/channel 等场景映射成外层会话桶。",
        url: `${OPENCLAW_REPO}/src/config/sessions/session-key.ts#L29`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · routing/session-key.ts`,
        note: "`resolveThreadSessionKeys()` 和 thread suffix 逻辑在这里，thread session 能反推出 parent/base session。",
        url: `${OPENCLAW_REPO}/src/routing/session-key.ts#L234`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · session-conversation.ts`,
        note: "`resolveSessionConversationRef()`、`resolveSessionParentSessionKey()` 在这里把 thread conversation 和 parent conversation 关系补齐。",
        url: `${OPENCLAW_REPO}/src/channels/plugins/session-conversation.ts#L229`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · reset.ts`,
        note: "`resolveSessionResetPolicy()` 和 `evaluateSessionFreshness()` 在这里，决定 daily/idle 下是否沿用旧 session。",
        url: `${OPENCLAW_REPO}/src/config/sessions/reset.ts#L80`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · session.ts`,
        note: "`resolveSessionKeyForRequest()` 处理显式 sessionId/sessionKey 反查；`resolveSession()` 再决定 runtime sessionId。",
        url: `${OPENCLAW_REPO}/src/agents/command/session.ts#L44`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · types.ts`,
        note: "`SessionEntry` 在这里定义。store 里记的是元数据和运行态，不是模型 history。",
        url: `${OPENCLAW_REPO}/src/config/sessions/types.ts#L75`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · transcript.ts`,
        note: "`resolveSessionTranscriptFile()` 先定位 `sessionFile`，后面再 `SessionManager.open(sessionFile)`。",
        url: `${OPENCLAW_REPO}/src/config/sessions/transcript.ts#L88`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · subagent-spawn.ts`,
        note: "subagent 在这里直接新建 `childSessionKey`，并写入 `spawnedBy/spawnDepth` 等父子谱系信息。",
        url: `${OPENCLAW_REPO}/src/agents/subagent-spawn.ts#L479`,
      },
      {
        title: "Pi SDK · session-manager.ts",
        note: "`buildSessionContext()` 会沿当前 leaf 回溯 path，并处理 compaction / branch_summary，最后产出模型可见 messages。",
        url: `${PI_MONO_REPO}/packages/coding-agent/src/core/session-manager.ts#L310`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · agent-command.ts`,
        note: "`resolveSession(...)` 的结果会在这里接进 workspace / runId / runtime 执行链。这里也能看出 `workspaceDir` 不是 sessionFile。",
        url: `${OPENCLAW_REPO}/src/agents/agent-command.ts#L255`,
      },
    ],
  },
  {
    id: "context",
    number: "02",
    title: "Context 组装",
    summary:
      "模型真正看到什么，是这一段决定的。这里控制上下文体积，也拼好本轮 prompt。",
    story:
      "任务继续往下跑时，历史消息、工具结果、bootstrap 文件都会一起增长。发请求前要先裁剪和组装上下文。",
    why: "如果这一段不清楚，就很难解释为什么模型这轮看到了某些东西，没看到另一些东西。",
    same: "两边都会在模型调用前整理上下文。",
    diff:
      `Claude Code 重点处理 message list。${OPENCLAW_RUNTIME} 重点组 system prompt、skills 和 bootstrap。`,
    ccPoints: [
      "`applyToolResultBudget() -> snipCompactIfNeeded() -> microcompact() -> autocompact()` 顺序是固定的。",
      "`messagesForQuery` 是这一段的核心对象，Claude Code 主要改的是消息数组本身。",
      "`startRelevantMemoryPrefetch()` 在回合开始就启动，后面有机会把 memory attachment 插回 loop。",
    ],
    ocPoints: [
      "`resolveSkillsPromptForRun()`、`resolveBootstrapContextForRun()` 先把 skills 和 context files 准备好。",
      "`buildEmbeddedSystemPrompt()` 再把 runtime info、tools、memory citations、workspace files 拼进 system prompt。",
      `${OPENCLAW_RUNTIME} 可根据 session 类型切到 \`minimal\` prompt，主动压小子会话上下文。`,
    ],
    ccHeader: "Claude Code · query.ts",
    ccCode: `// 先控制单条 tool result 的体积
messagesForQuery = await applyToolResultBudget(...)

// 再做 snip / microcompact / autocompact
messagesForQuery = snipCompactIfNeeded(messagesForQuery).messages
messagesForQuery = (await deps.microcompact(...)).messages

const { compactionResult } = await deps.autocompact(
  messagesForQuery,
  toolUseContext,
  ...
)

// 本轮开始时就预取 relevant memory
using pendingMemoryPrefetch = startRelevantMemoryPrefetch(...)`,
    ocHeader: `${OPENCLAW_RUNTIME} · run/attempt.ts`,
    ocCode: `// 先准备 skills 文本
const skillsPrompt = resolveSkillsPromptForRun({ ... })

// 再收集 bootstrap files / context files
const { bootstrapFiles, contextFiles } =
  await resolveBootstrapContextForRun({ ... })

// 根据 session 类型决定 promptMode
const promptMode = resolvePromptModeForSession(params.sessionKey)

// 最后把 skills / tools / context / runtimeInfo 组进 system prompt
const appendPrompt = buildEmbeddedSystemPrompt({
  workspaceDir: effectiveWorkspace,
  skillsPrompt,
  promptMode,
  contextFiles,
  runtimeInfo,
  tools: effectiveTools,
})`,
    comment:
      `这一段最能看出两边的分工。Claude Code 主要改消息数组；${OPENCLAW_RUNTIME} 主要组运行环境。`,
    sources: [
      {
        title: "Claude Code · query.ts",
        note: "budget、snip、microcompact、autocompact 以及 memory prefetch。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/query.ts`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · run/attempt.ts`,
        note: "skills、bootstrap、promptMode、buildEmbeddedSystemPrompt。",
        url: `${OPENCLAW_REPO}/src/agents/pi-embedded-runner/run/attempt.ts`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · system-prompt.md`,
        note: "workspace bootstrap injection 和 minimal prompt 行为。",
        url: `${OPENCLAW_REPO}/docs/concepts/system-prompt.md`,
      },
    ],
  },
  {
    id: "sampling",
    number: "03",
    title: "回合引擎",
    summary:
      "这一段负责真正调模型、接收流式输出、识别 tool use，并把结果变成后续可执行状态。",
    story: "上下文整理完之后，loop 才真正开始跑这一轮。",
    why: "只有把这一段读准，才能知道 tool use 是怎么被发现的，异常重试又是怎么发生的。",
    same: "两边都不会在一次调用后立刻停住，都会把模型输出继续转成下一步动作。",
    diff:
      `Claude Code 直接在 \`queryLoop()\` 里写模型回合循环。${OPENCLAW_RUNTIME} 把模型调用、stream 包装和事件桥接组合在一起。`,
    ccPoints: [
      "`for await (const message of deps.callModel(...))` 直接位于 `queryLoop()` 内部。",
      "同一段代码里同时积累 `assistantMessages`、`toolUseBlocks` 和 `needsFollowUp`。",
      "如果发生 streaming fallback，Claude Code 会 tombstone 掉前一轮半成品消息，再重新接后面的流。",
    ],
    ocPoints: [
      "`runEmbeddedPiAgent()` 先把 run 放进 session/global lane，再调用 `runEmbeddedAttempt()`。",
      `\`runEmbeddedAttempt()\` 里会先 \`createAgentSession()\`，这一步进入 Pi SDK。`,
      `\`activeSession.prompt(...)\` 会继续走到 Pi SDK 的 \`Agent.prompt() -> runAgentLoop() -> runLoop()\`。OpenClaw 自己负责 streamFn 包装和事件桥接。`,
    ],
    ccHeader: "Claude Code · query.ts",
    ccCode: `for await (const message of deps.callModel({
  // 本轮真正发给模型的 messages / systemPrompt / tools
  messages: prependUserContext(messagesForQuery, userContext),
  systemPrompt: fullSystemPrompt,
  tools: toolUseContext.options.tools,
  ...
})) {
  // assistant 文本、tool_use、是否 follow-up 都在这里识别
  // 收 assistantMessages / toolUseBlocks / needsFollowUp

  // 如果流式调用回退，前一轮半成品消息会被 tombstone 掉
  // 处理 streaming fallback / tombstone
}`,
    ocHeader: `${OPENCLAW_RUNTIME} · run.ts + run/attempt.ts`,
    ocCode: `// run/attempt.ts
// 先创建 pi session
({ session } = await createAgentSession({
  model: params.model,
  tools: builtInTools,
  customTools: allCustomTools,
  sessionManager,
  settingsManager,
  resourceLoader,
}))

// runtime 会继续包一层 pi 的 streamFn
activeSession.agent.streamFn = resolveEmbeddedAgentStreamFn(...)
activeSession.agent.streamFn = wrapStreamFnSanitizeMalformedToolCalls(...)
activeSession.agent.streamFn = wrapAnthropicStreamWithRecovery(...)

// 再订阅 pi 事件，把它们桥接成 runtime 的 stream
const subscription = subscribeEmbeddedPiSession({
  session: activeSession,
  runId: params.runId,
  ...
})

// 真正进入 Pi SDK loop
await abortable(activeSession.prompt(effectivePrompt, { images }))`,
    comment:
      `Claude Code 这一段就在自己代码里。${OPENCLAW_RUNTIME} 这一段要一起看 OpenClaw 和 Pi SDK：OpenClaw 负责接线，Pi SDK 负责 loop body。`,
    sources: [
      {
        title: "Claude Code · query.ts",
        note: "`deps.callModel()`、streaming fallback、tool block 收集都在这里。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/query.ts`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · run.ts`,
        note: "session queue 和 embedded run 入口。",
        url: `${OPENCLAW_REPO}/src/agents/pi-embedded-runner/run.ts`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · run/attempt.ts`,
        note: "`subscribeEmbeddedPiSession()` 和 `activeSession.prompt()`。",
        url: `${OPENCLAW_REPO}/src/agents/pi-embedded-runner/run/attempt.ts`,
      },
      {
        title: "Pi SDK · sdk.ts",
        note: "`createAgentSession()` 在这里建出 `AgentSession`。",
        url: `${PI_MONO_REPO}/packages/coding-agent/src/core/sdk.ts`,
      },
      {
        title: "Pi SDK · agent.ts",
        note: "`prompt()` 会走到 `runAgentLoop()`。",
        url: `${PI_MONO_REPO}/packages/agent/src/agent.ts`,
      },
      {
        title: "Pi SDK · agent-loop.ts",
        note: "`runLoop()` 是真正的 loop body。",
        url: `${PI_MONO_REPO}/packages/agent/src/agent-loop.ts`,
      },
    ],
  },
  {
    id: "tools",
    number: "04",
    title: "工具运行层",
    summary:
      "搜索、读文件、跑命令都发生在这一段。工具结果处理完，loop 才知道要不要继续下一轮。",
    story:
      "用户让 agent 搜代码、读文件、执行命令时，真正干活的是工具层。search 只是工具层里的一个能力。",
    why: "如果你关心 Search、Exec、Read、文件改动怎么回到主线程，这一段就是关键。",
    same: "两边都把搜索类动作放在 tool layer，和其他工具调用放在同一层。",
    diff:
      `Claude Code 直接在 \`queryLoop()\` 里 \`runTools()\`。${OPENCLAW_RUNTIME} 把工具集准备、pi 调度和结果桥接放在一套运行链里。`,
    ccPoints: [
      "`runTools()` 直接消费 `toolUseBlocks`，得到 `toolResults` 和 `newContext`。",
      "`getAttachmentMessages()` 会把文件改动、队列消息、memory attachment 再塞回当前 loop。",
      "`state = { ... transition: { reason: 'next_turn' } }` 是进入下一轮的关键状态转移。",
    ],
    ocPoints: [
      "`createOpenClawCodingTools()` 决定这次 run 里有哪些工具，包括 search / exec / session / memory 等。",
      "这些工具会作为 `tools/customTools` 传给 `createAgentSession()`，随后由 Pi SDK 的 `executeToolCalls()` 调度。",
      "`subscribeEmbeddedPiSession()` 再把工具 start/update/end 统一转成 `stream: \"tool\"`。",
    ],
    ccHeader: "Claude Code · query.ts",
    ccCode: `// 先决定工具结果来自 streaming executor 还是普通 runTools()
const toolUpdates = streamingToolExecutor
  ? streamingToolExecutor.getRemainingResults()
  : runTools(toolUseBlocks, assistantMessages, canUseTool, toolUseContext)

for await (const update of toolUpdates) {
  // tool_result 会进 toolResults，newContext 会更新 toolUseContext
  if (update.message) toolResults.push(...)
  if (update.newContext) updatedToolUseContext = { ...update.newContext, queryTracking }
}

// attachment 会把文件改动、memory、队列消息补回本轮结果
for await (const attachment of getAttachmentMessages(...)) {
  toolResults.push(attachment)
}

// 这里把本轮 assistant + toolResults 拼回 state，进入 next_turn
state = {
  messages: [...messagesForQuery, ...assistantMessages, ...toolResults],
  pendingToolUseSummary: nextPendingToolUseSummary,
  transition: { reason: "next_turn" },
  ...
}`,
    ocHeader: `${OPENCLAW_RUNTIME} · run/attempt.ts + agent-loop.md`,
    ocCode: `// 这一层决定本次 run 暴露哪些工具
const toolsRaw = createOpenClawCodingTools({
  sessionKey: sandboxSessionKey,
  sessionId: params.sessionId,
  runId: params.runId,
  workspaceDir: effectiveWorkspace,
  ...
})

// 然后把 builtInTools / customTools 交给 pi session
({ session } = await createAgentSession({
  tools: builtInTools,
  customTools: allCustomTools,
  ...
}))

// 工具执行由 Pi SDK 负责
// runtime 自己负责把事件桥接成统一流
tool start / update / end -> stream "tool"
assistant delta           -> stream "assistant"
lifecycle                 -> stream "lifecycle"`,
    comment:
      `Search 在 ${OPENCLAW_RUNTIME} 里不是独立 loop，它是 Pi SDK 工具循环里的一个工具能力。OpenClaw 自己负责准备工具集和事件桥。`,
    sources: [
      {
        title: "Claude Code · query.ts",
        note: "`runTools()`、`getAttachmentMessages()`、`transition: next_turn`。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/query.ts`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · run/attempt.ts`,
        note: "`createOpenClawCodingTools()` 和 `subscribeEmbeddedPiSession()`。",
        url: `${OPENCLAW_REPO}/src/agents/pi-embedded-runner/run/attempt.ts`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · agent-loop.md`,
        note: "tool stream 和 assistant/lifecycle stream 的桥接说明。",
        url: `${OPENCLAW_REPO}/docs/concepts/agent-loop.md`,
      },
      {
        title: "Pi SDK · agent-loop.ts",
        note: "`executeToolCalls()` 负责真正的工具循环。",
        url: `${PI_MONO_REPO}/packages/agent/src/agent-loop.ts`,
      },
    ],
  },
  {
    id: "subagent",
    number: "05",
    title: "Subagent",
    summary:
      "subagent 的关键是独立上下文、隔离方式、结果回传和生命周期管理。",
    story: "主 agent 判断任务太大时，会启动一个子代理，让一部分工作在独立上下文里运行。",
    why: "如果不搞清楚子代理边界，就很容易把 fork、background、session tree、worktree 混在一起。",
    same: "两边都有子代理，而且子代理都有独立上下文。",
    diff:
      `Claude Code 重点是 worktree、后台运行和本地隔离。${OPENCLAW_RUNTIME} 重点是 child session、depth、announce 和控制边界。`,
    ccPoints: [
      "`Agent` 工具可指定 `subagent_type`，实验打开时也可以省略后走 fork path。",
      "`run_in_background`、`isolation: \"worktree\"`、`cwd` 决定执行方式和隔离方式。",
      "Claude Code 的子代理仍在同一套 runtime 内，通过 transcript 和 notification 回流结果。",
    ],
    ocPoints: [
      "`sessions_spawn` 默认非阻塞返回 `runId` 和 `childSessionKey`，直接创建一条子会话。",
      "`resolveSubagentCapabilities()` 用 depth 决定 `role / canSpawn / controlScope`。",
      "`registerSubagentRun()` 和 announce 流负责把子会话结果回贴给请求者。",
    ],
    ccHeader: "Claude Code · AgentTool.tsx",
    ccCode: `// 先决定子代理类型，实验开关打开时可以走 fork path
const effectiveType =
  subagent_type ?? (isForkSubagentEnabled() ? undefined : GENERAL_PURPOSE_AGENT.agentType)

// 再决定同步还是后台运行
const shouldRunAsync =
  (run_in_background === true || selectedAgent.background === true) &&
  !isBackgroundTasksDisabled

// 如果要求 worktree 隔离，就先创建独立 worktree
if (effectiveIsolation === "worktree") {
  worktreeInfo = await createAgentWorktree(slug)
}

// 最后把子代理交给 runAgent 执行
return runAgent({
  agentId,
  worktreePath: worktreeInfo?.worktreePath,
  ...
})`,
    ocHeader: `${OPENCLAW_RUNTIME} · subagent-spawn.ts`,
    ocCode: `// 先生成新的 childSessionKey
const childSessionKey =
  "agent:" + targetAgentId + ":subagent:" + crypto.randomUUID()

// 再通过 gateway agent 入口启动子会话
const response = await callSubagentGateway({
  method: "agent",
  params: {
    message: childTaskMessage,
    sessionKey: childSessionKey,
    lane: AGENT_LANE_SUBAGENT,
    extraSystemPrompt: childSystemPrompt,
  },
})

// 最后把 runId / childSessionKey 记到 subagent registry
registerSubagentRun({
  runId: readGatewayRunId(response) ?? childIdem,
  childSessionKey,
  requesterSessionKey: requesterInternalKey,
  spawnMode,
})`,
    comment:
      `Claude Code 的子代理实现重点是本地执行隔离。${OPENCLAW_RUNTIME} 的子代理实现重点是新建 child session 并管理其生命周期。`,
    sources: [
      {
        title: "Claude Code · AgentTool.tsx",
        note: "`subagent_type`、`run_in_background`、`isolation: worktree`。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/tools/AgentTool/AgentTool.tsx`,
      },
      {
        title: "Claude Code · forkSubagent.ts",
        note: "省略 `subagent_type` 时的 fork 语义。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/tools/AgentTool/forkSubagent.ts`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · session-tool.md`,
        note: "`sessions_spawn` 的使用边界。",
        url: `${OPENCLAW_REPO}/docs/concepts/session-tool.md`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · subagent-spawn.ts`,
        note: "`childSessionKey`、gateway `agent` 调用、`registerSubagentRun()`。",
        url: `${OPENCLAW_REPO}/src/agents/subagent-spawn.ts`,
      },
    ],
  },
  {
    id: "finish",
    number: "06",
    title: "收尾与记忆",
    summary:
      "loop 的最后一步不只是 return。这里还要处理 recovery、compaction、memory flush，以及真正的结束条件。",
    story: "模型可能已经答完，也可能刚好碰到 overflow、compaction 或需要写 memory。",
    why: "长对话能不能稳住，主要看这一段怎么收尾。",
    same: "两边都把 compaction 和 memory 放在 loop 收尾阶段处理，和主执行流直接相连。",
    diff:
      `Claude Code 的 memory 写回走 \`registerPostSamplingHook()\` + forked agent。${OPENCLAW_RUNTIME} 的 memory 重点在 workspace files 和 pre-compaction flush。`,
    ccPoints: [
      "`!needsFollowUp` 之后还会过 `pendingToolUseSummary`、overflow recovery、`max_output_tokens` recovery、stop hooks、token budget。",
      "`registerPostSamplingHook(extractSessionMemory)` 在主线程回合后提取 session memory。",
      "Claude Code 的 memory 读写分两头：开始时 prefetch，结束后提取。",
    ],
    ocPoints: [
      "`agent.wait` 以 lifecycle `end/error` 为准，不以单条 assistant 文本为准。",
      "`runMemoryFlushIfNeeded()` 会在 compaction 前判断是否需要跑一次 silent memory flush。",
      "长期记忆通过 `MEMORY.md`、`memory/*.md` 以及 `memory_search` / `memory_get` 再次回到后续回合。",
    ],
    ccHeader: "Claude Code · query.ts + sessionMemory.ts",
    ccCode: `if (pendingToolUseSummary) {
  // 上一轮工具摘要在这里真正发出去
  yield await pendingToolUseSummary
}

if (!needsFollowUp) {
  // 没有 follow-up 时，才进入结束分支
  // prompt-too-long recovery
  // max_output_tokens recovery
  // stop hooks
  // token budget
  return { reason: "completed" }
}

// session memory 提取挂在 registerPostSamplingHook() 上
registerPostSamplingHook(extractSessionMemory)

// memory 提取本身由 forked agent 执行
await runForkedAgent({
  querySource: "session_memory",
  forkLabel: "session_memory",
  ...
})`,
    ocHeader: `${OPENCLAW_RUNTIME} · agent-runner.ts + agent-runner-memory.ts + agent-job.ts`,
    ocCode: `// follow-up turn 前，先检查要不要做 memory flush
activeSessionEntry = await runMemoryFlushIfNeeded({
  cfg,
  followupRun,
  sessionKey,
  sessionStore,
  ...
})

// flush 计划、session log 读取和可写性判断都在这里
const memoryFlushPlan = resolveMemoryFlushPlan({ cfg: params.cfg })
const canAttemptFlush = memoryFlushWritable && !params.isHeartbeat && !isCli
const sessionLogSnapshot = shouldReadSessionLog
  ? await readSessionLogSnapshot(...)
  : undefined

// agent.wait 等待的是 lifecycle end/error，不是单条 assistant 文本
const snapshot = await waitForAgentJob({ runId, timeoutMs })`,
    comment:
      `Claude Code 在会话开始和结束两侧处理 memory。${OPENCLAW_RUNTIME} 把 memory 和 workspace 持久化、compaction 保护放得更近。`,
    sources: [
      {
        title: "Claude Code · query.ts",
        note: "no-follow-up 分支里的 recovery、stop hooks、token budget。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/query.ts`,
      },
      {
        title: "Claude Code · sessionMemory.ts",
        note: "`extractSessionMemory()` 和 `registerPostSamplingHook()`。",
        url: `${CLAUDE_REPO}/03-claude-code-runnable/src/services/SessionMemory/sessionMemory.ts`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · agent-runner.ts`,
        note: "`runMemoryFlushIfNeeded()` 在 followup turn 前被调用。",
        url: `${OPENCLAW_REPO}/src/auto-reply/reply/agent-runner.ts`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · agent-runner-memory.ts`,
        note: "`runMemoryFlushIfNeeded()` 的判断逻辑。",
        url: `${OPENCLAW_REPO}/src/auto-reply/reply/agent-runner-memory.ts`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · memory.md`,
        note: "`MEMORY.md`、`memory/*.md`、`memory_search`、pre-compaction memory flush。",
        url: `${OPENCLAW_REPO}/docs/concepts/memory.md`,
      },
      {
        title: `${OPENCLAW_RUNTIME} · agent-job.ts`,
        note: "`waitForAgentJob()` 说明 `agent.wait` 的真正等待对象。",
        url: `${OPENCLAW_REPO}/src/gateway/server-methods/agent-job.ts`,
      },
    ],
  },
];

const APPENDIX = [
  {
    group: "Claude Code",
    title: "query.ts",
    summary: "主 loop：context、模型调用、工具、attachment、next_turn。",
    url: `${CLAUDE_REPO}/03-claude-code-runnable/src/query.ts`,
  },
  {
    group: "Claude Code",
    title: "state.ts",
    summary: "主线程 session 状态边界。",
    url: `${CLAUDE_REPO}/03-claude-code-runnable/src/bootstrap/state.ts`,
  },
  {
    group: "Claude Code",
    title: "sessionStorage.ts",
    summary: "transcript 路径、resume、adopt。",
    url: `${CLAUDE_REPO}/03-claude-code-runnable/src/utils/sessionStorage.ts`,
  },
  {
    group: "Claude Code",
    title: "AgentTool.tsx",
    summary: "subagent、worktree、sync/async lifecycle。",
    url: `${CLAUDE_REPO}/03-claude-code-runnable/src/tools/AgentTool/AgentTool.tsx`,
  },
  {
    group: "Claude Code",
    title: "sessionMemory.ts",
    summary: "模型回合后的 memory 提取。",
    url: `${CLAUDE_REPO}/03-claude-code-runnable/src/services/SessionMemory/sessionMemory.ts`,
  },
  {
    group: OPENCLAW_RUNTIME,
    title: "agent-loop.md",
    summary: "完整 runtime 的官方 loop 说明。",
    url: `${OPENCLAW_REPO}/docs/concepts/agent-loop.md`,
  },
  {
    group: OPENCLAW_RUNTIME,
    title: "pi.md",
    summary: "完整 runtime 和 pi-coding-agent / pi-agent-core 的集成说明。",
    url: `${OPENCLAW_REPO}/docs/pi.md`,
  },
  {
    group: OPENCLAW_RUNTIME,
    title: "agent-command.ts",
    summary: "入口层：session、workspace、runWithModelFallback。",
    url: `${OPENCLAW_REPO}/src/agents/agent-command.ts`,
  },
  {
    group: OPENCLAW_RUNTIME,
    title: "run.ts",
    summary: "session queue、global queue、embedded run 入口。",
    url: `${OPENCLAW_REPO}/src/agents/pi-embedded-runner/run.ts`,
  },
  {
    group: OPENCLAW_RUNTIME,
    title: "run/attempt.ts",
    summary: "skills、bootstrap、prompt、tool bridge、compaction wait。",
    url: `${OPENCLAW_REPO}/src/agents/pi-embedded-runner/run/attempt.ts`,
  },
  {
    group: OPENCLAW_RUNTIME,
    title: "subagent-spawn.ts",
    summary: "sessions_spawn 的真实实现。",
    url: `${OPENCLAW_REPO}/src/agents/subagent-spawn.ts`,
  },
  {
    group: OPENCLAW_RUNTIME,
    title: "subagent-registry.ts",
    summary: "子会话 registry、announce、lifecycle。",
    url: `${OPENCLAW_REPO}/src/agents/subagent-registry.ts`,
  },
  {
    group: OPENCLAW_RUNTIME,
    title: "agent-runner-memory.ts",
    summary: "pre-compaction memory flush。",
    url: `${OPENCLAW_REPO}/src/auto-reply/reply/agent-runner-memory.ts`,
  },
  {
    group: OPENCLAW_RUNTIME,
    title: "pi-mono/sdk.ts",
    summary: "Pi SDK 的 `createAgentSession()`。",
    url: `${PI_MONO_REPO}/packages/coding-agent/src/core/sdk.ts`,
  },
  {
    group: OPENCLAW_RUNTIME,
    title: "pi-mono/agent.ts",
    summary: "Pi SDK 的 `prompt()` -> `runAgentLoop()` 入口。",
    url: `${PI_MONO_REPO}/packages/agent/src/agent.ts`,
  },
  {
    group: OPENCLAW_RUNTIME,
    title: "pi-mono/agent-loop.ts",
    summary: "Pi SDK 的 `runLoop()` 和 `executeToolCalls()`。",
    url: `${PI_MONO_REPO}/packages/agent/src/agent-loop.ts`,
  },
];

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderLoopMap() {
  const node = document.getElementById("loop-map");
  if (!node) return;

  node.innerHTML = LOOP_STEPS.map(
    (step) => `
      <a
        class="loop-step"
        href="#phase-${step.id}"
        data-phase-link="${step.id}"
      >
        <span class="loop-step-index">${step.number}</span>
        <strong>${step.title}</strong>
        <p>${step.summary}</p>
        <div class="chip-row">
          ${step.concepts
            .map((concept) => `<span class="chip">${concept}</span>`)
            .join("")}
        </div>
      </a>
    `,
  ).join("");
}

function renderCoreLoop() {
  const node = document.getElementById("core-loop-shell");
  if (!node) return;

  node.innerHTML = `
    <div class="section-head">
      <p class="eyebrow">主循环</p>
      <h2>${CORE_LOOP.title}</h2>
      <p>${CORE_LOOP.body}</p>
    </div>

    <article class="story-band">
      <span class="story-tag">用户故事</span>
      <p>${CORE_LOOP.story}</p>
    </article>

    <article class="story-band overview-track">
      <span class="story-tag">这一层只看总图</span>
      <p>${CORE_LOOP.track}</p>
    </article>

    <div class="code-grid overview-grid">
      <article class="code-panel">
        <header>
          <strong>${CORE_LOOP.claude.title}</strong>
          <span>${CORE_LOOP.claude.meta}</span>
        </header>
        <pre><code>${escapeHtml(CORE_LOOP.claude.code)}</code></pre>
      </article>
      <article class="code-panel">
        <header>
          <strong>${CORE_LOOP.openclaw.title}</strong>
          <span>${CORE_LOOP.openclaw.meta}</span>
        </header>
        <pre><code>${escapeHtml(CORE_LOOP.openclaw.code)}</code></pre>
      </article>
    </div>

    <div class="overview-steps">
      ${CORE_LOOP.steps
        .map(
          (step) => `
            <article class="overview-step">
              <div class="overview-step-head">
                <span class="phase-index">${step.number}</span>
                <h3>${step.title}</h3>
              </div>
              <div class="overview-step-grid">
                <article class="overview-path">
                  <strong>Claude Code</strong>
                  <p>${step.cc}</p>
                </article>
                <article class="overview-path">
                  <strong>${OPENCLAW_RUNTIME}</strong>
                  <p>${step.oc}</p>
                </article>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>

    <div class="source-list">
      ${CORE_LOOP.sources
        .map(
          (source) => `
            <a class="source-link" href="${source.url}" target="_blank" rel="noreferrer">
              <strong>${source.title}</strong>
              <span>${source.note}</span>
            </a>
          `,
        )
        .join("")}
    </div>

    <div class="comment-box">
      <strong>点评</strong>
      <p>${CORE_LOOP.comment}</p>
    </div>
  `;
}

function renderPyramid() {
  const node = document.getElementById("pyramid-shell");
  if (!node) return;

  const { parts } = LOOP_PYRAMID;

  node.innerHTML = `
    <div class="pyramid-grid">
      ${parts
        .map(
          (part) => `
            <a
              class="pyramid-card"
              href="#phase-${part.id}"
              data-phase-link="${part.id}"
            >
              <div class="pyramid-card-head">
                <h3>${part.title}</h3>
                <p>${part.summary}</p>
              </div>
              <div class="pyramid-compare">
                <div class="pyramid-path">
                  <strong>Claude Code</strong>
                  <p>${part.ccPath}</p>
                </div>
                <div class="pyramid-path">
                  <strong>${OPENCLAW_RUNTIME}</strong>
                  <p>${part.ocPath}</p>
                </div>
              </div>
              <p class="pyramid-comment"><strong>差异</strong>${part.diff}</p>
              <p class="pyramid-comment"><strong>点评</strong>${part.comment}</p>
            </a>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderSkeletons() {
  const node = document.getElementById("skeleton-grid");
  if (!node) return;

  node.innerHTML = LOOP_SKELETON.map(
    (view) => `
      <article class="skeleton-panel">
        <header>
          <span class="snippet-meta">${view.kind}</span>
          <h3>${view.title}</h3>
          <p>${view.body}</p>
        </header>
        <div class="skeleton-stack">
          ${view.panels
            .map(
              (panel) => `
                <section class="skeleton-snippet">
                  <div class="snippet-head">
                    <div>
                      <span class="snippet-meta">${panel.meta}</span>
                      <h4>${panel.header}</h4>
                      <p>${panel.note}</p>
                    </div>
                    <a
                      class="snippet-link"
                      href="${panel.url}"
                      target="_blank"
                      rel="noreferrer"
                    >
                      源码
                    </a>
                  </div>
                  <pre><code>${escapeHtml(panel.code)}</code></pre>
                </section>
              `,
            )
            .join("")}
        </div>
      </article>
    `,
  ).join("");
}

function renderList(items) {
  return `
    <ul class="point-list">
      ${items.map((item) => `<li>${item}</li>`).join("")}
    </ul>
  `;
}

function renderNarrativeBlock(phase) {
  return `
    <section class="narrative">
      <div>
        <strong>这一步在解决什么</strong>
        <span>${phase.why}</span>
      </div>
      <div>
        <strong>放进主线里看</strong>
        <span>${phase.story}</span>
      </div>
    </section>
  `;
}

function renderSummaryCards(phase) {
  if (!phase.summaryCards?.length) {
    return `
      <div class="phase-summary-grid">
        <section class="delta-card">
          <h4>共同点</h4>
          <p>${phase.same}</p>
        </section>
        <section class="delta-card">
          <h4>关键差异</h4>
          <p>${phase.diff}</p>
        </section>
      </div>
    `;
  }

  return `
    <div class="phase-chain-grid">
      ${phase.summaryCards
        .map(
          (card, index) => `
            <section class="delta-card phase-chain-card">
              <span class="phase-chain-index">${String(index + 1).padStart(2, "0")}</span>
              <h4>${card.title}</h4>
              <p>${card.body}</p>
            </section>
          `,
        )
        .join("")}
    </div>

    <div class="phase-summary-grid">
      <section class="delta-card">
        <h4>共同点</h4>
        <p>${phase.same}</p>
      </section>
      <section class="delta-card">
        <h4>关键差异</h4>
        <p>${phase.diff}</p>
      </section>
    </div>
  `;
}

function renderDiagramLanes(diagrams) {
  if (!diagrams?.length) {
    return "";
  }

  return `
    <section class="phase-diagram-section">
      <div class="phase-compare-head">
        <h4>一眼先看结构图</h4>
      </div>
      <div class="diagram-lane-grid">
        ${diagrams
          .map(
            (diagram) => `
              <article class="diagram-lane">
                <header class="diagram-lane-head">
                  <strong>${diagram.label}</strong>
                  <p>${diagram.lead}</p>
                </header>
                <div class="diagram-node-row">
                  ${diagram.nodes
                    .map(
                      (node, index) => `
                        <div class="diagram-node-wrap">
                          <section class="diagram-node">
                            <span class="diagram-node-tag">${node.tag}</span>
                            <h5>${node.title}</h5>
                            <p>${node.body}</p>
                          </section>
                          ${
                            index < diagram.nodes.length - 1
                              ? `<div class="diagram-arrow" aria-hidden="true">→</div>`
                              : ""
                          }
                        </div>
                      `,
                    )
                    .join("")}
                </div>
                <p class="diagram-note">${diagram.note}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderFlowMaps(flowMaps) {
  if (!flowMaps?.length) {
    return "";
  }

  return `
    <section class="phase-flow-section">
      <div class="phase-compare-head">
        <h4>先把关系链看全</h4>
      </div>
      <div class="flow-map-grid">
        ${flowMaps
          .map(
            (map) => `
              <article class="delta-card flow-map-card">
                <header class="flow-map-head">
                  <strong>${map.label}</strong>
                  <p>${map.lead}</p>
                </header>
                <div class="flow-step-grid">
                  ${map.steps
                    .map(
                      (step, index) => `
                        <section class="flow-step-card">
                          <span class="phase-chain-index">${String(index + 1).padStart(2, "0")}</span>
                          <h5>${step.title}</h5>
                          <p>${step.body}</p>
                        </section>
                      `,
                    )
                    .join("")}
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderMappingSection(title, rows) {
  if (!rows?.length) {
    return "";
  }

  return `
    <section class="phase-compare-section">
      <div class="phase-compare-head">
        <h4>${title}</h4>
      </div>
      <div class="phase-compare-grid">
        ${rows
          .map(
            (row) => `
              <article class="mapping-row">
                <div class="mapping-head">
                  <header>${row.title}</header>
                  <p>${row.role}</p>
                </div>
                <div class="compare-columns">
                  <section class="compare-column">
                    <span class="compare-label">Claude Code</span>
                    <p>${row.cc}</p>
                  </section>
                  <section class="compare-column">
                    <span class="compare-label">${OPENCLAW_RUNTIME}</span>
                    <p>${row.oc}</p>
                  </section>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderCompareSection(title, rows) {
  if (!rows?.length) {
    return "";
  }

  return `
    <section class="phase-compare-section">
      <div class="phase-compare-head">
        <h4>${title}</h4>
      </div>
      <div class="phase-compare-grid">
        ${rows
          .map(
            (row) => `
              <article class="compare-row">
                <header>${row.title}</header>
                <div class="compare-columns">
                  <section class="compare-column">
                    <span class="compare-label">Claude Code</span>
                    <p>${row.cc}</p>
                  </section>
                  <section class="compare-column">
                    <span class="compare-label">${OPENCLAW_RUNTIME}</span>
                    <p>${row.oc}</p>
                  </section>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderConceptInventory(items) {
  if (!items?.length) {
    return "";
  }

  return `
    <section class="phase-concepts">
      <div class="phase-compare-head">
        <h4>相关概念先列全</h4>
      </div>
      <div class="concept-grid">
        ${items
          .map(
            (item) => `
              <article class="concept-card">
                <header>${item.name}</header>
                <p>${item.body}</p>
                <div class="concept-columns">
                  <section class="concept-column">
                    <span class="compare-label">Claude Code</span>
                    <p>${item.cc}</p>
                  </section>
                  <section class="concept-column">
                    <span class="compare-label">${OPENCLAW_RUNTIME}</span>
                    <p>${item.oc}</p>
                  </section>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderPhase(phase) {
  return `
    <article
      class="phase-card"
      id="phase-${phase.id}"
      data-phase-id="${phase.id}"
    >
      <div class="phase-head">
        <div>
          <p class="phase-index">${phase.number}</p>
          <h3>${phase.title}</h3>
          <p class="phase-summary-line">${phase.summary}</p>
        </div>
        <div class="chip-row">
          ${LOOP_STEPS.find((step) => step.id === phase.id).concepts
            .map((concept) => `<span class="chip">${concept}</span>`)
            .join("")}
        </div>
      </div>

      ${renderNarrativeBlock(phase)}

      ${renderDiagramLanes(phase.diagramLanes)}

      ${renderFlowMaps(phase.flowMaps)}

      ${renderSummaryCards(phase)}

      ${renderMappingSection("这些词不要混在一起", phase.mappingRows)}

      ${renderConceptInventory(phase.conceptInventory)}

      ${renderCompareSection("四个问题先答清", phase.questionRows)}

      ${renderCompareSection("匹配场景", phase.scenarioRows)}

      <div class="code-grid">
        <article class="code-panel">
          <header>
            <strong>${phase.ccHeader}</strong>
            <span>源码对齐伪代码</span>
          </header>
          <pre><code>${escapeHtml(phase.ccCode)}</code></pre>
        </article>
        <article class="code-panel">
          <header>
            <strong>${phase.ocHeader}</strong>
            <span>源码对齐伪代码</span>
          </header>
          <pre><code>${escapeHtml(phase.ocCode)}</code></pre>
        </article>
      </div>

      <div class="runtime-grid">
        <article class="runtime-panel">
          <header>Claude Code 这一层看什么</header>
          ${renderList(phase.ccPoints)}
        </article>
        <article class="runtime-panel">
          <header>${OPENCLAW_RUNTIME} 这一层看什么</header>
          ${renderList(phase.ocPoints)}
        </article>
      </div>

      <div class="comment-box">
        <strong>点评</strong>
        <p>${phase.comment}</p>
      </div>

      <div class="source-list">
        ${phase.sources
          .map(
            (source) => `
              <a
                class="source-link"
                href="${source.url}"
                target="_blank"
                rel="noreferrer"
              >
                <strong>${source.title}</strong>
                <span>${source.note}</span>
              </a>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderPhaseList() {
  const node = document.getElementById("phase-list");
  if (!node) return;
  node.innerHTML = PHASES.map(renderPhase).join("");
}

function renderAppendix() {
  const node = document.getElementById("appendix-grid");
  if (!node) return;

  node.innerHTML = APPENDIX.map(
    (item) => `
      <article class="appendix-card">
        <span class="appendix-tag">${item.group}</span>
        <h3>${item.title}</h3>
        <p>${item.summary}</p>
        <a
          class="appendix-link"
          href="${item.url}"
          target="_blank"
          rel="noreferrer"
        >
          打开源码
        </a>
      </article>
    `,
  ).join("");
}

function setActivePhase(id) {
  if (!id) return;

  document.querySelectorAll("[data-phase-link]").forEach((node) => {
    node.classList.toggle("is-active", node.dataset.phaseLink === id);
  });

  document.querySelectorAll("[data-phase-id]").forEach((node) => {
    node.classList.toggle("is-active", node.dataset.phaseId === id);
  });
}

function resolvePhaseFromHash() {
  const hash = window.location.hash;
  if (!hash.startsWith("#phase-")) return LOOP_STEPS[0].id;
  return hash.replace("#phase-", "");
}

function bindPhaseLinks() {
  document.querySelectorAll("[data-phase-link]").forEach((node) => {
    node.addEventListener("click", () => {
      setActivePhase(node.dataset.phaseLink);
    });
  });

  window.addEventListener("hashchange", () => {
    setActivePhase(resolvePhaseFromHash());
  });

  setActivePhase(resolvePhaseFromHash());
}

renderLoopMap();
renderCoreLoop();
renderPyramid();
renderSkeletons();
renderPhaseList();
renderAppendix();
bindPhaseLinks();
