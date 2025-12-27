import type { OAuthCallbackParams, OAuthClient, OAuthPlatform, RegisteredApp } from "../services/OAuthClient";
import { MastodonOAuthClient } from "./MastodonOAuthClient";
import { MisskeyOAuthClient } from "./MisskeyOAuthClient";

const normalizeInstanceUrl = (instanceUrl: string): string => instanceUrl.replace(/\/$/, "");

const detectPlatform = async (instanceUrl: string): Promise<OAuthPlatform> => {
  try {
    const response = await fetch(`${normalizeInstanceUrl(instanceUrl)}/api/meta`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });
    if (response.ok) {
      const data = (await response.json()) as { name?: string; version?: string };
      if (data.name || data.version) {
        return "misskey";
      }
    }
  } catch {
    return "mastodon";
  }
  return "mastodon";
};

export class UnifiedOAuthClient implements OAuthClient {
  constructor(
    private readonly mastodon: MastodonOAuthClient,
    private readonly misskey: MisskeyOAuthClient
  ) {}

  async registerApp(instanceUrl: string, redirectUri: string): Promise<RegisteredApp> {
    const platform = await detectPlatform(instanceUrl);
    if (platform === "misskey") {
      return this.misskey.registerApp(instanceUrl, redirectUri);
    }
    return this.mastodon.registerApp(instanceUrl, redirectUri);
  }

  buildAuthorizeUrl(app: RegisteredApp, state: string): string {
    if (app.platform === "misskey") {
      return this.misskey.buildAuthorizeUrl(app, state);
    }
    return this.mastodon.buildAuthorizeUrl(app, state);
  }

  exchangeToken(params: { app: RegisteredApp; callback: OAuthCallbackParams }): Promise<string> {
    if (params.app.platform === "misskey") {
      return this.misskey.exchangeToken(params);
    }
    return this.mastodon.exchangeToken(params);
  }
}
