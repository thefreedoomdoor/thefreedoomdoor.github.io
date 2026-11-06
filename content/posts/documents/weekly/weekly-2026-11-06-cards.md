---
title: "本周经验卡：剪映、模型下载与显卡环境"
date: 2026-11-06
tags: [经验卡, 剪映, ComfyUI]
summary: "本周 14 张卡：展开剪映草稿加密、hf-mirror 大文件、cu128 回退三张，其余按类归纳。"
---

## 三张展开

### 剪映草稿已加密

**现象**：想用 pyJianYingDraft 生成剪映草稿，打开 `draft_content.json` 发现是 base64 密文而不是明文 JSON。

**做法**：剪映 7+ / 草稿 10.8 以上不支持程序化生成草稿。改用 ffmpeg 拼接出片，剪映只做手动精修。

**验证**：先查版本确认；最终成片能被剪映正常导入并播放。

### hf-mirror 大文件单流卡死

**现象**：从 hf-mirror 下 10 GB 级 safetensors，`curl -C -` 续传一直卡在建立连接，速率 0、没有报错。

**做法**：24 并发加 16 MB 分块，每块独立重连，聚合能到 8–10 MB/s；失败只重下该块。

**验证**：单文件字节数与模型卡 size 完全一致；safetensors 能正常加载 header。

### cu128 下量化核走 eager 回退

**现象**：同一套工作流换机器后从 66 秒变成 562 秒，w4a8/int8 能跑但慢得离谱。

**做法**：另建隔离的 cu130 环境，共享 `models/` 和 `custom_nodes/`，另起端口。

**验证**：`torch.version.cuda` 显示 ≥13；640×368、124 帧、4 步回到约 66 秒。

## 其余按类归纳

- **剪映操作**：批量导入用 `Ctrl+L` 加通配符再加 `Ctrl+A`；拖拽必须 `strategy: "event"`；接触表上目测裁脸会漂移，回原图按分数坐标裁。
- **ComfyUI**：两个实例会抢显存（任务变慢但显存被占满）；UI 转 API 后要确认每个节点有 `class_type`、`/prompt` 的 `node_errors` 为空；`autogrow` 输入要点开节点加点号键才会真正生效；按位置改 `widgets_values` 容易整体错位，改完在 UI 里核对。
- **环境**：`python -I` 会丢掉脚本目录，`import comfy` 失败，补 `PYTHONPATH`；uv 装包时镜像可能缺某些版本，换源前先确认。
- **配置**：运行时状态写到独立文件，别让整份上传把命令写入的值覆盖；工作流的状态目录要落到 `films/<slug>/state/`，别跑到工作区根目录。
- **抓取**：raw 域名和 CDN 全失败、curl 报 schannel 证书错误时，改用 git（走 OpenSSL），`git clone --depth 1` 能拿到内容。
