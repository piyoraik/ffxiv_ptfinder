import type { Listing } from "./types";
import {
  getUltimateAchievementGroupMap,
  getUltimateAchievementShortMap,
  type HighEndAchievementGroup,
  type UltimateAchievementName
} from "@piyoraik/ffxiv-lodestone-character-lookup";

export type PartyRole = "tank" | "healer" | "dps";

/**
 * `title` 内のスペース区切りジョブコードを分割します。
 */
export function splitJobList(value: string): string[] {
  return value
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * party の classList からロールヒント（`tank`/`healer`/`dps`）を取得します。
 */
export function getRolesFromClassList(classList: string[]): PartyRole[] {
  const roles: PartyRole[] = [];
  if (classList.includes("tank")) roles.push("tank");
  if (classList.includes("healer")) roles.push("healer");
  if (classList.includes("dps")) roles.push("dps");
  return roles;
}

/**
 * ジョブコードからロールを解決します（ルックアップマップを使用）。
 */
export function getRoleFromJobCode(
  jobCode: string,
  jobCodeToRole: Map<string, PartyRole>
): PartyRole | undefined {
  return jobCodeToRole.get(jobCode);
}

function formatLine(label: string, values: Iterable<string>): string {
  const text = Array.from(values).join(" ");
  return `${label}：${text}`;
}

type PartyGroups = {
  joined: Record<PartyRole, string[]>;
  recruiting: Record<PartyRole, Set<string>>;
};

function createEmptyPartyGroups(): PartyGroups {
  return {
    joined: { tank: [], healer: [], dps: [] },
    recruiting: { tank: new Set<string>(), healer: new Set<string>(), dps: new Set<string>() }
  };
}

/**
 * listing の `party` 配列から、ロール別の参加/募集情報を組み立てます。
 */
export function buildPartyGroups(
  listing: Listing,
  codeToShort: Map<string, string>,
  codeToRole: Map<string, PartyRole>
): PartyGroups {
  const groups = createEmptyPartyGroups();

  for (const item of listing.party) {
    if (item.classList.includes("total")) continue;
    const title = item.title?.trim();
    if (!title) continue;

    if (item.classList.includes("filled")) {
      const role = getRoleFromJobCode(title, codeToRole);
      if (!role) continue;
      groups.joined[role].push(codeToShort.get(title) ?? title);
      continue;
    }

    const rolesFromClass = getRolesFromClassList(item.classList);
    for (const job of splitJobList(title)) {
      const short = codeToShort.get(job) ?? job;
      const roleFromCode = getRoleFromJobCode(job, codeToRole);

      if (rolesFromClass.length > 0) {
        for (const role of rolesFromClass) groups.recruiting[role].add(short);
        continue;
      }

      if (roleFromCode) groups.recruiting[roleFromCode].add(short);
    }
  }

  return groups;
}

/**
 * 1件の募集をテキストブロックとして整形します。
 */
export function formatListingText(
  listing: Listing,
  codeToShort: Map<string, string>,
  codeToRole: Map<string, PartyRole>
): string {
  const { joined, recruiting } = buildPartyGroups(listing, codeToShort, codeToRole);

  return [
    `コンテンツ: ${listing.duty?.title ?? ""}`,
    `募集者: ${listing.creator ?? ""}`,
    `ロードストーン: ${listing.creatorLodestoneUrl ?? listing.creatorLodestoneSearchUrl ?? ""}`,
    `絶クリア: ${formatHighEndClears(listing, "ultimate")}`,
    `零式クリア: ${formatHighEndClears(listing, "savage")}`,
    `DC: ${listing.dataCentre ?? ""}`,
    `カテゴリ: ${listing.dataPfCategory ?? ""}`,
    `要件: ${listing.requirements.join(" ")}`,
    `募集文: ${listing.description}`,
    "パーティ:",
    "【参加ジョブ】",
    formatLine("タンク", joined.tank),
    formatLine("ヒーラー", joined.healer),
    formatLine("DPS", joined.dps),
    "【募集ジョブ】",
    formatLine("タンク", recruiting.tank),
    formatLine("ヒーラー", recruiting.healer),
    formatLine("DPS", recruiting.dps)
  ].join("\n");
}

/**
 * 高難度（絶/零式）アチーブ達成状況を表示用に整形します。
 */
function formatHighEndClears(listing: Listing, group: HighEndAchievementGroup): string {
  if (!listing.creatorAchievementUrl && !listing.creatorLodestoneUrl) return "";

  const status = listing.creatorUltimateClearsStatus;
  if (status === "private_or_unavailable") return "非公開/取得不可";
  if (status === "error") return "取得エラー";

  const clears = listing.creatorUltimateClears ?? [];
  if (clears.length === 0) return "なし";

  const shortMap = getUltimateAchievementShortMap();
  const groupMap = getUltimateAchievementGroupMap();
  const short = clears
    .filter((name) => groupMap.get(name as UltimateAchievementName) === group)
    .map((name) => shortMap.get(name as UltimateAchievementName) ?? name);

  return short.length > 0 ? short.join(" / ") : "なし";
}

/**
 * 複数募集を空行区切りで整形します。
 */
export function formatListingsText(
  listings: Listing[],
  codeToShort: Map<string, string>,
  codeToRole: Map<string, PartyRole>
): string {
  return listings.map((l) => formatListingText(l, codeToShort, codeToRole)).join("\n\n");
}
