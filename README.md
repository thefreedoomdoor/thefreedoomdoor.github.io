# thefreedomdoor's blog

个人博客。源文件是 Markdown，用 Node 构建成静态 HTML，托管在 GitHub Pages。

线上地址：<https://thefreedoomdoor.github.io>

## 结构

```
content/site.json                 站点文案：标语、关于、项目
content/posts/documents/**.md     文章源文件，目录即层级（最多 3 层）
scripts/build.mjs                 构建：Markdown → HTML
scripts/serve.mjs                 本地预览服务器
assets/css|js                     生成的样式与脚本
assets/img/posts/<slug>/          文章插图
inside/blog.html                  博客全览（生成）
inside/about.html                 ContactMe（生成）
inside/blogs/blog/**.html         文章详情（生成）
```

`inside/**`、`index.html`、`404.html`、`sitemap.xml` 都是构建产物，不要手改。

## 写一篇

用本机管理端（推荐）：

```
_tools/admin/pnpm start
```

或者命令行：

```bash
python _tools/github-accel/new_post.py "文章标题" my-slug
# 编辑 content/posts/documents/weekly/my-slug.md
node scripts/build.mjs
```

## 文章格式

```markdown
---
title: 文章标题
date: 2026-10-29
tags: [GitHub, 排障]
summary: 一句话摘要，会显示在标题下方
kind: note        # note | paper
pin: true         # 可选，置顶
pinnedAt: 2026-10-29T21:00:00+08:00   # 置顶时间，越晚越靠前
---

## 小节标题

正文。支持 $行内公式$ 与：

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

```js
const code = "构建时高亮";
```

![图片说明](/assets/img/posts/my-slug/figure.png "图 1：图注")

> [!NOTE]
> 提示块也支持 TIP / WARNING / DANGER。

::: theorem 定理 1
定理内容。
:::

<span class="hl hl-red">红色</span> / <span class="hl hl-blue">蓝色</span> 等六种颜色。
```

完整示例见 `content/posts/_template.md`。

## 构建与预览

```bash
node scripts/build.mjs      # 构建
node scripts/serve.mjs      # http://127.0.0.1:4000
```

构建会：

- 校验目录层级（≤ 3 层）、slug 唯一、frontmatter
- 用 KaTeX 渲染公式、Shiki 渲染代码，全部在构建时完成
- 生成博客目录树、置顶区、文章页、About、Login、404、sitemap
- 清理上一轮生成、这一轮已不存在的页面

## 发布

```bash
git add -A
git commit -m "post: 文章标题"
git push
```

GitHub Pages 会在一到两分钟内更新。站点是用户主页仓库，直接托管根目录，没有 CI。

## 本地工具（不随仓库发布）

- `_tools/admin/`：Electron 管理端，负责写作、预览、构建、推送
- `_tools/github-accel/`：GitHub 加速与周报自动化
- `procedures/`：踩坑记录

这些目录已加入 `.git/info/exclude` 与 `.gitignore`，不会出现在线上。**不要手动提交它们**：`_tools/admin/config.json` 里有本机密码哈希，`runtime.yaml` 里有代理凭据。

## 登录说明

GitHub Pages 是纯静态托管，网页端没有、也不应该有账号密码。导航里的 Login 只说明如何在本机管理端操作。
