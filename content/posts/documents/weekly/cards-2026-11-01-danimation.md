---
title: "经验卡合集：danimation 的声音与工作流"
date: 2026-11-01
tags: [经验卡, danimation, 工作流]
summary: "danimation 的 11 张卡：工作流缓存、旋律生成、音色与混音。"
---

## 工作流

### 修订运行丢参数

**现象**：用 AmendWorkflow 续跑带 launch 参数的工作流后，运行详情里 Launch arguments 变成空对象，参数代理开始提议一部新片。

**做法**：修订前在脚本里合并默认值。`args` 是冻结对象，不能 `Object.assign`，要新建对象展开。

**验证**：新运行的参数提示里能看到原始键值；制片阶段 0 秒结算（命中缓存），片名不变。

### manifest 审计仍报旧失败

**现象**：manifest 已经压到上限内，重跑或修订后仍报同一句 audit failed，字节数是修之前的旧值。

**做法**：audit 结果来自 journal，不会重读磁盘文件；给失败的 audit 调用加一个显式参数，改变缓存键后再跑。

**验证**：单独跑 audit 返回 `"ok": true`；新运行日志不再出现旧字节数。

### motif 写 rest 报错

**现象**：motif 里写 `["rest",1]` 或 `[null,1]`，展开时报 `bad note name: 'rest'`。

**做法**：`motif_notes` 把 rest/None 映射成 None，`transform_motif` 保留，`_melody` 遇到 None 只推进 cursor、不发声。

**验证**：`motif_notes([["C5",1],["rest",1],["E5",2]])` 返回 `[(72,1),(None,1),(76,2)]`，expand 有 2 个音。

### 字幕卡数门禁冲突

**现象**：2 分钟片、锁定分镜只有 4 张卡，字幕阶段两轮后报 card count 不在 6–10。

**做法**：门禁以锁定分镜为准，只查零卡片；不要在字幕阶段往 timeline 加卡。

**验证**：门禁不再报 card count，SRT 校验通过，卡片数与锁定分镜一致。

### 换 family 后空测报错

**现象**：render 正常，verify 报 family stems sum to mix 7.2 dB；刚把某个 part 的 family 从 melody 改成 harmony。

**做法**：换 family 后先清空 family stem 目录再 render。`--keep-stems` 只写当前 families，不会删旧 wav。

**验证**：verify 空测 ≤ -60 dB（这次是 -101.5 dB）。

### 结尾旋律丢音

**现象**：最后一小节的最后一个音没响，expand 事件数比谱面少一个。

**做法**：`_melody()` 用最后一小节的 `bar_end` 作段落终点，motif 和 generated contour 两个分支都要改。

**验证**：1 小节、1 个 4 拍音的测试谱，expand 后 lead 事件数=1、t=0。

## 音色与混音

### 主旋律被混响盖住

**现象**：加 pad/竖琴后钢琴不突出，分段落算 melody 与 harmony+texture 的 RMS 只差 0–1 dB。

**做法**：pad/竖琴的 send 从 0.6 降到 0.2–0.3，`mix.reverb_gain` 从 0.34 降到 0.15–0.2；pad 的 family 设成 texture；主旋律 send 0.35–0.45。

**验证**：按段算 RMS，主旋律比伴奏高 3–8 dB；solo 不炸。

### 伴奏低八度

**现象**：pad/左手比谱面低一个八度，events.json 里的 midi 比预期低 12。

**做法**：`voice_lead(None, chord, octave)` 的候选从 `octave-1` 开始，没有 prev 时取中心最接近的候选；或者把 part 的 octave +1 抵消。

**验证**：`voice_lead(None,"C",4)` 的中心音落在 C4–B4，而不是 C3。

### 单钢琴声音炸

**现象**：solo 每个音一样响；改 `parts[].velocity` 后 render_info 完全不变。

**做法**：在 `render_event()` 出口加力度到电平的映射；`VELOCITY_DB` 给动态深度（钢琴 24、pad 14、sub 12、打击 16–18），mix 峰值 -6 dBFS。

**验证**：MIDI 60 / vel 0.5 峰值约 -6 dBFS；0.3 与 0.7 的 RMS 差大于 6 dB。

### 旋律没有句法

**现象**：每个音一样响，没有起句和收句，solo 尤其明显。

**做法**：`_melody()` 加乐句拱形和长音/反拍重音，humanize 用 ±10%。

**验证**：events.json 的 lead velocity 有 min/mean/max 分布，句中略高于句首句尾。

### 母带太响压平动态

**现象**：-16 LUFS 但 true peak 很低，comp/lim GR 很大，听着顶、没有弱起。

**做法**：solo/acoustic 设 -18…-20 LUFS，混音峰值 -6 dBFS；A/B 前先把两版响度对齐。

**验证**：-20 LUFS 版 LRA 比 -16 版大 2–4 dB，comp/lim 接近 0。
