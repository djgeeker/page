import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, extname, join, normalize, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const requestedPort = Number(process.env.PORT || 4173);
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4"
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === "/api/gallery") {
      const gallery = await scanGallery();
      sendJson(response, gallery);
      return;
    }

    if (url.pathname === "/api/tech-posts") {
      const posts = await scanMarkdownPosts("tech-blog");
      sendJson(response, posts);
      return;
    }

    if (url.pathname === "/api/life-posts") {
      const posts = await scanMarkdownPosts("life-notes");
      sendJson(response, posts);
      return;
    }

    await sendStatic(url.pathname, response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : "Unknown server error");
  }
});

listen(requestedPort);

function listen(port) {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE") {
      listen(port + 1);
      return;
    }
    throw error;
  });

  server.listen(port, () => {
    console.log(`Photo showcase running at http://localhost:${port}`);
  });
}

async function scanGallery() {
  const photosRoot = join(root, "photos");
  const groups = await safeReaddir(photosRoot, { withFileTypes: true });
  const directories = groups.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));

  const items = [];
  for (const [index, directory] of directories.entries()) {
    const folderPath = join(photosRoot, directory.name);
    const entries = await safeReaddir(folderPath, { withFileTypes: true });
    const images = entries
      .filter((entry) => entry.isFile() && imageExtensions.has(extname(entry.name).toLowerCase()))
      .map((entry) => toPublicPath(join(folderPath, entry.name)))
      .sort((a, b) => a.localeCompare(b));

    if (!images.length) continue;

    const cover = images.find((image) => /\/cover\./i.test(image)) || images[0];
    const meta = await readMeta(folderPath);
    const derivedTitle = toTitle(directory.name);

    items.push({
      id: directory.name,
      folder: `photos/${directory.name}`,
      title: meta.title || derivedTitle,
      location: meta.location || derivedTitle,
      chapter: meta.chapter || `CHAPTER ${String(index + 1).padStart(2, "0")}`,
      date: meta.date || "",
      time: meta.time || "",
      coordinates: meta.coordinates || meta.coords || "",
      note: meta.note || "",
      caption: meta.caption || "",
      theme: meta.theme || "auto",
      cover,
      images
    });
  }

  return items;
}

async function scanMarkdownPosts(section) {
  const postsRoot = join(root, "content", section);
  const entries = await safeReaddir(postsRoot, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".md")
    .sort((a, b) => a.name.localeCompare(b.name));

  const posts = [];
  for (const file of files) {
    const filePath = join(postsRoot, file.name);
    const content = await readFile(filePath, "utf8").catch(() => "");
    const fileStats = await stat(filePath).catch(() => null);
    const attributes = parseFrontMatter(content);
    const stem = basename(file.name, ".md");
    const date = toText(attributes.date) || toDateString(fileStats?.mtime);
    const title = toText(attributes.title) || toTitle(stem);
    const id = createPostId(date, stem);

    posts.push({
      id,
      title,
      date,
      time: toText(attributes.time),
      category: toText(attributes.category),
      tags: toList(attributes.tags),
      href: toPublicPath(filePath),
      filename: file.name
    });
  }

  return posts.sort((a, b) => {
    const byDate = Date.parse(b.date || "") - Date.parse(a.date || "");
    return Number.isFinite(byDate) && byDate !== 0 ? byDate : b.filename.localeCompare(a.filename);
  });
}

async function sendStatic(pathname, response) {
  const cleanPath = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  const target = normalize(join(root, cleanPath));
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;

  if (target !== rootPrefix.slice(0, -1) && !target.startsWith(rootPrefix)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const stats = await stat(target).catch(() => null);
  if (!stats || !stats.isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const ext = extname(target).toLowerCase();
  response.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  response.end(await readFile(target));
}

async function readMeta(folderPath) {
  const metaFiles = ["meta.md", "meta.txt", "location.md"];
  for (const filename of metaFiles) {
    const content = await readFile(join(folderPath, filename), "utf8").catch(() => null);
    if (content) return parseMeta(content);
  }
  return {};
}

function parseMeta(content) {
  const meta = {};
  content.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([a-zA-Z][\w-]*)\s*:\s*(.+)$/);
    if (!match) return;
    meta[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  });
  return meta;
}

function parseFrontMatter(content) {
  const normalized = String(content || "").replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("---\n")) return {};

  const end = normalized.indexOf("\n---", 4);
  if (end === -1) return {};

  return parseMeta(normalized.slice(4, end).trim());
}

async function safeReaddir(path, options) {
  return readdir(path, options).catch(() => []);
}

function sendJson(response, value) {
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(value, null, 2));
}

function toPublicPath(path) {
  return `./${relative(root, path).split(sep).join("/")}`;
}

function toTitle(folderName) {
  return folderName
    .replace(/^\d+[-_\s]*/, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .toUpperCase();
}

function createPostId(date, stem) {
  const datePart = String(date || "")
    .trim()
    .replace(/[^\d]/g, "")
    .slice(0, 8);
  const stemPart = slugify(stem);
  return [datePart, stemPart].filter(Boolean).join("-");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "post";
}

function toDateString(value) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function toText(value) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] || "" : String(value);
}

function toList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
