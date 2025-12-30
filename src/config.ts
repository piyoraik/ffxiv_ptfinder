/**
 * CLI 全体で共有するデフォルト値・設定。
 */

export const DEFAULT_LISTINGS_URL = "https://xivpf.com/listings";
export const DEFAULT_COOKIE = "lang=ja";
export const DEFAULT_WEBHOOK_LIMIT = 5;

export const ALLOWED_DATA_CENTRES = new Set(["Elemental", "Mana", "Meteor", "Gaia"]);

export const ENV = {
  QUERY: "FFXIV_PTFINDER_QUERY",
  LIMIT: "FFXIV_PTFINDER_LIMIT",
  DISCORD_WEBHOOK_URL: "DISCORD_WEBHOOK_URL"
} as const;
