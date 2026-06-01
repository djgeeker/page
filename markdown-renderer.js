import { parseMarkdown } from "./markdown-parser.js";

const DEFAULT_SELECTOR = "[data-markdown-src], [data-markdown-inline]";

document.addEventListener("DOMContentLoaded", () => {
  renderMarkdownElements();
});

export async function renderMarkdownElements(root = document) {
  const elements = Array.from(root.querySelectorAll(DEFAULT_SELECTOR));
  const results = [];

  for (const element of elements) {
    results.push(await renderMarkdownElement(element));
  }

  return results;
}

export async function renderMarkdownElement(element) {
  const source = await readMarkdownSource(element);
  const parsed = parseMarkdown(source);

  element.innerHTML = parsed.html;
  element.dataset.markdownRendered = "true";

  updateTitle(element, parsed);
  updateMeta(element, parsed);
  updateToc(element, parsed);

  return parsed;
}

export async function renderMarkdownFile(src, target, options = {}) {
  const source = await fetchMarkdown(src);
  const parsed = parseMarkdown(source);
  target.innerHTML = parsed.html;

  if (options.titleTarget) {
    setText(resolveTarget(options.titleTarget), getTitle(parsed));
  }

  if (options.metaTarget) {
    setText(resolveTarget(options.metaTarget), formatMeta(parsed.attributes));
  }

  if (options.tocTarget) {
    renderToc(resolveTarget(options.tocTarget), parsed.toc);
  }

  return parsed;
}

async function readMarkdownSource(element) {
  const inline = element.dataset.markdownInline;
  if (inline) return inline;

  const src = resolveMarkdownSrc(element);
  if (!src) return element.textContent || "";

  try {
    return await fetchMarkdown(src);
  } catch (error) {
    element.dataset.markdownRendered = "error";
    return [
      "# Markdown load failed",
      "",
      `File: \`${src}\``,
      "",
      error instanceof Error ? error.message : "Unknown error"
    ].join("\n");
  }
}

function resolveMarkdownSrc(element) {
  const paramName = element.dataset.markdownParam;
  if (!paramName) return element.dataset.markdownSrc;

  const params = new URLSearchParams(window.location.search);
  const requested = params.get(paramName) || element.dataset.markdownDefault;
  if (!requested) return element.dataset.markdownSrc;

  const base = element.dataset.markdownBase || "";
  const filename = requested.endsWith(".md") ? requested : `${requested}.md`;
  const safeFilename = filename
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
  return `${base}${safeFilename}`;
}

async function fetchMarkdown(src) {
  const response = await fetch(src, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function updateTitle(element, parsed) {
  const selector = element.dataset.markdownTitle;
  if (!selector) return;

  setText(resolveTarget(selector, element), getTitle(parsed));
}

function updateMeta(element, parsed) {
  const selector = element.dataset.markdownMeta;
  if (!selector) return;

  setText(resolveTarget(selector, element), formatMeta(parsed.attributes));
}

function updateToc(element, parsed) {
  const selector = element.dataset.markdownToc;
  if (!selector) return;

  renderToc(resolveTarget(selector, element), parsed.toc);
}

function renderToc(target, toc) {
  if (!target) return;

  const items = toc.filter((item) => item.level <= 3);
  if (!items.length) {
    target.replaceChildren();
    target.hidden = true;
    return;
  }

  target.hidden = false;
  target.innerHTML = items
    .map((item) => `<a href="#${item.id}" data-level="${item.level}">${escapeHtml(item.text)}</a>`)
    .join("");
}

function getTitle(parsed) {
  const title = parsed.attributes.title;
  if (Array.isArray(title)) return title[0] || "";
  return title || "Untitled";
}

function formatMeta(attributes) {
  const parts = [];
  if (attributes.date) parts.push(toText(attributes.date));
  if (attributes.category) parts.push(toText(attributes.category));
  if (attributes.tags) parts.push(Array.isArray(attributes.tags) ? attributes.tags.join(" / ") : attributes.tags);
  return parts.join(" · ");
}

function resolveTarget(selectorOrElement, scope = document) {
  if (!selectorOrElement) return null;
  if (selectorOrElement instanceof Element) return selectorOrElement;
  return scope.closest(".simple-panel")?.querySelector(selectorOrElement)
    || document.querySelector(selectorOrElement);
}

function setText(target, value) {
  if (!target || !value) return;
  target.textContent = value;
}

function toText(value) {
  return Array.isArray(value) ? value.join(" / ") : value;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
