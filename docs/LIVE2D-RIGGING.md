# 灰糯 Live2D 模型制作规范（给建模师）

按本规范绑定参数，灰糯的 **34 个程序化动作 + 12 种表情** 可以直接驱动模型，无需另做动作文件。
动作也可以导出为标准 `.motion3.json` 在 Cubism Editor 中查看和微调：`npm run export-motions`（输出到 `packages/widget/motions/standard/`）。

参考图：`design/final/live2d-base-front.png`（拆层底稿）、`design/final/character-sheet.png`（设定集）、`design/final/front-with-wand.png`（持魔法棒）。

## 1. 必需参数（使用 Cubism 标准 ID）

| 参数 ID | 范围 | 默认 | 说明 |
|---|---|---|---|
| `ParamAngleX` / `ParamAngleY` / `ParamAngleZ` | -30 ~ 30 | 0 | 头部左右转 / 抬低头 / 歪头 |
| `ParamBodyAngleX` / `Y` / `Z` | -10 ~ 10 | 0 | 身体转动 / 前后倾 / 侧倾 |
| `ParamEyeLOpen` / `ParamEyeROpen` | 0 ~ 1.4 | 1 | 0 闭眼，1 正常，**>1 瞪大眼（惊讶）** |
| `ParamEyeLSmile` / `ParamEyeRSmile` | 0 ~ 1 | 0 | 笑眼（单侧可做 wink） |
| `ParamEyeBallX` / `ParamEyeBallY` | -1 ~ 1 | 0 | 眼珠方向（视线跟随鼠标） |
| `ParamBrowLY` / `ParamBrowRY` | -1 ~ 1 | 0 | 眉毛上下 |
| `ParamBrowLAngle` / `ParamBrowRAngle` | -1 ~ 1 | 0 | -1 生气（内低外高），1 难过（八字眉） |
| `ParamBrowLForm` / `ParamBrowRForm` | -1 ~ 1 | 0 | 眉形 |
| `ParamMouthForm` | -1 ~ 1 | 0 | -1 撇嘴 / 1 微笑 |
| `ParamMouthOpenY` | 0 ~ 1 | 0 | 张嘴（口型同步用） |
| `ParamCheek` | 0 ~ 1 | 0 | 脸红 |
| `ParamTear` | 0 ~ 1 | 0 | 眼泪（哭、打哈欠） |
| `ParamBreath` | 0 ~ 1 | 0 | 呼吸 |

## 2. 手臂（灰糯的动作大量用到，务必做）

| 参数 ID | 范围 | 默认 | 0 的样子 → 1 的样子 |
|---|---|---|---|
| `ParamArmLA` / `ParamArmRA` | 0 ~ 1 | 0 | 手臂自然下垂 → **举到肩膀以上**（挥手、欢呼、指向） |
| `ParamArmLB` / `ParamArmRB` | 0 ~ 1 | 0 | 前臂伸直 → 前臂弯曲（手到胸前 / 托腮 / 捂脸） |
| `ParamHandL` / `ParamHandR` | -1 ~ 1 | 0 | 手腕摆动（挥手、指尖朝下） |

> 若模型用「两套手臂部件切换」的做法，也可以支持：在 `packages/widget/src/motion/profiles.ts` 新建档案，用 `parts` 指定显示 / 隐藏的部件（参考 `HARU_PROFILE`）。

**右手握光标水晶魔法棒**：魔法棒作为右手的子部件，跟随 `ParamArmRA/RB` 运动；「指引」动作就是用它指向页面按钮。

## 3. 物理摆动（physics3.json）

| 部位 | 输入 | 备注 |
|---|---|---|
| 鼠耳（左右各一） | 头部角度 X/Z | 毛绒感，摆动柔和、稍有延迟 |
| 短卷发（前发 / 侧发 / 后发） | 头部角度 X/Z、身体角度 X | |
| 侧边缎带、花饰 | 头部角度 X/Z | |
| 袖子缎带 | 手臂参数 | |
| 裙摆、水晶流苏 | 身体角度 X/Z | |
| 尾巴 + 铃铛 | 身体角度 X/Z | 尾巴是灰糯的标志，摆动幅度可以大一些 |

## 4. 点击区域（HitAreas）

在 `model3.json` 中设置：`Head`（头部，摸头）和 `Body`（身体，戳戳）。名称里含 `head` 即识别为头部。

## 5. 交付文件

```
huinuo.model3.json
huinuo.moc3
huinuo.physics3.json
huinuo.cdi3.json          （可选）
huinuo.2048/texture_00.png（贴图 ≤ 2 张，总体积建议 < 2MB）
```

交付后放进网站，组件改为：

```html
<huinuo-assistant profile="standard" model="/models/huinuo/huinuo.model3.json"></huinuo-assistant>
```
