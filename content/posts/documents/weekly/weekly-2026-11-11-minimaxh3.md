---
title: "minimaxh3：接进 Qwen-Image，以及一次 2bit 量化的失败"
date: 2026-11-11
tags: [minimaxh3, ComfyUI, 量化, 视频]
summary: "五天内补三处代码把 Qwen-Image-2.1-Turbo 接进 ComfyUI，却证明 Q2_K 量化会摧毁文本条件；顺手修掉 H3 长度硬编码与整轨杂音。"
---

## 接入 Qwen-Image-2.1-Turbo

AtomicChat 版 GGUF 在仓库里明写「Not run yet in ComfyUI」，实际接进去要补三处：

1. `ComfyUI-GGUF/tools/convert.py` 的 `arch_list` 加上 `ModelQwenImage`，key 分别是 `img_in.weight`、`txt_in.text_norm.weight`、`transformer_blocks.0.attn.norm_q.weight`，否则 denoiser 直接报 Unknown model architecture；
2. `loader.py` 的 `gguf_clip_loader` 对纯文本导出的 qwen3vl 注入两个视觉标记键（`deepstack_merger_list.0.norm.weight` 与 `merger.linear_fc2.weight`），让 `detect_te_model` 认成 QWEN3VL_8B；
3. ComfyUI 的 KSampler 没有 sigmas 输入，自定义调度得走 `KSamplerSelect + ManualSigmas + SamplerCustom`。

补完能跑，文生图与参考图各存成一份工作流。

## Q2_K 把文本通路抹平了

接着是最反直觉的发现：Q2_K 量化版本对所有提示词都产出同一张「卧室男人」，猫、闸门、英文提示全都不跟随。但证据链很干净：

- conditioning 确实进到了模型（猫 vs 空白的平均差 48）；
- 文本编码器语义正常（猫-狗相似度 0.988，高于猫-男人 0.944）；
- DiT 的 `txt_in` / `img_in` 是 BF16，没被量化。

问题只可能出在 transformer blocks 的 Q2_K：图像通路（噪声 + 参考图）完好，文本通路被量化抹平。这也解释了为什么 img2img 还能用。结论写进了卡：**2bit 量化对需要文本条件的文生图不可用**。

## H3 的长度硬编码与整轨锁死

两个隐蔽 bug。一是工作流 `length` 字段硬编码 124，改参数不生效；批量修了 6 个工作流，当前在用的 4 个已确认。二是「人声前杂音」：`AddGuide` 只钉住台词几帧，锁定点之前那段未锁区域会朝目标音频「预热」出渐强杂音。解法是整轨锁死——静音 + 台词 + 静音合成一条 48k 立体声轨，句首尾 30ms/20ms 淡入淡出，只放一个 `AddGuide frame_idx=0`。

## 剪映只做精修

自动剪辑的结论没变：`draft_content.json` 在剪映 7+ / 草稿 10.8 以上是密文，程序化生成工程文件这条路封死。computer-use 操作剪映可行但娇气（拖拽必须 `strategy: "event"`，批量导入要 `Ctrl+L` + 通配符 + `Ctrl+A`）。所以最终形态是 ffmpeg 拼接出片，剪映退到精修位。

## 下周

换 Q4_K 以上精度复测同一组提示词，把「2bit 不可用」的边界钉准；再把关键帧、分段、拼接串成一条命令。