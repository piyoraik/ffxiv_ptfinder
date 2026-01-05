import type { Listing } from "./types";
import {
  buildAchievementCategoryUrl,
  fetchAchievementCategoryHtml,
  parseUltimateClearsFromAchievementHtml,
  buildLodestoneSearchUrl,
  fetchTopCharacterUrl
} from "@piyoraik/ffxiv-lodestone-character-lookup";

type CacheEntry = {
  searchUrl: string;
  characterUrl?: string;
  achievementUrl?: string;
  ultimateStatus?: "ok" | "private_or_unavailable" | "error";
  ultimateClears?: string[];
};

export type LodestoneEnrichmentCache = Map<string, CacheEntry>;

/**
 * `募集者: キャラクター名 @ サーバー名` 形式の文字列から、名前/ワールドを取り出します。
 */
function parseCreatorLabel(creator: string): { name: string; world: string } | undefined {
  const raw = creator.trim();
  if (!raw) return undefined;
  const at = raw.lastIndexOf("@");
  if (at === -1) return undefined;
  const name = raw.slice(0, at).trim();
  const world = raw.slice(at + 1).trim();
  if (!name || !world) return undefined;
  return { name, world };
}

/**
 * Lodestone補完（検索URL/キャラクターURL/アチーブ取得）用のキャッシュを作成します。
 *
 * 同一募集者が複数回出てくるケースがあるため、1実行内で使い回します。
 */
export function createLodestoneEnrichmentCache(): LodestoneEnrichmentCache {
  return new Map<string, CacheEntry>();
}

/**
 * 募集者情報（`Name @ World`）から Lodestone の検索URL/キャラクターURL/アチーブ達成状況を補完します。
 *
 * 検索の結果、先頭にヒットしたURLが取得できない場合でも、検索URLはセットします。
 */
export async function enrichListingWithLodestone(
  listing: Listing,
  cache: LodestoneEnrichmentCache
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

  const parsed = parseCreatorLabel(creator);
  if (!parsed) return listing;

  const searchUrl = buildLodestoneSearchUrl({ name: parsed.name, world: parsed.world });
  let characterUrl: string | undefined;
  let achievementUrl: string | undefined;
  let ultimateStatus: "ok" | "private_or_unavailable" | "error" | undefined;
  let ultimateClears: string[] | undefined;

  try {
    characterUrl = await fetchTopCharacterUrl(searchUrl);
  } catch {
    // 失敗しても後続処理は継続する
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

  cache.set(creator, { searchUrl, characterUrl, achievementUrl, ultimateStatus, ultimateClears });
  return {
    ...listing,
    creatorLodestoneSearchUrl: searchUrl,
    creatorLodestoneUrl: characterUrl,
    creatorAchievementUrl: achievementUrl,
    creatorUltimateClears: ultimateClears,
    creatorUltimateClearsStatus: ultimateStatus
  };
}
