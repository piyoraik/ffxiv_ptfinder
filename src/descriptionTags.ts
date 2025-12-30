import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type DescriptionTagsJa = {
  version: number;
  tags: Array<{ token: string; label: string }>;
};

let cachedTags: DescriptionTagsJa | undefined;

/**
 * `data/description_tags_ja.json` を読み込みます（初回のみ読み取り、以後はキャッシュ）。
 */
export async function loadDescriptionTagsJa(): Promise<DescriptionTagsJa> {
  if (cachedTags) return cachedTags;
  const filePath = resolve(process.cwd(), "data/description_tags_ja.json");
  const raw = await readFile(filePath, "utf8");
  cachedTags = JSON.parse(raw) as DescriptionTagsJa;
  return cachedTags;
}
