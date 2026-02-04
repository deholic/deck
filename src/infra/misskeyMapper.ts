import type {
  AccountRelationship,
  CustomEmoji,
  MediaAttachment,
  Mention,
  ProfileField,
  Reaction,
  Status,
  UserProfile,
  Visibility
} from "../domain/types";
import i18n from "../i18n";

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

const inferKindFromUrl = (value: string): MediaAttachment["kind"] => {
  const lower = value.toLowerCase();
  if (/(\.|\/)(gifv)(\?|#|$)/.test(lower)) {
    return "gifv";
  }
  if (/(\.|\/)(mp4|webm|mov|m4v|ogv)(\?|#|$)/.test(lower)) {
    return "video";
  }
  if (/(\.|\/)(mp3|wav|ogg|m4a|flac)(\?|#|$)/.test(lower)) {
    return "audio";
  }
  if (/(\.|\/)(gif|jpg|jpeg|png|webp)(\?|#|$)/.test(lower)) {
    return "image";
  }
  return "unknown";
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
      const previewUrl =
        typeof typed.thumbnailUrl === "string"
          ? typed.thumbnailUrl
          : typeof typed.previewUrl === "string"
            ? typed.previewUrl
            : null;
      const rawType = typeof typed.type === "string" ? typed.type : "";
      const normalizedType = rawType.toLowerCase();
      const kind: MediaAttachment["kind"] =
        normalizedType.startsWith("image/") || normalizedType === "image"
          ? "image"
          : normalizedType.startsWith("video/") || normalizedType === "video"
            ? "video"
            : normalizedType.startsWith("audio/") || normalizedType === "audio"
              ? "audio"
              : url
                ? inferKindFromUrl(url)
                : "unknown";
      if (!id || !url) {
        return null;
      }
      return { id, url, previewUrl, description, kind };
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

const mapProfileFields = (fields: unknown): ProfileField[] => {
  if (!Array.isArray(fields)) {
    return [];
  }
  return fields
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const typed = item as Record<string, unknown>;
      const label = typeof typed.name === "string" ? typed.name.trim() : "";
      const value = typeof typed.value === "string" ? typed.value.trim() : "";
      if (!label || !value) {
        return null;
      }
      return { label, value };
    })
    .filter((item): item is ProfileField => item !== null);
};

export const mapMisskeyUserProfile = (
  raw: unknown,
  instanceUrl?: string
): UserProfile => {
  const value = raw as Record<string, unknown>;
  const id = String(value.id ?? "");
  const username = String(value.username ?? "");
  const host = typeof value.host === "string" ? value.host : "";
  const handle = host ? `${username}@${host}` : username;
  const name = String(value.name ?? username ?? "");
  const url = buildAccountUrl(value, instanceUrl);
  const avatarUrl = typeof value.avatarUrl === "string" ? value.avatarUrl : null;
  const headerUrl = typeof value.bannerUrl === "string" ? value.bannerUrl : null;
  const bio = typeof value.description === "string" ? value.description : "";
  const locked = Boolean(value.isLocked ?? value.isPrivate ?? false);
  return {
    id,
    name,
    handle,
    url,
    avatarUrl,
    headerUrl,
    locked,
    bio,
    fields: mapProfileFields(value.fields),
    emojis: mapCustomEmojis(value.emojis)
  };
};

export const mapMisskeyRelationship = (raw: unknown): AccountRelationship => {
  const value = raw as Record<string, unknown>;
  return {
    following: Boolean(value.isFollowing ?? false),
    requested: Boolean(value.hasPendingFollowRequestFromYou ?? value.hasPendingFollowRequest ?? false),
    muting: Boolean(value.isMuted ?? value.isMuting ?? false),
    blocking: Boolean(value.isBlocked ?? value.isBlocking ?? false)
  };
};

export const mapMisskeyStatusWithInstance = (raw: unknown, instanceUrl?: string): Status => {
  const value = raw as Record<string, unknown>;
  const user = (value.user ?? {}) as Record<string, unknown>;
  const renoteValue = value.renote as Record<string, unknown> | null | undefined;
  const renote = renoteValue ? mapMisskeyStatusWithInstance(renoteValue, instanceUrl) : null;
  const accountId = typeof user.id === "string" ? user.id : null;
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
    accountId,
    accountName,
    accountHandle,
    accountUrl,
    accountAvatarUrl,
    content: text,
    hasRichContent: false,
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
    bookmarked: Boolean(value.isFavorited ?? false),
    inReplyToId: value.replyId ? String(value.replyId) : null,
    mentions,
    mediaAttachments,
    reblog: renote,
    boostedBy: renote ? { name: accountName, handle: accountHandle, url: accountUrl } : null,
    notification: null,
    myReaction,
    customEmojis,
    accountEmojis
  };
};

export const mapMisskeyStatus = (raw: unknown): Status => {
  return mapMisskeyStatusWithInstance(raw);
};

const STATUS_LIKE_NOTIFICATION_TYPES = new Set<string>([
  "mention",
  "reply",
  "quote",
  "note",
  "renote",
  "reaction",
  "pollEnded",
  "scheduledNotePosted",
  "reaction:grouped",
  "renote:grouped"
]);
const SYSTEM_NOTIFICATION_TYPES = new Set<string>([
  "achievementEarned",
  "login",
  "test",
  "roleAssigned",
  "announcement",
  "unreadAnnouncement",
  "app",
  "scheduledNotePosted",
  "scheduledNotePostFailed",
  "exportCompleted",
  "chatRoomInvitationReceived",
  "createToken",
  "reaction:grouped",
  "renote:grouped"
]);

const pickTextField = (value: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const raw = value[key];
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return "";
};

const getNotificationMessage = (value: Record<string, unknown>): string => {
  return pickTextField(value, ["body", "message", "header", "title"]);
};

const getAnnouncementMessage = (value: Record<string, unknown>): string => {
  const announcement = value.announcement;
  if (announcement && typeof announcement === "object") {
    const record = announcement as Record<string, unknown>;
    const title = pickTextField(record, ["title", "name"]);
    const text = pickTextField(record, ["text", "body", "message"]);
    if (title && text) {
      return `${title}: ${text}`;
    }
    return title || text;
  }
  return "";
};

const getAchievementDetail = (value: Record<string, unknown>): string => {
  const achievement = value.achievement;
  if (achievement && typeof achievement === "object") {
    const record = achievement as Record<string, unknown>;
    const name = pickTextField(record, ["name", "title"]);
    const description = pickTextField(record, ["description", "detail", "body", "text"]);
    if (name && description) {
      return `${name} - ${description}`;
    }
    return name || description;
  }
  if (typeof achievement === "string") {
    return achievement;
  }
  return "";
};

const getRoleName = (value: Record<string, unknown>): string => {
  const role = value.role;
  if (role && typeof role === "object") {
    const record = role as Record<string, unknown>;
    const name = pickTextField(record, ["name", "title"]);
    if (name) {
      return name;
    }
  }
  if (typeof role === "string") {
    return role;
  }
  return pickTextField(value, ["roleName", "role_name"]);
};

const getChatRoomInvitationDetail = (value: Record<string, unknown>): string => {
  const invitation = value.invitation;
  if (invitation && typeof invitation === "object") {
    const record = invitation as Record<string, unknown>;
    const room = record.room;
    if (room && typeof room === "object") {
      const roomRecord = room as Record<string, unknown>;
      const name = pickTextField(roomRecord, ["name"]);
      if (name) {
        return name;
      }
    }
  }
  return "";
};

const getNoteDraftPreview = (value: Record<string, unknown>): string => {
  const noteDraft = value.noteDraft;
  if (noteDraft && typeof noteDraft === "object") {
    const record = noteDraft as Record<string, unknown>;
    return pickTextField(record, ["text", "cw"]);
  }
  return "";
};

const getExportEntityLabel = (value: Record<string, unknown>): string => {
  const entity = typeof value.exportedEntity === "string" ? value.exportedEntity : "";
  switch (entity) {
    case "antenna":
      return i18n.t("notifications.export.antenna");
    case "blocking":
      return i18n.t("notifications.export.blocking");
    case "clip":
      return i18n.t("notifications.export.clip");
    case "customEmoji":
      return i18n.t("notifications.export.customEmoji");
    case "favorite":
      return i18n.t("notifications.export.favorite");
    case "following":
      return i18n.t("notifications.export.following");
    case "muting":
      return i18n.t("notifications.export.muting");
    case "note":
      return i18n.t("notifications.export.note");
    case "userList":
      return i18n.t("notifications.export.userList");
    default:
      return entity;
  }
};

const getLoginDetail = (value: Record<string, unknown>): string => {
  const ip = pickTextField(value, ["ip", "ipAddress", "ip_address"]);
  const location = pickTextField(value, ["location", "place"]);
  const userAgent = pickTextField(value, ["userAgent", "user_agent", "ua"]);
  const parts = [];
  if (ip) {
    parts.push(`IP: ${ip}`);
  }
  if (location) {
    parts.push(i18n.t("notifications.login.location", { value: location }));
  }
  if (userAgent) {
    parts.push(i18n.t("notifications.login.browser", { value: userAgent }));
  }
  return parts.join(", ");
};

const getNotificationDescriptor = (
  type: string,
  reaction: string | null,
  value: Record<string, unknown>
): { label: string; fallback: string } => {
  switch (type) {
    case "follow":
      return {
        label: i18n.t("notifications.misskey.follow.label"),
        fallback: i18n.t("notifications.misskey.follow.fallback")
      };
    case "receiveFollowRequest":
      return {
        label: i18n.t("notifications.misskey.receiveFollowRequest.label"),
        fallback: i18n.t("notifications.misskey.receiveFollowRequest.fallback")
      };
    case "followRequestAccepted": {
      const followMessage = pickTextField(value, ["message"]);
      return {
        label: i18n.t("notifications.misskey.followRequestAccepted.label"),
        fallback: followMessage
          ? i18n.t("notifications.misskey.followRequestAccepted.fallbackWithMessage", {
              message: followMessage
            })
          : i18n.t("notifications.misskey.followRequestAccepted.fallback")
      };
    }
    case "renote":
      return {
        label: i18n.t("notifications.misskey.renote.label"),
        fallback: i18n.t("notifications.misskey.renote.fallback")
      };
    case "reaction":
      return {
        label: reaction
          ? i18n.t("notifications.misskey.reaction.labelWithReaction", { reaction })
          : i18n.t("notifications.misskey.reaction.label"),
        fallback: reaction
          ? i18n.t("notifications.misskey.reaction.fallbackWithReaction", { reaction })
          : i18n.t("notifications.misskey.reaction.fallback")
      };
    case "pollEnded":
      return {
        label: i18n.t("notifications.misskey.pollEnded.label"),
        fallback: i18n.t("notifications.misskey.pollEnded.fallback")
      };
    case "pollVote":
      return {
        label: i18n.t("notifications.misskey.pollVote.label"),
        fallback: i18n.t("notifications.misskey.pollVote.fallback")
      };
    case "note":
      return {
        label: i18n.t("notifications.misskey.note.label"),
        fallback: i18n.t("notifications.misskey.note.fallback")
      };
    case "quote":
      return {
        label: i18n.t("notifications.misskey.quote.label"),
        fallback: i18n.t("notifications.misskey.quote.fallback")
      };
    case "reply":
      return {
        label: i18n.t("notifications.misskey.reply.label"),
        fallback: i18n.t("notifications.misskey.reply.fallback")
      };
    case "mention":
      return {
        label: i18n.t("notifications.misskey.mention.label"),
        fallback: i18n.t("notifications.misskey.mention.fallback")
      };
    case "scheduledNotePosted":
      return {
        label: i18n.t("notifications.misskey.scheduledNotePosted.label"),
        fallback: i18n.t("notifications.misskey.scheduledNotePosted.fallback")
      };
    case "scheduledNotePostFailed": {
      const preview = getNoteDraftPreview(value);
      return {
        label: i18n.t("notifications.misskey.scheduledNotePostFailed.label"),
        fallback: preview
          ? i18n.t("notifications.misskey.scheduledNotePostFailed.fallbackWithPreview", { preview })
          : i18n.t("notifications.misskey.scheduledNotePostFailed.fallback")
      };
    }
    case "achievementEarned": {
      const detail = getAchievementDetail(value) || getNotificationMessage(value);
      return {
        label: i18n.t("notifications.misskey.achievementEarned.label"),
        fallback: detail
          ? i18n.t("notifications.misskey.achievementEarned.fallbackWithDetail", { detail })
          : i18n.t("notifications.misskey.achievementEarned.fallback")
      };
    }
    case "login": {
      const detail = getLoginDetail(value) || getNotificationMessage(value);
      return {
        label: i18n.t("notifications.misskey.login.label"),
        fallback: detail
          ? i18n.t("notifications.misskey.login.fallbackWithDetail", { detail })
          : i18n.t("notifications.misskey.login.fallback")
      };
    }
    case "test": {
      const message = getNotificationMessage(value);
      return {
        label: i18n.t("notifications.misskey.test.label"),
        fallback: message || i18n.t("notifications.misskey.test.fallback")
      };
    }
    case "roleAssigned": {
      const roleName = getRoleName(value) || getNotificationMessage(value);
      return {
        label: i18n.t("notifications.misskey.roleAssigned.label"),
        fallback: roleName
          ? i18n.t("notifications.misskey.roleAssigned.fallbackWithRole", { role: roleName })
          : i18n.t("notifications.misskey.roleAssigned.fallback")
      };
    }
    case "announcement":
    case "unreadAnnouncement": {
      const announcement = getAnnouncementMessage(value) || getNotificationMessage(value);
      return {
        label: i18n.t("notifications.misskey.announcement.label"),
        fallback: announcement
          ? i18n.t("notifications.misskey.announcement.fallbackWithAnnouncement", { announcement })
          : i18n.t("notifications.misskey.announcement.fallback")
      };
    }
    case "app": {
      const message = getNotificationMessage(value);
      return {
        label: i18n.t("notifications.misskey.app.label"),
        fallback: message || i18n.t("notifications.misskey.app.fallback")
      };
    }
    case "chatRoomInvitationReceived": {
      const roomName = getChatRoomInvitationDetail(value) || getNotificationMessage(value);
      return {
        label: i18n.t("notifications.misskey.chatRoomInvitationReceived.label"),
        fallback: roomName
          ? i18n.t("notifications.misskey.chatRoomInvitationReceived.fallbackWithRoom", { room: roomName })
          : i18n.t("notifications.misskey.chatRoomInvitationReceived.fallback")
      };
    }
    case "exportCompleted": {
      const entity = getExportEntityLabel(value);
      return {
        label: i18n.t("notifications.misskey.exportCompleted.label"),
        fallback: entity
          ? i18n.t("notifications.misskey.exportCompleted.fallbackWithEntity", { entity })
          : i18n.t("notifications.misskey.exportCompleted.fallback")
      };
    }
    case "createToken":
      return {
        label: i18n.t("notifications.misskey.createToken.label"),
        fallback: i18n.t("notifications.misskey.createToken.fallback")
      };
    case "reaction:grouped":
      return {
        label: i18n.t("notifications.misskey.reactionGrouped.label"),
        fallback: i18n.t("notifications.misskey.reactionGrouped.fallback")
      };
    case "renote:grouped":
      return {
        label: i18n.t("notifications.misskey.renoteGrouped.label"),
        fallback: i18n.t("notifications.misskey.renoteGrouped.fallback")
      };
    default:
      return {
        label: i18n.t("notifications.labels.default"),
        fallback: getNotificationMessage(value) || i18n.t("notifications.fallback.default")
      };
  }
};

export const mapMisskeyNotification = (raw: unknown, instanceUrl?: string): Status | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const notificationId = String(value.id ?? "");
  const type = typeof value.type === "string" ? value.type : "";
  const createdAt = String(value.createdAt ?? value.created_at ?? "");
  const noteValue = value.note;
  const noteStatus = noteValue ? mapMisskeyStatusWithInstance(noteValue, instanceUrl) : null;
  if (!notificationId) {
    return null;
  }
  const user = (value.user ?? {}) as Record<string, unknown>;
  const accountId = typeof user.id === "string" ? user.id : null;
  const accountName = String(user.name ?? user.username ?? "");
  const accountHandle = String(user.username ?? "");
  const accountUrl = buildAccountUrl(user, instanceUrl);
  const accountAvatarUrl = typeof user.avatarUrl === "string" ? user.avatarUrl : null;
  const reaction = typeof value.reaction === "string" ? value.reaction : null;
  const descriptor = getNotificationDescriptor(type, reaction, value);
  const isSystemNotification =
    SYSTEM_NOTIFICATION_TYPES.has(type) || (!accountName && !accountHandle);
  const appHeader = pickTextField(value, ["header"]);
  const appIcon = typeof value.icon === "string" ? value.icon : null;
  const isGroupedNotification = type === "reaction:grouped" || type === "renote:grouped";
  const systemActorName = isGroupedNotification ? i18n.t("notifications.system.grouped") : i18n.t("notifications.system.default");
  const appActorName = appHeader || i18n.t("notifications.system.app");
  const actor = isSystemNotification
    ? {
        name: type === "app" ? appActorName : systemActorName,
        handle: "",
        url: null,
        avatarUrl: type === "app" ? appIcon : null
      }
    : {
        name: accountName,
        handle: accountHandle,
        url: accountUrl,
        avatarUrl: accountAvatarUrl
      };
  const normalizedAccountName = isSystemNotification ? actor.name || i18n.t("notifications.system.default") : accountName;
  const systemAccountHandle = type === "app" ? "app" : isGroupedNotification ? "grouped" : "system";
  const normalizedAccountHandle = isSystemNotification ? systemAccountHandle : accountHandle;
  const normalizedAccountUrl = isSystemNotification ? null : accountUrl;
  const normalizedAccountAvatarUrl = isSystemNotification ? actor.avatarUrl ?? null : accountAvatarUrl;
  const target = noteStatus;
  const content = target && STATUS_LIKE_NOTIFICATION_TYPES.has(type) ? "" : descriptor.fallback;
  return {
    id: notificationId,
    createdAt: createdAt || noteStatus?.createdAt || "",
    accountId,
    accountName: normalizedAccountName,
    accountHandle: normalizedAccountHandle,
    accountUrl: normalizedAccountUrl,
    accountAvatarUrl: normalizedAccountAvatarUrl,
    content,
    hasRichContent: false,
    url: target?.url ?? null,
    visibility: target?.visibility ?? "public",
    spoilerText: "",
    sensitive: Boolean(target?.sensitive ?? false),
    card: target?.card ?? null,
    repliesCount: 0,
    reblogsCount: 0,
    favouritesCount: 0,
    reactions: [],
    reblogged: false,
    favourited: false,
    bookmarked: false,
    inReplyToId: target?.inReplyToId ?? null,
    mentions: [],
    mediaAttachments: target?.mediaAttachments ?? [],
    reblog: null,
    boostedBy: null,
    notification: {
      type,
      label: descriptor.label,
      actor,
      target
    },
    myReaction: null,
    customEmojis: target?.customEmojis ?? [],
    accountEmojis: mapCustomEmojis(user.emojis)
  };
};
