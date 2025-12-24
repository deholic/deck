import type { OAuthClient, RegisteredApp } from "../services/OAuthClient";

const OAUTH_SCOPE = "read write follow";

const normalizeInstanceUrl = (instanceUrl: string): string => instanceUrl.replace(/\/$/, "");

export class MastodonOAuthClient implements OAuthClient {
  async registerApp(instanceUrl: string, redirectUri: string): Promise<RegisteredApp> {
    const normalized = normalizeInstanceUrl(instanceUrl);
    const body = new URLSearchParams({
      client_name: "textodon",
      redirect_uris: redirectUri,
      scopes: OAUTH_SCOPE
    });
    const response = await fetch(`${normalized}/api/v1/apps`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    if (!response.ok) {
      throw new Error("앱 등록에 실패했습니다.");
    }

    const data = (await response.json()) as Record<string, unknown>;
    const clientId = String(data.client_id ?? "");
    const clientSecret = String(data.client_secret ?? "");
    if (!clientId || !clientSecret) {
      throw new Error("앱 등록 정보가 올바르지 않습니다.");
    }
    return {
      instanceUrl: normalized,
      clientId,
      clientSecret,
      redirectUri,
      scope: OAUTH_SCOPE
    };
  }

  async exchangeCode(params: {
    instanceUrl: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    code: string;
    scope: string;
  }): Promise<string> {
    const body = new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
      code: params.code,
      scope: params.scope
    });
    const response = await fetch(`${normalizeInstanceUrl(params.instanceUrl)}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    if (!response.ok) {
      throw new Error("토큰 교환에 실패했습니다.");
    }

    const data = (await response.json()) as Record<string, unknown>;
    const token = String(data.access_token ?? "");
    if (!token) {
      throw new Error("토큰을 받지 못했습니다.");
    }
    return token;
  }
}
