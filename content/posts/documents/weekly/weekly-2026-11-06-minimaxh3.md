---
title: "minimaxh3：从 ComfyUI 工作流到剪映"
date: 2026-11-06
tags: [minimaxh3, ComfyUI, 视频]
summary: "搭起 minimax-h3 的 ComfyUI 流水线，试通剪映自动化，并把显卡环境从 cu128 换到 cu130。"
---

## 流水线

这周把 minimax-h3 的视频流水线搭了起来：ComfyUI 里做关键帧和分段候选，`pipeline_run.py` 负责跑批，产物按 `pipeline/<片名>/{script,keyframe,candidates,manifest}` 组织。到周末已经能稳定产出分镜候选段。

## 剪映这一段

自动化剪辑试了两条路。一条是用 computer-use 直接操作剪映：批量导入要 `Ctrl+L` 跳目录、文件名框输通配符、点列表下方空白再 `Ctrl+A`；拖素材进时间线，`left_click_drag` 必须带 `strategy: "event"`，默认的 auto 不生效。

另一条是程序化生成草稿，走不通：剪映 7+ / 草稿 10.8 以上的 `draft_content.json` 是加密的，pyJianYingDraft 这类工具读到的只是密文。所以改成 ffmpeg 拼接出片，剪映只做手动精修。

## 环境

同一套工作流换机器后从 66 秒变成 562 秒，原因是 cu128 下量化核走了 eager 回退。另建一个 cu130 的隔离环境（共享模型和自定义节点、另起端口），速度回到 66 秒。

## 下周

把关键帧、分段、拼接串成一条命令；剪映留在精修环节，不再尝试全自动工程文件。
