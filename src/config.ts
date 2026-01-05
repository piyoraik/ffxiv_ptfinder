/**
 * CLI 全体で共有するデフォルト値・設定。
 */

export const DEFAULT_LISTINGS_URL = "https://xivpf.com/listings";
export const DEFAULT_COOKIE = "lang=ja";
export const DEFAULT_WEBHOOK_LIMIT = 5;
export const DEFAULT_FILTER_FILE = "data/filter.json";

export const ALLOWED_DATA_CENTRES = new Set(["Elemental", "Mana", "Meteor", "Gaia"]);

export const ENV = {
  LIMIT: "FFXIV_PTFINDER_LIMIT",
  DISCORD_WEBHOOK_URL: "DISCORD_WEBHOOK_URL",
  FILTER_FILE: "FFXIV_PTFINDER_FILTER_FILE"
} as const;
