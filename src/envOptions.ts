import { DEFAULT_LISTINGS_URL, DEFAULT_WEBHOOK_LIMIT, ENV } from "./config";
import type { CliOptions } from "./cliOptions";

/**
 * 環境変数を読み取り、前後空白を除いた文字列を返します（空なら undefined）。
 */
export function getEnvString(name: string): string | undefined {
  const value = process.env[name];
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * 正の整数として解釈できる場合のみ数値を返します。
 */
export function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
}

/**
 * 環境変数からオプションを読み取ります（デフォルト値はここでは適用しません）。
 */
export function readEnvOptions(): Partial<CliOptions> {
  return {
    query: getEnvString(ENV.QUERY),
    limit: parsePositiveInt(getEnvString(ENV.LIMIT))
  };
}

export type ResolvedCliOptions = {
  input: string;
  query?: string;
  webhookUrl: string;
  limit: number;
};

/**
 * CLIオプションを優先して環境変数オプションとマージし、デフォルト値を適用します。
 */
export function resolveOptions(
  cli: CliOptions,
  env: Partial<CliOptions>
): ResolvedCliOptions {
  const webhookUrl = getEnvString(ENV.DISCORD_WEBHOOK_URL);
  if (!webhookUrl) {
    throw new Error(`${ENV.DISCORD_WEBHOOK_URL} is required.`);
  }

  return {
    input: DEFAULT_LISTINGS_URL,
    query: cli.query ?? env.query,
    webhookUrl,
    limit: cli.limit ?? env.limit ?? DEFAULT_WEBHOOK_LIMIT
  };
}
