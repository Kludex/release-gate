export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  OWNER_GITHUB_ID: string;
  PUBLIC_ORIGIN: string;
  RP_NAME: string;
};

export type User = { id: number; login: string };

export type AppEnv = { Bindings: Env; Variables: { user: User | null } };
