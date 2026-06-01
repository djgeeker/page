import { renderMarkdownFile } from "./markdown-renderer.js";

const timeline = document.querySelector("[data-post-timeline]");
const article = document.querySelector("[data-markdown-article]");
const titleTarget = document.querySelector("[data-markdown-page-title]");
const metaTarget = document.querySelector("[data-markdown-page-meta]");
const tocTarget = document.querySelector("[data-markdown-page-toc]");
let posts = [];

initTechBlog();

async function initTechBlog() {
  posts = await loadPosts();
  renderTimeline(posts);

  if (!posts.length) {
    renderEmptyState();
    return;
  }

  await openPost(resolveRequestedPost());
  window.addEventListener("popstate", () => openPost(resolveRequestedPost(), { replaceUrl: true }));
}

async function loadPosts() {
  try {
    const response = await fetch("./api/tech-posts", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch {
    return [{
      id: "20260601-markdown-render-demo",
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

function renderTimeline(items) {
  if (!timeline) return;

  timeline.innerHTML = items
    .map((post, index) => {
      const active = index === 0 ? " is-active" : "";
      return `
        <a class="post-node${active}" href="./tech-blog.html?post=${encodeURIComponent(post.id)}" data-post-id="${escapeAttribute(post.id)}">
          <span class="post-node-line" aria-hidden="true"></span>
          <span class="post-node-title">${escapeHtml(post.title)}</span>
          <time class="post-node-date" datetime="${escapeAttribute(post.date || "")}">${escapeHtml(formatPostDate(post))}</time>
        </a>
      `;
    })
    .join("");

  timeline.addEventListener("click", (event) => {
    const link = event.target.closest("[data-post-id]");
    if (!link) return;

    event.preventDefault();
    const post = posts.find((item) => item.id === link.dataset.postId);
    if (!post) return;

    history.pushState({ post: post.id }, "", `./tech-blog.html?post=${encodeURIComponent(post.id)}`);
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

  if (!new URLSearchParams(window.location.search).get("post") && !options.replaceUrl) {
    history.replaceState({ post: post.id }, "", `./tech-blog.html?post=${encodeURIComponent(post.id)}`);
  }

  if (options.scrollToArticle) {
    article.scrollIntoView({ block: "start", behavior: "smooth" });
  }
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
