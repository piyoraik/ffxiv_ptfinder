import { extractListingsFromHtml } from "./extractListings";
import { applyDescriptionTags } from "./descriptionRequirements";
import { loadDescriptionTagsJa } from "./descriptionTags";
import { loadHtml } from "./fetchHtml";
import {
  ALLOWED_DATA_CENTRES,
  DEFAULT_FILTER_FILE
} from "./config";
import type { Listing } from "./types";
import { matchTextFilter, type ListingSearchFilter } from "./searchFilter";

/**
 * 対象DC（Elemental/Mana/Meteor/Gaia）のみに絞り込みます。
 */
function filterAllowedDataCentres(listings: Listing[]): Listing[] {
  return listings.filter((l) => l.dataCentre && ALLOWED_DATA_CENTRES.has(l.dataCentre));
}

export type PipelineOptions = {
  input: string;
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
  const preFiltered = tagged;
  if (!options.searchFilter) return preFiltered;

  const f = options.searchFilter;
  return preFiltered.filter((l) => {
    if (!matchTextFilter(l.duty?.title ?? "", f.dutyTitle)) return false;
    if (!matchTextFilter(l.creator ?? "", f.creator)) return false;
    if (f.dataCentres && f.dataCentres.length > 0 && !f.dataCentres.includes(l.dataCentre ?? "")) return false;
    if (f.pfCategories && f.pfCategories.length > 0 && !f.pfCategories.includes(l.dataPfCategory ?? "")) return false;
    if (!matchTextFilter(l.description ?? "", f.description)) return false;
    if (!matchTextFilter((l.requirements ?? []).join(" "), f.requirements)) return false;
    return true;
  });
}
