export type RegisteredApp = {
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
};

export interface OAuthClient {
  registerApp(instanceUrl: string, redirectUri: string): Promise<RegisteredApp>;
  exchangeCode(params: {
    instanceUrl: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    code: string;
    scope: string;
  }): Promise<string>;
}
