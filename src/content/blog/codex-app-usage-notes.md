---
title: "Codex App 用久以后,我留下的这些使用习惯"
description: "功能确实前沿,客户端也确实不省心.这是一篇写给刚开始使用 Codex 的经验分享:怎么放项目、怎么拆线程、怎么记笔记,以及什么时候该叫子代理帮忙."
pubDate: 2026-07-27
updatedDate: 2026-08-17
cover: "/blog-covers/cover-07.webp"
tags: ["Codex", "OpenAI", "AI Agent", "AGENTS.md", "Development"]
category: "tech"
---

先直说,不绕弯子

Codex App 的能力确实很前沿.在同类harness中,总是会有一些先进功能,比如 Computer Use, Browers Use,让模型跳出命令行,通过工具规范直接与电脑互动.

但是,作为 OpenAI 这种大厂推出的官方编程工具,它现在还是太拉了

Bug 满天飞、性能优化不怎么样、偶尔会出现反人类的交互设计,还有一些很奇怪的门控小巧思.最近越来越多 ChatGPT 相关能力也在往同一个产品壳里塞,我能理解他们想把功能做完整,但实际使用起来的体感就是越来越臃肿.有时候新功能还没用上,先得研究为什么我的按钮不见了、权限被挡了,或者同一个能力为什么在另一个入口里才能用.

![图片描述](/blog-assets/codex-app-usage/4.webp)

当然,我一边骂还是一边在用

因为只看“能帮我把项目做到什么程度”,Codex App 目前确实很强.要是想把它用得舒服一点,默认的一些设置肯定是不够的.下面这些习惯不是官方标准答案,而是我在长时间会话、多任务项目和多次上下文事故以后慢慢留下来的经验.

本文基于 **2026 年 8 月 17 日** 的使用体验整理.Codex App 更新很快,具体按钮、门控和内部文件格式以后都可能变化.

## 先把项目放在找得到的地方

如果一个线程只是临时问两句话,默认目录倒也无所谓

但只要准备长期使用,或者会生成代码、图片、文档、测试产物,我都建议先给它一个单独的工作目录.最好一个长期项目一个目录,名字只要起的你能记住就行,关键是过几个月后你还能看懂里面放的是什么,也知道什么可以备份、什么不能乱删.

~~不要什么都让它往类似下面这种默认位置里拉💩：~~

```
C:\Users\你的用户名\Documents\Codex
```

刚开始看不出问题.等你积累了一堆项目副本、临时素材、预览产物、依赖目录和不知道属于哪个会话的文件,再碰上一次清理 C 盘,你就可以慢慢享受了.

![图片描述](/blog-assets/codex-app-usage/2.webp)

我的习惯是一个长期项目对应一个明确目录,例如：

```
D:\Projects\个人博客
D:\Projects\AstrBot插件
D:\Writing\论文项目
```

## 一个线程最好只聊一类事情

~~不要在同一个线程里上午写论文,下午改博客,晚上再让它帮你写情书~~

GPT 的长上下文能力已经很强了,但上下文被不同任务反复污染以后,它也遭不住.前一个任务的术语、路径、格式要求和语气偏好,都有可能在后面的回答里偷偷冒出来.

最简单的判断方式是：这些内容是否共享同一批文件、同一套背景和同一个最终目标？

如果答案是否定的,就新开线程

同一个项目内部当然可以持续聊.同一个博客的首页、文章页、播放器和部署本来就会互相影响,放在一个长期线程里没有任何问题.虽然写论文和博文时都需要用 Markdown语法,但它们之间并没有什么关联.

所以线程不是越长越厉害.能在多轮对话中持续继承有效背景才有意义,只继承噪声就不是什么优点了.

## 给模型定下规矩,让它知道在这台机器上该干什么不该干什么

工作人员在岗位上需要做好自己这一岗位应尽的责任. `AGENTS.md`就像一份员工培训手册,在正式开工前,模型都会读取其中的内容作为第一准则,但实际的表现还与模型的指令遵循能力/`AGENTS.md`的表述质量有关.

来给大家展示一下我自己总结的一份`AGENTS.md`:

<details class="article-source-foldout">
<summary><span>展开查看完整 <code>AGENTS.md</code></span><small>项目开工、文件安全、子代理与资源规则</small></summary>

```AGENTS.md
你是我的编程助手。以下为硬规则；与更高优先级指令冲突时，以更高优先级指令为准。

## 开工与记录

1. 每个涉及项目工作的回合，在诊断、计划、写入或测试前，先确认 Shell、工作目录和任务范围；若为 Git 仓库，同时检查 `git status --short`、当前分支和 HEAD，不得影响用户的无关修改。
2. 每轮开始前必须阅读最近的 `AGENTS.md` 和已有的 `DEVELOPMENT_NOTES.md`、`HANDOFF.md` 或等价笔记，长笔记可用 `rg` 定位相关段落，但禁止只写不读。确认根因、改变方案、完成测试、真人验收、备份、回滚、提交或推送后及时更新；复杂长期项目自动使用 `$maintain-development-notes`。纯聊天和与项目无关的短查询可跳过。

## Git 检查点

3. Git 项目必须保持可恢复检查点。修改已验收功能、视觉/媒体、状态机、全局配置、多文件逻辑，或开始第二轮返工前，先确认有效恢复点。
4. 优先创建只包含本任务文件的本地提交；工作区含无关修改或暂不适合提交时，先在仓库外生成 `git diff --binary` 补丁或等价原样备份并报告路径。稳定里程碑或真人验收后及时建立本地检查点，除非用户明确要求，否则不得推送。
5. 禁止把无关文件、未跟踪素材或他人修改混入检查点；避免影响整个工作区的 `git stash`，未经授权禁止 `git reset --hard`、`git checkout --` 等破坏性操作。回滚前核对目标提交、备份和文件范围，不得凭记忆猜测旧状态。

## 子代理

6. 提示词长短不代表复杂度。主线程最多先做一次有限预检；若需要跨两个以上模块/三个以上文件、读取长文件或大量检索、追踪异步生命周期/状态机/竞态、处理浏览器/视觉/媒体、根因不明、已有失败返工，或两步内仍未定位，必须停止独自扩展检索，在 `commentary` 说明原因并升级，不得静默埋头苦干。
7. 升级路径：`luna` 是大范围快速吞吐层，负责文件树/路径/符号/行号定位、长文件与日志压缩、资源整理，也负责浏览器和明确授权的低风险写入/媒体处理；只读吞吐可用较低 reasoning effort，浏览器或写入使用 `luna max`。中等难度方案与审查使用 `terra`，高难度架构、复杂竞态、安全风险或独立反方意见使用 `sol high`；主线程原则上不调用浏览器，`terra`/`sol` 不写文件、不调用浏览器，媒体只返回路径和结论，不返回 base64。
8. 每个子代理只负责一个小任务，必须限定输入、输出、停止条件和禁止扩展项。默认只允许一级子代理，并行通常限制为 2-4 个；探索代理只读，禁止并行写同一文件。
9. 子代理首次交付不合格时最多定向重试一次；仍不合格或已无提升空间时，主线程立即接管。主线程负责最终方案与验收，收束结论、证据、文件/行号和风险后及时关闭子代理。
10. 本地图片、截图或视觉素材送往上游视觉模型、浏览器工具或子代理前，必须先检查像素尺寸、单文件体积和批量总量；原图保留本地，只上传压缩审查副本。默认最长边不超过 2048px，优先使用 WebP/JPEG 质量 80-85，单次总量控制在 12MB 内，超过则分批；透明通道或像素级细节改用无损副本或局部裁切。禁止原样批量上传高分辨率图片，也禁止把图片 base64 塞入线程。

## 环境与文件安全

11. 默认环境为中国大陆网络、Windows、PowerShell 或 Git Bash。执行前识别 Shell；PowerShell 禁止使用 bash 专属写法。命令失败后禁止原样重跑，必须分析原因并换用等价命令；所有路径必须加引号。
12. 下载失败时只为当前命令临时使用镜像或代理，禁止擅自修改全局 npm、pip、git、代理或默认 Shell。新增工具需说明来源、版本、范围和风险并获许可，用户已授权的除外。
13. 中文文件可能是 UTF-8、GBK 或 CP936；乱码不等于损坏。禁止擅自转码、重写或格式化，新文件默认 UTF-8 without BOM，修改旧文件保持原编码、换行和结构。修改必须最小化并保持单一写入所有者，不删除用户内容、不做无关重构。
14. 删除、覆盖、批量修改/转码、全局配置、编码不确定、图片版本不清或主观视觉判断前必须询问，用户已明确授权当前操作时无需重复询问。UI 与图片判断要保守，不得把旧图、临时图或错图当最终结果。

## 资源与沟通

15. 主线程只保留结论、关键证据、文件位置和下一步，不塞入全文、base64、长日志或临时推理。禁止并行运行多个重型任务，Cargo 默认 `-j 2`；重型命令前先告知，结束后确认进程退出。用户报告卡顿时立即停止新增重型任务并先收束进程。默认用中文简洁回复，说明原因、改动、验证、备份/提交状态和待验收风险
```

</details>

这份`AGENTS.md`  就是要求模型先看清再动手, 它不清楚的本机网络环境/系统设置我是已经写好给它了,剩下的就看它的自觉性了.

## 给项目留一张能接住上下文的便签

单个长项目最怕的是,多个线程共同接管,但它们并不共享同一份上下文,这个项目中每新开一个线程,它们并不会有其他线程中多轮任务得出的结论.

聊到几百轮以后,哪些文件不能碰、哪个方案已经失败、当前改到哪里、有没有留下能回去的版本,如果全靠模型从压缩了无数次的上下文里猜,迟早会出事.所以我会要求模型在项目里写一份 开发笔记 `DEVELOPMENT_NOTES.md`.

<details class="article-source-foldout">
<summary><span>展开查看开发笔记 Skill 原文</span><small>开发笔记何时读取、何时更新,以及应该记录什么</small></summary>

```SKILL
Maintain Development Notes
保持开发记录
Preserve verified project reality so the current agent and future agents can recover context without repeating investigations, ignoring user preferences, retrying rejected approaches, confusing branches, or losing safety constraints. Treat a development note as operational memory: read it before it should influence work, then update it when verified reality meaningfully changes.
保留经过验证的项目现实状态，这样当前的代理以及未来的代理就能在不重复调查的情况下恢复上下文信息。同时，可以忽略用户的偏好设置，重新尝试失败的方法，避免混淆的分支，以及失去安全约束条件等问题。将开发笔记视为操作性记忆：在它影响工作之前先读取这些信息，然后在现实状态发生有意义的变化时再进行更新。

Apply separate read and write gates
分别设置读写门限
Apply the read gate before the write gate.
在写入门之前，先应用读取门。

Read gate  阅读门
At the start of every project-work turn, re-read the latest applicable AGENTS.md and the relevant parts of any development or handoff note before diagnosing, planning, choosing a solution, implementing, testing, resuming work, changing direction, installing, releasing, or handing off.
在每个项目周期的开始阶段，请重新阅读最新的相关文档以及任何开发或交接文件中涉及的部分内容。在进行诊断、规划、选择解决方案、实施、测试、继续工作、改变方向、安装、发布或交接之前，请先仔细阅读这些文档。

The read gate applies even when the current task is small and will not justify a note update. A small task can still depend on old decisions, user preferences, or a rejected approach.
即使当前任务规模较小，也不需要进行更新。因为小型任务仍然可能依赖于旧的决策、用户偏好或已被否决的方法。

Skip reading only for casual conversation, general advice, or work clearly unrelated to the note's scope.
对于用于闲聊、提供一般建议或与笔记内容无关的工作内容，可以跳过这部分内容阅读。

Write gate  写入门
Assess the write gate silently before creating or updating a note.
在创建或更新笔记之前，请先安静地评估一下写作的门槛。

Create or adopt a development note when any hard trigger applies:
当遇到任何关键时机时，应创建或采用一份发展计划：

The user explicitly requests a development note or durable handoff record.
用户明确请求一份开发记录或持久性的交接文档。
Work spans multiple threads, repositories, worktrees, or PRs.
工作可以分布在多个线程、仓库、工作节点或公共 pull 请求中。
Work includes a risky local installation, package replacement, backup, rollback, migration, or production-like operation.
工作内容包括一些具有风险性的本地安装、软件包替换、备份、回滚、迁移，以及类似生产环境的操作。
The agent is about to switch away from a substantial unfinished workstream that must be resumed later.
该代理即将离开当前那个尚未完成的重要任务流程，该任务需要稍后继续完成。
Otherwise, create a note only when at least two complexity signals apply:
否则，只有在至少有两个复杂性信号适用时才创建笔记。

Three or more active feature, bug, research, release, or publication tracks exist.
存在三个或更多处于活动状态的功能、漏洞、研究、发布或出版物相关跟踪。
Two or more branches, worktrees, deployment variants, or patch stacks must remain distinct.
两个或更多的分支、工作树、部署版本或补丁堆栈必须保持独立。
The thread repeatedly switches between tasks or returns to earlier tasks.
这个线程会反复在各个任务之间切换，或者返回到之前的任务中。
Important state depends on exact paths, commits, versions, hashes, CI runs, settings, or external review status.
重要的状态取决于具体的路径、提交记录、版本信息、哈希值、持续集成运行情况、设置参数，以及外部审核的进展。
Multiple failed or superseded approaches could be repeated without a record.
多种失败或已被取代的方法可以重复使用，而无需记录这些尝试。
The conversation is long enough that compaction or handoff is likely to lose operational context.
这段对话的时间足够长，以至于在压缩或切换流程时，可能会丢失一些操作上下文信息。
Different artifacts have different ownership, safety boundaries, or release plans.
不同的物品有着不同的所有权、安全保护规定或处置方案。
Do not create or update a note solely for:
不要只是为了自己而创建或更新笔记：

Casual conversation or general advice.
随意的聊天或一般的建议。
A one-off question with no continuing implementation state.
这是一个一次性问题，不会持续实施下去。
A small, self-contained change with one clear branch and no expected follow-up.
这是一个小型的、独立的变更，只有一个明确的分支，并且预计不会有其他后续操作。
Short read-only exploration that produces no durable decision or risk.
这种简短的只读探索方式并不会产生任何持久性的决策或风险。
Routine command output that is already captured adequately by source control or CI.
那些已经通过源代码控制或集成工具得到充分捕获的常规命令输出。
If the write gate is not met, continue without creating or updating a note. Still use any context recovered through the read gate.
如果未能满足写入条件，则继续操作，无需创建或更新笔记。仍然可以使用通过读取操作获得的任何上下文信息。

Discover and read before acting
在行动之前，先去发现并阅读吧。
Search the workspace for existing files such as DEVELOPMENT_NOTES.md, DEV_NOTES.md, CODEX_DEV_NOTES.md, HANDOFF.md, or a clearly equivalent project record.
在工作区中搜索现有的文件，例如 DEVELOPMENT_NOTES.md 、 DEV_NOTES.md 、 CODEX_DEV_NOTES.md 、 HANDOFF.md 等，或者与这些文件相对应的一些项目记录。
Read applicable AGENTS.md instructions, then read the note's current snapshot, non-negotiable constraints, active workstreams, known risks, and immediate next actions.
请阅读相关的 AGENTS.md 说明，然后了解该项目的当前状况、不可协商的约束条件、当前工作进展、已知风险以及接下来的紧急行动。
Search the note for terms connected to the current task: symptoms, error text, feature names, paths, symbols, branches, tools, protocols, or user language.
在笔记中查找与当前任务相关的术语：症状、错误文本、功能名称、路径、符号、分支、工具、协议，或者用户使用的语言。
Recover six kinds of operational memory before choosing an approach:
在选择方法之前，先恢复六种类型的操作内存：
the same or a related problem or scenario;
相同或类似的问题或情境；
user preferences and non-negotiable constraints;
用户偏好以及不可协商的约束条件；
rejected, failed, superseded, or unsafe approaches and why they were rejected;
被拒绝、失败、被替代或不安全的方法，以及为何会拒绝这些方法；
the overall product, architecture, and release direction;
整个产品的架构、设计以及发布方向；
the last verified authoritative state and supporting evidence;
最后的权威验证结果及支持性证据；
unresolved risks, pending validation, and ordered next actions.
未解决的风险、仍需验证的事项，以及接下来需要执行的步骤。
Reuse the authoritative note. Do not create a competing note merely because its filename differs from the preferred name.
请重复使用这个权威的文档。不要因为文件的名称与首选名称不同就创建新的文档。
If multiple notes exist, identify their responsibilities and read the authoritative source for each relevant fact. Synchronize them only when their documented roles require it.
如果存在多个角色或职责，请明确他们各自的责任范围，并查阅相关事实的权威来源。只有在角色职责需要的时候，才进行相关的同步处理。
If authority is ambiguous or notes contradict each other, verify reality before acting. Ask the user only when repository evidence cannot resolve ownership safely.
如果权限不明确，或者各种信息相互矛盾，那么在采取行动之前，请先确认实际情况。只有在这些证据无法明确确定所有权的情况下，才向用户提出相关建议。
For long notes, start with the current snapshot and use targeted search (rg when available). Do not load or repeat the entire history when only a small section is relevant.
对于较长的记录，可以从当前的快照开始，并使用目标搜索功能（如果可用，可以使用 rg ）。当只有一小部分内容相关时，无需加载或重复整个历史记录。

Choose the note topology  选择笔记拓扑结构
For one growing repository, use one root-level DEVELOPMENT_NOTES.md unless the repository already has an established equivalent.
对于一个正在增长的仓库来说，建议使用一个根级别的 DEVELOPMENT_NOTES.md 标签，除非该仓库已经存在类似的标签。
For a large multi-repository or multi-product workspace, use a short workspace recovery summary plus one canonical detailed engineering note only when both roles provide real value.
对于规模较大、包含多个存储库或多种产品的工作环境来说，只有当两种角色都能提供实际价值时，才需要同时提供简短的工作环境恢复说明以及一份详细的工程说明。
Define the responsibility of every note near its top. Avoid maintaining two independent copies of the same history.
明确每个注释在顶部附近的责任范围。避免同时维护两份相同的历史记录。
Keep user-facing documentation separate from private agent recovery notes unless the user explicitly wants a public document.
将面向用户的文档与私密的代理恢复说明分开存放，除非用户明确希望拥有公开的文档。
Read references/note-schema.md before creating a new note or substantially restructuring an existing one.
在创建新的笔记或大幅修改现有的笔记之前，请先阅读参考文档/note-schema.md。

Reconcile memory with reality before acting or writing
在行动或写作之前，先确保记忆与现实相符。
Treat conversation history and development notes as leads, not as substitutes for current evidence.
将对话记录和讨论笔记视为线索，而不是替代当前的证据。

Verify relevant repository path, branch, HEAD, dirty state, remotes, and worktree role.
请确认相关仓库的路径、分支、HEAD 状态、脏状态、远程节点以及工作树角色是否正确。
Verify PR, issue, CI, release, installation, version, backup, or hash state when it matters and tools permit.
在必要的时候验证 PR、发布、确认、发布状态、安装情况、版本信息、备份情况或哈希值状态。当工具允许时，也进行相关的操作。
Distinguish implemented, tested, human-validated, published, merged, installed, pending, and superseded.
区分 implemented 、 tested 、 human-validated 、 published 、 merged 、 installed 、 pending 和 superseded 。
Compare a proposed approach with previously rejected or superseded approaches. Do not repeat one unless a relevant premise changed, and record that changed premise.
将所提出的方案与之前被拒绝或已经淘汰的方案进行比较。除非相关的前提发生了变化，否则不要重复使用同一个方案，并记录下这一变化的前提。
Honor recorded user preferences and overall direction unless the user has changed them or verified reality makes them impossible.
Honor 会记录用户的偏好和整体方向，除非用户已经改变了这些设置，或者实际情况使得这些设置不再适用。
If live evidence invalidates the note, correct the current snapshot before relying on it for downstream decisions.
如果现场证据能够证明那份备忘录是无效的，那么在依赖它来做出后续决策之前，应先修正当前的状况。
Record uncertainty explicitly. Never turn an assumption into a completed status.
明确表达出存在的不确定性。永远不要将某种假设视为已经确定的事实。
Never copy secrets, API keys, auth files, tokens, private prompt history, or unnecessary personal data into notes.
切勿将秘密密钥、API 密钥、认证文件、令牌、私有提示历史记录以及不必要的个人数据复制到笔记中。
Write for recovery  为康复而写作
Put the current source of truth before long history. Include only information that changes how a future agent should act:
请将当前的信息来源置于历史背景之前。只包含那些能够影响未来代理人行为的信息。

Project purpose, user priorities, and non-negotiable constraints.
项目的目标、用户的优先级以及不可协商的约束条件。
Active workstreams and boundaries between them.
活跃的工作流程以及它们之间的界限。
Authoritative repositories, paths, branches, worktrees, commits, PRs, and installed artifacts.
权威的存储库、路径、分支、工作树、提交、 pull 请求以及已安装的工件。
Root cause and behavioral evidence for important bugs.
重要漏洞的根本原因及相关行为表现。
Key files, symbols, hooks, protocols, and design decisions.
关键文件、符号、钩子函数、协议以及设计决策。
Tests run, exact outcomes, human validation, and remaining gates.
测试已经进行完毕，结果已经明确，还需要进行人工验证，之后还有剩余的步骤需要完成。
Known risks, unresolved limitations, safety incidents, and rollback information.
已知的风险、尚未解决的缺陷、安全事件以及系统回退的相关信息。
Superseded approaches labeled as historical, including why they failed.
被取代的方法被称为“历史性的方法”，其中包括了这些方法为何会失败的原因。
Immediate next actions in dependency order.
按依赖顺序列出接下来的立即行动事项。
Use concise English when it makes technical recovery clearer. Otherwise follow the existing note language or the user's preference. Do not translate an established note merely for consistency.
在需要清晰表达技术细节的情况下，应使用简洁明了的英语。否则，应遵循现有的注释语言或用户的偏好。不要为了一致性而翻译那些已经明确表述的注释内容。

Prefer workspace-relative paths for portable source references. Use absolute paths for local worktree roles, installations, backups, or other machine-specific facts where ambiguity would be dangerous.
建议使用与工作空间相关的路径来引用可移植的源代码。而对于本地的工作树、安装文件、备份文件等需要绝对路径才能准确引用的内容，或者那些可能导致歧义的情况，则应使用绝对路径。

Update at meaningful checkpoints
在重要的检查点进行更新
Update the note after:
请在以下时间后更新此笔记：

Confirming a root cause or invalidating an earlier diagnosis.
确认了根本原因，或者否定了之前的诊断结果。
Changing architecture, ownership boundaries, or implementation strategy.
改变架构、所有权边界或实施策略。
Creating, rebasing, publishing, reviewing, merging, closing, or replacing a branch or PR.
创建、重新定位、发布、审核、合并、关闭或替换某个分支或 Pull 请求。
Completing tests, human acceptance, installation, backup, rollback, or release work.
完成测试、获得用户认可、安装工作、创建备份、执行回滚操作，或者准备发布产品。
Discovering a safety incident, compatibility boundary, or repeated failure mode.
发现安全隐患、兼容性问题，或重复出现的故障模式。
Switching to another substantial workstream or preparing a handoff.
转向另一个重要的工作领域，或者为交接做好准备。
Do not log every command, file read, transient error, or speculative thought. Summarize evidence and consequences.
不要记录每一个命令、文件读取操作、临时错误或随意的想法。只需总结这些行为的证据和后果即可。

Preserve history without preserving confusion
保留历史，同时避免造成混乱。
Update the current snapshot when reality changes.
当实际情况发生变化时，请更新当前的快照。
Keep useful historical evidence, but mark it superseded, historical, obsolete, or do not use.
保留那些有用的历史证据，但请将其标记为 superseded 、 historical 、 obsolete 或 do not use 。
Never leave an old path, branch, installed hash, or PR status presented as current after it changes.
永远不要离开原有的路径、分支、已安装的哈希值，以及被当作当前状态呈现的版本状态，因为这些元素在发生变化后可能会带来影响。
When a mistake caused data loss, downgrade, broken installation, or resource exhaustion, record the prevention rule prominently.
当错误导致数据丢失、性能下降、安装失败或资源耗尽时，务必将预防规则记录下来。
When two notes have summary/detail roles, update the detailed record first and then refresh the summary.
当两个音符具有主次关系时，应先更新详细的记录，然后再刷新摘要信息。
Finish with a note audit
最后进行笔记审核
Before ending substantial work, check that:
在结束大量工作之前，请确认以下几点：

Current paths, heads, versions, PR states, and next actions are accurate.
当前路径、状态、版本、优先级状态以及下一步操作都是准确的。
Completed work is not still listed as pending.
已完成的工作仍然没有被列为待处理状态。
Pending human or CI validation is not claimed as passed.
待人类或 CI 系统验证通过之前，不视为已通过。
No sensitive data entered the note.
该笔记中没有包含任何敏感数据。
The note remains useful for resuming work rather than becoming a raw transcript.
这份笔记仍然具有实用性，可以用来继续工作，而不必只是作为一份简单的文字记录。
Do not create commits or publish note changes unless the user requested that repository action or the note is intentionally part of the requested patch.
除非用户明确请求了相关操作，或者该修改确实是所请求补丁的一部分，否则不要创建提交或发布修改内容。
```

</details>

与 `AGENTS.md`不同的是,笔记更像是针对单个项目的运行日志,不同项目之间的笔记不互通.一个项目是 做博客,另外一个项目是 开发程序,你总不能让模型看着 开发程序的经验去 做博客吧.

而`AGENTS.md`呢,可以把它理解成用户给 Agent 留下的全局注意事项：机器的常用终端、网络环境、子代理使用规则等等.它的优先级肯定高于 单项目级的笔记,模型会优先从`AGENTS.md`中的硬规则出发来考虑单项目中的实际问题.

开发笔记的重点不要只放在“写下来”.

笔记如果从来不在开工前读,最后就只是一个看起来很认真的日志仓库.只写不读和只听不复习有什么区别? 真正有用的开发笔记是一轮一轮地跑下面这个循环：**读 → 验 → 做 → 回写**

### 第一步：读,先把已经知道的事情找回来

SKILL会要求模型在开始前先看项目原来的注意事项和开发笔记,尤其是和当前任务有关的部分.以前有没有遇过同类问题,用户有没有特别在意的地方,哪些方案已经被否决,上次测试到哪里,这些信息都比重新猜一遍有用.

### 第二步：验,把笔记和现实重新对上

笔记里的内容是线索,不是现实本身. 如果一个项目有着多线程会话的共同协作,那么笔记的真实性漂移是肯定会更容易出现的.

SKILL会要求模型在动手前先确认自己确实在正确的项目里,看看当前有没有别的线程遗留的修改,同时也要确认这次做的事情不会碰到无关内容.笔记说某个问题已经修好,但实际文件或页面显示另一回事时,模型就应该按照实际情况来进行判断,然后把笔记改正.

### 第三步：做,把范围、恢复点和验证一起带上

虽然我们已经有了项目笔记,是不是在一个任务内就可以放着模型做到底呢?

当然不是, 笔记只是一句简短的摘要,顶多记录一下当前的状态,并不涉及所有精确到每一行的代码/文件改动. 专业的事情还得用专业的工具,我们就需要让模型在一轮任务中的每个节点做一次Git检查点.

### 第四步：回写,只把下一次恢复真正需要的事实留下

确认根因、改了方案、跑完测试、做了备份或拿到人工验收以后,给笔记补一条真正有用的结果.写清楚改了什么、为什么改、哪些地方验证过、还有什么没完成就够了.

这肯定是不要求把整段聊天记录、几百行日志和当时的猜测全部原样复制进去.下一次需要的只有结论、关键文件、能回退到哪里和下一步该做什么.

这四步连起来以后,开发笔记才不是单向的备忘录.它在开工时阻止重复调查,在执行中保护现场,在结束时把新证据交给下一轮恢复.

## 决定好给模型多少权限了吗

既然都使用 Codex App 了,绝不可能只拿它来聊天吧. 真正的应用场景还是在于 模型 根据指令来进行文件的读取修改等工作. 而模型与电脑交互不像我们大多数场景使用键鼠,而是通过终端与命令(~~虽然 Computer Use 可以模拟鼠标点击,但是太低效了没什么必要~~).而终端这东西吧,哈哈, 有时候语法一写错/甚至只是 个别符号的使用错误都会导致操作误删文件.

![图片描述](/blog-assets/codex-app-usage/7.webp)

所以Codex App 内单个线程有着三种权限供你选择:

- 请求批准: 每一步操作前都会停下来问你行不行

- 帮我审批: 让另一个模型来替你审批

- 完全访问: 完全放开任由模型进行操作

所以问题就来了,请求审批 它问你每一步操作可不可以,先别说你自己能不能判断出来是否有害,一个长任务得要你审批上百次,付费上班何意味. 帮我审批 得额外消耗额度,且不保证完全100%审批正确. 完全访问: 虽然风险很大,但都玩 AI Agent 了,还怕它这一点出问题不成? 况且保持前文中的方案,就算不幸中的不幸出了问题,也有几条后路可以修复.

当然,出了问题也别来找我,至少我这大半年的完全访问是真没出现过事故.

## 子代理不是按任务描述长短来分

主线程用子代理时,很容易走到两个极端：要么主线程太自信觉得什么都能自己做,要么看见一个小问题就想把一堆代理全叫出来.

我在`AGENTS.md`中给主线程的子代理使用规则不是看任务描述有几行,而是看整个任务的真实流程会不会让主线程干很多脏活.例如要在很多文件里找一个入口、读很长的日志、检查很多图片、追一个多因素影响的问题时,这些都不适合让主线程独自做.

反过来,如果修改位置已经明确,只差一两步就能完成,那这种情况就适合主线程直接做.主子代理之间有沟通成本,没必要再把子代理再喊出来来应付规则.

~~(user: 1+1=?  agent:Planning to create sub-agents to discuss math problems...)~~

GPT5.6系列大概是这样的：

| 层级      | 价格  | 速率  | 判断能力与适合的工作                            |
| ------- | --- | --- | ------------------------------------- |
| `luna`  | 最低  | 最高  | 吞吐、定位、长文件和日志压缩、资源整理、浏览器、明确授权的低风险小范围写入 |
| `terra` | 居中  | 居中  | 中等难度方案比较、实现审查、明确 Bug 分析,以及边界独立的中等实现   |
| `sol`   | 最高  | 最低  | 架构判断、复杂竞态、安全风险和独立反方意见                 |

简单说就是价格 `luna < terra < sol`,速度 `luna > terra > sol`,判断能力通常也是 `luna < terra < sol`.所以问题的核心在于,别拿最慢最贵的sol去做简单重复重复的问题,你可能很有钱不在乎token费用,但时间你是无法只靠堆费用来节省的.

交给子代理的任务越小越好.告诉它要找什么、可以碰什么、不能碰什么、最后只需要回什么.一个代理只做一件清楚的事,结果回来以后由主线程判断能不能用.如果第一次结果不对,说明问题后最多可再让它修一次；如果还不行的话,就只能主线程亲自操刀了,否则你就会看到sol在给luna耐心的做一对一教学辅导,学费还是你自己的token.

### 主线程不推荐使用浏览器

这一条我说得更绝对些：无论怎么样都不建议主线程自己调用浏览器工具

主线程通常用的是最强也最慢的模型.浏览器却是一连串的动作：点击、等待、看状态、再点击.每一步都要来回一次,延迟会一层层叠起来,最后最简单的页面检查也能拖很久.

浏览器交给 `luna max` 更合适.主线程只要说清楚要打开哪里、看什么、什么结果算通过、碰到什么情况必须停下. `luna` 负责点击、悬浮、滚动、刷新和保存必要的截图.它每一步更快,用户也能更快看到页面到底发生了什么.

且浏览器通常会有着大量工具结构噪声返回,非常占用上下文,将浏览器交给 `luna` 也能节省你的token费用(二十五分之一sol价格的含金量)

如果你不在乎时间也不在乎token账单,下面有个更阴的因素,就注定了长会话中主线程是没法用浏览器工具的.

## 图片才是线程卡顿的真凶

我们在正常使用过程中,肯定会给模型发一些图片.但是,图片在对话里只出现一次,并不代表它在同一线程的后续对话中就不会被加载了.工具基本都是会以`Base64`的形式将图片返回给模型(Browers Use ,Computer Use,Imagen.... ),而模型通常只会看这张图一次,但这是标准的工具返回格式内包含的东西,所以每个线程的`Base64`都会一直堆积,直到你被这个线程卡到受不了为止.你可以理解为,当前这个窗口,需要同时加载几千张图片,然后还会继续累积.

更容易出事的不是只看一张普通截图,而是一次原样读取好几张高分辨率图片.几张 4K 原图、连续截图或图片处理中间结果一起进来,线程体积会很快膨胀；请求或工具载荷超过限制时,还可能直接撞上 `413 Payload Too Large`,连下一次请求都发不出去.

上下文压缩能总结文字交接摘要,但线程文件是一直往后写的,即使前面的东西在压缩后模型已经看不到了,但它还是会赖在线程文件里,除非你主动去清理这个线程.我处理过一条很长的会话,在备份并清理不再需要的 Base64 媒体数据以后,文件体积缩到了原来的大约五分之一.

处理方法为:新建一个空白线程,将需要被清理的线程id准备好,连同着id一并告诉它:

*"备份并清理id为XXXXX的线程文件中的Base64"*

但这里必须提醒一句：**这不是官方公开保证的稳定维护接口** ,只是社区中可信度较高的方法,但至少我也试过,很有用.

更可靠的办法还是从源头控制.原图始终留在本地,让模型在正式读取前先检查像素尺寸和文件体积,需要送去审查时再生成压缩副本

图片查找、截图和简单处理也不要都让主线程负责.交给 `luna` 这样的子代理后,让它承接工具返回的图片内容,最后只把真实图片路径、必要的尺寸信息和一句结论交回来.主线程仍然知道该看哪张图,却不会将图片原样永远写入线程文件中.

## 不要每次都等客户端被动压缩

很多人在同一个线程中会一直聊,直到 这个线程 自己触发被动压缩.能用是能用,但压缩发生的时间不一定合适.

比如一个复杂问题刚交付时,已经使用了大约 60% 的上下文.接下来准备开启另一个同项目的大任务,而客户端可能在接近 80% 时才开始被动压缩.这时候如果直接把新 Prompt 发出去,很可能做到一半才压缩,刚加入的新需求、旧问题的收尾和工具输出全挤在一起,可能会造成一定的注意力损失,即丢失原 Prompt 中的目标导致最终交付的质量不佳.

更稳妥的做法是：趁上一件事刚完成、状态最清楚的时候,确认这一轮已经走完开发笔记第四步的流程,直接 `/compact` 主动压缩当前会话,然后开始下一项任务.

具体的被动压缩百分比并不是 OpenAI 保证不变的固定阈值,不同版本和模型也可能不一样(甚至相同线程的不同任务也不一样).重点不是卡着 60% 或 80% 算命,而是把压缩放在**两个任务之间**,不要等它在任务中间突然发生.而且按照 Codex 的工作流程来说,每次模型的调用都是会上传上次压缩后到现在的所有上下文,也就是说,合理的主动压缩也可以减轻token消耗.

## 别把客户端问题都当成模型降智

Codex App 出问题时,第一反应很容易是模型怎么变笨了

![图片描述](/blog-assets/codex-app-usage/1.webp)

其实应用内部是有很多隐藏门控的,通常受到 网络环境/远端灰测 影响,有些功能不可用不一定是你做错了什么. 比如特殊插件就是吃你的地区门控,需要你自行解决网络问题.

SKILL以及插件的安装及更新,都是需要重启 App 的,通常不需要新开线程,你会经常看见,在安装或更新SKILL/插件后,你的某个线程会要求你新开线程,这个不用在意,你只需要重启 App 然后接着用那个线程就可以了.

## 最后还是得自己管项目

Vibe Coding 给人最大的错觉是: 模型已经能自己读代码、自己改、自己测试,所以用户只需要等结果

![图片描述](/blog-assets/codex-app-usage/6.webp)

短任务或许可以.但长项目如果你没有参与管理与重要决策判断,整个项目会暴露出越来越多的问题.

所以你仍然要决定项目中线程的分工、工作目录在哪里、哪些素材不能碰、什么时候该停下来确认,以及什么结果才算真的修好.Vibe Coding 远没有“一句话生成项目”那么酷,但背后由你进行管理决策的东西才是让长线程更加稳定的重要因素.

我把更完整的项目规则和开发笔记参考放在这里：[Yuimi-chaya/codex-development-guidelines](https://github.com/Yuimi-chaya/codex-development-guidelines)

既然短时间内改变不了客户端,那至少可以先把自己的目录、线程和上下文管明白.
