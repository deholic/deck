type Env = Record<string, unknown>;

const MAX_RESPONSE_BYTES = 512 * 1024;
const REQUEST_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 2;

const textDecoder = new TextDecoder("utf-8");

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const extractMetaTagContent = (html: string, attribute: "property" | "name", key: string): string | null => {
  const tagRegex = new RegExp(`<meta[^>]+${attribute}=["']${key}["'][^>]*>`, "i");
  const match = html.match(tagRegex);
  if (!match) {
    return null;
  }
  const contentMatch = match[0].match(/content=["']([^"']+)["']/i);
  if (!contentMatch) {
    return null;
  }
  return decodeHtmlEntities(contentMatch[1].trim());
};

const extractTitle = (html: string): string | null => {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (!match) {
    return null;
  }
  const text = decodeHtmlEntities(match[1].trim());
  return text || null;
};

const toAbsoluteHttpUrl = (value: string | null, baseUrl: string): string | null => {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};

const isValidHttpUrl = (value: string): URL | null => {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
};

const isIpAddress = (host: string): boolean => /^(\d{1,3}\.){3}\d{1,3}$/.test(host);

const isPrivateIpv4 = (host: string): boolean => {
  if (!isIpAddress(host)) {
    return false;
  }
  const parts = host.split(".").map((item) => Number(item));
  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
};

const isPrivateIpv6 = (host: string): boolean => {
  const normalized = host.toLowerCase();
  if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") {
    return true;
  }
  if (normalized.startsWith("::ffff:")) {
    const mappedIpv4 = normalized.slice(7);
    return isIpAddress(mappedIpv4) && isPrivateIpv4(mappedIpv4);
  }
  return (
    normalized === "::1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  );
};

const isBlockedHostname = (hostname: string): boolean => {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".local")) {
    return true;
  }
  if (isPrivateIpv4(lower) || isPrivateIpv6(lower)) {
    return true;
  }
  return false;
};

const isYouTubeHost = (hostname: string): boolean => {
  const lower = hostname.toLowerCase();
  return lower === "youtu.be" || lower === "youtube.com" || lower.endsWith(".youtube.com");
};


const isAllowedContentType = (contentType: string): boolean => {
  const normalized = contentType.toLowerCase().split(";")[0]?.trim();
  return normalized === "text/html" || normalized === "application/xhtml+xml";
};


const fetchWithSafeRedirects = async (
  targetUrl: URL,
  signal: AbortSignal,
  redirectCount = 0
): Promise<Response> => {
  const response = await fetch(targetUrl.toString(), {
    signal,
    redirect: "manual",
    headers: {
      "User-Agent": "DeckLinkPreview/1.0",
      Accept: "text/html,application/xhtml+xml"
    }
  });

  if (response.status >= 300 && response.status < 400) {
    if (redirectCount >= MAX_REDIRECTS) {
      throw new Error("too_many_redirects");
    }
    const location = response.headers.get("location");
    if (!location) {
      throw new Error("invalid_redirect");
    }
    let redirectedUrl: URL;
    try {
      redirectedUrl = new URL(location, targetUrl.toString());
    } catch {
      throw new Error("invalid_redirect");
    }
    const validatedRedirectUrl = isValidHttpUrl(redirectedUrl.toString());
    if (!validatedRedirectUrl || isBlockedHostname(validatedRedirectUrl.hostname)) {
      throw new Error("blocked_redirect");
    }
    return fetchWithSafeRedirects(validatedRedirectUrl, signal, redirectCount + 1);
  }

  return response;
};


const fetchYouTubeOEmbed = async (targetUrl: string): Promise<{ title: string; image: string | null } | null> => {
  try {
    const oembedUrl = new URL("https://www.youtube.com/oembed");
    oembedUrl.searchParams.set("url", targetUrl);
    oembedUrl.searchParams.set("format", "json");
    const response = await fetch(oembedUrl.toString(), {
      headers: {
        Accept: "application/json"
      }
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { title?: string; thumbnail_url?: string };
    if (!data.title) {
      return null;
    }
    return {
      title: data.title,
      image: data.thumbnail_url ?? null
    };
  } catch {
    return null;
  }
};


const readResponseText = async (response: Response): Promise<string> => {
  if (!response.body) {
    return response.text();
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      total += value.length;
      if (total > MAX_RESPONSE_BYTES) {
        break;
      }
      chunks.push(value);
    }
  }
  const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return textDecoder.decode(combined);
};

const buildResponse = (
  body: Record<string, unknown>,
  status = 200,
  cacheSeconds = 600,
  allowedOrigin?: string
): Response => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": `public, max-age=${cacheSeconds}`,
    "Content-Security-Policy": "default-src 'none'",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    Vary: "Origin"
  };

  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }

  return new Response(JSON.stringify(body), {
    status,
    headers
  });
};

export const onRequestGet = async (context: { request: Request } & { env?: Env }) => {
  const requestUrl = new URL(context.request.url);
  const allowedOrigin = requestUrl.origin;
  const urlParam = requestUrl.searchParams.get("url");
  if (!urlParam) {
    return buildResponse({ error: "missing_url" }, 400, 60, allowedOrigin);
  }

  const targetUrl = isValidHttpUrl(urlParam);
  if (!targetUrl || isBlockedHostname(targetUrl.hostname)) {
    return buildResponse({ error: "invalid_url" }, 400, 60, allowedOrigin);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchWithSafeRedirects(targetUrl, controller.signal);

    if (!response.ok) {
      return buildResponse({ error: "fetch_failed", status: response.status }, 200, 60, allowedOrigin);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!isAllowedContentType(contentType)) {
      return buildResponse({ error: "unsupported_content" }, 200, 300, allowedOrigin);
    }

    const html = await readResponseText(response);
    if (!html) {
      return buildResponse({ error: "empty_body" }, 200, 60, allowedOrigin);
    }

    const ogTitle = extractMetaTagContent(html, "property", "og:title");
    const ogDescription = extractMetaTagContent(html, "property", "og:description");
    const ogImageRaw = extractMetaTagContent(html, "property", "og:image");
    const ogUrl = extractMetaTagContent(html, "property", "og:url");
    const metaDescription = extractMetaTagContent(html, "name", "description");
    let title = ogTitle || extractTitle(html);
    const description = ogDescription || metaDescription;
    let image = toAbsoluteHttpUrl(ogImageRaw, targetUrl.toString());
    const canonicalUrl = toAbsoluteHttpUrl(ogUrl, targetUrl.toString()) ?? targetUrl.toString();

    const shouldFetchYouTube = !title || title.trim() === "YouTube";
    if (shouldFetchYouTube && isYouTubeHost(targetUrl.hostname)) {
      const oembed = await fetchYouTubeOEmbed(targetUrl.toString());
      if (oembed) {
        title = title || oembed.title;
        image = image || oembed.image;
      }
    }


    if (!title) {
      return buildResponse({ error: "missing_title" }, 200, 300, allowedOrigin);
    }

    return buildResponse(
      {
        url: canonicalUrl,
        title,
        description: description || null,
        image: image || null
      },
      200,
      600,
      allowedOrigin
    );
  } catch (error) {
    if (error instanceof Error && ["invalid_redirect", "blocked_redirect", "too_many_redirects"].includes(error.message)) {
      return buildResponse({ error: error.message }, 200, 60, allowedOrigin);
    }
    if (error instanceof Error && error.name === "AbortError") {
      return buildResponse({ error: "timeout" }, 200, 60, allowedOrigin);
    }
    return buildResponse({ error: "fetch_failed" }, 200, 60, allowedOrigin);
  } finally {
    clearTimeout(timeout);
  }
};
