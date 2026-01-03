import { DEFAULT_LISTINGS_URL, DEFAULT_WEBHOOK_LIMIT, ENV } from "./config";

export type CliOptions = {
  query?: string;
  limit?: number;
};

/**
 * Usage を stderr に出力して終了します。
 */
export function printUsageAndExit(exitCode = 0): never {
  process.stderr.write(getUsageText() + "\n");
  process.exit(exitCode);
}

/**
 * Usage 文字列を生成します（テストしやすいように純粋関数にしています）。
 */
export function getUsageText(): string {
  return [
    "Usage:",
    `  yarn start -- [--query <text>] [--limit <n>]`,
    `    defaults: --query (required)  --limit ${DEFAULT_WEBHOOK_LIMIT}`,
    "",
    "Environment variables (Lambda-friendly):",
    `  ${ENV.QUERY}=<text>`,
    `  ${ENV.LIMIT}=<n>  (default: ${DEFAULT_WEBHOOK_LIMIT})`,
    `  ${ENV.DISCORD_WEBHOOK_URL}=<discord_webhook_url>  (required)`,
    `  ${ENV.DESCRIPTION_TERMS}=<comma-separated|json-array>  (default: 最初から)`,
    `  ${ENV.DESCRIPTION_MODE}=and|or  (default: and)`,
    "Examples:",
    `  ${ENV.QUERY}=\"タイタン\" ${ENV.DISCORD_WEBHOOK_URL}=\"https://discord.com/api/webhooks/...\" yarn start`,
    `  ${ENV.QUERY}=\"絶アルテマ\" ${ENV.LIMIT}=5 ${ENV.DISCORD_WEBHOOK_URL}=\"https://discord.com/api/webhooks/...\" yarn start`
  ].join("\n");
}

/**
 * CLI 引数（argv）をオプションにパースします。
 * ここでは argv の解析のみ行い、環境変数とのマージやデフォルト適用は別モジュールで行います。
 */
export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      printUsageAndExit(0);
    }

    if (arg === "--query" || arg === "-q") {
      options.query = argv[++index];
      continue;
    }

    if (arg === "--limit" || arg === "-l") {
      const raw = argv[++index];
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        process.stderr.write(`Invalid --limit: ${raw}\n`);
        process.exit(2);
      }
      options.limit = Math.floor(parsed);
      continue;
    }

    if (!options.query) {
      options.query = arg;
      continue;
    }
  }

  return options;
}
