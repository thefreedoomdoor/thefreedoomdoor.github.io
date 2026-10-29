---
title: 文章模板
date: 2026-10-29
tags: [示例]
summary: 这是模板文件，不会被构建（不在 documents 目录下）。
kind: note
---

## 常用写法

行内公式 $a^2 + b^2 = c^2$，块级公式：

$$
\frac{\partial f}{\partial x} = \lim_{h \to 0}\frac{f(x+h)-f(x)}{h}
$$

```python
def hello(name: str) -> str:
    return f"hello, {name}"
```

| 参数 | 含义 |
| --- | --- |
| `lr` | 学习率 |
| `bs` | 批大小 |

![示意图](/images/bg.jpg "图 1：图片标题会变成图注")

> [!TIP]
> 提示块支持 NOTE / TIP / IMPORTANT / WARNING / DANGER。

::: theorem 定理 1
设 $f$ 在 $[a,b]$ 上连续，则 $f$ 在该区间上有界。
:::

颜色：<span class="hl hl-red">红</span> <span class="hl hl-amber">黄</span> <span class="hl hl-green">绿</span> <span class="hl hl-blue">蓝</span> <span class="hl hl-purple">紫</span> <span class="hl hl-cyan">青</span>

脚注示例[^1]。

[^1]: 脚注会出现在文末。
