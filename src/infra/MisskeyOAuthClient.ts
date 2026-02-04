import type {
  MisskeyRegisteredApp,
  OAuthCallbackParams,
  OAuthClient,
  RegisteredApp
} from "../services/OAuthClient";
import i18n from "../i18n";

const APP_NAME = "Deck";
const MIAUTH_PERMISSIONS = [
  "read:account",
  "read:notifications",
  "read:notes",
  "write:notes",
  "write:drive",
  "write:reactions",
  "write:favorites",
  "write:following",
  "write:mutes",
  "write:blocks"
];

const normalizeInstanceUrl = (instanceUrl: string): string => instanceUrl.replace(/\/$/, "");

export class MisskeyOAuthClient implements OAuthClient {
  async registerApp(instanceUrl: string, redirectUri: string): Promise<MisskeyRegisteredApp> {
    return {
      platform: "misskey",
      instanceUrl: normalizeInstanceUrl(instanceUrl),
      redirectUri,
      scope: MIAUTH_PERMISSIONS.join(","),
      sessionId: crypto.randomUUID(),
      appName: APP_NAME
    };
  }

  buildAuthorizeUrl(app: RegisteredApp, state: string): string {
    if (app.platform !== "misskey") {
      throw new Error(i18n.t("errors.oauth.misskeyInfoRequired"));
    }
    const authorizeUrl = new URL(`${normalizeInstanceUrl(app.instanceUrl)}/miauth/${app.sessionId}`);
    const callbackUrl = new URL(app.redirectUri);
    callbackUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("name", app.appName);
    authorizeUrl.searchParams.set("callback", callbackUrl.toString());
    authorizeUrl.searchParams.set("permission", app.scope);
    return authorizeUrl.toString();
  }

  async exchangeToken(params: { app: RegisteredApp; callback: OAuthCallbackParams }): Promise<string> {
    if (params.app.platform !== "misskey") {
      throw new Error(i18n.t("errors.oauth.misskeyInfoRequired"));
    }
    const sessionId = params.callback.session ?? params.app.sessionId;
    if (!sessionId) {
      throw new Error(i18n.t("errors.oauth.misskeySessionMissing"));
    }
    const response = await fetch(
      `${normalizeInstanceUrl(params.app.instanceUrl)}/api/miauth/${sessionId}/check`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      }
    );
    if (!response.ok) {
      throw new Error(i18n.t("errors.oauth.misskeyTokenMissing"));
    }
    const data = (await response.json()) as { ok?: boolean; token?: string };
    if (!data.ok || !data.token) {
      throw new Error(i18n.t("errors.oauth.misskeyTokenInvalid"));
    }
    return data.token;
  }
}
