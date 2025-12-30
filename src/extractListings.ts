import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { Listing, PartyItem } from "./types";

/**
 * HTML から取り出したテキストを、出力用に読みやすく正規化します。
 */
function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

/**
 * class 属性（スペース区切り）を配列に分解します。
 */
function splitClassList(value: string | undefined): string[] {
  return (value ?? "").split(/\s+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * 募集一覧の要素（`.listing[data-id]`）を取得します。
 * 可能なら `#listings` 配下から取り、なければドキュメント全体から探索します。
 */
function selectListingElements($: CheerioAPI) {
  const listingsRoot = $("#listings");
  return listingsRoot.length
    ? listingsRoot.find("div.listing[data-id]")
    : $("div.listing[data-id]");
}

/**
 * `.listing` 要素から duty 情報（class と title）を抽出します。
 */
function parseDuty(listing: cheerio.Cheerio<any>): Listing["duty"] | undefined {
  const dutyNode = listing.find(".duty").first();
  if (!dutyNode.length) return undefined;

  const text = normalizeText(dutyNode.text());
  const title = (dutyNode.attr("title") ?? text).trim();
  if (!title) return undefined;

  return { classList: splitClassList(dutyNode.attr("class")), title };
}

/**
 * `.listing` 要素から description テキストを抽出します。
 */
function parseDescription(listing: cheerio.Cheerio<any>): string {
  const descriptionText = listing.find(".description").first().text();
  return normalizeText(descriptionText);
}

/**
 * `.listing` 要素から募集者（creator）を抽出します。
 */
function parseCreator(listing: cheerio.Cheerio<any>): string | undefined {
  const creatorText = listing.find(".right.meta .item.creator .text").first().text();
  const normalized = normalizeText(creatorText);
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * `.listing` 要素から party 情報（各 slot の class と title）を抽出します。
 */
function parseParty($: CheerioAPI, listing: cheerio.Cheerio<any>): PartyItem[] {
  const party: PartyItem[] = [];
  const partyRoot = listing.find(".party").first();
  if (!partyRoot.length) return party;

  partyRoot.children("div").each((_, child) => {
    const node = $(child);
    const classList = splitClassList(node.attr("class"));
    if (classList.length === 0) return;
    const title = node.attr("title") ?? undefined;
    party.push(title ? { classList, title } : { classList });
  });

  return party;
}

/**
 * `.listing` 要素を `Listing` に変換します。
 */
function parseListingElement($: CheerioAPI, el: unknown): Listing | undefined {
  const listing = $(el as any);
  const id = listing.attr("data-id");
  if (!id) return undefined;

  return {
    id,
    dataCentre: listing.attr("data-centre") ?? undefined,
    dataPfCategory: listing.attr("data-pf-category") ?? undefined,
    duty: parseDuty(listing),
    creator: parseCreator(listing),
    requirements: [],
    description: parseDescription(listing),
    party: parseParty($, listing)
  };
}

/**
 * listings HTML から募集一覧を抽出します。
 */
export function extractListingsFromHtml(html: string): Listing[] {
  const $ = cheerio.load(html);

  const results: Listing[] = [];
  const seenIds = new Set<string>();
  selectListingElements($).each((_, el) => {
    const parsed = parseListingElement($, el);
    if (!parsed) return;
    if (seenIds.has(parsed.id)) return;
    seenIds.add(parsed.id);
    results.push(parsed);
  });

  return results;
}
