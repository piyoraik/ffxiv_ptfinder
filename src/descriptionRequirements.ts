import type { Listing } from "./types";

/**
 * 表示用に空白を正規化します。
 */
export function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * description からタグ（例: `[Practice]`）を検出してラベルを抽出し、
 * 本文からタグトークンを除去します。
 *
 * `Listing.description` を読みやすく保ち、タグの意味は `Listing.requirements` に移します。
 */
export function applyDescriptionTags(
  listings: Listing[],
  tags: Array<{ token: string; label: string }>
): Listing[] {
  return listings.map((listing) => {
    const requirements = new Set<string>();
    let description = listing.description;

    for (const tag of tags) {
      if (!tag.token) continue;
      if (description.includes(tag.token)) requirements.add(tag.label);
      description = description.split(tag.token).join("");
    }

    return {
      ...listing,
      requirements: Array.from(requirements),
      description: normalizeSpaces(description)
    };
  });
}
