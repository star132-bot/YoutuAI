# 灰糯 Live2D 素材包

灰糯（Huinuo / Mochi）：灰蓝色小老鼠女孩。这个包里是**绑定前的素材**，还不是能直接放进 VTube Studio 的模型文件（`.moc3`）。
要变成真正的 Live2D 模型，需要在 **Live2D Cubism Editor** 里完成绑定（下面有步骤）。

## 里面有什么

| 文件 / 文件夹 | 内容 | 用在哪 |
|---|---|---|
| `huinuo.psd` | 分层 PSD（1024×1536）：尾巴、左耳、右耳、身体、头部；另有一个默认隐藏的 `expressions` 组（左右眼半闭 / 闭眼、嘴小张 / 大张） | **导入 Cubism Editor** |
| `layers/*.png` | 同样的图层，每张都是整幅画布大小的透明 PNG，位置已对齐 | Inochi2D、Spine 等其他软件，或手动检查 |
| `motions/*.motion3.json` | 36 个动作（Cubism 标准格式，参数用 Live2D 标准 ID） | 模型绑定好后，放进模型文件夹注册使用 |
| `LIVE2D-RIGGING.md` | 参数清单和范围（`ParamAngleX`、`ParamEyeLOpen` 等），物理、点击区域要求 | **绑定时照着做**，动作才能直接用 |
| `reference/` | 定稿立绘、设定集（含背面 / 表情）、持魔法棒版、AI 生成的表情差分原图 | 绑定时参考 |

### PSD 图层对照

从下到上（越往下越在后面）：

| 图层名 | 中文 | 说明 |
|---|---|---|
| `tail` | 尾巴 | 根部向裙子里多延长了一点，摆动时不会断 |
| `ear_L` / `ear_R` | 左耳 / 右耳 | 耳根被头发挡住的部分已补画 |
| `body` | 身体 | 含手臂和腿；脖子已向上补画到下巴后面，头部下方垫了一层头发 |
| `head` | 头部 | 头发、脸、五官、花饰、发卡 |
| `expressions (hidden)` 组 | 表情差分 | 默认隐藏 |
| ├ `eye_L_half` / `eye_R_half` | 左 / 右眼半闭 | 只覆盖眼睛附近的小块 |
| ├ `eye_L_closed` / `eye_R_closed` | 左 / 右眼闭眼 | 笑眼形状 |
| ├ `mouth_open` | 嘴小张 | 说话 |
| └ `mouth_wide` | 嘴大张 | 大笑 |

## 在 Cubism Editor 里使用

1. 打开 Cubism Editor（免费版即可），**文件 → 打开**，选 `huinuo.psd`。
2. 软件会按图层生成部件。选中全部部件 → **自动生成网格**。
3. 按 `LIVE2D-RIGGING.md` 新建参数（名称用里面写的标准 ID），做变形器和关键形状：
   - 头部：`ParamAngleX/Y/Z` 转头、点头、歪头
   - 眼睛：`ParamEyeLOpen / ParamEyeROpen`（可以参考 `expressions` 组里的闭眼图层，或直接用它们做切换）
   - 嘴：`ParamMouthOpenY`
   - 耳朵、尾巴：做物理摆动
4. **文件 → 导出 → moc3**，得到 `.model3.json` + `.moc3` + 贴图。
5. 把 `motions/` 里的动作文件复制到模型文件夹，在 `.model3.json` 的 `Motions` 里注册，或在 VTube Studio 里添加。

## 需要知道的限制

这些图层是从**一张平面立绘自动拆出来的**，比专业 Live2D 的分层粗很多：

| 现在 | 专业 Live2D 通常会有 |
|---|---|
| 头部是一整层（前发、脸、后发、五官连在一起） | 前发 / 侧发 / 后发、脸、眼白、眼珠、睫毛、眉毛、嘴分开，约 30～50 层 |
| 手臂和身体是同一层 | 左右上臂、前臂、手分开 |
| 闭眼、张嘴用的是整块替换图 | 眼皮、嘴型靠网格变形 |

所以直接拿这份 PSD 绑定，**只能做出转头、眨眼、张嘴、耳朵尾巴摆动这类基础效果**。想要更自然，需要先把头发、眼睛、手臂进一步拆开，并补画被挡住的部分。可以：
- 找绑定师 / 画师，把这个包（尤其是 `reference/` 和 `LIVE2D-RIGGING.md`）当需求单；
- 或者让 Claude 继续拆前发 / 后发、眼珠、手臂（会更新这个包）。

## 动作文件说明

- 参数 ID 是 Live2D 标准命名，绑定时用同样的 ID，动作就能直接播放。
- 有 13 个动作（如蹦跳、转圈、探头）原本带「整体移动 / 旋转」，`.motion3.json` 里只保留了模型参数的部分，`motions/index.json` 里 `skippedTransform: true` 的就是这些。
- `sneeze`（打喷嚏）、`giggle`（偷笑）是额外的示例动作。

## 授权

灰糯的立绘和素材是本项目原创（AI 生成后整理）。Live2D Cubism Editor 和 Cubism SDK 的使用请遵守 Live2D 官方授权条款。
