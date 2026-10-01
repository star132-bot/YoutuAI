# 伪 Live2D（路线 B）：一张立绘 → 能动的灰糯

不需要 Cubism Editor，也不需要绘画基础：把一张正面立绘拆成部件，在网页里用**网格变形 + 弹簧物理**做出 Live2D 的效果。
参数沿用 **Live2D 标准命名**（`ParamAngleX/Y/Z`、`ParamEyeLOpen`、`ParamMouthOpenY`…），所以项目里的 34 个动作和任何 `.motion3.json` 都能直接驱动它；以后换成真正的 Live2D 模型（路线 A/C），动作可以原样迁移。

## 预览

```bash
npm install
npm run dev:widget
```

打开 <http://localhost:5173/pseudo.html>：右侧有全部动作、表情、说话按钮，以及参数滑块（拖动检查接缝，双击复位）。
直播用 `pseudo.html?obs=1`（隐藏面板）。

在线版（不用装任何东西）：<https://claude.ai/artifact/9xxbytKjhhBH6k3Q9guwPt>。
打包单文件版：`node packages/widget/scripts/build-pseudo-standalone.mjs`，页面先引入 PixiJS 6.5.10，再引入生成的 `huinuo-pseudo.js`，用 `HuinuoPseudo.PseudoCharacter.create(canvas, { rigUrl })` 创建。

## 能做什么

| 能力 | 实现 |
|---|---|
| 转头 / 点头 | 头部网格变形：越往上、越靠中间位移越大（伪 3D），下巴线以下完全不动 |
| 歪头 | 也在网格里：绕下巴旋转，权重随高度递增，下巴和发梢不动 |
| 眨眼 / wink / 笑眼 | 左右眼分别切换「半闭」「全闭」贴片 |
| 说话 / 大笑 | 嘴巴「小张」「大张」贴片 |
| 脸红 | 程序绘制 |
| 呼吸、身体左右倾 | 身体网格变形（腿和脚不动） |
| 鼠耳、尾巴摆动 | 弹簧物理；耳朵偶尔会自己抖一下 |
| 视线跟随鼠标 | 驱动 `ParamAngleX/Y` |

**目前不支持**：手臂动作（挥手、举手、指向）——需要把手臂单独拆出来并补画被挡住的衣服，见「下一步」。用到手臂的动作会只播放头和身体的部分。

## 加一个新动作

在 `packages/widget/public/huinuo-pseudo/motions/` 放一个 `.motion3.json`，再在同目录的 `index.json` 里加一行：

```json
{ "sneeze": "sneeze.motion3.json", "新动作": "新动作.motion3.json" }
```

刷新预览页，新动作会以虚线按钮出现。文件格式就是 Cubism 标准动作格式（关键帧曲线），参数 ID 用 Live2D 标准命名。
`sneeze`（打喷嚏）和 `giggle`（偷笑）是两个示例，由 `packages/widget/scripts/make-example-motions.ts` 生成。

代码里也可以直接注册：`character.addMotion(name, def)` 或 `character.addMotionFile(name, url)`。

## 重新生成部件（换立绘时）

```bash
pip install -r tools/pseudo-live2d/requirements.txt
python tools/pseudo-live2d/build_parts.py      # 拆部件 → parts/*.png + rig.json
python tools/pseudo-live2d/build_face.py       # 对齐表情差分，裁出眼睛 / 嘴贴片
python tools/pseudo-live2d/preview_parts.py <输出目录>   # 检查图：部件、重组对比、极限姿势
python tools/pseudo-live2d/preview_face.py <输出目录>
```

- 立绘要求：正面、站直、双手自然下垂不挡身体、刘海不挡眼睛、白底。
- `build_parts.py` 顶部的 `GEOMETRY` 是所有切割坐标（下巴线、头顶轮廓、耳朵椭圆、尾巴区域等），换图时改这里。
- 表情差分在 `design/pseudo/face-variants/`：用图像编辑接口把脸部裁图改成「闭眼 / 半闭眼 / 小张嘴 / 大张嘴」得到；`build_face.py` 会自动对齐位置、匹配色调，只取眼睛和嘴附近的小块。

### 拆件流程中处理接缝的方法

| 问题 | 处理 |
|---|---|
| 纸纹背景 | 只把和图片边缘连通的白色当背景，角色边缘 2px 内做软边 |
| 转头时下巴和脖子之间露缝 | 网格在下巴线以下完全锚定；身体层把脖子向上补画到下巴后面 |
| 歪头时发梢 / 下巴错位 | 歪头放进网格变形（越往上转得越多），而不是整颗头刚体旋转 |
| 网格把头发边缘往里拉时露出空隙 | 头部后面垫一份变形较少的头部副本；身体层在头部下方垫一层头发 |
| 耳根转动时露出色块 | 耳根被头发挡住的部分只用耳朵本身的纹理延伸（inpaint）补出 |
| 花饰跟着耳朵乱动 | `keep_on_head` 把花饰区域留在头部 |

## 导出给 Cubism Editor 等软件用的素材包

```bash
python tools/pseudo-live2d/export_kit.py
```

生成 `exports/huinuo-live2d-kit/`（及 `.zip`）：分层 `huinuo.psd`、对齐的整幅图层 PNG、36 个 `.motion3.json`、参考图和绑定规范。使用说明见包内 `README.md`（源文件 `tools/pseudo-live2d/KIT_README.md`）。

## 下一步

1. **手臂**：拆出左右手臂，用图像编辑接口补画手臂后面的裙子，做抬手 / 挥手 / 指向。
2. **眼珠**：拆出虹膜，实现视线（`ParamEyeBallX/Y`）而不只是转头。
3. **头发分层**：前发 / 后发分开，转头时视差更强。
4. **接回网页助手**：`<huinuo-assistant renderer="pseudo">`。
