/**
 * CLI 全体で共有するデフォルト値・設定。
 */

export const DEFAULT_LISTINGS_URL = "https://xivpf.com/listings";
export const DEFAULT_COOKIE = "lang=ja";
export const DEFAULT_WEBHOOK_LIMIT = 5;
export const DEFAULT_FILTER_FILE = "data/filter.json";

/**
 * 募集文フィルタのデフォルト条件。
 * - terms: 複数条件（部分一致）
 * - mode: "and" は全て含む / "or" はいずれかを含む
 */
export const DEFAULT_DESCRIPTION_TERMS: string[] = [];
export const DEFAULT_DESCRIPTION_MATCH_MODE = "and" as const;

export const ALLOWED_DATA_CENTRES = new Set(["Elemental", "Mana", "Meteor", "Gaia"]);

export const ENV = {
  QUERY: "FFXIV_PTFINDER_QUERY",
  LIMIT: "FFXIV_PTFINDER_LIMIT",
  DISCORD_WEBHOOK_URL: "DISCORD_WEBHOOK_URL",
  DESCRIPTION_TERMS: "FFXIV_PTFINDER_DESCRIPTION_TERMS",
  DESCRIPTION_MODE: "FFXIV_PTFINDER_DESCRIPTION_MODE",
  FILTER_JSON: "FFXIV_PTFINDER_FILTER_JSON",
  FILTER_FILE: "FFXIV_PTFINDER_FILTER_FILE"
} as const;
