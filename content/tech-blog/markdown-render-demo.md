---
title: Markdown Auto Rendering
date: 2026-06-01
category: Frontend
tags: Markdown, Static Blog, Rendering
---

## What this script does

This page is rendered from a Markdown file. Replace this file with your own note and the page will keep the same visual frame while the content updates automatically.

## Supported syntax

- Headings from `#` to `######`
- Paragraphs, **bold**, *italic*, ~~deleted text~~ and inline `code`
- Ordered and unordered lists
- Blockquotes
- Tables
- Code fences
- Links and images

> Keep the page quiet. Let the article carry the density, and let the background stay behind the reading surface.

## Example table

| Layer | Purpose | Status |
| --- | --- | --- |
| Markdown file | Write content | Ready |
| Parser | Convert Markdown to safe HTML | Ready |
| Renderer | Load file and update page | Ready |

## Example code

```html
<article
  class="markdown-body"
  data-markdown-src="./content/tech-blog/my-post.md">
</article>
```

## Next

Create another `.md` file under `content/tech-blog/`, then point `data-markdown-src` to that file.
