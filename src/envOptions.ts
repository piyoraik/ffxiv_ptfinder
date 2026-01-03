import {
  DEFAULT_DESCRIPTION_MATCH_MODE,
  DEFAULT_DESCRIPTION_TERMS,
  DEFAULT_FILTER_FILE,
  DEFAULT_LISTINGS_URL,
  DEFAULT_WEBHOOK_LIMIT,
  ENV
} from "./config";
import type { CliOptions } from "./cliOptions";
import { parseListingSearchFilterJson, type ListingSearchFilter } from "./searchFilter";

/**
 * 環境変数を読み取り、前後空白を除いた文字列を返します（空なら undefined）。
 */
export function getEnvString(name: string): string | undefined {
  const value = process.env[name];
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * 正の整数として解釈できる場合のみ数値を返します。
 */
export function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
}

export type DescriptionMatchMode = "and" | "or";

/**
 * 募集文フィルタ条件（部分一致）の配列をパースします。
 * - JSON配列: `["最初から","固定募集"]`
 * - カンマ区切り: `最初から,固定募集`
 */
function parseDescriptionTerms(value: string | undefined): string[] | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;

  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return undefined;
      const terms = parsed
        .filter((v) => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean);
      return terms.length > 0 ? terms : undefined;
    } catch {
      return undefined;
    }
  }

  const terms = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return terms.length > 0 ? terms : undefined;
}

/**
 * 募集文フィルタのマッチモード（and/or）をパースします。
 */
function parseDescriptionMode(value: string | undefined): DescriptionMatchMode | undefined {
  const raw = value?.trim().toLowerCase();
  if (raw === "and" || raw === "or") return raw;
  return undefined;
}

/**
 * 環境変数からオプションを読み取ります（デフォルト値はここでは適用しません）。
 */
export function readEnvOptions(): Partial<CliOptions> & {
  descriptionTerms?: string[];
  descriptionMode?: DescriptionMatchMode;
  filterJson?: string;
  filterFile?: string;
  searchFilter?: ListingSearchFilter;
} {
  return {
    query: getEnvString(ENV.QUERY),
    limit: parsePositiveInt(getEnvString(ENV.LIMIT)),
    descriptionTerms: parseDescriptionTerms(getEnvString(ENV.DESCRIPTION_TERMS)),
    descriptionMode: parseDescriptionMode(getEnvString(ENV.DESCRIPTION_MODE)),
    filterJson: getEnvString(ENV.FILTER_JSON),
    filterFile: getEnvString(ENV.FILTER_FILE),
    searchFilter: parseListingSearchFilterJson(getEnvString(ENV.FILTER_JSON))
  };
}

export type ResolvedCliOptions = {
  input: string;
  webhookUrl: string;
  limit: number;
  descriptionTerms: string[];
  descriptionMode: DescriptionMatchMode;
  searchFilter?: ListingSearchFilter;
  searchFilterFile: string;
  searchFilterJson?: string;
};

/**
 * CLIオプションを優先して環境変数オプションとマージし、デフォルト値を適用します。
 */
export function resolveOptions(
  cli: CliOptions,
  env: Partial<CliOptions> & {
    descriptionTerms?: string[];
    descriptionMode?: DescriptionMatchMode;
    filterJson?: string;
    filterFile?: string;
  }
): ResolvedCliOptions {
  const webhookUrl = getEnvString(ENV.DISCORD_WEBHOOK_URL);
  if (!webhookUrl) {
    throw new Error(`${ENV.DISCORD_WEBHOOK_URL} is required.`);
  }

  const searchFilterFile = env.filterFile ?? DEFAULT_FILTER_FILE;
  const searchFilterJson = env.filterJson;
  const searchFilter = parseListingSearchFilterJson(searchFilterJson);

  return {
    input: DEFAULT_LISTINGS_URL,
    webhookUrl,
    limit: cli.limit ?? env.limit ?? DEFAULT_WEBHOOK_LIMIT,
    descriptionTerms: env.descriptionTerms ?? [...DEFAULT_DESCRIPTION_TERMS],
    descriptionMode: env.descriptionMode ?? DEFAULT_DESCRIPTION_MATCH_MODE,
    searchFilter,
    searchFilterFile,
    searchFilterJson
  };
}
