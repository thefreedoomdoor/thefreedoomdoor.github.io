---
title: "经验卡合集：QQbot 的 16 个坑"
date: 2026-11-01
tags: [经验卡, QQbot, 排障]
summary: "把 QQbot 这半年踩过的 16 个坑整理成卡：抓取、文件、脚本、远程连接。"
---

## 抓取

### B 站视频：先拿 DASH 地址

**现象**：手上只有音频地址，或者把 BV 页面直接喂给 ffmpeg。

**做法**：先调 playurl 取 `dash` 里的 video/audio `baseUrl`，再分别下载。`fnval=16` 只返回音频，要选能带视频的取值。

**验证**：ffprobe 能同时读出视频和音频流，时长与源一致。

### DASH 长视频半途截断

**现象**：`ffmpeg -i URL -c copy` 下长片，下完 ffprobe 时长只有源的一半。

**做法**：先按 `content-range` 拿总字节数，分段下载后核对字节数，再用 ffprobe 核时长。老版本 curl 没有 `--retry-all-errors`，别依赖它。

**验证**：本地字节数等于 content-range 总大小，时长一致。

### 图片消息空回复

**现象**：HTTP 200 但 content 为空，token 全花在 reasoning 上。

**做法**：请求体里关 thinking；图片用 OpenAI 的 `image_url` 格式。只加 `enable_thinking:false` 对部分中转不够，要确认返回结构。

**验证**：`finish_reason=stop` 且 content 非空，能读出图里的内容。

## 文件

### 配置带 BOM，热加载静默失败

**现象**：用 `encoding="utf-8-sig"` 写 `config.json`，插件反复报 `Unexpected UTF-8 BOM`，配置改动不生效。

**做法**：写配置用无 BOM 的 utf-8；读配置用 `utf-8-sig` 兼容。判断文件头三字节是不是 `EF BB BF`。

**验证**：文件头无 BOM，日志出现「配置已重新加载」。

### 整份上传覆盖运行时状态

**现象**：本地改完 config 整份上传，服务器上由命令写入的状态被旧值覆盖，功能「莫名消失」。

**做法**：把运行时写入的状态放独立文件，config 只保留初始值；读取时优先独立文件。

**验证**：命令设置的值在重启和配置同步后仍然存在。

## 脚本

### 命令被处理两次

**现象**：同一个 `/命令` 出现两次 ack、两次回复。

**做法**：自动入口开头判断是否已由 command handler 处理，避免同时注册两类入口。注意 wake_prefix 会先剥掉 `/`。

**验证**：发一次命令只有一次 ack + 一次最终回复。

### Git Bash 改写了远端路径

**现象**：SFTP 上传报 `FileNotFoundError` 或 `PermissionError`，远端收到的是 `C:/Program Files/Git/home/...`。

**做法**：设 `MSYS_NO_PATHCONV=1`；单文件失败时用 `sftp.open(remote,"wb")` 兜底，并打印 `repr(remote)`。

**验证**：脚本打印的远端路径仍是 `/root/...`，服务器上 ls 得到。

### Windows 的 nice 吃掉 ffmpeg 参数

**现象**：`asyncio.create_subprocess_exec` 调 ffmpeg，`select='not(between(pts,1,4))'` 在 Windows 报 `No such filter: '1'`。

**做法**：`nice` 只在 POSIX 加，Windows 直接执行；不要手工加 `\,` 维护两份表达式。

**验证**：Windows 本机与 Linux 容器跑同一个测试，都输出 5 张拼图。

### 中文乱码

**现象**：接口英文正常，中文变成 `æ½` / `锟斤拷`。

**做法**：不用 `resp.text()`（无 charset 时按 latin-1 猜），改读 bytes 自己 `decode("utf-8")`。

**验证**：`repr(text[:40])` 里有正常汉字，长度量级对得上。

### 精确选帧报 Cannot allocate memory

**现象**：`select` 表达式越写越长，4KB 以上直接报解析错误和内存错误。

**做法**：用定长表达式（Bresenham 生成），或把区间分块、串联多个 `select`（每块 ≤40 段）。`sendcmd` 在 7.1 上不生效。

**验证**：输出帧数与目标集合完全一致，对比 `showinfo` 的 pts 列表。

### 关键帧在旧版 ffmpeg 里为空

**现象**：`-skip_frame nokey -show_frames` 在 ffmpeg 4.2 输出全是空行，7.1 正常。

**做法**：改用 `show_packets`，按行 split，第二列含 `K` 才取 `pts_time`。

**验证**：4.2 与 7.1 返回相同的关键帧时间。

### VAD 的 pop 返回 None

**现象**：`vad.pop()` 之后 `seg.start` 报 `AttributeError: 'NoneType'`。

**做法**：用 `vad.front` 取段，先复制 samples 再 pop；`flush()` 之后同样用 front。

**验证**：段数大于 0，start/end 单调递增，与音频时长匹配。

### 思考过程混进回复

**现象**：回复开头出现「用户说……要安慰一下」这类元叙述，历史里能看到 `<think>`。

**做法**：`on_llm_request` 清历史 think，`on_llm_response` 清 `completion_text` 和 `reasoning_content`，`on_decorating_result` 删 think 组件；只清 LLM 结果，别碰命令结果。

**验证**：单测全过；真实历史抽检只改泄露样本，正常回复不动。

## 工具

### SFTP 失败留下 0 字节

**现象**：`sftp.get` 会先创建本地文件再拉数据，远端不存在时留下 0 字节，把上一轮的好文件覆盖掉。

**做法**：先 `stat` 再 `get`，下载到临时文件，校验大小后 `os.replace`。

**验证**：本地大小等于远端 stat 大小且非 0。

### SSH 连发被限流，后台任务挂住

**现象**：连续连服务器第 2–3 次报 `Error reading SSH protocol banner` / `10054`；`nohup ... &` 之后 ssh 一直不返回。

**做法**：重试退避 8/16/24/32/40 秒；一次连接做完上传、执行、取回；后台任务用 `nohup ... >log 2>&1 </dev/null &`，启动命令给 10–20 秒短超时，再另开连接轮询日志。

**验证**：退避后命令返回；`pgrep` / `tail` 能看到后台任务在跑。

### VirtualBox 限速把 VM 启动卡死

**现象**：用 `VBoxManage bandwidthctl ... add Limit --type network` 后，VM 冷启动卡在网卡重命名，SSH 永不就绪。

**做法**：不在 VM 层面用带宽组，改在 VM 内用 `tc` + `ifb` 限下行，`tbf` 限上行。

**验证**：VM 能正常启动到 SSH，实测下载约 600–650 KB/s。
