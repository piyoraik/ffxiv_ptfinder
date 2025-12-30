import axios from "axios";
import * as cheerio from "cheerio";

const LODESTONE_BASE_URL = "https://jp.finalfantasyxiv.com";
const ULTIMATE_CATEGORY_ID = 4;

/**
 * 高難度（絶/零式）アチーブの正式名と表示用略称の定義（SSOT）。
 */
export const ULTIMATE_ACHIEVEMENTS = [
  { name: "絶バハムートを狩りし者", short: "絶バハ", group: "ultimate" },
  { name: "絶アルテマウェポンを破壊せし者", short: "絶テマ", group: "ultimate" },
  { name: "絶アレキサンダーを破壊せし者", short: "絶アレキ", group: "ultimate" },
  { name: "絶竜詩戦争を平定せし者", short: "絶竜詩", group: "ultimate" },
  { name: "絶オメガ検証戦を完遂せし者", short: "絶オメガ", group: "ultimate" },
  { name: "絶もうひとつの未来を見届けし者", short: "絶エデン", group: "ultimate" },
  { name: "万魔殿の辺獄を完全制覇せし者：ランク1", short: "【パンデモ】辺獄", group: "savage" },
  { name: "万魔殿の煉獄を完全制覇せし者：ランク1", short: "【パンデモ】煉獄", group: "savage" },
  { name: "万魔殿の天獄を完全制覇せし者：ランク1", short: "【パンデモ】天獄", group: "savage" },
  {
    name: "アルカディアのライトヘビー級を制覇せし者：ランク1",
    short: "【アルカディア】ライトヘビー",
    group: "savage"
  },
  {
    name: "アルカディアのクルーザー級を完全制覇せし者：ランク1",
    short: "【アルカディア】クルーザー",
    group: "savage"
  },
  {
    name: "アルカディアのヘビー級を完全制覇せし者：ランク1",
    short: "【アルカディア】ヘビー",
    group: "savage"
  }
] as const;

export type UltimateAchievementName = (typeof ULTIMATE_ACHIEVEMENTS)[number]["name"];
export type HighEndAchievementGroup = (typeof ULTIMATE_ACHIEVEMENTS)[number]["group"];

/**
 * 正式名 → 略称のルックアップを返します。
 */
export function getUltimateAchievementShortMap(): Map<UltimateAchievementName, string> {
  return new Map(ULTIMATE_ACHIEVEMENTS.map((a) => [a.name, a.short]));
}

/**
 * 正式名 → 種別（絶/零式）のルックアップを返します。
 */
export function getUltimateAchievementGroupMap(): Map<UltimateAchievementName, HighEndAchievementGroup> {
  return new Map(ULTIMATE_ACHIEVEMENTS.map((a) => [a.name, a.group]));
}

/**
 * キャラクターURL（例: `https://.../lodestone/character/12345/`）から characterId を抽出します。
 */
export function parseCharacterIdFromUrl(characterUrl: string): string | undefined {
  const match = characterUrl.match(/\/lodestone\/character\/(\d+)\//);
  return match?.[1];
}

/**
 * Lodestone のアチーブメント一覧URL（カテゴリ指定）を生成します。
 */
export function buildAchievementCategoryUrl(characterUrl: string): string | undefined {
  const characterId = parseCharacterIdFromUrl(characterUrl);
  if (!characterId) return undefined;
  return new URL(
    `/lodestone/character/${characterId}/achievement/category/${ULTIMATE_CATEGORY_ID}/#anchor_achievement`,
    LODESTONE_BASE_URL
  ).toString();
}

export type UltimateAchievementParseResult = {
  status: "ok" | "private_or_unavailable";
  clears: string[];
};

/**
 * アチーブメント一覧HTMLから、指定した高難度（絶/零式）アチーブの達成状況を判定します。
 *
 * 判定方法:
 * - 対象の `<li class="entry">` 内に `time.entry__activity__time` が存在するか（=日付が入る）
 */
export function parseUltimateClearsFromAchievementHtml(
  html: string
): UltimateAchievementParseResult {
  const $ = cheerio.load(html);

  const targetSet = new Set<string>(ULTIMATE_ACHIEVEMENTS.map((a) => a.name));
  const clears = new Set<string>();
  let foundAny = false;

  $("li.entry").each((_, el) => {
    const entry = $(el);
    const name = entry.find("p.entry__activity__txt").first().text().trim();
    if (!targetSet.has(name)) return;

    foundAny = true;
    const hasDate = entry.find("time.entry__activity__time").length > 0;
    if (hasDate) clears.add(name);
  });

  return {
    status: foundAny ? "ok" : "private_or_unavailable",
    clears: Array.from(clears)
  };
}

/**
 * Lodestone のアチーブメント一覧ページを取得します。
 */
export async function fetchAchievementCategoryHtml(url: string): Promise<string> {
  const response = await axios.get<string>(url, {
    responseType: "text",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ja,en;q=0.8",
      "User-Agent": "ffxiv_ptfinder/1.0 (+https://jp.finalfantasyxiv.com)"
    },
    timeout: 30_000
  });
  return response.data;
}
