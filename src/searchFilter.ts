import type { Listing } from "./types";
import { buildPartyGroups, type PartyRole } from "./partyText";
import { loadJobsJa } from "./jobs";
import {
  getUltimateAchievementGroupMap,
  getUltimateAchievementShortMap,
  type HighEndAchievementGroup,
  type UltimateAchievementName
} from "./lodestoneAchievements";

export type MatchMode = "and" | "or";

export type TextFilter = {
  terms: string[];
  mode?: MatchMode;
};

export type PartyRoleFilter = Partial<Record<PartyRole, string[]>> & {
  /**
   * 同一ロール内（例: healer の ["白","占"]）の評価方法。
   * - "or": いずれかを含めばOK（デフォルト）
   * - "and": 全て含めばOK
   */
  withinRoleMode?: MatchMode;

  /**
   * 複数ロール指定時（例: tank と healer の両方を指定）の評価方法。
   * - "and": 指定したロール条件を全て満たす（デフォルト）
   * - "or": いずれか1つのロール条件を満たす
   */
  acrossRolesMode?: MatchMode;

  /**
   * 互換用（非推奨）: withinRoleMode の旧名。
   */
  roleMode?: MatchMode;

  /**
   * 互換用（非推奨）: acrossRolesMode の旧名。
   */
  mode?: MatchMode;
};

export type PartyFilter = {
  joined?: PartyRoleFilter;
  recruiting?: PartyRoleFilter;
};

export type AchievementFilter = Partial<Record<HighEndAchievementGroup, string[]>> & {
  mode?: MatchMode;
};

/**
 * `formatListingText` 相当の内容を、オブジェクトで検索条件として指定するためのフィルタ定義です。
 *
 * - `TextFilter` は「部分一致」のみ対応（terms × and/or）
 * - party は、表示で使う「ジョブ略称（例: ナ/白/侍）」で指定できます
 * - achievements は、表示で使う略称（例: 絶テマ/【パンデモ】煉獄）で指定できます
 */
export type ListingSearchFilter = {
  dutyTitle?: TextFilter;
  creator?: TextFilter;
  dataCentres?: string[];
  pfCategories?: string[];
  requirements?: TextFilter;
  description?: TextFilter;
  party?: PartyFilter;
  achievements?: AchievementFilter;
  formattedText?: TextFilter;
};

function normalizeTerms(terms: string[]): string[] {
  return terms.map((t) => t.trim()).filter(Boolean);
}

function getMode(mode: MatchMode | undefined): MatchMode {
  return mode ?? "and";
}

function matchText(value: string, filter: TextFilter | undefined): boolean {
  if (!filter) return true;
  const terms = normalizeTerms(filter.terms ?? []);
  if (terms.length === 0) return true;

  const mode = getMode(filter.mode);
  return mode === "and"
    ? terms.every((t) => value.includes(t))
    : terms.some((t) => value.includes(t));
}

/**
 * テキストフィルタ（部分一致 × and/or）の一致判定を行います。
 */
export function matchTextFilter(value: string, filter: TextFilter | undefined): boolean {
  return matchText(value, filter);
}

function matchInList(value: string | undefined, allowList: string[] | undefined): boolean {
  if (!allowList || allowList.length === 0) return true;
  if (!value) return false;
  return allowList.includes(value);
}

function matchStringArray(values: string[], filter: TextFilter | undefined): boolean {
  if (!filter) return true;
  return matchText(values.join(" "), filter);
}

function filterRoleItems(
  roleValues: Record<PartyRole, string[]>,
  filter: PartyRoleFilter | undefined
): boolean {
  if (!filter) return true;
  const acrossRolesMode = getMode(filter.acrossRolesMode ?? filter.mode);
  const withinRoleMode = getMode(filter.withinRoleMode ?? filter.roleMode ?? "or");
  const roles: PartyRole[] = ["tank", "healer", "dps"];

  const checks = roles
    .filter((r) => Array.isArray(filter[r]) && (filter[r] ?? []).length > 0)
    .map((role) => {
      const expected = new Set(normalizeTerms(filter[role] ?? []));
      const actual = new Set(roleValues[role] ?? []);
      const list = Array.from(expected);
      return withinRoleMode === "and"
        ? list.every((v) => actual.has(v))
        : list.some((v) => actual.has(v));
    });

  if (checks.length === 0) return true;
  return acrossRolesMode === "and" ? checks.every(Boolean) : checks.some(Boolean);
}

function computeAchievementShortsByGroup(listing: Listing): Record<HighEndAchievementGroup, string[]> {
  const shortMap = getUltimateAchievementShortMap();
  const groupMap = getUltimateAchievementGroupMap();

  const result: Record<HighEndAchievementGroup, string[]> = { ultimate: [], savage: [] };
  const clears = listing.creatorUltimateClears ?? [];

  for (const name of clears) {
    const group = groupMap.get(name as UltimateAchievementName);
    if (!group) continue;
    const short = shortMap.get(name as UltimateAchievementName) ?? name;
    result[group].push(short);
  }

  return result;
}

function matchAchievements(listing: Listing, filter: AchievementFilter | undefined): boolean {
  if (!filter) return true;

  const status = listing.creatorUltimateClearsStatus;
  if (status === "private_or_unavailable" || status === "error") return false;

  const actual = computeAchievementShortsByGroup(listing);
  const mode = getMode(filter.mode);

  const checks = (["ultimate", "savage"] as const)
    .filter((g) => Array.isArray(filter[g]) && (filter[g] ?? []).length > 0)
    .map((group) => {
      const expected = new Set(normalizeTerms(filter[group] ?? []));
      const got = new Set(actual[group] ?? []);
      return Array.from(expected).every((v) => got.has(v));
    });

  if (checks.length === 0) return true;
  return mode === "and" ? checks.every(Boolean) : checks.some(Boolean);
}

/**
 * フィルタのうち party 条件を評価するためのジョブ辞書を読み込み、略称ベースのグルーピングを返します。
 */
async function buildPartyRoleValues(listing: Listing): Promise<{
  joined: Record<PartyRole, string[]>;
  recruiting: Record<PartyRole, string[]>;
}> {
  const jobsJa = await loadJobsJa();
  const entries = Object.entries(jobsJa.jobs);
  const codeToShort = new Map(entries.map(([code, info]) => [code, info.short]));
  const codeToRole = new Map(entries.map(([code, info]) => [code, info.role]));

  const groups = buildPartyGroups(listing, codeToShort, codeToRole);
  return {
    joined: groups.joined,
    recruiting: {
      tank: Array.from(groups.recruiting.tank),
      healer: Array.from(groups.recruiting.healer),
      dps: Array.from(groups.recruiting.dps)
    }
  };
}

/**
 * 募集（Listing）がフィルタ条件に一致するか判定します。
 *
 * - `formattedText` は呼び出し元で生成した文字列を渡してください（Lodestone情報などを含めるため）
 */
export async function matchListing(params: {
  listing: Listing;
  filter?: ListingSearchFilter;
  formattedText?: string;
}): Promise<boolean> {
  const { listing, filter, formattedText } = params;
  if (!filter) return true;

  if (!matchText(listing.duty?.title ?? "", filter.dutyTitle)) return false;
  if (!matchText(listing.creator ?? "", filter.creator)) return false;
  if (!matchInList(listing.dataCentre, filter.dataCentres)) return false;
  if (!matchInList(listing.dataPfCategory, filter.pfCategories)) return false;
  if (!matchStringArray(listing.requirements ?? [], filter.requirements)) return false;
  if (!matchText(listing.description ?? "", filter.description)) return false;

  if (filter.achievements && !matchAchievements(listing, filter.achievements)) return false;
  if (filter.formattedText && !matchText(formattedText ?? "", filter.formattedText)) return false;

  if (filter.party) {
    const roleValues = await buildPartyRoleValues(listing);
    if (!filterRoleItems(roleValues.joined, filter.party.joined)) return false;
    if (!filterRoleItems(roleValues.recruiting, filter.party.recruiting)) return false;
  }

  return true;
}

/**
 * JSON文字列から ListingSearchFilter を読み取ります（不正な場合は undefined）。
 */
export function parseListingSearchFilterJson(raw: string | undefined): ListingSearchFilter | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return undefined;
    return parsed as ListingSearchFilter;
  } catch {
    return undefined;
  }
}

/**
 * JSONファイルから ListingSearchFilter を読み込みます。
 * ファイルが存在しない/読めない/JSONが不正な場合は undefined を返します。
 */
export async function loadListingSearchFilterFromFile(
  filePath: string | undefined
): Promise<ListingSearchFilter | undefined> {
  const path = filePath?.trim();
  if (!path) return undefined;

  try {
    const raw = await readFile(resolve(process.cwd(), path), "utf8");
    return parseListingSearchFilterJson(raw);
  } catch {
    return undefined;
  }
}
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
