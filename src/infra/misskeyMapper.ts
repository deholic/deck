import type { CustomEmoji, MediaAttachment, Mention, Reaction, Status, Visibility } from "../domain/types";

const mapVisibility = (visibility: string): Visibility => {
  switch (visibility) {
    case "home":
      return "unlisted";
    case "followers":
      return "private";
    case "specified":
      return "direct";
    default:
      return "public";
  }
};

const mapMediaAttachments = (files: unknown): MediaAttachment[] => {
  if (!Array.isArray(files)) {
    return [];
  }
  return files
    .map((file) => {
      if (!file || typeof file !== "object") {
        return null;
      }
      const typed = file as Record<string, unknown>;
      const id = String(typed.id ?? "");
      const url = typeof typed.url === "string" ? typed.url : "";
      const description = typeof typed.comment === "string" ? typed.comment : null;
      if (!id || !url) {
        return null;
      }
      return { id, url, description };
    })
    .filter((file): file is MediaAttachment => file !== null);
};

const mapMentions = (mentions: unknown): Mention[] => {
  if (!Array.isArray(mentions)) {
    return [];
  }
  return mentions
    .map((mention) => {
      if (!mention || typeof mention !== "object") {
        return null;
      }
      const typed = mention as Record<string, unknown>;
      const id = String(typed.id ?? "");
      const username = String(typed.username ?? "");
      const host = typeof typed.host === "string" ? typed.host : "";
      const handle = host ? `${username}@${host}` : username;
      const displayName = String(typed.name ?? username ?? "");
      const url = typeof typed.url === "string" ? typed.url : null;
      if (!id || !handle) {
        return null;
      }
      return { id, displayName, handle, url };
    })
    .filter((item): item is Mention => item !== null);
};

const normalizeEmojiShortcode = (value: string) => value.replace(/^:|:$/g, "");

const resolveEmojiUrl = (typed: Record<string, unknown>): string => {
  if (typeof typed.url === "string") {
    return typed.url;
  }
  if (typeof typed.publicUrl === "string") {
    return typed.publicUrl;
  }
  if (typeof typed.staticUrl === "string") {
    return typed.staticUrl;
  }
  if (typeof typed.static_url === "string") {
    return typed.static_url;
  }
  return "";
};

const mapCustomEmojis = (emojis: unknown): { shortcode: string; url: string }[] => {
  if (Array.isArray(emojis)) {
    return emojis
      .map((emoji) => {
        if (!emoji || typeof emoji !== "object") {
          return null;
        }
        const typed = emoji as Record<string, unknown>;
        const rawShortcode =
          typeof typed.name === "string"
            ? typed.name
            : typeof typed.shortcode === "string"
              ? typed.shortcode
              : "";
        const shortcode = rawShortcode ? normalizeEmojiShortcode(rawShortcode) : "";
        const url = resolveEmojiUrl(typed);
        if (!shortcode || !url) {
          return null;
        }
        return { shortcode, url };
      })
      .filter((item): item is { shortcode: string; url: string } => item !== null);
  }
  if (emojis && typeof emojis === "object") {
    return Object.entries(emojis as Record<string, unknown>)
      .map(([shortcode, url]) => {
        if (typeof url !== "string") {
          return null;
        }
        const normalized = normalizeEmojiShortcode(shortcode);
        return normalized ? { shortcode: normalized, url } : null;
      })
      .filter((item): item is { shortcode: string; url: string } => item !== null);
  }
  return [];
};

const buildEmojiMap = (emojis: CustomEmoji[]): Map<string, string> => {
  return new Map(emojis.map((emoji) => [emoji.shortcode, emoji.url]));
};

const extractLocalEmojiShortcodes = (text: string): string[] => {
  const regex = /:([a-zA-Z0-9_+@.-]+):/g;
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[1];
    if (!raw || raw.includes("@")) {
      continue;
    }
    found.add(normalizeEmojiShortcode(raw));
  }
  return Array.from(found);
};

const buildFallbackEmojis = (text: string, instanceUrl?: string): CustomEmoji[] => {
  if (!text || !instanceUrl) {
    return [];
  }
  const host = getHostFromInstanceUrl(instanceUrl);
  if (!host) {
    return [];
  }
  return extractLocalEmojiShortcodes(text)
    .map((shortcode) => {
      const url = buildEmojiUrl(shortcode, host, instanceUrl);
      if (!url) {
        return null;
      }
      return { shortcode, url };
    })
    .filter((emoji): emoji is CustomEmoji => emoji !== null);
};

const getEmojiHost = (url: string | null): string | null => {
  if (!url) {
    return null;
  }
  try {
    const host = new URL(url).hostname;
    return host || null;
  } catch {
    return null;
  }
};

const getHostFromInstanceUrl = (instanceUrl?: string): string | null => {
  if (!instanceUrl) {
    return null;
  }
  try {
    const host = new URL(instanceUrl).hostname;
    return host || null;
  } catch {
    return null;
  }
};

const buildEmojiUrl = (shortcode: string, host: string | null, instanceUrl?: string): string | null => {
  if (!shortcode || !host) {
    return null;
  }
  let base = `https://${host}`;
  if (instanceUrl) {
    try {
      const parsed = new URL(instanceUrl);
      base = `${parsed.protocol}//${host}`;
    } catch {
      /* noop */
    }
  }
  return `${base.replace(/\/$/, "")}/emoji/${encodeURIComponent(shortcode)}.webp`;
};

const mapReactions = (
  reactions: unknown,
  reactionEmojis: unknown,
  customEmojis: CustomEmoji[],
  instanceUrl?: string
): Reaction[] => {
  if (!reactions || typeof reactions !== "object") {
    return [];
  }

  const reactionEmojiMap = buildEmojiMap([
    ...customEmojis,
    ...mapCustomEmojis(reactionEmojis)
  ]);

  return Object.entries(reactions)
    .map(([rawName, rawCount]) => {
      if (typeof rawName !== "string") {
        return null;
      }
      const count = typeof rawCount === "number" ? rawCount : Number(rawCount ?? 0);
      if (!Number.isFinite(count) || count <= 0) {
        return null;
      }
      const trimmedName =
        rawName.startsWith(":") && rawName.endsWith(":") ? rawName.slice(1, -1) : rawName;
      const baseName = trimmedName.includes("@") ? trimmedName.split("@")[0] : trimmedName;
      const normalizedName = trimmedName.replace(/@\.?$/, "");
      const url =
        reactionEmojiMap.get(trimmedName) ??
        reactionEmojiMap.get(normalizedName) ??
        reactionEmojiMap.get(baseName) ??
        null;
      const hostFromName = trimmedName.includes("@")
        ? trimmedName.split("@").slice(1).join("@").replace(/\.$/, "") || null
        : null;
      const host = getEmojiHost(url) ?? hostFromName ?? getHostFromInstanceUrl(instanceUrl);
      const isCustom = Boolean(url) || rawName.startsWith(":") || trimmedName.includes("@");
      const resolvedUrl = isCustom ? url ?? buildEmojiUrl(baseName, host, instanceUrl) : null;
      return { name: rawName, count: Math.floor(count), url: resolvedUrl, isCustom, host };
    })
    .filter((reaction): reaction is Reaction => reaction !== null)
    .sort((a, b) => {
      if (a.count === b.count) {
        return a.name.localeCompare(b.name);
      }
      return b.count - a.count;
    });
};

const mapReplyMention = (reply: unknown): Mention | null => {
  if (!reply || typeof reply !== "object") {
    return null;
  }
  const replyRecord = reply as Record<string, unknown>;
  if (!replyRecord.user || typeof replyRecord.user !== "object") {
    return null;
  }
  const user = replyRecord.user as Record<string, unknown>;
  const id = String(user.id ?? "");
  const username = String(user.username ?? "");
  const host = typeof user.host === "string" ? user.host : "";
  const handle = host ? `${username}@${host}` : username;
  const displayName = String(user.name ?? username ?? "");
  const url = typeof user.url === "string" ? user.url : null;
  if (!id || !handle) {
    return null;
  }
  return { id, displayName, handle, url };
};

const sumReactions = (reactions: unknown): number => {
  if (!reactions || typeof reactions !== "object") {
    return 0;
  }
  return Object.values(reactions).reduce((acc, value) => {
    if (typeof value === "number") {
      return acc + value;
    }
    return acc;
  }, 0);
};

const buildAccountUrl = (
  user: Record<string, unknown>,
  instanceUrl?: string
): string | null => {
  const url = typeof user.url === "string" ? user.url : null;
  if (url) {
    return url;
  }
  const uri = typeof user.uri === "string" ? user.uri : null;
  if (uri) {
    return uri;
  }
  const username = typeof user.username === "string" ? user.username : "";
  if (!username || !instanceUrl) {
    return null;
  }
  const host = typeof user.host === "string" ? user.host : "";
  const base = host ? `https://${host}` : instanceUrl;
  return `${base.replace(/\/$/, "")}/@${username}`;
};

export const mapMisskeyStatusWithInstance = (raw: unknown, instanceUrl?: string): Status => {
  const value = raw as Record<string, unknown>;
  const user = (value.user ?? {}) as Record<string, unknown>;
  const renoteValue = value.renote as Record<string, unknown> | null | undefined;
  const renote = renoteValue ? mapMisskeyStatusWithInstance(renoteValue, instanceUrl) : null;
  const accountName = String(user.name ?? user.username ?? "");
  const accountHandle = String(user.username ?? "");
  const accountUrl = buildAccountUrl(user, instanceUrl);
  const accountAvatarUrl = typeof user.avatarUrl === "string" ? user.avatarUrl : null;
  const text = String(value.text ?? "");
  const spoilerText = typeof value.cw === "string" ? value.cw : "";
  const files = value.files;
  const mediaAttachments = mapMediaAttachments(files);
  const isSensitive =
    typeof value.isSensitive === "boolean"
      ? value.isSensitive
      : mediaAttachments.length > 0 &&
        Array.isArray(files) &&
        files.some(
          (file) =>
            file &&
            typeof file === "object" &&
            (file as Record<string, unknown>).isSensitive === true
        );
  const reactionsCount =
    typeof value.reactionCount === "number" ? value.reactionCount : sumReactions(value.reactions);
  const reblogged = Boolean(value.myRenoteId);
  const myReaction = typeof value.myReaction === "string" ? value.myReaction : null;
  const favourited = Boolean(value.isFavorited ?? myReaction);
  const mappedEmojis = mapCustomEmojis(value.emojis);
  const customEmojis =
    mappedEmojis.length > 0 ? mappedEmojis : buildFallbackEmojis(text, instanceUrl);
  const reactions = mapReactions(value.reactions, value.reactionEmojis, customEmojis, instanceUrl);
  const accountEmojis = mapCustomEmojis(user.emojis);
  const baseMentions = mapMentions(value.mentions);
  const replyMention = mapReplyMention(value.reply);
  const mentions =
    replyMention && !baseMentions.some((mention) => mention.id === replyMention.id)
      ? [...baseMentions, replyMention]
      : baseMentions;
  return {
    id: String(value.id ?? ""),
    createdAt: String(value.createdAt ?? ""),
    accountName,
    accountHandle,
    accountUrl,
    accountAvatarUrl,
    content: text,
    url: typeof value.url === "string" ? value.url : typeof value.uri === "string" ? value.uri : null,
    visibility: mapVisibility(String(value.visibility ?? "public")),
    spoilerText,
    sensitive: Boolean(spoilerText) || isSensitive,
    card: null,
    repliesCount: Number(value.repliesCount ?? 0),
    reblogsCount: Number(value.renoteCount ?? 0),
    favouritesCount: Number(reactionsCount ?? 0),
    reactions,
    reblogged,
    favourited,
    inReplyToId: value.replyId ? String(value.replyId) : null,
    mentions,
    mediaAttachments,
    reblog: renote,
    boostedBy: renote ? { name: accountName, handle: accountHandle, url: accountUrl } : null,
    myReaction,
    customEmojis,
    accountEmojis
  };
};

export const mapMisskeyStatus = (raw: unknown): Status => {
  return mapMisskeyStatusWithInstance(raw);
};
