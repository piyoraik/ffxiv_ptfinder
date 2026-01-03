import { DEFAULT_LISTINGS_URL } from "./config";
import { parseCliArgs } from "./cliOptions";
import { readEnvOptions } from "./envOptions";
import { buildListings } from "./listingsPipeline";

/**
 * パイプ出力時（例: `| head`）の EPIPE を無視するハンドラを登録します。
 */
function installStdoutEpipeHandler(): void {
  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EPIPE") process.exit(0);
    throw err;
  });
}

/**
 * デバッグ用エントリポイント。
 *
 * - Webhook 送信はせず、募集一覧を JSON で標準出力に吐き出します。
 * - 入力は固定で `https://xivpf.com/listings` を使用します。
 */
async function main(): Promise<void> {
  installStdoutEpipeHandler();

  const cli = parseCliArgs(process.argv.slice(2));
  const env = readEnvOptions();

  const listings = await buildListings({
    input: DEFAULT_LISTINGS_URL,
    descriptionTerms: env.descriptionTerms,
    descriptionMode: env.descriptionMode,
    searchFilter: env.searchFilter
  });

  if (cli.limit ?? env.limit) {
    const limit = cli.limit ?? env.limit ?? listings.length;
    process.stdout.write(JSON.stringify(listings.slice(0, limit), null, 2) + "\n");
    return;
  }

  process.stdout.write(JSON.stringify(listings, null, 2) + "\n");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(message + "\n");
  process.exitCode = 1;
});
