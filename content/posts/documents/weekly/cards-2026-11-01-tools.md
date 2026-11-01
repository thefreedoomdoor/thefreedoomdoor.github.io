---
title: "经验卡合集：工具与前端"
date: 2026-11-01
tags: [经验卡, 工具, three.js]
summary: "四张卡：读会话库、无头截图、three.js 色彩空间、看不见图时怎么验收画面。"
---

## 用会话库挖经验

**现象**：想读历史会话、找某次工具调用的原文，脚本读出来是空的。

**做法**：直接读 `db.sqlite`（只读模式）。正文在 `part` 表 `type='text'` 的 `data.text`，message 表只有元数据；tool part 一行自带 `state.input` 和 `state.output`，不需要再做配对。

**验证**：脚本能列出项目与会话数；`calls` 能同时打出 ARG 和 RES，而不是一片 `(无结果)`。

## 无头 Chrome 截图

**现象**：要验证网页、WebGL、3D 场景跑起来长什么样，或者做视觉回归。

**做法**：`--headless=new` 加 `--enable-unsafe-swiftshader --use-angle=swiftshader`，截图路径必须绝对，`--user-data-dir` 指到临时目录。要执行 JS、等动画、多次截图，就用 CDP 驱动（Node 22+ 自带 WebSocket，不需要 puppeteer），必要时轮询 `window.__ready`。

**验证**：截图存在且大于 10KB；`Runtime.exceptionThrown` 和 Log 异常计数为 0。

## three.js 颜色发暗或过曝

**现象**：自己写着色器或往 geometry 里塞 color 时，天空水面发暗、地面过曝发白。

**做法**：三件事必须同时做对——全局只转一次 sRGB→linear（`ColorManagement.legacyMode = false`）；手写 vertex color 的地方自己转；自定义 ShaderMaterial 自己挂 `tonemapping_fragment` 和 `encodings_fragment`。少一个就偏色。

**验证**：读帧缓冲采样中心列，线性化后的草地应落在 `rgb(74,98,53)` 附近，偏差 ±30 以内。

## 看不见图也能验证画面

**现象**：模型不支持读图，视觉验收 agent 也不可用，但交付物是画面。

**做法**：在页面里内建诊断，把「看图」变成「读字符串」——语义射线图（一格一个字母标出画面里是什么）、ASCII 颜色预览、中心列 RGB 剖面、blown/crushed/colors 统计。

**验证**：每个机位出现该出现的对象；`blown% ≈ 0`、`crushed% < 10`、`colors > 200`；时间点之间颜色真的在变；控制台 0 异常。
