import type { PartyRole } from "./partyText";

/**
 * party の整形に使うジョブ変換マップを作成します。
 */
export function buildJobMaps(jobs: Record<string, { short: string; role: PartyRole }>): {
  codeToShort: Map<string, string>;
  codeToRole: Map<string, PartyRole>;
} {
  const entries = Object.entries(jobs);
  return {
    codeToShort: new Map(entries.map(([code, info]) => [code, info.short])),
    codeToRole: new Map(entries.map(([code, info]) => [code, info.role]))
  };
}

