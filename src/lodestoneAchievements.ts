import axios from "axios";
import * as cheerio from "cheerio";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LODESTONE_BASE_URL = "https://jp.finalfantasyxiv.com";
const ULTIMATE_CATEGORY_ID = 4;

/**
 * 高難度（絶/零式）アチーブの正式名と表示用略称の定義（SSOT）。
 *
 * 定義は `data/high_end_achievements_ja.json` に置き、ここでは読み取って使います。
 */
export type HighEndAchievementGroup = "ultimate" | "savage";

export type HighEndAchievementDefinition = {
  name: string;
  short: string;
  group: HighEndAchievementGroup;
};

type HighEndAchievementsJa = {
  version: number;
  achievements: HighEndAchievementDefinition[];
};

let cachedDefinitions: HighEndAchievementDefinition[] | undefined;
let cachedShortMap: Map<string, string> | undefined;
let cachedGroupMap: Map<string, HighEndAchievementGroup> | undefined;
let cachedNameSet: Set<string> | undefined;

function loadDefinitions(): HighEndAchievementDefinition[] {
  if (cachedDefinitions) return cachedDefinitions;
  const filePath = resolve(process.cwd(), "data/high_end_achievements_ja.json");
  const rawText = readFileSync(filePath, "utf8");
  const raw = JSON.parse(rawText) as HighEndAchievementsJa;
  cachedDefinitions = raw.achievements ?? [];
  return cachedDefinitions;
}

/**
 * 高難度アチーブ定義を取得します。
 */
export function getUltimateAchievements(): HighEndAchievementDefinition[] {
  return loadDefinitions();
}

export type UltimateAchievementName = string;

/**
 * 正式名 → 略称のルックアップを返します。
 */
export function getUltimateAchievementShortMap(): Map<UltimateAchievementName, string> {
  if (cachedShortMap) return cachedShortMap;
  const map = new Map<string, string>();
  for (const a of loadDefinitions()) map.set(a.name, a.short);
  cachedShortMap = map;
  return map;
}

/**
 * 正式名 → 種別（絶/零式）のルックアップを返します。
 */
export function getUltimateAchievementGroupMap(): Map<UltimateAchievementName, HighEndAchievementGroup> {
  if (cachedGroupMap) return cachedGroupMap;
  const map = new Map<string, HighEndAchievementGroup>();
  for (const a of loadDefinitions()) map.set(a.name, a.group);
  cachedGroupMap = map;
  return map;
}

function getUltimateAchievementNameSet(): Set<string> {
  if (cachedNameSet) return cachedNameSet;
  cachedNameSet = new Set(loadDefinitions().map((a) => a.name));
  return cachedNameSet;
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

  const targetSet = getUltimateAchievementNameSet();
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
