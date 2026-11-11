---
title: "桌面这一周：PDF 打开方式被劫持、C 盘扫描与表情包"
date: 2026-11-11
tags: [Windows, 运维, 杂记]
summary: "从音频增强的注册表权限，到 PDF 关联被劫持、WizTree 扫盘超时，再到给 VTuber 抓表情包——一周的桌面杂事。"
---

## 音频与蓝屏

起因是电脑卡顿、声音断续。查下来几条硬边界：`MMDevices\...\Properties` 下的 `Disable_SysFx` 即使 UAC 提权到管理员也写不进去，那个键只有 SYSTEM 有写权限，正路是走「设置 → 声音 → 设备 → 音频增强」；普通权限下 `Win32_Process` 读管理员进程的 `ExecutablePath` 返回空，容易误判成「查不到路径」；用 `Get-ChildItem -Recurse` 扫全盘找 exe 会直接跑到超时，应该先查注册表 Run 项、计划任务和已知安装目录。

## PDF 被劫持与旧档案

`11-08` 的会话是「文件打开关联被劫持，每次都问打开方式」：清理掉指向不存在程序的关联项，再删残留的旧用户档案，最后顺手做了个垃圾文件扫描。这类问题的坑在于 `reg query` 在 Git Bash 里的转义——引号层级不对，命令会被拆成两半，得先落成脚本再执行。

## 表情包与 MCP

给 VTuber 用，从 irasutoya 抓了一批日式表情包（开心、生气、尴尬几类），原始图与 `index.json` 一起落盘。另一个会话在装 blender-mcp，结论值得记：给 DeepSeek Harness 加 MCP 连接**别直接改** `storages/mcp_connector.json`，应用运行中会回写覆盖，正确姿势是界面里「添加连接 → 导入 JSON」。

## 其余

Cloudflare Worker 版的 GitPort 加速代理完成部署；VirtualBox 里把课程 PPT 的 1–6 页操作做完。都是小活，但每件都卡过一两次。

## 下周

别再全盘递归搜索；清理脚本一律先备份再动手。