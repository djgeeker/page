import { renderMarkdownFile } from "./markdown-renderer.js";

const timeline = document.querySelector("[data-post-timeline]");
const article = document.querySelector("[data-markdown-article]");
const titleTarget = document.querySelector("[data-markdown-page-title]");
const metaTarget = document.querySelector("[data-markdown-page-meta]");
const tocTarget = document.querySelector("[data-markdown-page-toc]");
const tagFilter = document.querySelector("[data-tag-filter]");
const postsApi = document.body.dataset.postsApi || "./api/tech-posts";
const indexPage = document.body.dataset.indexPage || "./tech-blog.html";
const detailPage = document.body.dataset.detailPage || "./tech-post.html";
const defaultPostId = document.body.dataset.defaultPost || "20260601-markdown-render-demo";
let posts = [];
let sectionObserver = null;

initTechBlog();

async function initTechBlog() {
  posts = await loadPosts();
  const requestedPost = resolveRequestedPost();

  if (!posts.length) {
    renderEmptyState();
    return;
  }

  if (tagFilter) {
    renderTagFilter(posts);
    applyPostFilters();
    window.addEventListener("popstate", applyPostFilters);
  } else {
    renderTimeline(posts, requestedPost?.id);
  }

  if (article) {
    await openPost(requestedPost || posts[0]);
    window.addEventListener("popstate", () => openPost(resolveRequestedPost() || posts[0], { replaceUrl: true }));
    window.addEventListener("hashchange", () => {
      scrollToCurrentHash({ behavior: "smooth" });
      setActiveSection(safeDecode(window.location.hash.slice(1)));
    });
  }
}

async function loadPosts() {
  try {
    const response = await fetch(postsApi, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch {
    return [{
      id: defaultPostId,
      title: "Markdown Auto Rendering",
      date: "2026-06-01",
      time: "",
      category: "Frontend",
      tags: ["Markdown", "Static Blog", "Rendering"],
      href: "./content/tech-blog/markdown-render-demo.md",
      filename: "markdown-render-demo.md"
    }];
  }
}

function renderTimeline(items, activeId = "") {
  if (!timeline) return;

  if (!items.length) {
    timeline.innerHTML = '<p class="post-empty">No posts match this tag.</p>';
    return;
  }

  timeline.innerHTML = items
    .map((post, index) => {
      const active = activeId ? post.id === activeId : index === 0;
      return `
        <a class="post-node${active ? " is-active" : ""}" href="${detailPage}?post=${encodeURIComponent(post.id)}" data-post-id="${escapeAttribute(post.id)}">
          <span class="post-node-line" aria-hidden="true"></span>
          <span class="post-node-title">${escapeHtml(post.title)}</span>
          <time class="post-node-date" datetime="${escapeAttribute(post.date || "")}">${escapeHtml(formatPostDate(post))}</time>
        </a>
      `;
    })
    .join("");

  if (timeline.dataset.timelineBound === "true") return;
  timeline.dataset.timelineBound = "true";

  timeline.addEventListener("click", (event) => {
    if (!article) return;

    const link = event.target.closest("[data-post-id]");
    if (!link) return;

    event.preventDefault();
    const post = posts.find((item) => item.id === link.dataset.postId);
    if (!post) return;

    history.pushState({ post: post.id }, "", `${detailPage}?post=${encodeURIComponent(post.id)}`);
    openPost(post, { scrollToArticle: true });
  });
}

async function openPost(post, options = {}) {
  if (!post || !article) return;

  setActivePost(post.id);
  article.dataset.activePost = post.id;
  await renderMarkdownFile(post.href, article, {
    titleTarget,
    metaTarget,
    tocTarget
  });
  initSectionNav();

  if (window.location.hash && !options.scrollToArticle) {
    scrollToCurrentHash({ behavior: "auto" });
  }

  if (!new URLSearchParams(window.location.search).get("post") && !options.replaceUrl) {
    history.replaceState({ post: post.id }, "", `${detailPage}?post=${encodeURIComponent(post.id)}${window.location.hash}`);
  }

  if (options.scrollToArticle) {
    article.scrollIntoView({ block: "start", behavior: resolveScrollBehavior() });
  }
}

function renderTagFilter(items) {
  const tags = Array.from(new Set(items.flatMap((post) => post.tags || [])))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const activeTag = getRequestedTag();

  tagFilter.innerHTML = `
    <label class="tag-search">
      <span>Tag</span>
      <input type="search" data-tag-search placeholder="Search tags" value="${escapeAttribute(activeTag === "all" ? "" : activeTag)}">
    </label>
    <div class="tag-list" data-tag-list>
      <button type="button" class="tag-chip${activeTag === "all" ? " is-active" : ""}" data-tag-value="all">All</button>
      ${tags.map((tag) => `<button type="button" class="tag-chip${normalizeTag(tag) === normalizeTag(activeTag) ? " is-active" : ""}" data-tag-value="${escapeAttribute(tag)}">${escapeHtml(tag)}</button>`).join("")}
    </div>
  `;

  tagFilter.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tag-value]");
    if (!button) return;
    const tag = button.dataset.tagValue || "all";
    updateTagUrl(tag);
    const input = tagFilter.querySelector("[data-tag-search]");
    if (input) input.value = tag === "all" ? "" : tag;
    applyPostFilters();
  });

  tagFilter.querySelector("[data-tag-search]")?.addEventListener("input", (event) => {
    updateTagUrl(event.target.value.trim() || "all", { replace: true });
    applyPostFilters();
  });
}

function applyPostFilters() {
  const activeTag = getRequestedTag();
  const normalized = normalizeTag(activeTag);
  const input = tagFilter?.querySelector("[data-tag-search]");
  if (input && input.value !== (normalized === "all" ? "" : activeTag)) {
    input.value = normalized === "all" ? "" : activeTag;
  }

  const filtered = normalized === "all"
    ? posts
    : posts.filter((post) => (post.tags || []).some((tag) => normalizeTag(tag).includes(normalized)));

  tagFilter?.querySelectorAll("[data-tag-value]").forEach((button) => {
    const value = normalizeTag(button.dataset.tagValue || "all");
    button.classList.toggle("is-active", value === normalized || (normalized !== "all" && value !== "all" && value.includes(normalized)));
  });

  renderTimeline(filtered);
}

function getRequestedTag() {
  return new URLSearchParams(window.location.search).get("tag") || "all";
}

function updateTagUrl(tag, options = {}) {
  const params = new URLSearchParams(window.location.search);
  if (!tag || normalizeTag(tag) === "all") {
    params.delete("tag");
  } else {
    params.set("tag", tag);
  }
  const query = params.toString();
  const nextUrl = query ? `${indexPage}?${query}` : indexPage;
  const method = options.replace ? "replaceState" : "pushState";
  history[method]({ tag }, "", nextUrl);
}

function normalizeTag(value) {
  return String(value || "all").trim().toLowerCase();
}

function initSectionNav() {
  if (!article || !tocTarget || tocTarget.hidden) return;
  sectionObserver?.disconnect();
  bindSectionNavClicks();

  const links = Array.from(tocTarget.querySelectorAll("a[href^='#']"));
  const headings = links
    .map((link) => document.getElementById(safeDecode(link.getAttribute("href").slice(1))))
    .filter(Boolean);

  if (!links.length || !headings.length) return;

  const activate = (id) => {
    setActiveSection(id);
  };

  activate(headings[0].id);

  sectionObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (visible) activate(visible.target.id);
  }, {
    rootMargin: "-22% 0px -68% 0px",
    threshold: 0.01
  });

  headings.forEach((heading) => sectionObserver.observe(heading));
}

function bindSectionNavClicks() {
  if (!tocTarget || tocTarget.dataset.sectionNavBound === "true") return;
  tocTarget.dataset.sectionNavBound = "true";

  tocTarget.addEventListener("click", (event) => {
    const link = event.target.closest("a[href^='#']");
    if (!link) return;

    const id = safeDecode(link.getAttribute("href").slice(1));
    if (!id || !document.getElementById(id)) return;

    event.preventDefault();
    scrollToSection(id, { behavior: "smooth", updateHash: true });
  });
}

function scrollToCurrentHash(options = {}) {
  const id = safeDecode(window.location.hash.slice(1));
  if (!id) return false;
  return scrollToSection(id, options);
}

function scrollToSection(id, options = {}) {
  const target = document.getElementById(id);
  if (!target) return false;

  window.requestAnimationFrame(() => {
    target.scrollIntoView({
      block: "start",
      behavior: resolveScrollBehavior(options.behavior || "smooth")
    });
    setActiveSection(id);
  });

  if (options.updateHash) {
    const nextUrl = `${window.location.pathname}${window.location.search}#${encodeURIComponent(id)}`;
    history.pushState({ section: id }, "", nextUrl);
  }

  return true;
}

function setActiveSection(id) {
  if (!tocTarget || !id) return;

  tocTarget.querySelectorAll("a[href^='#']").forEach((link) => {
    const targetId = safeDecode(link.getAttribute("href").slice(1));
    link.classList.toggle("is-active", targetId === id);
  });
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value || "");
  } catch {
    return value || "";
  }
}

// JS scrollIntoView bypasses the CSS `scroll-behavior: auto !important` that
// the reduced-motion media query sets, so honor the preference explicitly.
function resolveScrollBehavior(preferred = "smooth") {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : preferred;
}

function resolveRequestedPost() {
  const requested = new URLSearchParams(window.location.search).get("post");
  return posts.find((post) => post.id === requested) || posts[0];
}

function setActivePost(id) {
  timeline?.querySelectorAll("[data-post-id]").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.postId === id);
  });
}

function renderEmptyState() {
  if (titleTarget) titleTarget.textContent = "Technical Blog";
  if (metaTarget) metaTarget.textContent = "No Markdown posts found";
  if (tocTarget) {
    tocTarget.hidden = true;
    tocTarget.replaceChildren();
  }
  if (article) {
    article.innerHTML = "<p>Put Markdown files under <code>content/tech-blog/</code>, then refresh this page.</p>";
  }
  if (timeline) {
    timeline.innerHTML = '<p class="post-empty">Put Markdown files under <code>content/tech-blog/</code>, then refresh this page.</p>';
  }
}

function formatPostDate(post) {
  return [post.date, post.time].filter(Boolean).join(" ");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
