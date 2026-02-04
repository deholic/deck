import type {
  Account,
  AccountRelationship,
  CustomEmoji,
  Status,
  ThreadContext,
  TimelineType,
  InstanceInfo,
  UserProfile
} from "../domain/types";
import type { CreateStatusInput, MastodonApi } from "../services/MastodonApi";
import { mapAccountProfile, mapAccountRelationship, mapNotificationToStatus, mapStatus } from "./mastodonMapper";
import i18n from "../i18n";

const buildHeaders = (account: Account): HeadersInit => ({
  Authorization: `Bearer ${account.accessToken}`,
  "Content-Type": "application/json"
});

const mapCustomEmojis = (data: unknown): CustomEmoji[] => {
  if (!Array.isArray(data)) {
    return [];
  }
  const result: CustomEmoji[] = [];
  data.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const typed = item as Record<string, unknown>;
    const shortcode = typeof typed.shortcode === "string" ? typed.shortcode : "";
    const url =
      typeof typed.url === "string"
        ? typed.url
        : typeof typed.static_url === "string"
          ? typed.static_url
          : "";
    if (!shortcode || !url) {
      return;
    }
    result.push({
      shortcode,
      url,
      category: typeof typed.category === "string" ? typed.category : null
    });
  });
  return result;
};

export class MastodonHttpClient implements MastodonApi {
  async verifyAccount(
    account: Account
  ): Promise<{ accountName: string; handle: string; avatarUrl: string | null; emojis: CustomEmoji[] }> {
    const response = await fetch(`${account.instanceUrl}/api/v1/accounts/verify_credentials`, {
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.api.accountVerifyFailed"));
    }
    const data = (await response.json()) as Record<string, unknown>;
    return {
      accountName: String(data.display_name ?? data.username ?? ""),
      handle: String(data.acct ?? ""),
      avatarUrl: typeof data.avatar === "string" ? data.avatar : null,
      emojis: mapCustomEmojis(data.emojis)
    };
  }

  async fetchHomeTimeline(account: Account, limit: number, maxId?: string): Promise<Status[]> {
    const url = new URL(`${account.instanceUrl}/api/v1/timelines/home`);
    url.searchParams.set("limit", String(limit));
    if (maxId) {
      url.searchParams.set("max_id", maxId);
    }
    const response = await fetch(url.toString(), {
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.timelineLoadFailed"));
    }
    const data = (await response.json()) as unknown[];
    return data.map(mapStatus);
  }

  async fetchTimeline(
    account: Account,
    timeline: TimelineType,
    limit: number,
    maxId?: string
  ): Promise<Status[]> {
    if (timeline === "home") {
      return this.fetchHomeTimeline(account, limit, maxId);
    }
    if (timeline === "notifications") {
      return this.fetchNotifications(account, limit, maxId);
    }
    const url = new URL(`${account.instanceUrl}/api/v1/timelines/public`);
    url.searchParams.set("limit", String(limit));
    if (timeline === "local") {
      url.searchParams.set("local", "true");
    }
    if (maxId) {
      url.searchParams.set("max_id", maxId);
    }
    const response = await fetch(url.toString(), {
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.timelineLoadFailed"));
    }
    const data = (await response.json()) as unknown[];
    return data.map(mapStatus);
  }

  async fetchBookmarks(account: Account, limit: number = 20, maxId?: string): Promise<Status[]> {
    const url = new URL(`${account.instanceUrl}/api/v1/bookmarks`);
    url.searchParams.set("limit", String(limit));
    if (maxId) {
      url.searchParams.set("max_id", maxId);
    }
    const response = await fetch(url.toString(), {
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.api.bookmarksLoadFailed"));
    }
    const data = (await response.json()) as unknown[];
    return data.map(mapStatus);
  }

  async fetchCustomEmojis(account: Account): Promise<CustomEmoji[]> {
    const response = await fetch(`${account.instanceUrl}/api/v1/custom_emojis`, {
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.api.customEmojisLoadFailed"));
    }
    const data = (await response.json()) as unknown;
    return mapCustomEmojis(data);
  }

  async fetchInstanceInfo(account: Account): Promise<InstanceInfo> {
    // 먼저 v2 API를 시도
    try {
      const v2Response = await fetch(`${account.instanceUrl}/api/v2/instance`, {
        headers: buildHeaders(account)
      });
      if (v2Response.ok) {
        const v2Data = (await v2Response.json()) as Record<string, unknown>;
        const configuration = v2Data.configuration as Record<string, unknown> || {};
        const statuses = configuration.statuses as Record<string, unknown> || {};
        
        // v2 API에서 max_characters 가져오기, 없으면 v1 호환 필드 사용
        const maxChars = typeof statuses.max_characters === "number" 
          ? statuses.max_characters 
          : typeof v2Data.max_toot_chars === "number" 
            ? v2Data.max_toot_chars 
            : 500;
        
        return {
          uri: String(v2Data.uri || v2Data.domain || ""),
          title: String(v2Data.title || ""),
          description: v2Data.description ? String(v2Data.description) : undefined,
          max_toot_chars: maxChars,
          platform: "mastodon"
        };
      }
    } catch {
      // v2 API 실패 시 v1 API로 fallback
    }

    const v1Response = await fetch(`${account.instanceUrl}/api/v1/instance`, {
      headers: buildHeaders(account)
    });
    if (!v1Response.ok) {
      throw new Error(i18n.t("errors.api.instanceInfoLoadFailed"));
    }
    const data = (await v1Response.json()) as Record<string, unknown>;
    
    // v1 API에서 configuration 확인 (이전 버전과의 호환성)
    let maxChars = 500;
    if (typeof data.max_toot_chars === "number") {
      maxChars = data.max_toot_chars;
    } else if (data.configuration && typeof data.configuration === "object") {
      const config = data.configuration as Record<string, unknown>;
      if (config.statuses && typeof config.statuses === "object") {
        const statuses = config.statuses as Record<string, unknown>;
        if (typeof statuses.max_characters === "number") {
          maxChars = statuses.max_characters;
        }
      }
    }
    
    return {
      uri: String(data.uri || data.domain || ""),
      title: String(data.title || ""),
      description: data.description ? String(data.description) : undefined,
      max_toot_chars: maxChars,
      platform: "mastodon"
    };
  }

  async fetchAccountProfile(account: Account, accountId: string): Promise<UserProfile> {
    const response = await fetch(`${account.instanceUrl}/api/v1/accounts/${accountId}`, {
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.api.profileLoadFailed"));
    }
    const data = (await response.json()) as unknown;
    return mapAccountProfile(data);
  }

  async fetchAccountRelationship(account: Account, accountId: string): Promise<AccountRelationship> {
    const url = new URL(`${account.instanceUrl}/api/v1/accounts/relationships`);
    url.searchParams.append("id[]", accountId);
    const response = await fetch(url.toString(), {
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.api.relationshipLoadFailed"));
    }
    const data = (await response.json()) as unknown[];
    const relationship = data[0];
    return mapAccountRelationship(relationship);
  }

  async followAccount(account: Account, accountId: string): Promise<AccountRelationship> {
    const response = await fetch(`${account.instanceUrl}/api/v1/accounts/${accountId}/follow`, {
      method: "POST",
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.api.followFailed"));
    }
    const data = (await response.json()) as unknown;
    return mapAccountRelationship(data);
  }

  async unfollowAccount(account: Account, accountId: string): Promise<AccountRelationship> {
    const response = await fetch(`${account.instanceUrl}/api/v1/accounts/${accountId}/unfollow`, {
      method: "POST",
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.api.unfollowFailed"));
    }
    const data = (await response.json()) as unknown;
    return mapAccountRelationship(data);
  }

  async cancelFollowRequest(account: Account, accountId: string): Promise<AccountRelationship> {
    return this.unfollowAccount(account, accountId);
  }

  async muteAccount(account: Account, accountId: string): Promise<AccountRelationship> {
    const response = await fetch(`${account.instanceUrl}/api/v1/accounts/${accountId}/mute`, {
      method: "POST",
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.api.muteFailed"));
    }
    const data = (await response.json()) as unknown;
    return mapAccountRelationship(data);
  }

  async unmuteAccount(account: Account, accountId: string): Promise<AccountRelationship> {
    const response = await fetch(`${account.instanceUrl}/api/v1/accounts/${accountId}/unmute`, {
      method: "POST",
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.api.unmuteFailed"));
    }
    const data = (await response.json()) as unknown;
    return mapAccountRelationship(data);
  }

  async blockAccount(account: Account, accountId: string): Promise<AccountRelationship> {
    const response = await fetch(`${account.instanceUrl}/api/v1/accounts/${accountId}/block`, {
      method: "POST",
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.api.blockFailed"));
    }
    const data = (await response.json()) as unknown;
    return mapAccountRelationship(data);
  }

  async unblockAccount(account: Account, accountId: string): Promise<AccountRelationship> {
    const response = await fetch(`${account.instanceUrl}/api/v1/accounts/${accountId}/unblock`, {
      method: "POST",
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.api.unblockFailed"));
    }
    const data = (await response.json()) as unknown;
    return mapAccountRelationship(data);
  }

  async fetchThreadContext(account: Account, statusId: string): Promise<ThreadContext> {
    return this.fetchContext(account, statusId);
  }

  async fetchAccountStatuses(
    account: Account,
    accountId: string,
    limit: number,
    maxId?: string
  ): Promise<Status[]> {
    const url = new URL(`${account.instanceUrl}/api/v1/accounts/${accountId}/statuses`);
    url.searchParams.set("limit", String(limit));
    if (maxId) {
      url.searchParams.set("max_id", maxId);
    }
    const response = await fetch(url.toString(), {
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.api.statusesLoadFailed"));
    }
    const data = (await response.json()) as unknown[];
    return data.map(mapStatus);
  }

  async uploadMedia(account: Account, file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${account.instanceUrl}/api/v2/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`
      },
      body: formData
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.api.mediaUploadFailed"));
    }
    const data = (await response.json()) as Record<string, unknown>;
    const id = String(data.id ?? "");
    if (!id) {
      throw new Error(i18n.t("errors.api.mediaUploadNotFound"));
    }
    return id;
  }

  async fetchContext(account: Account, statusId: string): Promise<ThreadContext> {
    const response = await fetch(`${account.instanceUrl}/api/v1/statuses/${statusId}/context`, {
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.threadLoadFailed"));
    }
    const data = (await response.json()) as Record<string, unknown>;
    
    // 마스토돈 API 응답: { ancestors: Status[], descendants: Status[] }
    const ancestors = Array.isArray(data.ancestors) 
      ? data.ancestors.map(mapStatus).filter((status): status is Status => status !== null)
      : [];
    
    const descendants = Array.isArray(data.descendants)
      ? data.descendants.map(mapStatus).filter((status): status is Status => status !== null)
      : [];

    return {
      ancestors,
      descendants
    };
  }

  async createStatus(account: Account, input: CreateStatusInput): Promise<Status> {
    const response = await fetch(`${account.instanceUrl}/api/v1/statuses`, {
      method: "POST",
      headers: buildHeaders(account),
      body: JSON.stringify({
        status: input.status,
        visibility: input.visibility,
        in_reply_to_id: input.inReplyToId,
        media_ids: input.mediaIds,
        spoiler_text: input.spoilerText
      })
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.composeFailed"));
    }
    const data = (await response.json()) as unknown;
    return mapStatus(data);
  }

  async deleteStatus(account: Account, statusId: string): Promise<void> {
    const response = await fetch(`${account.instanceUrl}/api/v1/statuses/${statusId}`, {
      method: "DELETE",
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.statusDeleteFailed"));
    }
  }

  async favourite(account: Account, statusId: string): Promise<Status> {
    return this.postAction(account, statusId, "favourite");
  }

  async unfavourite(account: Account, statusId: string): Promise<Status> {
    return this.postAction(account, statusId, "unfavourite");
  }

  async bookmark(account: Account, statusId: string): Promise<Status> {
    return this.postAction(account, statusId, "bookmark");
  }

  async unbookmark(account: Account, statusId: string): Promise<Status> {
    return this.postAction(account, statusId, "unbookmark");
  }

  async createReaction(_account: Account, _statusId: string, _reaction: string): Promise<Status> {
    throw new Error(i18n.t("errors.reactionMisskeyOnly"));
  }

  async deleteReaction(_account: Account, _statusId: string): Promise<Status> {
    throw new Error(i18n.t("errors.reactionMisskeyOnly"));
  }

  async fetchNoteState(
    account: Account,
    noteId: string
  ): Promise<{ isFavourited: boolean; isReblogged: boolean; bookmarked: boolean }> {
    const response = await fetch(`${account.instanceUrl}/api/v1/statuses/${noteId}`, {
      headers: {
        "Authorization": `Bearer ${account.accessToken}`
      }
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.api.noteStateLoadFailed"));
    }
    const data = (await response.json()) as unknown;
    const status = mapStatus(data);
    return {
      isFavourited: status.favourited,
      isReblogged: status.reblogged,
      bookmarked: status.bookmarked
    };
  }

  async translateStatus(account: Account, statusId: string) {
    const response = await fetch(`${account.instanceUrl}/api/v1/statuses/${statusId}/translate`, {
      method: "POST",
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.api.translationFailed"));
    }
    const data = (await response.json()) as Record<string, unknown>;
    const htmlContent = typeof data.content === "string" ? data.content : "";
    const sourceLanguage =
      typeof data.detected_source_language === "string" ? data.detected_source_language : null;
    const targetLanguage = typeof data.target_language === "string" ? data.target_language : null;
    const provider = typeof data.provider === "string" ? data.provider : null;
    return {
      content: htmlContent,
      htmlContent,
      sourceLanguage,
      targetLanguage,
      provider
    };
  }

  async reblog(account: Account, statusId: string): Promise<Status> {
    return this.postAction(account, statusId, "reblog");
  }

  async unreblog(account: Account, statusId: string): Promise<Status> {
    return this.postAction(account, statusId, "unreblog");
  }

  private async fetchNotifications(
    account: Account,
    limit: number,
    maxId?: string
  ): Promise<Status[]> {
    const url = new URL(`${account.instanceUrl}/api/v1/notifications`);
    url.searchParams.set("limit", String(limit));
    if (maxId) {
      url.searchParams.set("max_id", maxId);
    }
    const response = await fetch(url.toString(), {
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      throw new Error(i18n.t("errors.api.notificationsLoadFailed"));
    }
    const data = (await response.json()) as unknown[];
    return data
      .map((item) => mapNotificationToStatus(item))
      .filter((item): item is Status => item !== null);
  }

  private async postAction(account: Account, statusId: string, action: string): Promise<Status> {
    const response = await fetch(`${account.instanceUrl}/api/v1/statuses/${statusId}/${action}`, {
      method: "POST",
      headers: buildHeaders(account)
    });
    if (!response.ok) {
      const errorBody = await response.text();
      if (errorBody) {
        try {
          const data = JSON.parse(errorBody) as { error?: string; message?: string };
          const message = data.error || data.message;
          if (message) {
            throw new Error(message);
          }
        } catch {
          throw new Error(errorBody);
        }
      }
      throw new Error(i18n.t("errors.api.requestFailed"));
    }
    const data = (await response.json()) as unknown;
    return mapStatus(data);
  }
}
