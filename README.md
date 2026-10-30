# OJ Claude / ChatGPT Helper

算法竞赛 OJ 油猴脚本：提取题面后，选择发送给 **Claude** 或 **ChatGPT**，也可只复制 Markdown。支持网页版和 API 两种模式。

## 安装与更新

先安装 Tampermonkey 或 Violentmonkey，再打开 [安装脚本](https://raw.githubusercontent.com/koma404/oj-claude-helper/HEAD/claude-contest-helper.user.js)。

为保留原有更新路径，脚本文件名仍为 `claude-contest-helper.user.js`，namespace 保持不变。版本升级至 2.0.0，保留已有 Claude 密钥、项目、模式、位置等设置；ChatGPT 设置独立存储，不会使用 Claude 的密钥。升级后若管理器同时保留了旧版本，请禁用旧版本，避免重复按钮。

## 两个悬浮球与独立开关

题目页面右侧默认显示两个入口：橙色 **C（Claude）** 和绿色 **G（ChatGPT）**。点击展开按钮，拖动可调整位置；两者分别记忆位置。非题目页面不显示。Vjudge 有侧栏时分别显示在侧栏。

油猴菜单按 `[Claude]`、`[ChatGPT]` 分组，各有独立的「悬浮球：开 / 关」开关，点击立即生效。关闭后对应快捷键也停用；两者可以都开、只开一个或都关。菜单状态文字刷新页面后更新。

- `Alt+Shift+C`：问 Claude。
- `Alt+Shift+G`：问 ChatGPT。
- `Alt+Shift+M`：复制题目 Markdown。

洛谷和代码源已有复制功能，因此不重复放「复制 MD」按钮，快捷键和油猴菜单仍可使用。选中超过 20 个字符时优先发送选中文字，否则自动提取题面。

## 网页版（默认）

分别在对应平台菜单里选择网页模式、设置目标页面：

- Claude：留空打开 `https://claude.ai/new`，也可配置 `https://claude.ai/project/<ID>`。
- ChatGPT：留空打开 `https://chatgpt.com/`，也可配置 GPT 首页 `/g/<ID>` 或项目首页 `/g/<ID>/project`。

需要在自己的浏览器登录对应账号。脚本只传题目标题、链接、题面，不附加解题提示词；项目或 GPT 的自定义指令由用户配置。题面同时复制到剪贴板，自动填入失败时可手动粘贴。已有草稿不会被覆盖；清空后刷新可在两分钟有效期内重试。

默认填入后由用户检查并手动发送。两个平台分别有「网页版自动发送」选项；带 PDF 时始终要求手动确认附件上传后发送。网页结构变化可能影响自动填入或附件上传，页面已有对话不会接收新题面。

## API 模式

在对应平台菜单中切换为 API 模式并设置密钥和模型 ID，答案显示在题目页面板，可复制全部或最后一个代码块。

- Claude：Anthropic Messages API，默认模型 `claude-sonnet-4-6`，已有自定义模型继续保留。
- ChatGPT：OpenAI Responses API，默认模型 `gpt-4.1`。

密钥只保存在本地油猴存储；两个平台分开保存和使用。API 按对应服务独立计费，网页会员不等于 API 额度。模型需在账号中可用，API 模式不带网页项目或 GPT 的自定义指令。PDF 题面分别以 Anthropic document 或 OpenAI input_file 发送，需要支持文件输入的模型。

## 支持的网站

| 网站 | 提取方式 |
| --- | --- |
| Codeforces（含 gym / mirror） | `.problem-statement`，从 MathJax 的 `<script type="math/tex">` 还原 TeX 公式 |
| AtCoder | `#task-statement`，优先英文版，从 KaTeX annotation 还原公式，附带时空限制 |
| 洛谷 | 优先读页面内嵌的 JSON（原始 Markdown 题面 + 样例），失败时退回读 DOM |
| LeetCode / 力扣 | 题目描述区域 |
| Vjudge | 比赛页 `#problem/X` 和单题页 `/problem/...`，从题面 iframe 对应的描述页提取，`$$$x$$$` 等 CF 原始公式写法统一成 `$x$`；只有 PDF 的题会下载 PDF 作为附件发给 Claude |
| 代码源 newoj（Hydro） | 优先读 `UiContext.pdoc` 里的原始 Markdown，失败时读 `.problem-content` |
| 代码源旧 OJ `oj.daimayuan.top`（UOJ） | `.uoj-article`，从 MathJax 的 `<script type="math/tex">` 还原公式，附带时空限制 |

Vjudge 只有 PDF 题面的题会尝试下载 PDF；复制 MD 只能复制标题和 PDF 链接。PDF 可能来自其他域名，管理器可能询问跨域授权。

配套 [DMY Better](https://github.com/koma404/DMY-Better) 独立维护，负责代码源的复制 Markdown、下载等功能，可同时安装。

## 开发与检查

脚本无需构建和运行依赖。语法检查：

```sh
node --check claude-contest-helper.user.js
```

浏览器回归需要 Node.js、Playwright 和 Chromium。云环境已提供；其他环境可在仓库外安装 Playwright 并通过 `NODE_PATH` 引入，避免把本地依赖提交进仓库。测试默认使用 `/usr/bin/chromium`，可用 `CHROMIUM_PATH` 覆盖。

```sh
node tests/oj-smoke.cjs
node tests/chatgpt-smoke.cjs
```

测试模拟网页和油猴接口，覆盖六类 OJ 提取、双平台分流、独立开关、网页填入、草稿保护、过期消息、PDF 控件及 API 响应。不会访问真实 AI 服务或产生费用；不代表真实网站或管理器扩展已完成端到端验证。Vjudge 在线 iframe / PDF 下载仍需实际浏览器验证。

**不要在正式比赛（rated contest）中使用。** 请只在赛后补题、练习时使用，并遵守各平台规定。
