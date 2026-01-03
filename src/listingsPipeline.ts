import { extractListingsFromHtml } from "./extractListings";
import { applyDescriptionTags } from "./descriptionRequirements";
import { loadDescriptionTagsJa } from "./descriptionTags";
import { loadHtml } from "./fetchHtml";
import {
  ALLOWED_DATA_CENTRES,
  DEFAULT_DESCRIPTION_MATCH_MODE,
  DEFAULT_DESCRIPTION_TERMS
} from "./config";
import type { Listing } from "./types";
import type { DescriptionMatchMode } from "./envOptions";
import { matchTextFilter, type ListingSearchFilter } from "./searchFilter";

/**
 * 対象DC（Elemental/Mana/Meteor/Gaia）のみに絞り込みます。
 */
function filterAllowedDataCentres(listings: Listing[]): Listing[] {
  return listings.filter((l) => l.dataCentre && ALLOWED_DATA_CENTRES.has(l.dataCentre));
}

/**
 * （後方互換用）コンテンツ名（duty.title）で部分一致フィルタします。
 * 現状は `filter.json` 側で `dutyTitle` を指定する運用を想定しているため、呼び出し側では使用しません。
 */
function filterByQuery(listings: Listing[], query: string | undefined): Listing[] {
  const q = query?.trim();
  if (!q) return listings;
  return listings.filter((l) => (l.duty?.title ?? "").includes(q));
}

/**
 * 募集文に特定の文字列を含むものだけに絞り込みます。
 */
function filterByDescriptionTerms(
  listings: Listing[],
  terms: string[],
  mode: DescriptionMatchMode
): Listing[] {
  const normalized = terms.map((t) => t.trim()).filter(Boolean);
  if (normalized.length === 0) return listings;

  return listings.filter((l) => {
    const description = l.description ?? "";
    return mode === "and"
      ? normalized.every((t) => description.includes(t))
      : normalized.some((t) => description.includes(t));
  });
}

export type PipelineOptions = {
  input: string;
  descriptionTerms?: string[];
  descriptionMode?: DescriptionMatchMode;
  searchFilter?: ListingSearchFilter;
};

/**
 * HTML取得→募集抽出→DC/クエリ絞り込み→要件抽出、までを行います。
 *
 * Webhook送信やテキスト整形はこの関数の責務に含めません。
 */
export async function buildListings(options: PipelineOptions): Promise<Listing[]> {
  const html = await loadHtml(options.input);
  const allListings = extractListingsFromHtml(html);
  const dcFiltered = filterAllowedDataCentres(allListings);
  const queryFiltered = dcFiltered;

  const tagsJa = await loadDescriptionTagsJa();
  const tagged = applyDescriptionTags(queryFiltered, tagsJa.tags);
  const terms = options.descriptionTerms ?? [...DEFAULT_DESCRIPTION_TERMS];
  const mode = options.descriptionMode ?? DEFAULT_DESCRIPTION_MATCH_MODE;

  // 既存の簡易フィルタ（descriptionの部分一致）に加えて、オブジェクト指定の検索条件がある場合は
  // Lodestone 取得前に適用できる範囲だけ先に絞り込みます。
  const preFiltered = filterByDescriptionTerms(tagged, terms, mode);
  if (!options.searchFilter) return preFiltered;

  const f = options.searchFilter;
  return preFiltered.filter((l) => {
    if (!matchTextFilter(l.duty?.title ?? "", f.dutyTitle)) return false;
    if (!matchTextFilter(l.creator ?? "", f.creator)) return false;
    if (f.dataCentres && f.dataCentres.length > 0 && !f.dataCentres.includes(l.dataCentre ?? "")) return false;
    if (f.pfCategories && f.pfCategories.length > 0 && !f.pfCategories.includes(l.dataPfCategory ?? "")) return false;
    return true;
  });
}
