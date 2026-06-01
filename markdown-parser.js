const BLOCK_START = /^(#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+|```|---+\s*$|\|.+\|)/;
const SAFE_URL = /^(https?:|mailto:|tel:|#|\.\/|\.\.\/|\/)/i;

export function parseMarkdown(source) {
  const { attributes, body } = parseFrontMatter(source || "");
  const state = {
    html: [],
    toc: [],
    slugs: new Map()
  };

  renderBlocks(body.replace(/\r\n?/g, "\n").split("\n"), state);

  return {
    attributes,
    toc: state.toc,
    html: state.html.join("\n")
  };
}

export function parseFrontMatter(source) {
  const normalized = String(source || "").replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { attributes: {}, body: normalized };
  }

  const end = normalized.indexOf("\n---", 4);
  if (end === -1) {
    return { attributes: {}, body: normalized };
  }

  const rawAttributes = normalized.slice(4, end).trim();
  const body = normalized.slice(end + 4).replace(/^\n/, "");
  const attributes = {};

  rawAttributes.split("\n").forEach((line) => {
    const match = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (!match) return;

    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    attributes[key] = value.includes(",")
      ? value.split(",").map((item) => item.trim()).filter(Boolean)
      : value;
  });

  return { attributes, body };
}

export function renderMarkdown(source, target) {
  const parsed = parseMarkdown(source);
  target.innerHTML = parsed.html;
  return parsed;
}

function renderBlocks(lines, state) {
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      index = renderFence(lines, index, state);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = uniqueSlug(text, state.slugs);
      state.toc.push({ id, level, text });
      state.html.push(`<h${level} id="${id}">${renderInline(text)}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^---+\s*$/.test(line.trim())) {
      state.html.push("<hr>");
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      index = renderBlockquote(lines, index, state);
      continue;
    }

    if (isTableStart(lines, index)) {
      index = renderTable(lines, index, state);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      index = renderList(lines, index, state);
      continue;
    }

    index = renderParagraph(lines, index, state);
  }
}

function renderFence(lines, index, state) {
  const language = lines[index].replace(/^```/, "").trim();
  const code = [];
  let cursor = index + 1;

  while (cursor < lines.length && !lines[cursor].startsWith("```")) {
    code.push(lines[cursor]);
    cursor += 1;
  }

  const langClass = language ? ` class="language-${escapeAttribute(language)}"` : "";
  state.html.push(`<pre><code${langClass}>${escapeHtml(code.join("\n"))}</code></pre>`);
  return Math.min(cursor + 1, lines.length);
}

function renderBlockquote(lines, index, state) {
  const quote = [];
  let cursor = index;

  while (cursor < lines.length && /^>\s?/.test(lines[cursor])) {
    quote.push(lines[cursor].replace(/^>\s?/, ""));
    cursor += 1;
  }

  const nested = { html: [], toc: state.toc, slugs: state.slugs };
  renderBlocks(quote, nested);
  state.html.push(`<blockquote>${nested.html.join("\n")}</blockquote>`);
  return cursor;
}

function renderTable(lines, index, state) {
  const headers = splitTableRow(lines[index]);
  const alignments = splitTableRow(lines[index + 1]).map((cell) => {
    if (/^:-+:$/.test(cell)) return "center";
    if (/^-+:$/.test(cell)) return "right";
    if (/^:-+$/.test(cell)) return "left";
    return "";
  });
  const rows = [];
  let cursor = index + 2;

  while (cursor < lines.length && /\|/.test(lines[cursor]) && lines[cursor].trim()) {
    rows.push(splitTableRow(lines[cursor]));
    cursor += 1;
  }

  const head = headers
    .map((cell, cellIndex) => tableCell("th", cell, alignments[cellIndex]))
    .join("");
  const body = rows
    .map((row) => `<tr>${row.map((cell, cellIndex) => tableCell("td", cell, alignments[cellIndex])).join("")}</tr>`)
    .join("");

  state.html.push(`<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`);
  return cursor;
}

function renderList(lines, index, state) {
  const ordered = /^\s*\d+\.\s+/.test(lines[index]);
  const tag = ordered ? "ol" : "ul";
  const matcher = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*+]\s+/;
  const items = [];
  let cursor = index;

  while (cursor < lines.length && matcher.test(lines[cursor])) {
    items.push(lines[cursor].replace(matcher, "").trim());
    cursor += 1;
  }

  state.html.push(`<${tag}>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</${tag}>`);
  return cursor;
}

function renderParagraph(lines, index, state) {
  const paragraph = [];
  let cursor = index;

  while (cursor < lines.length && lines[cursor].trim() && !BLOCK_START.test(lines[cursor])) {
    paragraph.push(lines[cursor].trim());
    cursor += 1;
  }

  state.html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  return cursor;
}

function renderInline(value) {
  const codeTokens = [];
  let output = String(value || "").replace(/`([^`]+)`/g, (_, code) => {
    const token = `\u0000CODE${codeTokens.length}\u0000`;
    codeTokens.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  output = escapeHtml(output);
  output = output.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_, alt, url, title) => {
    const safeUrl = sanitizeUrl(url);
    const safeTitle = title ? ` title="${escapeAttribute(title)}"` : "";
    return `<img src="${safeUrl}" alt="${escapeAttribute(alt)}"${safeTitle}>`;
  });
  output = output.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_, label, url, title) => {
    const safeUrl = sanitizeUrl(url);
    const safeTitle = title ? ` title="${escapeAttribute(title)}"` : "";
    return `<a href="${safeUrl}"${safeTitle}>${label}</a>`;
  });
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  output = output.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  output = output.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  output = output.replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>");

  codeTokens.forEach((html, tokenIndex) => {
    output = output.replace(`\u0000CODE${tokenIndex}\u0000`, html);
  });

  return output;
}

function isTableStart(lines, index) {
  return /\|/.test(lines[index] || "") && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[index + 1] || "");
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function tableCell(tag, value, alignment) {
  const align = alignment ? ` style="text-align:${alignment}"` : "";
  return `<${tag}${align}>${renderInline(value)}</${tag}>`;
}

function uniqueSlug(text, slugs) {
  const base = String(text)
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "section";
  const count = slugs.get(base) || 0;
  slugs.set(base, count + 1);
  return count ? `${base}-${count + 1}` : base;
}

function sanitizeUrl(value) {
  const normalized = String(value || "").trim().replace(/&amp;/g, "&");
  if (normalized.startsWith("//")) return "#";
  if (!SAFE_URL.test(normalized)) return "#";
  return escapeAttribute(normalized);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
