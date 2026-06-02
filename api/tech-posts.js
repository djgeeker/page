const { scanMarkdownPosts, sendJson } = require("./_content.cjs");

module.exports = async function handler(request, response) {
  try {
    sendJson(response, await scanMarkdownPosts("tech-blog"));
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
};
