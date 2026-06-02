# page

Personal portfolio and photography showcase.

## Pages

- `blog.html`: About Me landing page.
- `index.html`: Photography gallery.
- `tech-blog.html` and `tech-post.html`: Technical blog index and post pages.
- `life-notes.html` and `life-post.html`: Life notes index and post pages.

## Local Preview

```bash
node server.mjs
```

Open the printed local URL. The default route is also configured for Vercel through `vercel.json`.

## Content

- Photography albums live under `photos/`.
- Technical posts live under `content/tech-blog/`.
- Life notes live under `content/life-notes/`.
- Vercel API functions under `api/` scan these folders at runtime.

## CI

GitHub Actions runs JavaScript syntax checks and validates the content scanners on pushes and pull requests to `main`.
