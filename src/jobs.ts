import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type JobsJa = {
  version: number;
  jobs: Record<string, { short: string; role: "tank" | "healer" | "dps" }>;
};

let cachedJobs: JobsJa | undefined;

/**
 * `data/jobs_ja.json` を読み込みます（初回のみ読み取り、以後はキャッシュ）。
 */
export async function loadJobsJa(): Promise<JobsJa> {
  if (cachedJobs) return cachedJobs;
  const filePath = resolve(process.cwd(), "data/jobs_ja.json");
  const raw = await readFile(filePath, "utf8");
  cachedJobs = JSON.parse(raw) as JobsJa;
  return cachedJobs;
}
