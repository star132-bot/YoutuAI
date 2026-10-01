# 灰糯（Huinuo / Mochi）🐭

一只住在网页里的灰蓝色小老鼠 AI 助手：会聊天、会做 **34 种动作 + 12 种表情**、会一步步教用户操作网站，也能在 YouTube 直播里当虚拟形象。

- 需求与设计：[`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- 角色定稿：[`design/final/`](design/final/)
- 给建模师的 Live2D 规范：[`docs/LIVE2D-RIGGING.md`](docs/LIVE2D-RIGGING.md)

## 组成

| 目录 | 内容 |
|---|---|
| `packages/widget` | `<huinuo-assistant>` 网页组件：Live2D 渲染、程序化动作引擎、聊天面板、教程引导、直播页 |
| `packages/server` | 后端：AI 网关（多 AI + 自动故障转移）、jev 判断层、聊天服务、限流 |
| `packages/shared` | 前后端共用：情绪 / 动作白名单、AI 回复解析、事件类型 |
| `config/` | 配置示例：AI 提供商、网站资料（知识库）、教程脚本、jev 参数 |

## 快速开始

需要 Node.js 20+。

```bash
npm install
npm run fetch-model -w @huinuo/widget   # 下载开发用的 Live2D 示例模型和 Cubism Core（不入库）
npm run dev:server                       # 后端 http://localhost:8787
npm run dev:widget                       # 前端 http://localhost:5173
```

- 网站助手演示：<http://localhost:5173/>
- 直播画面 + 动作调试面板：<http://localhost:5173/live.html>（OBS 中使用 `live.html?obs=1`）

不配置 AI Key 时自动使用**离线模式**（按关键词回复），可以先体验全部交互。

## 接入 AI

1. 复制配置：`cp config/huinuo.config.example.json config/huinuo.config.json`
2. 在 `providers` 里按优先级列出 AI（任何 OpenAI 兼容接口都行：DeepSeek、通义千问、Moonshot、各类中转站…）
3. 复制 `.env.example` 为 `.env`，填入每个 AI 的 Key（变量名与配置里的 `apiKeyEnv` 对应）

**Key 只放在后端 `.env`**，不会出现在网页里，也不会提交到 Git。

排在前面的 AI 出错 / 超时 / 限流时，网关会自动切到下一个，并让出错的 AI 冷却一段时间（30 秒起，每次翻倍，最长 5 分钟）。
手动切换首选 AI（需要在 `.env` 设置 `ADMIN_TOKEN`）：

```bash
curl -X POST localhost:8787/api/providers/active -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"id":"backup"}'
curl localhost:8787/api/providers   # 查看各 AI 状态
```

## 嵌入到你的网站

```bash
npm run build   # 产物：packages/widget/dist/huinuo.js
```

```html
<script src="/huinuo.js"></script>
<huinuo-assistant api="https://你的后端/api"></huinuo-assistant>
```

| 属性 | 说明 | 默认 |
|---|---|---|
| `api` | 后端地址 | `/api` |
| `model` | Live2D `.model3.json` 地址 | 官方示例模型 Haru |
| `profile` | 参数档案：`standard`（灰糯原创模型）/ `haru` | `haru` |
| `mode` | `widget` 网页助手 / `live` 直播画面 | `widget` |
| `idle-seconds` | 用户多久不操作就主动询问 | `30` |
| `core-url` | Cubism Core 地址 | Live2D 官方 CDN |

JavaScript 接口：`el.say(text, motion, { emotion })`、`el.play(motion)`、`el.chat(text)`、`el.emit(event)`、`el.startTutorial(id)`。

## 工作原理

```
网页行为 / YouTube 弹幕 / 用户消息
        │
        ▼
   jev 判断层 ──► 忽略 / 直接做动作 / 说一句话 / 启动教程 / 交给 AI 聊天
        │                                              │
        │                                  AI 网关（多 AI 故障转移）
        ▼                                              ▼
   {text, emotion, motion, highlight, tutorial}  ◄── 结构化回复
        │
        ▼
 灰糯：说话（口型）+ 表情 + 动作 + 高亮按钮 / 教程
```

- **jev 判断层**（`packages/server/src/jev.ts`）：目前是规则版，接口 `DecisionEngine` 固定，之后可换成训练好的 jev 模型。
- **动作引擎**（`packages/widget/src/motion/`）：动作是代码里的关键帧，和模型无关；通过「模型档案」映射到具体模型参数，所以换成原创模型后动作照样能用；也能导出成 Cubism 标准 `.motion3.json`。

## 开发

```bash
npm test              # 单元测试
npm run typecheck     # 类型检查
npm run export-motions            # 导出动作为 .motion3.json（标准参数）
npm run export-motions -- haru    # 按 Haru 的参数导出
```

## 授权说明

- 开发用示例模型 Haru 属于 Live2D Inc.，受 [Free Material License](https://www.live2d.com/eula/live2d-free-material-license-agreement_en.html) 约束，脚本只下载到本地，不随仓库分发。
- Live2D Cubism Core 受 Live2D Proprietary Software License 约束，生产环境从官方 CDN 加载。商用前请确认 [Cubism SDK 授权条款](https://www.live2d.com/en/sdk/license/)。
