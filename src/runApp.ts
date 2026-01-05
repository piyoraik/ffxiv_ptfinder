import { loadJobsJa } from "./jobs";
import { DEFAULT_WEBHOOK_LIMIT } from "./config";
import { postDiscordWebhook, sleep, toDiscordCodeBlock } from "./discordWebhook";
import { formatListingText, type PartyRole } from "./partyText";
import type { Listing } from "./types";
import type { ResolvedCliOptions } from "./envOptions";
import { buildListings } from "./listingsPipeline";
import {
  loadListingSearchFilterFromFile,
  matchListing,
  type ListingSearchFilter
} from "./searchFilter";
import { createLogger, type Logger } from "./logger";
import { buildJobMaps } from "./jobMaps";
import { createLodestoneEnrichmentCache, enrichListingWithLodestone } from "./lodestoneEnrichment";

function summarizeFilter(filter: ListingSearchFilter | undefined): Record<string, unknown> | undefined {
  if (!filter) return undefined;
  return { keys: Object.keys(filter) };
}

/**
 * Discord Webhook に送信します（最大 `limit` 件、1募集=1メッセージ）。
 */
async function sendToDiscordWebhook(params: {
  webhookUrl: string;
  limit: number;
  listings: Listing[];
  codeToShort: Map<string, string>;
  codeToRole: Map<string, PartyRole>;
  searchFilter?: ListingSearchFilter;
  logger?: Logger;
}): Promise<number> {
  const lodestoneCache = createLodestoneEnrichmentCache();

  let sent = 0;
  let scanned = 0;
  let filteredOut = 0;
  for (const listing of params.listings) {
    if (sent >= params.limit) break;
    scanned++;
    const enriched = await enrichListingWithLodestone(listing, lodestoneCache);
    const text = formatListingText(enriched, params.codeToShort, params.codeToRole);

    const ok = await matchListing({
      listing: enriched,
      filter: params.searchFilter,
      formattedText: text
    });
    if (!ok) {
      filteredOut++;
      continue;
    }

    const content = toDiscordCodeBlock(text);
    await postDiscordWebhook(params.webhookUrl, content);
    await sleep(350);
    sent++;
  }
  params.logger?.info("send_summary", { scanned, filteredOut, sent, limit: params.limit });

  if (sent === 0) {
    const message = "該当の募集は見つかりませんでした";
    await postDiscordWebhook(params.webhookUrl, message);
    params.logger?.info("no_match", { posted: true });
  }
  return sent;
}

export type RunResult = { mode: "webhook"; sent: number };

/**
 * アプリのコア処理（CLI/Lambda共通）。
 *
 * - HTML 取得（ファイル or URL）
 * - 募集一覧を抽出
 * - DCフィルタ / クエリフィルタ
 * - description タグを requirements に抽出
 * - JSON/text 出力、または webhook 送信
 */
export async function runApp(options: ResolvedCliOptions): Promise<RunResult> {
  const logger = createLogger("runApp");
  const startAt = Date.now();

  const fileFilter =
    options.searchFilterFile ? await loadListingSearchFilterFromFile(options.searchFilterFile) : undefined;
  const mergedSearchFilter = fileFilter ?? options.searchFilter;

  logger.info("start", {
    limit: options.limit,
    filterFile: options.searchFilterFile,
    filterLoaded: Boolean(fileFilter),
    filterSummary: summarizeFilter(mergedSearchFilter)
  });

  const buildStartAt = Date.now();
  const taggedListings = await buildListings({
    input: options.input,
    searchFilter: mergedSearchFilter
  });
  logger.info("listings_built", { count: taggedListings.length, ms: Date.now() - buildStartAt });

  const jobsJa = await loadJobsJa();
  const { codeToShort, codeToRole } = buildJobMaps(jobsJa.jobs);

  const limit = options.limit ?? DEFAULT_WEBHOOK_LIMIT;
  logger.info("send_start", { limit, candidates: taggedListings.length });
  const sent = await sendToDiscordWebhook({
    webhookUrl: options.webhookUrl,
    limit,
    listings: taggedListings,
    codeToShort,
    codeToRole,
    searchFilter: mergedSearchFilter,
    logger
  });
  logger.info("done", { sent, ms: Date.now() - startAt });
  return { mode: "webhook", sent };
}
