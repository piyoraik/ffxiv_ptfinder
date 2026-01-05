import { loadJobsJa } from "./jobs";
import { DEFAULT_WEBHOOK_LIMIT } from "./config";
import { postDiscordWebhook, sleep, toDiscordCodeBlock } from "./discordWebhook";
import { formatListingText, type PartyRole } from "./partyText";
import type { Listing } from "./types";
import type { ResolvedCliOptions } from "./envOptions";
import { buildListings } from "./listingsPipeline";
import {
  buildLodestoneSearchUrl,
  fetchTopCharacterUrl,
  parseCreator
} from "./lodestone";
import {
  buildAchievementCategoryUrl,
  fetchAchievementCategoryHtml,
  parseUltimateClearsFromAchievementHtml
} from "./lodestoneAchievements";
import {
  loadListingSearchFilterFromFile,
  matchListing,
  type ListingSearchFilter
} from "./searchFilter";
import { createLogger, type Logger } from "./logger";

function summarizeFilter(filter: ListingSearchFilter | undefined): Record<string, unknown> | undefined {
  if (!filter) return undefined;
  return { keys: Object.keys(filter) };
}

/**
 * party の整形に使うジョブ変換マップを作成します。
 */
function buildJobMaps(jobs: Record<string, { short: string; role: PartyRole }>): {
  codeToShort: Map<string, string>;
  codeToRole: Map<string, PartyRole>;
} {
  const entries = Object.entries(jobs);
  return {
    codeToShort: new Map(entries.map(([code, info]) => [code, info.short])),
    codeToRole: new Map(entries.map(([code, info]) => [code, info.role]))
  };
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
  const lodestoneCache = new Map<
    string,
    {
      searchUrl: string;
      characterUrl?: string;
      achievementUrl?: string;
      ultimateStatus?: "ok" | "private_or_unavailable" | "error";
      ultimateClears?: string[];
    }
  >();

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

/**
 * 募集者情報（`Name @ World`）から Lodestone の検索URL/キャラクターURLを補完します。
 *
 * 検索の結果、先頭にヒットしたURLが取得できない場合でも、検索URLはセットします。
 */
async function enrichListingWithLodestone(
  listing: Listing,
  cache: Map<
    string,
    {
      searchUrl: string;
      characterUrl?: string;
      achievementUrl?: string;
      ultimateStatus?: "ok" | "private_or_unavailable" | "error";
      ultimateClears?: string[];
    }
  >
): Promise<Listing> {
  const creator = listing.creator?.trim();
  if (!creator) return listing;

  const cached = cache.get(creator);
  if (cached) {
    return {
      ...listing,
      creatorLodestoneSearchUrl: cached.searchUrl,
      creatorLodestoneUrl: cached.characterUrl,
      creatorAchievementUrl: cached.achievementUrl,
      creatorUltimateClears: cached.ultimateClears,
      creatorUltimateClearsStatus: cached.ultimateStatus
    };
  }

  const info = parseCreator(creator);
  if (!info) return listing;

  const searchUrl = buildLodestoneSearchUrl(info);
  let characterUrl: string | undefined;
  let achievementUrl: string | undefined;
  let ultimateStatus: "ok" | "private_or_unavailable" | "error" | undefined;
  let ultimateClears: string[] | undefined;
  try {
    characterUrl = await fetchTopCharacterUrl(searchUrl);
  } catch {
    // 失敗しても通知自体は継続する
    characterUrl = undefined;
  }

  if (characterUrl) {
    achievementUrl = buildAchievementCategoryUrl(characterUrl);
    if (achievementUrl) {
      try {
        const html = await fetchAchievementCategoryHtml(achievementUrl);
        const parsed = parseUltimateClearsFromAchievementHtml(html);
        ultimateStatus = parsed.status;
        ultimateClears = parsed.clears;
      } catch {
        ultimateStatus = "error";
        ultimateClears = undefined;
      }
    }
  }

  cache.set(creator, {
    searchUrl,
    characterUrl,
    achievementUrl,
    ultimateStatus,
    ultimateClears
  });
  return {
    ...listing,
    creatorLodestoneSearchUrl: searchUrl,
    creatorLodestoneUrl: characterUrl,
    creatorAchievementUrl: achievementUrl,
    creatorUltimateClears: ultimateClears,
    creatorUltimateClearsStatus: ultimateStatus
  };
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
