export type OAuthPlatform = "mastodon" | "misskey";

export type MastodonRegisteredApp = {
  platform: "mastodon";
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
};

export type MisskeyRegisteredApp = {
  platform: "misskey";
  instanceUrl: string;
  redirectUri: string;
  scope: string;
  sessionId: string;
  appName: string;
};

export type RegisteredApp = MastodonRegisteredApp | MisskeyRegisteredApp;

export type OAuthCallbackParams = {
  code: string | null;
  state: string | null;
  session: string | null;
};

export interface OAuthClient {
  registerApp(instanceUrl: string, redirectUri: string): Promise<RegisteredApp>;
  buildAuthorizeUrl(app: RegisteredApp, state: string): string;
  exchangeToken(params: { app: RegisteredApp; callback: OAuthCallbackParams }): Promise<string>;
}
