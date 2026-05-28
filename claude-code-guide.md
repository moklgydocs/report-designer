# Claude Code 完整使用指南

> 基于 https://code.claude.com/docs/ 官方文档整理，最后更新：2026-05-26

---

## 目录

1. [概述](#1-概述)
2. [安装与登录](#2-安装与登录)
3. [快速入门](#3-快速入门)
4. [CLI 命令参考](#4-cli-命令参考)
5. [权限模式](#5-权限模式)
6. [CLAUDE.md 与记忆系统](#6-claudemd-与记忆系统)
7. [Skills（技能）](#7-skills技能)
8. [Hooks（钩子）](#8-hooks钩子)
9. [MCP（模型上下文协议）](#9-mcp模型上下文协议)
10. [Subagents（子代理）](#10-subagents子代理)
11. [Settings（配置）](#11-settings配置)
12. [常见工作流](#12-常见工作流)
13. [最佳实践](#13-最佳实践)
14. [并行会话与 Worktree](#14-并行会话与-worktree)
15. [CI/CD 集成](#15-cicd-集成)
16. [多平台使用](#16-多平台使用)

---

## 1. 概述

Claude Code 是 Anthropic 推出的 **AI 驱动的编程助手**，能够读取代码库、编辑文件、运行命令，并与开发工具集成。它不是一个简单的聊天机器人，而是一个**代理式编码环境（agentic coding environment）**——可以自主完成编码任务，你在旁观察、引导或完全放手。

### 核心能力

| 能力 | 说明 |
|---|---|
| **自动化繁琐工作** | 编写测试、修复 lint 错误、解决合并冲突、更新依赖、编写发布说明 |
| **构建功能与修复 Bug** | 用自然语言描述需求，Claude 规划、编写跨文件代码并验证 |
| **创建提交和 PR** | 暂存变更、写提交信息、创建分支、开 PR；在 CI 中自动化 |
| **连接工具（MCP）** | 通过 Model Context Protocol 连接 Google Drive、Jira、Slack 等 |
| **自定义指令/技能/钩子** | CLAUDE.md 持久指令、自动记忆、可复用技能、生命周期钩子 |
| **运行代理团队** | 启动多个子代理、后台代理，或用 Agent SDK 构建自定义代理 |
| **管道/脚本/CLI 自动化** | 可组合的 Unix 哲学工具，管道日志、CI 运行、链式调用 |
| **定时任务** | Routines（Anthropic 托管）、桌面定时任务、`/loop` 会话内轮询 |

### 可用平台

| 平台 | 说明 |
|---|---|
| **终端 CLI** | 完整功能，推荐使用 |
| **VS Code** | 内联差异、@-mention、计划审查、对话历史 |
| **Cursor** | 通过扩展安装 |
| **JetBrains** | IntelliJ、PyCharm、WebStorm 等插件 |
| **桌面应用** | macOS / Windows 独立应用，可视差异、多会话 |
| **Web** | 浏览器访问 [claude.ai/code](https://claude.ai/code)，无需本地安装 |
| **Slack** | `@Claude` 集成 |

---

## 2. 安装与登录

### 原生安装（推荐，自动更新）

**macOS / Linux / WSL：**
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows PowerShell：**
```powershell
irm https://claude.ai/install.ps1 | iex
```

**Windows CMD：**
```cmd
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

> 原生安装**自动后台更新**。Windows 推荐安装 [Git for Windows](https://git-scm.com/downloads/win) 以使用 Bash 工具。

### Homebrew

```bash
brew install --cask claude-code        # 稳定版（约滞后1周）
brew install --cask claude-code@latest # 最新版（即时发布）
```

> Homebrew 安装**不会自动更新**，需手动 `brew upgrade claude-code`。

### WinGet

```bash
winget install Anthropic.ClaudeCode
```

### Linux 包管理器

支持 `apt`、`dnf`、`apk`，详见 [Advanced setup](https://code.claude.com/docs/en/setup)。

### 登录

首次运行 `claude` 会提示登录。支持以下账户类型：

- **Claude 订阅**（Pro / Max / Team / Enterprise）——推荐
- **Anthropic Console**（API 预付费额度）
- **第三方云提供商**（Amazon Bedrock、Google Vertex AI、Microsoft Foundry）

会话内切换账户：`/login`

---

## 3. 快速入门

### 启动会话

```bash
cd /path/to/your/project
claude
```

### 基本用法示例

```bash
# 了解项目
what does this project do?

# 修改代码
add a hello world function to the main file

# Git 操作
commit my changes with a descriptive message

# 修复 Bug
there's a bug where users can submit empty forms - fix it

# 重构代码
refactor the authentication module to use async/await

# 编写测试
write unit tests for the calculator functions

# 代码审查
review my changes and suggest improvements
```

### 核心命令速查

| 命令 | 说明 | 示例 |
|---|---|---|
| `claude` | 启动交互式会话 | `claude` |
| `claude "task"` | 启动会话并执行任务 | `claude "fix the build error"` |
| `claude -p "query"` | 一次性查询后退出 | `claude -p "explain this function"` |
| `claude -c` | 继续最近一次会话 | `claude -c` |
| `claude -r` | 恢复之前的会话 | `claude -r` |
| `/clear` | 清除对话历史 | `/clear` |
| `/help` | 显示可用命令 | `/help` |
| `exit` 或 Ctrl+D | 退出 Claude Code | `exit` |

### 新手提示

- **具体描述需求**：❌ "fix the bug" → ✅ "fix the login bug where users see a blank screen after entering wrong credentials"
- **分步指令**：将复杂任务分解为步骤
- **让 Claude 先探索**：在修改前先理解代码
- **快捷键**：`/` 查看命令和技能、`Tab` 补全、`↑` 历史记录、`Shift+Tab` 切换权限模式

---

## 4. CLI 命令参考

### 主要命令

| 命令 | 说明 |
|---|---|
| `claude` | 启动交互式会话 |
| `claude "query"` | 带初始提示启动 |
| `claude -p "query"` | SDK 模式查询后退出 |
| `cat file \| claude -p "query"` | 管道处理 |
| `claude -c` | 继续最近会话 |
| `claude -r "<session>" "query"` | 按 ID/名称恢复会话 |
| `claude update` | 更新到最新版本 |
| `claude install [version]` | 安装/重装（接受版本号如 `2.1.118`、`stable`、`latest`） |
| `claude auth login` | 登录（`--console` 用 Console 登录） |
| `claude auth logout` | 登出 |
| `claude auth status` | 显示认证状态 |
| `claude agents` | 打开代理视图，监控/调度后台会话 |
| `claude attach <id>` | 附加到后台会话 |
| `claude bg` / `claude --bg` | 后台启动会话 |
| `claude logs <id>` | 查看后台会话输出 |
| `claude mcp` | 配置 MCP 服务器 |
| `claude plugin` | 管理插件 |
| `claude project purge [path]` | 清除项目本地状态 |
| `claude remote-control` | 启动远程控制服务器 |
| `claude setup-token` | 生成长期 OAuth 令牌（CI/脚本用） |
| `claude stop <id>` | 停止后台会话 |

### 常用 CLI 标志

| 标志 | 说明 | 示例 |
|---|---|---|
| `--add-dir` | 添加额外工作目录 | `claude --add-dir ../apps ../lib` |
| `--agent` | 指定代理 | `claude --agent my-custom-agent` |
| `--allowedTools` | 免确认工具白名单 | `"Bash(git log *)" "Read"` |
| `--append-system-prompt` | 追加系统提示 | `claude --append-system-prompt "Always use TypeScript"` |
| `--bare` | 最小模式，跳过自动发现 | `claude --bare -p "query"` |
| `--bg` | 后台运行 | `claude --bg "investigate flaky test"` |
| `--chrome` | 启用 Chrome 浏览器集成 | `claude --chrome` |
| `--continue` / `-c` | 继续最近会话 | `claude -c` |
| `--dangerously-skip-permissions` | 跳过权限提示 | `claude --dangerously-skip-permissions` |
| `--debug` | 调试模式 | `claude --debug "api,mcp"` |
| `--effort` | 努力级别（low/medium/high/xhigh/max） | `claude --effort high` |
| `--model` | 指定模型 | `claude --model claude-sonnet-4-6` |
| `--name` / `-n` | 会话显示名 | `claude -n "my-feature-work"` |
| `--output-format` | 输出格式（text/json/stream-json） | `claude -p --output-format json "query"` |
| `--permission-mode` | 权限模式 | `claude --permission-mode plan` |
| `--print` / `-p` | 非交互模式 | `claude -p "query"` |
| `--resume` / `-r` | 恢复会话 | `claude -r auth-refactor` |
| `--system-prompt` | 替换整个系统提示 | `claude --system-prompt "You are a Python expert"` |
| `--tools` | 限制可用工具 | `claude --tools "Bash,Edit,Read"` |
| `--verbose` | 详细日志 | `claude --verbose` |
| `--worktree` / `-w` | 在隔离 git worktree 中启动 | `claude -w feature-auth` |
| `--max-turns` | 限制代理轮次 | `claude -p --max-turns 3 "query"` |
| `--max-budget-usd` | 限制 API 开销 | `claude -p --max-budget-usd 5.00 "query"` |

### 系统提示标志（4种）

| 标志 | 行为 | 用途 |
|---|---|---|
| `--system-prompt` | **替换**整个默认提示 | 完全自定义身份/行为 |
| `--system-prompt-file` | 用文件内容**替换** | 同上，从文件加载 |
| `--append-system-prompt` | **追加**到默认提示末尾 | 保持默认行为 + 额外规则 |
| `--append-system-prompt-file` | 用文件**追加** | 同上，从文件加载 |

> `--system-prompt` 和 `--system-prompt-file` 互斥。追加标志可与替换标志组合。

---

## 5. 权限模式

权限模式控制 Claude 是否在编辑文件、运行命令前请求确认。

### 可用模式

| 模式 | 免确认范围 | 适用场景 |
|---|---|---|
| `default` | 仅读取 | 入门、敏感工作 |
| `acceptEdits` | 读取 + 文件编辑 + 常见文件系统命令 | 迭代修改代码 |
| `plan` | 仅读取（规划但不执行） | 修改前先探索 |
| `auto` | 一切操作（带后台安全检查） | 长任务，减少确认疲劳 |
| `dontAsk` | 仅预批准的工具 | 锁定的 CI/脚本 |
| `bypassPermissions` | 一切操作（无安全检查） | 仅用于隔离容器/VM |

### 切换方式

- **会话中**：按 `Shift+Tab` 循环切换
- **启动时**：`claude --permission-mode plan`
- **默认设置**：在 settings.json 中设 `permissions.defaultMode`

### Plan 模式

Claude 研究并提出变更计划，**不执行任何修改**。进入方式：
- `Shift+Tab`
- `/plan` 前缀
- `claude --permission-mode plan`

计划审查选项：
1. 批准并在 auto 模式下开始
2. 批准并自动接受编辑
3. 批准并手动审查每次编辑
4. 继续规划并提供反馈
5. 用 Ultraplan 在浏览器中审查

> 按 `Ctrl+G` 可在文本编辑器中打开计划直接编辑。

### Auto 模式

让 Claude 无需权限提示即可执行。一个**独立分类器模型**在操作前审查，阻止：
- 超出请求范围的升级操作
- 针对未知基础设施的操作
- 受恶意内容驱动的操作

**要求**：Claude Sonnet 4.6+ 或 Opus 4.6+，仅 Anthropic API。

### 受保护路径

以下路径的写入在所有模式（bypassPermissions 除外）下都需要确认：

- **目录**：`.git`、`.vscode`、`.idea`、`.husky`、`.claude`
- **文件**：`.gitconfig`、`.bashrc`、`.zshrc`、`.mcp.json`、`.claude.json` 等

---

## 6. CLAUDE.md 与记忆系统

### CLAUDE.md vs 自动记忆

| | CLAUDE.md 文件 | 自动记忆（Auto Memory） |
|---|---|---|
| **谁写的** | 你 | Claude |
| **内容** | 指令和规则 | 学习和模式 |
| **范围** | 项目/用户/组织 | 每个仓库，跨 worktree 共享 |
| **加载量** | 每次会话 | 前 200 行或 25KB |

### CLAUDE.md 文件位置

| 范围 | 位置 | 用途 |
|---|---|---|
| **组织级** | macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md`，Windows: `C:\Program Files\ClaudeCode\CLAUDE.md` | IT/DevOps 管理的组织指令 |
| **用户级** | `~/.claude/CLAUDE.md` | 适用于所有项目的个人偏好 |
| **项目级** | `./CLAUDE.md` 或 `./.claude/CLAUDE.md` | 团队共享的项目指令（提交到 git） |
| **本地级** | `./CLAUDE.local.md` | 个人项目偏好（加入 `.gitignore`） |

### 编写有效的 CLAUDE.md

- **保持简洁**：目标 200 行以内
- **具体可验证**："Use 2-space indentation" 而非 "Format code properly"
- **使用 Markdown 结构**：标题和列表分组相关指令
- **导入文件**：`@path/to/file` 语法
- **初始化**：运行 `/init` 自动生成

### 路径作用域规则（.claude/rules/）

```markdown
---
paths:
  - "src/api/**/*.ts"
---

# API 开发规则
- 所有 API 端点必须包含输入验证
- 使用标准错误响应格式
```

### 自动记忆

- **启用/禁用**：`/memory` 中的切换，或设置 `autoMemoryEnabled`
- **存储位置**：`~/.claude/projects/<project>/memory/`
- **结构**：`MEMORY.md`（索引）+ 主题文件
- **加载**：前 200 行/25KB 在每次会话开始时加载

---

## 7. Skills（技能）

技能通过 `SKILL.md` 文件扩展 Claude 的能力。仅在调用时加载内容，不影响日常上下文消耗。

### 内置技能

| 技能 | 用途 |
|---|---|
| `/code-review` | 代码审查 |
| `/batch` | 批量操作 |
| `/debug` | 调试 |
| `/loop` | 循环/重复执行 |
| `/run` | 启动并驱动应用 |
| `/verify` | 构建并运行验证代码变更 |

### 创建自定义技能

**步骤 1：创建目录**
```bash
mkdir -p .claude/skills/summarize-changes
```

**步骤 2：编写 SKILL.md**
```yaml
---
description: 总结未提交的变更并标记风险项
---

## 当前变更

!`git diff HEAD`

## 指令

用两三个要点总结以上变更，然后列出风险项。
```

> `!`command`` 语法是**动态上下文注入**：运行命令并将输出替换到技能内容中。

**步骤 3：使用**
- 自动触发："What did I change?"
- 手动调用：`/summarize-changes`

### 技能存放位置

| 位置 | 路径 | 适用范围 |
|---|---|---|
| 个人 | `~/.claude/skills/<name>/SKILL.md` | 所有项目 |
| 项目 | `.claude/skills/<name>/SKILL.md` | 当前项目 |
| 插件 | `<plugin>/skills/<name>/SKILL.md` | 插件启用时 |

### 前置元数据参考

| 字段 | 说明 |
|---|---|
| `name` | 显示名，默认为目录名 |
| `description` | 功能描述（推荐填写） |
| `arguments` | 命名参数（`$name` 替换） |
| `disable-model-invocation` | `true` 阻止 Claude 自动加载 |
| `user-invocable` | `false` 从 `/` 菜单隐藏 |
| `allowed-tools` | 激活时免确认的工具 |
| `model` | 模型覆盖 |
| `context` | 设为 `fork` 在子代理中运行 |

### 变量替换

| 变量 | 说明 |
|---|---|
| `$ARGUMENTS` | 调用时传入的所有参数 |
| `$0`, `$1` | 位置参数 |
| `$name` | 命名参数 |
| `${CLAUDE_SESSION_ID}` | 当前会话 ID |
| `${CLAUDE_SKILL_DIR}` | 技能目录路径 |

---

## 8. Hooks（钩子）

钩子是在 Claude Code 生命周期特定点自动执行的**自定义命令、HTTP 端点或 LLM 提示**。

### 生命周期事件

| 事件 | 触发时机 |
|---|---|
| `SessionStart` | 会话开始或恢复 |
| `UserPromptSubmit` | 提交提示时 |
| `PreToolUse` | 工具调用执行前（**可阻止**） |
| `PostToolUse` | 工具调用成功后 |
| `PermissionRequest` | 权限对话框出现时 |
| `Stop` | Claude 完成响应时 |
| `SubagentStart/Stop` | 子代理启动/完成时 |
| `PreCompact/PostCompact` | 上下文压缩前后 |
| `SessionEnd` | 会话终止时 |

### 钩子类型

| 类型 | 说明 |
|---|---|
| `command` | 执行 Shell 命令 |
| `http` | 发送 HTTP POST |
| `mcp_tool` | 调用 MCP 服务器工具 |
| `prompt` | 发送提示到 Claude 模型进行评估 |
| `agent` | 启动子代理验证条件 |

### 配置示例

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(rm *)",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/block-rm.sh"
          }
        ]
      }
    ]
  }
}
```

### 退出码

| 退出码 | 含义 |
|---|---|
| **0** | 成功，解析 stdout |
| **2** | **阻止操作** |
| 其他 | 非阻止错误，继续执行 |

> **只有退出码 2 才能阻止操作。** 退出码 1 被视为非阻止错误。

### 钩子存放位置

| 位置 | 范围 |
|---|---|
| `~/.claude/settings.json` | 所有项目 |
| `.claude/settings.json` | 当前项目（可提交到 git） |
| `.claude/settings.local.json` | 当前项目（不提交） |
| 插件 `hooks/hooks.json` | 插件启用时 |
| 技能/代理前置元数据 | 组件激活时 |

---

## 9. MCP（模型上下文协议）

MCP 让 Claude Code 连接外部工具和数据源。

### 安装 MCP 服务器

**方式 1：远程 HTTP（推荐）**
```bash
claude mcp add --transport http <name> <url>
# 带认证
claude mcp add --transport http secure-api https://api.example.com/mcp \
  --header "Authorization: Bearer your-token"
```

**方式 2：本地 stdio**
```bash
claude mcp add --transport stdio --env API_KEY=xxx airtable \
  -- npx -y airtable-mcp-server
```

### 管理服务器

```bash
claude mcp list          # 列出所有服务器
claude mcp get github    # 查看详情
claude mcp remove github # 移除
/mcp                     # 会话内检查状态
```

### 作用域

| 范围 | 存储位置 | 团队共享 |
|---|---|---|
| **Local**（默认） | `~/.claude.json` | 否 |
| **Project** | `.mcp.json` | 是（版本控制） |
| **User** | `~/.claude.json` | 否 |

### 环境变量展开

```json
{
  "mcpServers": {
    "api-server": {
      "type": "http",
      "url": "${API_BASE_URL:-https://api.example.com}/mcp",
      "headers": { "Authorization": "Bearer ${API_KEY}" }
    }
  }
}
```

### 实用示例

```bash
# Sentry 错误监控
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp

# GitHub 代码审查
claude mcp add --transport http github https://api.githubcopilot.com/mcp/ \
  --header "Authorization: Bearer YOUR_GITHUB_PAT"

# PostgreSQL 数据库
claude mcp add --transport stdio db -- npx -y @bytebase/dbhub \
  --dsn "postgresql://readonly:pass@prod.db.com:5432/analytics"
```

### MCP 工具搜索

默认启用。MCP 工具延迟加载——仅在使用时才进入上下文，节省 token。

### 将 Claude Code 作为 MCP 服务器

```bash
claude mcp serve
```

---

## 10. Subagents（子代理）

子代理是在独立上下文中运行的专门 AI 助手，有自己的系统提示和工具权限。

### 内置子代理

| 子代理 | 模型 | 工具 | 用途 |
|---|---|---|---|
| **Explore** | Haiku | 只读 | 文件发现、代码搜索 |
| **Plan** | 继承主会话 | 只读 | 代码库研究规划 |
| **General-purpose** | 继承主会话 | 全部 | 复杂研究、多步操作 |

### 创建自定义子代理

在 `.claude/agents/` 或 `~/.claude/agents/` 下创建 Markdown 文件：

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep, Bash
model: sonnet
---

You are a code reviewer. Analyze the code and provide specific,
actionable feedback on quality, security, and best practices.
```

### 前置元数据字段

| 字段 | 说明 |
|---|---|
| `name` | 唯一标识符（必填） |
| `description` | 何时委托（必填） |
| `tools` | 可用工具白名单 |
| `disallowedTools` | 禁用工具黑名单 |
| `model` | 模型选择（sonnet/opus/haiku/inherit） |
| `permissionMode` | 权限模式 |
| `maxTurns` | 最大轮次 |
| `memory` | 持久记忆范围（user/project/local） |
| `background` | `true` 始终后台运行 |
| `isolation` | 设为 `worktree` 在临时 git worktree 中运行 |
| `hooks` | 子代理专属钩子 |

### 调用方式

1. **自然语言**：在提示中提及子代理名称
2. **@-mention**：输入 `@` 选择子代理
3. **全会话**：`claude --agent <name>` 整个会话使用该代理配置

### 何时使用子代理

| 用主会话 | 用子代理 |
|---|---|
| 需要频繁来回沟通 | 任务产生大量你不需要的输出 |
| 多阶段共享大量上下文 | 想强制特定工具限制 |
| 快速定点修改 | 工作自包含，可返回摘要 |

---

## 11. Settings（配置）

### 配置范围

| 范围 | 位置 | 优先级 |
|---|---|---|
| **Managed** | 系统级 `managed-settings.json` | 最高（不可覆盖） |
| **CLI 参数** | 命令行标志 | 临时覆盖 |
| **Local** | `.claude/settings.local.json` | 覆盖项目/用户 |
| **Project** | `.claude/settings.json` | 覆盖用户 |
| **User** | `~/.claude/settings.json` | 最低 |

### 示例 settings.json

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Bash(npm run lint)",
      "Bash(npm run test *)",
      "Read(~/.zshrc)"
    ],
    "deny": [
      "Bash(curl *)",
      "Read(./.env)",
      "Read(./secrets/**)"
    ]
  },
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1"
  }
}
```

### 重要设置项

| 设置项 | 说明 | 示例 |
|---|---|---|
| `model` | 默认模型 | `"claude-sonnet-4-6"` |
| `effortLevel` | 努力级别 | `"high"` |
| `autoMemoryEnabled` | 自动记忆 | `true` |
| `language` | 响应语言 | `"japanese"` |
| `hooks` | 生命周期钩子 | 见钩子章节 |
| `permissions` | 权限规则 | 见权限章节 |
| `env` | 环境变量 | `{"FOO": "bar"}` |
| `editorMode` | 编辑器模式 | `"vim"` |
| `outputStyle` | 输出风格 | `"Explanatory"` |
| `statusLine` | 自定义状态行 | `{"type": "command", "command": "~/.claude/statusline.sh"}` |
| `sandbox` | 沙箱设置 | 见沙箱章节 |

### 沙箱设置

| 设置项 | 说明 |
|---|---|
| `sandbox.enabled` | 启用 Bash 沙箱（macOS/Linux/WSL2） |
| `sandbox.autoAllowBashIfSandboxed` | 沙箱中自动批准 Bash 命令 |
| `sandbox.filesystem.allowWrite` | 允许写入的额外路径 |
| `sandbox.filesystem.denyWrite` | 禁止写入的路径 |
| `sandbox.network.allowedDomains` | 允许出站流量的域名 |

---

## 12. 常见工作流

### 理解新代码库

```
give me an overview of this codebase
explain the main architecture patterns used here
how is authentication handled?
```

### 修复 Bug

```
I'm seeing an error when I run npm test
fix the login bug where users see a blank screen after entering wrong credentials
```

### 重构代码

```
refactor utils.js to use ES2024 features while maintaining the same behavior
run tests for the refactored code
```

### 编写测试

```
write unit tests for the calculator functions
add test cases for edge conditions
run the new tests and fix any failures
```

### 创建 PR

```
summarize the changes I've made
create a pr
enhance the PR description with more context
```

### 使用 `@` 引用文件

```
Explain the logic in @src/utils/auth.js
What's the structure of @src/components?
```

### 使用图像

- 拖拽图片到窗口
- 复制图片后 `Ctrl+V` 粘贴
- 提供图片路径：`Analyze this image: /path/to/image.png`

### 管道处理

```bash
git log --oneline -20 | claude -p "summarize these recent commits"
cat error.log | claude -p "analyze these errors"
```

### 定时任务

| 方式 | 运行位置 | 适用场景 |
|---|---|---|
| Routines | Anthropic 托管 | 电脑关机时也要运行的任务 |
| Desktop 定时任务 | 本机（桌面应用） | 需要本地文件/工具访问 |
| GitHub Actions | CI 管道 | 绑定仓库事件或 cron |
| `/loop` | 当前 CLI 会话 | 会话内的快速轮询 |

---

## 13. 最佳实践

### 核心约束：上下文窗口管理

> 大部分最佳实践基于一个约束：**Claude 的上下文窗口很快填满，填满后性能下降。**

### 1. 给 Claude 验证工作的方式（最高杠杆）

| 策略 | ❌ 之前 | ✅ 之后 |
|---|---|---|
| 验证标准 | "implement email validation" | "write validateEmail. test: user@example.com=true, invalid=false. run tests after" |
| UI 验证 | "make dashboard look better" | "[截图] 实现这个设计。截图对比差异并修复" |
| 根因修复 | "the build is failing" | "构建失败错误: [粘贴错误]. 修复并验证构建成功" |

### 2. 先探索，再规划，最后编码

1. **Explore** — 进入 plan 模式，阅读文件理解问题
2. **Plan** — 让 Claude 创建详细实施计划
3. **Implement** — 退出 plan 模式，按计划编码
4. **Commit** — 提交并创建 PR

> 小任务跳过规划。如果可以用一句话描述 diff，就不需要计划。

### 3. 提供具体上下文

- **限定范围**：不是 "add tests for foo.py" 而是 "write a test for foo.py covering the edge case where the user is logged out"
- **指向来源**：用 `@` 引用文件，粘贴图片，提供 URL
- **引用现有模式**："look at how HotDogWidget.php is implemented, follow the pattern"

### 4. 配置环境

- 编写有效的 CLAUDE.md（运行 `/init` 生成起步）
- 配置权限（auto 模式、允许列表、沙箱）
- 连接 MCP 服务器
- 设置钩子
- 创建技能

### 5. 有效沟通

- 让 Claude 采访你（用 `AskUserQuestion` 工具深入挖掘需求）
- 规范完成后，**开一个新会话来执行**

### 6. 管理会话

- **及时纠正**：发现偏离立即纠正
- **`Esc`**：停止 Claude 的当前操作
- **`Esc+Esc` / `/rewind`**：恢复之前的对话/代码状态
- **`/clear`**：不相关任务之间重置上下文
- **使用子代理**：将研究任务委托给子代理，保持主会话干净

### 7. 自动化与扩展

```bash
# 非交互模式
claude -p "fix all lint errors" --permission-mode auto

# 批量操作
for file in $(cat files.txt); do
  claude -p "Migrate $file from React to Vue. Return OK or FAIL." \
    --allowedTools "Edit,Bash(git commit *)"
done

# 结构化输出
claude -p "List all API endpoints" --output-format json
```

### 常见失败模式

| 模式 | 问题 | 修复 |
|---|---|---|
| **大杂烩会话** | 上下文充满无关信息 | `/clear` 切换任务 |
| **反复纠正** | 2次纠正后仍错 | `/clear` 重写更好的初始提示 |
| **过度规范的 CLAUDE.md** | 太长，Claude 忽略一半 | 无情裁剪 |
| **信任但未验证** | 看似正确但遗漏边缘情况 | 始终提供验证手段 |
| **无限探索** | 无范围限制的调查 | 缩小范围或用子代理 |

---

## 14. 并行会话与 Worktree

### Worktree

在隔离的 git 工作树中运行 Claude，互不干扰：

```bash
claude --worktree feature-auth
```

### 桌面应用

管理多个本地会话，每个在自己的 worktree 中。

### 后台代理

```bash
claude --bg "investigate the flaky test"
claude agents  # 监控并行会话
claude attach <id>  # 附加到后台会话
```

### 写入者/审查者模式

| 会话 A（写入者） | 会话 B（审查者） |
|---|---|
| 实现限流器 | |
| | 审查限流器实现，找边缘情况 |
| 根据审查反馈修复 | |

---

## 15. CI/CD 集成

### GitHub Actions

在 PR 事件上自动运行 Claude Code：

```yaml
# .github/workflows/claude-code.yml
- name: Run Claude Code
  run: claude -p "Review the changes in this PR" --output-format json
```

### 非交互模式最佳实践

```bash
# 生成长期令牌
claude setup-token

# 在 CI 中使用
claude -p "review this PR" \
  --permission-mode dontAsk \
  --allowedTools "Bash(git diff *)" "Read" \
  --output-format json
```

---

## 16. 多平台使用

| 我想... | 最佳选择 |
|---|---|
| 从手机/其他设备继续本地会话 | Remote Control |
| 从 Telegram/Discord/webhook 推送事件到会话 | Channels |
| 本地启动、移动端继续 | Web 或 Claude iOS App |
| 定期运行任务 | Routines 或 Desktop 定时任务 |
| 自动化 PR 审查和 Issue 分拣 | GitHub Actions 或 GitLab CI/CD |
| 自动代码审查 | GitHub Code Review |
| 从 Slack 路由 Bug 报告到 PR | Slack 集成 |
| 调试实时 Web 应用 | Chrome 扩展 |
| 构建自定义代理 | Agent SDK |

---

## 常用快捷操作速查

| 操作 | 方法 |
|---|---|
| 启动会话 | `claude` |
| 非交互查询 | `claude -p "query"` |
| 继续上次会话 | `claude -c` |
| 切换权限模式 | `Shift+Tab` |
| 停止当前操作 | `Esc` |
| 撤销/回退 | `Esc+Esc` 或 `/rewind` |
| 清除上下文 | `/clear` |
| 查看命令/技能 | `/` |
| 引用文件 | `@filepath` |
| 初始化 CLAUDE.md | `/init` |
| 管理记忆 | `/memory` |
| 查看 MCP 状态 | `/mcp` |
| 管理钩子 | `/hooks` |
| 管理代理 | `/agents` |
| 管理技能 | `/skills` |
| 后台运行 | `claude --bg "task"` |
| 在 worktree 中运行 | `claude -w name` |
| 帮助 | `/help` |

---

> 文档来源：https://code.claude.com/docs/
> 完整文档索引：https://code.claude.com/docs/llms.txt
