---
title: "danimation 与《李白传》：工作流 v3.1 与 genre 的坑"
date: 2026-11-06
tags: [danimation, 李白传, 工作流]
summary: "cinematic 推到 v3.1，并做完一条《李白传》考据动画；记下 genre 选错导致整轮作废的教训。"
---

## cinematic v3.1

danimation 这周把工作流推到 v3.1，加入自动审美审查。分镜和场景静帧的文件名统一用 slug 小写，manifest 目录保留大小写，`phase_context.py` 要同时兼容三种写法。

## 《李白传》

另一条线是从零做的考据动画：先取《新唐书·李白传》原文，逐句做子串断言核对引文；再走分镜、静帧、成片，产出 mp4、字幕和一份一键成图说明。取原文时维基文库连接超时，换古文站点拿到了全文。

## 三个坑

**genre 选错，整轮作废。** 想要「介绍李白一生」，选了 `explainer`，结果 explainer 是数学证明人格（定义→构造→证明→逆定理→应用），传记被套成定理结构，到 G2 才发现。人物、传记类应该用 `narrative`。

**只改一处 JSON 不够。** genre 同时存在 intake params、`film.params.json`、`phase_0.manifest.json` 三处，只改一处，重建 manifest 会回退。

**SVG 静默失败。** `fill="url(#id)"` 引用了没写进 defs 的渐变，Chrome 不报错，整组形状直接变黑；人头并进剪影 path 时，`A` 的端点必须落在椭圆上，否则出现缺口。

## 下周

把 genre 选择前置到 G0，确认时向用户点明 explainer 是数理证明式，不是泛指介绍片。
