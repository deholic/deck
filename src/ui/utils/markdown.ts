const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeAttr = (text: string): string => escapeHtml(text).replace(/\(/g, "%28").replace(/\)/g, "%29");

const isSafeUrl = (url: string): boolean => {
  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return false;
  }
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
  return !hasScheme || /^https?:/i.test(trimmed);
};

const normalizeMentionHandle = (handle: string): string => handle.replace(/^@/, "").trim().toLowerCase();

const renderImageTag = (alt: string, url: string): string => {
  if (!isSafeUrl(url)) {
    return escapeHtml(`![${alt}](${url})`);
  }
  const safeAlt = escapeHtml(alt);
  const safeUrl = escapeAttr(url.trim());
  return `<img src="${safeUrl}" alt="${safeAlt}" loading="lazy" />`;
};

const renderEmojiTag = (shortcode: string, url: string): string => {
  if (!isSafeUrl(url)) {
    return escapeHtml(`:${shortcode}:`);
  }
  const safeUrl = escapeAttr(url.trim());
  const safeAlt = escapeHtml(`:${shortcode}:`);
  return `<img src="${safeUrl}" alt="${safeAlt}" class="custom-emoji" loading="lazy" />`;
};

// Linkify plain URLs while excluding trailing punctuation.
const linkifyBareUrls = (text: string): string => {
  return text.replace(/https?:\/\/[^\s<]+[^\s<\])"'.,;:!?]/g, (match) => {
    if (!isSafeUrl(match)) {
      return match;
    }
    const safeUrl = escapeAttr(match);
    return `<a href="${safeUrl}" target="_blank" rel="noreferrer">${match}</a>`;
  });
};

// Tokenize inline elements first, then escape/format once to avoid double parsing.
const formatInline = (
  text: string,
  emojiMap?: Map<string, string>,
  options: {
    linkify?: boolean;
    parseLinks?: boolean;
    parseMentions?: boolean;
    mentionResolver?: (handle: string) => string | null;
  } = {}
): string => {
  const codeSpans: string[] = [];
  let tokenized = text.replace(/`([^`]+)`/g, (_match, code) => {
    const safeCode = escapeHtml(code);
    codeSpans.push(`<code>${safeCode}</code>`);
    return `\u0001${codeSpans.length - 1}\u0001`;
  });
  const images: string[] = [];
  tokenized = tokenized.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
    const imageTag = renderImageTag(alt, url);
    images.push(imageTag);
    return `\u0000${images.length - 1}\u0000`;
  });
  const links: string[] = [];
  if (options.parseLinks !== false) {
    tokenized = tokenized.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) => {
      // Parse link labels once; avoid nested markdown/link parsing and linkify here.
      const safeLabel = formatInline(label, emojiMap, {
        linkify: false,
        parseLinks: false,
        parseMentions: false
      });
      const safeUrl = escapeAttr(url);
      links.push(`<a href="${safeUrl}" target="_blank" rel="noreferrer">${safeLabel}</a>`);
      return `\u0003${links.length - 1}\u0003`;
    });
  }
  const mentions: string[] = [];
  if (options.parseMentions !== false && options.mentionResolver) {
    tokenized = tokenized.replace(
      /@[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?=[^\w@]|$)/g,
      (match) => {
        const normalized = normalizeMentionHandle(match);
        const url = options.mentionResolver?.(normalized);
        if (!url) {
          return match;
        }
        const safeUrl = escapeAttr(url);
        const safeLabel = escapeHtml(match);
        mentions.push(`<a href="${safeUrl}" class="mention" target="_blank" rel="noreferrer">${safeLabel}</a>`);
        return `\u0004${mentions.length - 1}\u0004`;
      }
    );
  }
  const emojis: string[] = [];
  if (emojiMap && emojiMap.size > 0) {
    tokenized = tokenized.replace(/:([a-zA-Z0-9_]+):/g, (_match, shortcode) => {
      const url = emojiMap.get(shortcode);
      if (!url) {
        return `:${shortcode}:`;
      }
      const emojiTag = renderEmojiTag(shortcode, url);
      emojis.push(emojiTag);
      return `\u0002${emojis.length - 1}\u0002`;
    });
  }
  let out = escapeHtml(tokenized);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  if (options.linkify !== false) {
    out = linkifyBareUrls(out);
  }
  out = out.replace(/\u0000(\d+)\u0000/g, (_match, index) => images[Number(index)] ?? "");
  out = out.replace(/\u0002(\d+)\u0002/g, (_match, index) => emojis[Number(index)] ?? "");
  out = out.replace(/\u0001(\d+)\u0001/g, (_match, index) => codeSpans[Number(index)] ?? "");
  out = out.replace(/\u0003(\d+)\u0003/g, (_match, index) => links[Number(index)] ?? "");
  out = out.replace(/\u0004(\d+)\u0004/g, (_match, index) => mentions[Number(index)] ?? "");
  return out;
};

export const renderMarkdown = (
  markdown: string,
  emojiMap?: Map<string, string>,
  options?: { mentionResolver?: (handle: string) => string | null }
): string => {
  const lines = markdown.split(/\r?\n/);
  const blocks: string[] = [];
  let inCode = false;
  let codeBuffer: string[] = [];
  let listBuffer: string[] = [];
  let paragraphBuffer: string[] = [];
  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const content = paragraphBuffer
      .map((line) => formatInline(line, emojiMap, { mentionResolver: options?.mentionResolver }))
      .join("<br />");
    blocks.push(`<p>${content}</p>`);
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const items = listBuffer
      .map((item) => `<li>${formatInline(item, emojiMap, { mentionResolver: options?.mentionResolver })}</li>`)
      .join("");
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

    const trimmedLine = line.trim();
    if (trimmedLine.match(/^(!\[[^\]]*\]\([^)]+\)\s*)+$/)) {
      flushParagraph();
      flushList();
      const images: string[] = [];
      for (const match of trimmedLine.matchAll(imagePattern)) {
        images.push(renderImageTag(match[1], match[2]));
      }
      if (images.length > 0) {
        blocks.push(`<div class="readme-image-row">${images.join("")}</div>`);
        continue;
      }
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      blocks.push(
        `<h${level}>${formatInline(headingMatch[2], emojiMap, { mentionResolver: options?.mentionResolver })}</h${level}>`
      );
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
