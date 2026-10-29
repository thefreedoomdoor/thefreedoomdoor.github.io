/**
 * 共享的 Markdown 渲染层：构建脚本与 Electron 管理端共用，
 * 保证编辑器预览和最终发布的页面完全一致。
 */

import katex from "katex";
import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import attrs from "markdown-it-attrs";
import container from "markdown-it-container";
import footnote from "markdown-it-footnote";
import mark from "markdown-it-mark";
import taskLists from "markdown-it-task-lists";
import { createHighlighter } from "shiki";

const SHIKI_THEME = "github-dark-default";
const SHIKI_LANGS = [
  "javascript", "typescript", "jsx", "tsx", "json", "bash", "shell",
  "python", "html", "css", "yaml", "markdown", "c", "cpp", "rust", "go",
  "java", "sql", "diff", "latex", "toml", "ini", "powershell",
];

let highlighter = null;
const slugPool = new Set();

export async function initHighlighter() {
  if (!highlighter) {
    highlighter = await createHighlighter({ themes: [SHIKI_THEME], langs: SHIKI_LANGS });
  }
  return highlighter;
}

export function disposeHighlighter() {
  if (highlighter) {
    highlighter.dispose();
    highlighter = null;
  }
}

export function resetSlugs() {
  slugPool.clear();
}

/* ------------------------------ 工具函数 ------------------------------ */

export const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const escapeAttr = escapeHtml;

const pad2 = (n) => String(n).padStart(2, "0");

export function normalizeDate(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  const text = String(value).trim();
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  return text;
}

export function normalizeTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((t) => String(t).trim()).filter(Boolean);
  return String(value).split(/[,，]/).map((t) => t.trim()).filter(Boolean);
}

export function normalizeBool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

export function readingStats(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  const latin = (text.match(/[A-Za-z0-9]+/g) || []).length;
  const chars = cjk + latin;
  return {
    chars,
    words: chars,
    minutes: Math.max(1, Math.round((cjk + latin * 1.6) / 400)),
  };
}

/* 给原始 HTML 里的 h2/h3 补 id，并据此生成目录 */
export function enhanceHeadings(html) {
  const toc = [];
  const output = html.replace(
    /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi,
    (match, tag, attrs, inner) => {
      const text = inner.replace(/<[^>]+>/g, "").trim();
      const existing = /id="([^"]+)"/i.exec(attrs);
      let id = existing ? existing[1] : "";
      let nextAttrs = attrs;
      if (!id) {
        id = slugify(text);
        nextAttrs = `${attrs} id="${escapeAttr(id)}"`;
      }
      toc.push({ level: tag.toLowerCase(), id, text });
      return `<${tag}${nextAttrs}>${inner}</${tag}>`;
    }
  );
  return { html: output, toc };
}

/* ------------------------------ Markdown ------------------------------ */


export function slugify(text) {
  let base = String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) base = "section";
  let id = base;
  let i = 2;
  while (slugPool.has(id)) id = `${base}-${i++}`;
  slugPool.add(id);
  return id;
}

function mathPlugin(md) {
  function isValidDelim(state, pos) {
    const prev = pos > 0 ? state.src.charCodeAt(pos - 1) : -1;
    const next = pos + 1 <= state.src.length ? state.src.charCodeAt(pos + 1) : -1;
    const isSpace = (c) => c === 0x20 || c === 0x09 || c === 0x0a;
    const isDigit = (c) => c >= 0x30 && c <= 0x39;
    // 开头：后面不能是空白或数字（避免把 "$5" 当公式），前面不能紧贴数字
    const canOpen = !isSpace(next) && !isDigit(next) && !isDigit(prev);
    // 结尾：前面不能是空白，后面不能紧贴数字
    const canClose = !isSpace(prev) && !isDigit(next);
    return { canOpen, canClose };
  }

  function mathInline(state, silent) {
    if (state.src[state.pos] !== "$") return false;
    let res = isValidDelim(state, state.pos);
    if (!res.canOpen) {
      if (!silent) state.pending += "$";
      state.pos += 1;
      return true;
    }
    const start = state.pos + 1;
    let match = start;
    while ((match = state.src.indexOf("$", match)) !== -1) {
      let pos = match - 1;
      while (state.src[pos] === "\\") pos -= 1;
      if ((match - pos) % 2 === 1) break;
      match += 1;
    }
    if (match === -1) {
      if (!silent) state.pending += "$";
      state.pos = start;
      return true;
    }
    if (match - start === 0) {
      if (!silent) state.pending += "$$";
      state.pos = start + 1;
      return true;
    }
    res = isValidDelim(state, match);
    if (!res.canClose) {
      if (!silent) state.pending += "$";
      state.pos = start;
      return true;
    }
    if (!silent) {
      const token = state.push("math_inline", "math", 0);
      token.markup = "$";
      token.content = state.src.slice(start, match);
    }
    state.pos = match + 1;
    return true;
  }

  function mathBlock(state, startLine, endLine, silent) {
    const begin = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    if (state.src.slice(begin, begin + 2) !== "$$") return false;

    const first = state.src.slice(begin + 2, max).trim();
    let content = "";
    let nextLine = startLine;

    if (first.endsWith("$$") && first.length >= 4) {
      content = first.slice(0, -2).trim();
      nextLine = startLine + 1;
    } else {
      content = first;
      nextLine = startLine + 1;
      let closed = false;
      while (nextLine < endLine) {
        const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
        const lineMax = state.eMarks[nextLine];
        const line = state.src.slice(lineStart, lineMax);
        if (line.trim().endsWith("$$")) {
          content += "\n" + line.replace(/\$\$\s*$/, "");
          closed = true;
          nextLine += 1;
          break;
        }
        content += "\n" + line;
        nextLine += 1;
      }
      if (!closed) return false;
    }

    if (silent) return true;

    const token = state.push("math_block", "math", 0);
    token.block = true;
    token.content = content.trim();
    token.map = [startLine, nextLine];
    token.markup = "$$";
    state.line = nextLine;
    return true;
  }

  md.inline.ruler.after("escape", "math_inline", mathInline);
  md.block.ruler.after("blockquote", "math_block", mathBlock, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
}

function calloutPlugin(md) {
  const pattern = /^\[!(NOTE|TIP|IMPORTANT|WARNING|DANGER)\]\s*/;

  md.core.ruler.push("callouts", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== "blockquote_open") continue;

      let inlineIndex = -1;
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type === "blockquote_close") break;
        if (tokens[j].type === "inline") {
          inlineIndex = j;
          break;
        }
      }
      if (inlineIndex === -1) continue;

      const inline = tokens[inlineIndex];
      const match = pattern.exec(inline.content);
      if (!match) continue;

      const kind = match[1].toLowerCase();
      tokens[i].attrJoin("class", `callout callout-${kind}`);
      if (inline.children && inline.children[0] && inline.children[0].type === "text") {
        inline.children[0].content = inline.children[0].content.replace(pattern, "");
      }
      inline.content = inline.content.replace(pattern, "");

      const title = new state.Token("html_block", "", 0);
      title.content = `<span class="callout-title">${kind}</span>\n`;
      tokens.splice(inlineIndex, 0, title);
      i = inlineIndex;
    }
  });
}

function buildCodeBlock(inner, lang) {
  const label = lang || "text";
  return (
    `<div class="code-block" data-lang="${escapeAttr(label)}">` +
    `<div class="code-head"><span class="code-lang">${escapeHtml(label)}</span>` +
    `<button type="button" class="code-copy" data-copy>复制</button></div>` +
    inner +
    `</div>\n`
  );
}

export function createMarkdown() {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    breaks: false,
  });

  md.use(anchor, { level: [2, 3], slugify });
  md.use(footnote);
  md.use(attrs);
  md.use(mark);
  md.use(taskLists, { enabled: true, label: true });
  md.use(mathPlugin);
  md.use(calloutPlugin);
  md.use(container, "theorem", {
    validate: (params) => params.trim().startsWith("theorem"),
    render: (tokens, idx) => {
      if (tokens[idx].nesting === 1) {
        const title = tokens[idx].info.trim().slice("theorem".length).trim() || "定理";
        return `<div class="theorem"><p class="theorem-title">${escapeHtml(title)}</p>\n`;
      }
      return "</div>\n";
    },
  });

  md.renderer.rules.math_inline = (tokens, idx) => {
    try {
      return katex.renderToString(tokens[idx].content, {
        throwOnError: false,
        displayMode: false,
      });
    } catch (error) {
      return `<code>${escapeHtml(tokens[idx].content)}</code>`;
    }
  };

  md.renderer.rules.math_block = (tokens, idx) => {
    try {
      return (
        `<div class="math-display">` +
        katex.renderToString(tokens[idx].content, {
          throwOnError: false,
          displayMode: true,
        }) +
        `</div>\n`
      );
    } catch (error) {
      return `<pre class="math-fallback">${escapeHtml(tokens[idx].content)}</pre>\n`;
    }
  };

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const info = (token.info || "").trim();
    const lang = info.split(/\s+/)[0] || "";

    if (lang && highlighter) {
      try {
        const html = highlighter.codeToHtml(token.content, {
          lang,
          theme: SHIKI_THEME,
        });
        return buildCodeBlock(html, lang);
      } catch (error) {
        /* 语言未注册时退回纯文本 */
      }
    }
    return buildCodeBlock(
      `<pre class="shiki"><code>${escapeHtml(token.content)}</code></pre>`,
      lang
    );
  };

  md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n';
  md.renderer.rules.table_close = () => "</table></div>\n";

  const defaultImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    token.attrSet("loading", "lazy");
    const title = token.attrGet("title");
    const img = defaultImage
      ? defaultImage(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
    if (!title) return img;
    token.attrSet("title", "");
    return (
      `<span class="fig">${img}` +
      `<span class="fig-cap">${escapeHtml(title)}</span></span>`
    );
  };

  return md;
}
