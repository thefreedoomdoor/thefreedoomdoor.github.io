#!/usr/bin/env node
/**
 * 静态博客构建：content/ → 根目录 HTML
 *
 * 产物：
 *   index.html                    首页
 *   inside/blog.html              博客全览（目录树 + 搜索 + 排序 + 置顶）
 *   inside/about.html             ContactMe
 *   inside/blogs/blog/**.html     文章详情
 *   404.html / sitemap.xml
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createMarkdown,
  disposeHighlighter,
  enhanceHeadings,
  escapeAttr,
  escapeHtml,
  initHighlighter,
  normalizeBool,
  normalizeDate,
  normalizeTags,
  readingStats,
  resetSlugs,
} from "./markdown.mjs";

import fg from "fast-glob";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import attrs from "markdown-it-attrs";
import container from "markdown-it-container";
import footnote from "markdown-it-footnote";
import mark from "markdown-it-mark";
import taskLists from "markdown-it-task-lists";
import katex from "katex";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");
const POSTS_DIR = path.join(CONTENT, "posts", "documents");
const SITE_JSON = path.join(CONTENT, "site.json");
const OUT_ARTICLES = path.join(ROOT, "inside", "blogs", "blog");
const KATEX_SRC = path.join(ROOT, "node_modules", "katex", "dist");
const KATEX_OUT = path.join(ROOT, "assets", "vendor", "katex");
const MANIFEST = path.join(ROOT, "_tools", ".build-manifest.json");


const written = [];

/* ------------------------------ 内容读取 ------------------------------ */

async function readPosts() {
  const files = await fg("**/*.md", {
    cwd: POSTS_DIR,
    absolute: false,
    onlyFiles: true,
    dot: false,
  });

  const posts = [];
  const errors = [];

  for (const rel of files.sort()) {
    const full = path.join(POSTS_DIR, rel);
    const raw = await fs.readFile(full, "utf8");
    const parsed = matter(raw);
    const fm = parsed.data || {};
    const segments = rel.split("/");
    const file = segments.pop();
    const slug = file.replace(/\.md$/i, "");

    if (segments.length > 3) {
      errors.push(`${rel}：目录层级 ${segments.length} 层，最多 3 层`);
      continue;
    }
    if (normalizeBool(fm.draft)) continue;

    const title = String(fm.title || slug).trim();
    if (!title) {
      errors.push(`${rel}：缺少 title`);
      continue;
    }

    const outPath = path
      .join("inside", "blogs", "blog", ...segments, `${slug}.html`)
      .split(path.sep)
      .join("/");

    posts.push({
      rel,
      full,
      slug,
      title,
      date: normalizeDate(fm.date),
      tags: normalizeTags(fm.tags),
      summary: String(fm.summary || "").trim(),
      kind: String(fm.kind || "note").trim(),
      bibtex: String(fm.bibtex || "").trim(),
      pin: normalizeBool(fm.pin),
      pinnedAt: normalizeDate(fm.pinnedAt || fm["pinned-at"] || fm.date),
      folderSegments: segments,
      url: "/" + outPath,
      outPath,
      body: parsed.content,
    });
  }

  if (errors.length) {
    throw new Error("内容校验失败：\n  " + errors.join("\n  "));
  }

  const seen = new Set();
  for (const post of posts) {
    if (seen.has(post.outPath)) {
      throw new Error(`输出路径重复：${post.outPath}（检查 slug 是否同名）`);
    }
    seen.add(post.outPath);
  }

  return posts;
}

async function readSite() {
  const raw = await fs.readFile(SITE_JSON, "utf8");
  const data = JSON.parse(raw);
  data.site = data.site || {};
  data.home = data.home || {};
  data.about = data.about || {};
  data.home.slogans = (data.home.slogans || []).filter(
    (s) => typeof s === "string" && s.trim()
  );
  return data;
}

/* ------------------------------ 页面模板 ------------------------------ */

const NAV_ITEMS = [
  { key: "home", label: "Home", href: "/" },
  { key: "blog", label: "Blog", href: "/inside/blog.html" },
  { key: "about", label: "ContactMe", href: "/inside/about.html" },
];

function navHtml(active) {
  const links = NAV_ITEMS.map((item) => {
    const current = item.key === active ? ' aria-current="page"' : "";
    return `<a class="nav-link" href="${item.href}"${current}>${item.label}</a>`;
  }).join("");

  return `
<header class="site-nav" id="siteNav">
  <div class="nav-inner">
    <a class="brand" href="/">thefreedomdoor<span class="brand-dot">.</span></a>
    <nav class="nav-links" aria-label="主导航">${links}</nav>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="mobileMenu" aria-label="打开菜单">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
    </button>
  </div>
  <div class="progress" aria-hidden="true"><span></span></div>
</header>
<div class="mobile-menu" id="mobileMenu">${links}</div>`;
}

function footHtml(site) {
  const meta = site.site || {};
  const year = new Date().getFullYear();
  return `
<footer class="site-foot">
  <div class="foot-inner">
    <span>© ${year} ${escapeHtml(meta.author || meta.title || "")}</span>
  </div>
</footer>`;
}

function layout({
  site,
  title,
  description,
  active = "",
  body,
  bodyClass = "",
  needsMath = false,
  needsProse = false,
  scripts = [],
  canonical = "",
}) {
  const meta = site.site || {};
  const siteTitle = meta.title || "";
  const fullTitle = title ? `${title} · ${siteTitle}` : siteTitle;
  const pageUrl = meta.url ? meta.url.replace(/\/$/, "") + canonical : "";
  const pageDesc = description || meta.description || "";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeAttr(pageDesc)}">
<meta name="theme-color" content="#08090a">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeAttr(fullTitle)}">
<meta property="og:description" content="${escapeAttr(pageDesc)}">
${pageUrl ? `<meta property="og:url" content="${escapeAttr(pageUrl)}">` : ""}
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/site.css">
<link rel="stylesheet" href="/assets/css/print.css" media="print">
${needsProse ? '<link rel="stylesheet" href="/assets/css/prose.css">' : ""}
${needsMath ? '<link rel="stylesheet" href="/assets/vendor/katex/katex.min.css">' : ""}
</head>
<body class="${bodyClass}">
${navHtml(active)}
${body}
${footHtml(site)}
<script src="/assets/js/site.js" defer></script>
${scripts.map((src) => `<script src="${src}" defer></script>`).join("\n")}
</body>
</html>
`;
}

/* ------------------------------ 首页 ------------------------------ */

function renderHome(site, posts) {
  const home = site.home;
  const meta = site.site || {};
  const slogans = home.slogans.length
    ? home.slogans
    : ["Welcome to my blog!"];
  const latest = posts
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
  const dataText = JSON.stringify(slogans).replace(/'/g, "&#39;");

  const body = `
<main class="hero">
  <div class="hero-inner">
    <p class="kicker">${escapeHtml(home.kicker || "NOTES / 随笔")}</p>
    <h1 class="hero-title"><span id="typewriter" data-text='${dataText}'>${escapeHtml(slogans[0])}</span><span class="caret" aria-hidden="true"></span></h1>
    <p class="hero-sub">${escapeHtml(home.subtitle || meta.description || "")}</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="/inside/blog.html">阅读博客</a>
      <a class="btn btn-ghost" href="/inside/about.html">关于我</a>
    </div>
    <div class="hero-meta">
      <span>${posts.length} 篇文章</span>
      ${latest ? `<span>最后更新 ${escapeHtml(latest.date)}</span>` : ""}
      <span>${escapeHtml(meta.author || "")}</span>
    </div>
    <p class="hero-hint">scroll <span>↓</span></p>
  </div>
</main>`;

  return layout({
    site,
    title: "",
    description: site.description,
    active: "home",
    body,
    canonical: "/",
    scripts: ["/assets/js/hero.js"],
  });
}

/* ------------------------------ 博客树 ------------------------------ */

function countPosts(node) {
  let total = node.posts.length;
  for (const child of node.folders.values()) total += countPosts(child);
  return total;
}

function postItemHtml(post) {
  const tags = post.tags.length
    ? `<span class="tagline">${post.tags
        .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
        .join("")}</span>`
    : "";
  const search = [post.title, post.tags.join(" "), post.folderSegments.join(" ")]
    .join(" ")
    .toLowerCase();

  return `
<li class="tree-post" data-date="${escapeAttr(post.date)}" data-title="${escapeAttr(post.title)}" data-search="${escapeAttr(search)}">
  <a href="${post.url}">
    <span class="file-icon" aria-hidden="true">📄</span>
    <span class="post-title">${escapeHtml(post.title)}</span>
    <time datetime="${escapeAttr(post.date)}">${escapeHtml(post.date)}</time>
    ${tags}
  </a>
</li>`;
}

function byDateDesc(a, b) {
  if (a.date === b.date) return a.title.localeCompare(b.title, "zh-Hans-CN");
  return a.date < b.date ? 1 : -1;
}

function folderHtml(node, depth) {
  const total = countPosts(node);
  const folders = [...node.folders.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "zh-Hans-CN")
  );
  const posts = node.posts.slice().sort(byDateDesc);

  const children = [
    ...folders.map((child) => folderHtml(child, depth + 1)),
    ...posts.map(postItemHtml),
  ].join("");

  // 只有真的还有子目录才需要收起按钮；根目录 documents 永远展开
  const collapsible = node.folders.size > 0 && depth > 0;
  const head = collapsible
    ? `<button class="tree-row" type="button" aria-expanded="true">
    <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
    <span class="file-icon" aria-hidden="true">📂</span>
    <span class="folder-name">${escapeHtml(node.name)}</span>
    <span class="count">${total}</span>
  </button>`
    : `<div class="tree-row">
    <span class="chev-space" aria-hidden="true"></span>
    <span class="file-icon" aria-hidden="true">📂</span>
    <span class="folder-name">${escapeHtml(node.name)}</span>
    <span class="count">${total}</span>
  </div>`;

  return `
<li class="tree-folder${depth === 0 ? " tree-root" : ""}" data-folder-name="${escapeAttr(node.name)}">
  ${head}
  <ul class="tree-children">${children}</ul>
</li>`;
}

function pinnedHtml(posts) {
  const pinned = posts
    .filter((p) => p.pin)
    .sort((a, b) => {
      if (a.pinnedAt === b.pinnedAt) return byDateDesc(a, b);
      return a.pinnedAt < b.pinnedAt ? 1 : -1;
    });
  if (!pinned.length) return "";

  return `
<li class="tree-folder tree-pinned" data-folder-name="置顶">
  <div class="tree-row">
    <span class="chev-space" aria-hidden="true"></span>
    <span class="file-icon" aria-hidden="true">📌</span>
    <span class="folder-name">置顶</span>
    <span class="count">${pinned.length}</span>
  </div>
  <ul class="tree-children">${pinned.map(postItemHtml).join("")}</ul>
</li>`;
}

function renderBlog(site, posts, root) {
  const treeBody = `<ul class="tree">
${folderHtml(root, 0)}
${pinnedHtml(posts)}
</ul>`;

  const body = `
<main class="page">
  <div class="page-inner blog-shell">
    <aside class="blog-side">
      <p class="kicker">INDEX / 全部文章</p>
      <h1>Blog</h1>
      <p class="blog-count"></p>
    </aside>
    <section class="blog-main">
      <div class="blog-tools">
        <div class="search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input id="blogSearch" type="search" placeholder="搜索标题或标签…" autocomplete="off" aria-label="搜索文章">
        </div>
        <div class="sort-wrap">
          <label for="blogSort">排序</label>
          <select id="blogSort">
            <option value="date-desc">日期新 → 旧</option>
            <option value="date-asc">日期旧 → 新</option>
            <option value="title-asc">标题 A → Z</option>
          </select>
        </div>
      </div>
      ${treeBody}
      <p class="empty-state">没有匹配的文章</p>
    </section>
  </div>
</main>`;

  return layout({
    site,
    title: "Blog",
    description: "全部文章，按目录归档。",
    active: "blog",
    body,
    canonical: "/inside/blog.html",
    scripts: ["/assets/js/blog.js"],
  });
}

/* ------------------------------ 文章页 ------------------------------ */

function renderArticle(site, post, related) {
  resetSlugs();
  const env = {};
  const tokens = md.parse(post.body, env);

  const html = md.renderer.render(tokens, md.options, env);
  const enhanced = enhanceHeadings(html);
  const hasMath =
    html.indexOf('class="katex') !== -1 ||
    tokens.some(
      (token) =>
        token.type === "math_block" ||
        (token.type === "inline" &&
          token.children &&
          token.children.some((child) => child.type === "math_inline"))
    );

  const stats = readingStats(enhanced.html);
  const year = post.date ? post.date.slice(0, 4) : "";
  const kicker = post.kind === "paper" ? `PAPER${year ? " · " + year : ""}` : `NOTE${year ? " · " + year : ""}`;

  const tocHtml = enhanced.toc.length
    ? `<nav class="toc" aria-label="文章目录">
  <p class="toc-title">Contents</p>
  <ul>${enhanced.toc
    .map(
      (item) =>
        `<li class="toc-${item.level}"><a href="#${encodeURIComponent(item.id)}">${escapeHtml(item.text)}</a></li>`
    )
    .join("")}</ul>
</nav>`
    : "";

  const tags = post.tags.length
    ? `<span class="dot"></span><span>${post.tags.map(escapeHtml).join(" · ")}</span>`
    : "";

  const bibtex = post.bibtex
    ? `<details class="bibtex"><summary>BibTeX</summary><pre><code>${escapeHtml(post.bibtex)}</code></pre></details>`
    : "";

  const prev = related.prev
    ? `<a href="${related.prev.url}"><span class="dir">← 上一篇</span> ${escapeHtml(related.prev.title)}</a>`
    : "<span></span>";
  const next = related.next
    ? `<a href="${related.next.url}"><span class="dir">下一篇 →</span> ${escapeHtml(related.next.title)}</a>`
    : "<span></span>";

  const body = `
<main class="article-page">
  <div class="article-shell">
    <article class="article">
      <header class="article-head">
        <p class="kicker">${escapeHtml(kicker)}</p>
        <h1>${escapeHtml(post.title)}</h1>
        <div class="article-meta">
          <time datetime="${escapeAttr(post.date)}">${escapeHtml(post.date)}</time>
          <span class="dot"></span>
          <span>${stats.chars} 字 · ${stats.minutes} 分钟</span>
          ${tags}
        </div>
        ${post.summary ? `<p class="article-summary">${escapeHtml(post.summary)}</p>` : ""}
      </header>
      <div class="article-body prose">
${enhanced.html}${bibtex}
      </div>
      <footer class="article-foot">
        ${prev}
        <a href="/inside/blog.html"><span class="dir">目录</span></a>
        ${next}
      </footer>
    </article>
    ${tocHtml}
  </div>
</main>`;

  return layout({
    site,
    title: post.title,
    description: post.summary || site.description,
    active: "blog",
    body,
    needsMath: hasMath,
    needsProse: true,
    canonical: post.url,
    scripts: enhanced.toc.length ? ["/assets/js/toc.js"] : [],
  });
}

/* ------------------------------ 关于 / 登录 / 404 ------------------------------ */

function renderAbout(site) {
  const about = site.about;
  const initials = (about.name || site.author || "A").trim().slice(0, 1).toUpperCase();

  const avatar = about.avatar
    ? `<img class="avatar" src="${escapeAttr(about.avatar)}" alt="${escapeAttr(about.name || "")}">`
    : `<span class="avatar-fallback">${escapeHtml(initials)}</span>`;

  const links = [];
  if (about.github) {
    links.push(
      `<a class="btn btn-ghost" href="${escapeAttr(about.github)}" target="_blank" rel="noopener">GitHub</a>`
    );
  }
  if (about.gitcode) {
    links.push(
      `<a class="btn btn-ghost" href="${escapeAttr(about.gitcode)}" target="_blank" rel="noopener">GitCode</a>`
    );
  }
  if (about.email) {
    links.push(
      `<a class="btn btn-ghost" href="mailto:${escapeAttr(about.email)}">Email</a>`
    );
  }

  const projects = (about.projects || []).filter((p) => p && p.name);
  const projectsHtml = projects.length
    ? `<section class="side-block">
  <h2>Projects</h2>
  <div class="project-grid">
${projects
  .map(
    (project) => `    <a class="project-card"${project.url ? ` href="${escapeAttr(project.url)}" target="_blank" rel="noopener"` : ""}>
      <h3>${escapeHtml(project.name)}</h3>
      ${project.desc ? `<p>${escapeHtml(project.desc)}</p>` : ""}
      ${project.repo ? `<span class="repo">${escapeHtml(project.repo)}</span>` : ""}
    </a>`
  )
  .join("\n")}
  </div>
</section>`
    : "";

  const body = `
<main class="page">
  <div class="page-inner">
    <header class="page-head">
      <p class="kicker">ABOUT / 关于</p>
      <h1>ContactMe</h1>
    </header>
    <div class="about-grid${projects.length ? "" : " is-single"}">
      <section class="profile-card">
        <div class="profile-top">
          ${avatar}
          <div>
            <h2 class="profile-name">${escapeHtml(about.name || site.author || "站长")}</h2>
            ${about.tagline ? `<p class="profile-tagline">${escapeHtml(about.tagline)}</p>` : ""}
          </div>
        </div>
        <p class="profile-bio">${escapeHtml(about.bio || "还没有填写自我介绍。")}</p>
        <div class="contact-links">${links.join("")}</div>
      </section>
      ${projects.length ? `<aside>${projectsHtml}</aside>` : ""}
    </div>
  </div>
</main>`;

  return layout({
    site,
    title: "ContactMe",
    description: about.tagline || "关于我",
    active: "about",
    body,
    canonical: "/inside/about.html",
  });
}

function render404(site) {
  const body = `
<main class="notfound">
  <div>
    <p class="code">404</p>
    <h1>页面不在这里</h1>
    <p style="color:var(--text-2)">链接可能已经换了位置，或者从来就不存在。</p>
    <p style="margin-top:var(--sp-5)"><a class="btn btn-primary" href="/">回到首页</a></p>
  </div>
</main>`;

  return layout({
    site,
    title: "404",
    description: "页面不存在",
    body,
  });
}

/* ------------------------------ 文件写入 ------------------------------ */

async function write(relPath, content) {
  const full = path.join(ROOT, relPath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf8");
  written.push(relPath.split(path.sep).join("/"));
}

async function copyKatex() {
  await fs.mkdir(KATEX_OUT, { recursive: true });
  await fs.copyFile(
    path.join(KATEX_SRC, "katex.min.css"),
    path.join(KATEX_OUT, "katex.min.css")
  );
  await fs.cp(path.join(KATEX_SRC, "fonts"), path.join(KATEX_OUT, "fonts"), {
    recursive: true,
  });
}

function sitemap(site, posts) {
  const base = (site.url || "").replace(/\/$/, "");
  const entries = [
    { loc: "/", priority: "1.0" },
    { loc: "/inside/blog.html", priority: "0.9" },
    { loc: "/inside/about.html", priority: "0.7" },
    ...posts.map((p) => ({ loc: p.url, priority: "0.8", lastmod: p.date })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${escapeHtml(base + entry.loc)}</loc>
    ${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ""}
    <priority>${entry.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;
}

/* ------------------------------ 主流程 ------------------------------ */

const md = createMarkdown();

async function main() {
  const started = Date.now();

  await initHighlighter();

  const site = await readSite();
  const posts = await readPosts();

  // 目录树根
  const root = { name: site.blog?.rootLabel || "documents", folders: new Map(), posts: [] };
  for (const post of posts) {
    let node = root;
    for (const segment of post.folderSegments) {
      if (!node.folders.has(segment)) {
        node.folders.set(segment, { name: segment, folders: new Map(), posts: [] });
      }
      node = node.folders.get(segment);
    }
    node.posts.push(post);
  }

  // 上一篇 / 下一篇（按日期）
  const ordered = posts.slice().sort(byDateDesc);
  const related = new Map();
  ordered.forEach((post, index) => {
    related.set(post.rel, {
      prev: ordered[index + 1] || null,
      next: ordered[index - 1] || null,
    });
  });

  await copyKatex();

  await write("index.html", renderHome(site, posts));
  await write("inside/blog.html", renderBlog(site, posts, root));
  await write("inside/about.html", renderAbout(site));
  await write("404.html", render404(site));

  for (const post of posts) {
    await write(post.outPath, renderArticle(site, post, related.get(post.rel)));
  }

  const index = posts
    .slice()
    .sort(byDateDesc)
    .map((post) => ({
      title: post.title,
      url: post.url,
      date: post.date,
      tags: post.tags,
      folder: post.folderSegments,
      pin: post.pin,
      summary: post.summary,
    }));
  await write("assets/data/blog-index.json", JSON.stringify(index, null, 2) + "\n");
  await write("sitemap.xml", sitemap(site, posts));

  // 清理上一轮生成、这一轮不再存在的页面（删文章后不留残页）
  try {
    const previous = JSON.parse(await fs.readFile(MANIFEST, "utf8"));
    const keep = new Set(written);
    for (const rel of previous.files || []) {
      if (keep.has(rel)) continue;
      const allowed =
        rel === "index.html" ||
        rel === "404.html" ||
        rel === "sitemap.xml" ||
        rel.startsWith("inside/") ||
        rel.startsWith("assets/data/");
      if (allowed) await fs.rm(path.join(ROOT, rel), { force: true });
    }
  } catch (error) {
    /* 第一次构建没有清单 */
  }

  await fs.mkdir(path.dirname(MANIFEST), { recursive: true });
  await fs.writeFile(
    MANIFEST,
    JSON.stringify({ generatedAt: new Date().toISOString(), files: written }, null, 2),
    "utf8"
  );

  disposeHighlighter();

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`构建完成 ${seconds}s`);
  console.log(`  文章 ${posts.length} 篇 · 页面 ${written.length} 个`);
  console.log(`  置顶 ${posts.filter((p) => p.pin).length} 篇`);
  const deepest = posts.reduce(
    (max, p) => Math.max(max, p.folderSegments.length),
    0
  );
  console.log(`  目录最深 ${deepest} 层`);
}

main().catch((error) => {
  console.error("\n构建失败：");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
