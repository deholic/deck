const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeAttr = (text: string): string => escapeHtml(text).replace(/\(/g, "%28").replace(/\)/g, "%29");

const formatInline = (text: string): string => {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) => {
    const safeUrl = escapeAttr(url);
    return `<a href=\"${safeUrl}\" target=\"_blank\" rel=\"noreferrer\">${label}</a>`;
  });
  return out;
};

export const renderMarkdown = (markdown: string): string => {
  const lines = markdown.split(/\r?\n/);
  const blocks: string[] = [];
  let inCode = false;
  let codeBuffer: string[] = [];
  let listBuffer: string[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const content = paragraphBuffer.map(formatInline).join("<br />");
    blocks.push(`<p>${content}</p>`);
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const items = listBuffer.map((item) => `<li>${formatInline(item)}</li>`).join("");
    blocks.push(`<ul>${items}</ul>`);
    listBuffer = [];
  };

  const flushCode = () => {
    if (!inCode) return;
    const code = escapeHtml(codeBuffer.join("\n"));
    blocks.push(`<pre><code>${code}</code></pre>`);
    codeBuffer = [];
    inCode = false;
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        flushCode();
      } else {
        flushParagraph();
        flushList();
        inCode = true;
        codeBuffer = [];
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const listMatch = line.match(/^-\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      listBuffer.push(listMatch[1]);
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();
  flushCode();

  return blocks.join("");
};
