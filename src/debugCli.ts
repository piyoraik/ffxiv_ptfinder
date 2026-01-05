import { DEFAULT_FILTER_FILE, DEFAULT_LISTINGS_URL } from "./config";
import { parseCliArgs } from "./cliOptions";
import { readEnvOptions } from "./envOptions";
import { loadJobsJa } from "./jobs";
import { buildListings } from "./listingsPipeline";
import { toDiscordCodeBlock } from "./discordWebhook";
import { formatListingText, type PartyRole } from "./partyText";
import { buildJobMaps } from "./jobMaps";
import { createLodestoneEnrichmentCache, enrichListingWithLodestone } from "./lodestoneEnrichment";
import { loadListingSearchFilterFromFile, matchListing } from "./searchFilter";
import type { ListingSearchFilter } from "./searchFilter";
import type { Listing } from "./types";

/**
 * パイプ出力時（例: `| head`）の EPIPE を無視するハンドラを登録します。
 */
function installStdoutEpipeHandler(): void {
  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EPIPE") process.exit(0);
    throw err;
  });
}

/**
 * デバッグ用エントリポイント。
 *
 * - Webhook 送信はせず、募集一覧を JSON で標準出力に吐き出します。
 * - 入力は固定で `https://xivpf.com/listings` を使用します。
 */
async function main(): Promise<void> {
  installStdoutEpipeHandler();

  const cli = parseCliArgs(process.argv.slice(2));
  const env = readEnvOptions();
  const filterFile = env.filterFile ?? DEFAULT_FILTER_FILE;
  const searchFilter = await loadListingSearchFilterFromFile(filterFile);

  const preFiltered = await buildListings({
    input: DEFAULT_LISTINGS_URL,
    searchFilter
  });

  const limit = cli.limit ?? env.limit;
  const jobsJa = await loadJobsJa();
  const { codeToShort, codeToRole } = buildJobMaps(jobsJa.jobs);

  const listings = await applyFullFilter({
    listings: preFiltered,
    searchFilter,
    limit,
    codeToShort,
    codeToRole,
    enrichLodestone: cli.output === "discord" || Boolean(searchFilter?.achievements)
  });

  if (cli.output === "discord") {
    process.stdout.write(formatDiscordPreview(listings, codeToShort, codeToRole) + "\n");
    return;
  }

  process.stdout.write(JSON.stringify(listings, null, 2) + "\n");
}

/**
 * `filter.json` の内容をできるだけ実運用（Lambda）に近い形で評価します。
 *
 * - party/formattedText はここで評価します（`buildListings` の事前フィルタには含まれないため）
 * - achievements 指定がある場合は、Lodestoneアクセスを行い達成状況を補完します
 */
async function applyFullFilter(params: {
  listings: Listing[];
  searchFilter: ListingSearchFilter | undefined;
  limit: number | undefined;
  codeToShort: Map<string, string>;
  codeToRole: Map<string, PartyRole>;
  enrichLodestone: boolean;
}): Promise<Listing[]> {
  const hasSearchFilter = Boolean(params.searchFilter);
  if (!hasSearchFilter) return params.limit ? params.listings.slice(0, params.limit) : params.listings;

  const lodestoneCache = params.enrichLodestone ? createLodestoneEnrichmentCache() : undefined;

  const matched: Listing[] = [];
  for (const listing of params.listings) {
    const enriched =
      params.enrichLodestone && lodestoneCache
        ? await enrichListingWithLodestone(listing, lodestoneCache)
        : listing;

    const formattedText = formatListingText(enriched, params.codeToShort, params.codeToRole);
    const ok = await matchListing({
      listing: enriched,
      filter: params.searchFilter,
      formattedText
    });
    if (!ok) continue;

    matched.push(enriched);
    if (params.limit && matched.length >= params.limit) break;
  }

  return matched;
}

/**
 * Webhook送信の本文と同じ形式（コードブロック）で標準出力に出します。
 *
 * - 1募集=1メッセージ想定なので、募集ごとにコードブロックを出します
 * - ヒット0件の場合は、Webhookで送る文言と同じ文言を出します
 */
function formatDiscordPreview(
  listings: Listing[],
  codeToShort: Map<string, string>,
  codeToRole: Map<string, PartyRole>
): string {
  if (listings.length === 0) return "該当の募集は見つかりませんでした";
  return listings.map((l) => toDiscordCodeBlock(formatListingText(l, codeToShort, codeToRole))).join("\n\n");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(message + "\n");
  process.exitCode = 1;
});
