import { extractListingsFromHtml } from "./extractListings";
import { applyDescriptionTags } from "./descriptionRequirements";
import { loadDescriptionTagsJa } from "./descriptionTags";
import { loadHtml } from "./fetchHtml";
import { ALLOWED_DATA_CENTRES } from "./config";
import type { Listing } from "./types";

/**
 * 対象DC（Elemental/Mana/Meteor/Gaia）のみに絞り込みます。
 */
function filterAllowedDataCentres(listings: Listing[]): Listing[] {
  return listings.filter((l) => l.dataCentre && ALLOWED_DATA_CENTRES.has(l.dataCentre));
}

/**
 * コンテンツ名（duty.title）で部分一致フィルタします。
 */
function filterByQuery(listings: Listing[], query: string | undefined): Listing[] {
  const q = query?.trim();
  if (!q) return listings;
  return listings.filter((l) => (l.duty?.title ?? "").includes(q));
}

export type PipelineOptions = {
  input: string;
  query?: string;
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
  const queryFiltered = filterByQuery(dcFiltered, options.query);

  const tagsJa = await loadDescriptionTagsJa();
  return applyDescriptionTags(queryFiltered, tagsJa.tags);
}

