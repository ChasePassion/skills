---
name: spacing-optimization
description: "Audit and normalize UI spacing — padding, margins, gaps, icon slots, hover/state boundaries, nested hover spacing, nested radii, target sizes, and vertical rhythm. Use whenever the user asks to clean up spacing, fix alignment, make a UI feel tidier, optimize padding or hover boundaries, or tighten a spacing scale (间距优化、间距审计、图标对齐、hover 边界、嵌套 hover)."
---

# Spacing Optimization

目标：把界面间距从“逐处微调”变成“按一套刻度推导”。输出落到具体数值、选择器和文件，不写风格评论。

## 触发后先做

1. 找目标：组件文件、CSS Module、全局 token、设计稿或截图。先读现有 token，不另起一套。Tailwind 项目先读 theme/config，再扫类名；脚本只扫 CSS/SCSS/LESS。
2. 跑 `scripts/spacing_inventory.py <目标目录>`，拿到当前 padding/margin/gap/radius/height 的取值分布。
3. 打开页面看三件事：左轴、hover 边界、图标与文字的关系。没有浏览器就按 CSS 和 DOM 判断，并在输出里注明依据。

## 工作流

### 1. 定刻度

从现有系统选刻度。没有系统就用：

`2 4 6 8 12 16 24 32 48 64`

- 0/1/2px 只用于 hairline 和光学微调。
- 同一个值反复出现（如 10）就给它命名；不要让它以裸值散落。
- 相邻档位差不到 25% 时合并。9/10/11/12 选一个。
- 圆角单独定 4/8/12，不要和间距混成一套刻度。

### 2. 定轴

先定五条轴，其他值由它们推导：

```
页面 gutter
卡片 padding
行 padding
图标槽位
文字 gap
```

文字起点 = gutter + card padding + row padding + icon slot + gap。同类内容落在同一条轴上；允许一条装饰轴（时间线、竖线），不允许三条“差不多”的轴。

### 3. 修 padding 和 hover

- 一段间距只归一层：父层有水平 padding，子层不要再加同样的水平 padding。
- 边框算进内缩：`border + padding` 的和落在刻度上。1px border 配 5px padding，不是 6px。
- 状态层用独立形状：行负责点击区，`::before` / `::after` 负责 hover 背景。状态形状可以比点击区小，不能比点击区大。
- hover 不改变布局：不改 padding、border-width、height；用透明边框占位、inset shadow 或伪元素。
- 嵌套 hover 的间距按内层状态形状算，不按内层 icon 算：
  `状态间隙 = 外层 padding − 外层状态内缩 − 内层状态外扩`。
  状态间隙最低 4px；两个圆角按 `内层半径 = 外层半径 − 状态间隙` 推导。
- 内层 hover 和外层 hover 同色时不要叠加：用 `:has()` 抑制外层填充，或内层只改 ink。
- hover 边界 = 点击边界。只有标题能点时，不要亮整张卡片。

详细写法见 `references/css-patterns.md`。

### 4. 修图标

- 图标放进固定槽位（16/18/20/24），槽位中心对齐文字，文字从槽位后开始。
- 同一行有两个前置图标时，每个图标一个槽位，或整段 leading 用固定宽度。
- 图标侧内缩 = `(控件高度 − 图标尺寸) / 2 − 边框`。
- 图标与文字 gap：16px 图标 4–8px，24px 图标 8–12px。
- 光学居中允许 1–2px 偏移；写成有名字的例外，不要散落 magic number。

### 5. 修垂直节奏

- UI 行高用 4px 倍数：16/20/24。
- 控件高度用 28/32/36/40；行高 = line-height + 2 × padding。
- 组内间距 < 组间间距。标题到内容是 8/12，内容到下一节是 16/24/32。
- 同一列表里行高统一；不要在 30/32/34/36 之间来回选。

### 6. 修圆角

```
内层圆角 = 外层圆角 − (padding + border)
```

结果小于 0 时用 0。只在内外角相邻时使用；不贴角不要机械套。

### 7. 验收

- `scripts/spacing_inventory.py` 再跑一次；除 0/1/2 和已命名的光学例外，不应有裸值。
- 截图检查默认、hover、active、disabled；100% 和 125% 缩放。
- 长文本、空状态、两个 trailing action 都要过一遍。
- 检查 hover 不推挤布局，嵌套 hover 不叠色，图标不贴边，文字不在两条轴之间。

## 判定

- 先改分组，再改数值；不为对齐数字改变布局结构。
- 每条改动写清 current → target 和原因；不确定标“未验证”。
- 不写免责句和风格评论，同一原则只说一次。

## 输出格式

先给结论，再给表，不写开场白。

```
目标：<页面/组件>
刻度：<token 列表>
轴：<gutter / card / row / icon / gap>
问题：
| 位置 | 当前 | 改为 | 原因 |
...
改动：<文件 + 选择器 + 值>
验收：<截图/检查结果>
```

## 参考

- `references/spacing-system.md`：刻度、token 分层、密度、来源。
- `references/audit-checklist.md`：逐项审计清单和常见问题。
- `references/css-patterns.md`：状态层、图标槽位、嵌套圆角、边框补偿的 CSS 写法。
- `scripts/spacing_inventory.py`：扫描现有间距值。
