---
title: "博客：从 GitHub Pages 搬到 Cloudflare Pages"
date: 2026-11-11
tags: [博客, Cloudflare, 部署]
summary: "接上 Cloudflare Pages：push 自动部署、两站逐字节一致，顺带解决沙箱写权限与 8000011 授权报错。"
---

## 为什么搬

站点一直是「本地构建 → 产物直接提交 → GitHub Pages 托管仓库根目录」。这套流程没有 CI、没有缓存层，想加自定义域名也只能靠 Cloudflare 反代。所以这次直接接到 Cloudflare Pages：仓库不变，push 之后自动构建部署。

## 怎么接的

新建项目 `thefreedoomdoor`，来源选 GitHub 仓库，生产分支 `main`，**构建命令留空、输出目录填 `/`**——因为 HTML 是本地构建好后提交的，Cloudflare 不需要再跑一遍构建。

第一次用 API 建项直接吃了 401：

```
error code 8000011: There is an internal issue with your Cloudflare Pages Git installation.
```

这不是代码问题，是 GitHub App 没装。去 dashboard 走一遍 Connect to Git 的授权，回来再建就成功了。

## 卡住的不是 Cloudflare，是本机沙箱

真正耗时间的是 Windows 侧的写权限：根目录有沙箱授权 ACE，但 `content/`、`assets/` 这些**早于授权就存在的子目录**既没有继承 ACE，也没打低完整性标签，于是构建在拷贝 KaTeX 时挂掉：

```
EPERM: operation not permitted, copyfile
  '...\node_modules\katex\dist\katex.min.css' -> '...\assets\vendor\katex\katex.min.css'
```

补法是给这些目录重建继承关系并统一打 `Low` 完整性标签，之后 `node scripts/build.mjs` 在正常权限下就能 exit 0，不再需要提权。顺带还确认了本机两个环境事实：`curl` 走 HTTPS 全失败（一律返回 000），验证网络只能用 Node 内置的 fetch；`wrangler` 的 npm shim 会 spawn 子进程，在沙箱里报 EPERM，得绕开 shim 直接跑它的真实入口脚本。

## 验证

- `/`、`/sitemap.xml`、`/inside/blog.html`、文章页与静态资源全部 200，且与 GitHub Pages **逐字节一致**；
- 不存在的路径返回 404 + 自定义错误页；
- 推一个空提交，Cloudflare 15 秒内生成部署并上线，`deployment_trigger.type` 是 `github:push`。

现在两个地址同时可用。自定义域名暂时搁置——账户里还没有域名，而免费的 `.us.kg` / `.eu.org` 都要走 NS 委托，等真的需要再说。