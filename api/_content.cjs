const { readdir, readFile, stat } = require("node:fs/promises");
const { basename, extname, join, relative, sep } = require("node:path");

const root = process.cwd();
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);

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

function sendJson(response, value) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.status(200).send(JSON.stringify(value, null, 2));
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

function toPublicPath(path) {
  return `./${relative(root, path).split(sep).join("/")}`;
}

function toTitle(folderName) {
  return String(folderName || "")
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

module.exports = {
  scanGallery,
  scanMarkdownPosts,
  sendJson
};
