import { parseCliArgs } from "./cliOptions";
import { readEnvOptions, resolveOptions } from "./envOptions";
import { runApp } from "./runApp";

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
 * 通知（Webhook送信）用 CLI。
 * EventBridge/Lambda と同じ `runApp` を呼び出して実行します。
 */
async function main(): Promise<void> {
  installStdoutEpipeHandler();
  const cliOptions = parseCliArgs(process.argv.slice(2));
  const envOptions = readEnvOptions();
  const options = resolveOptions(cliOptions, envOptions);
  await runApp(options);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(message + "\n");
  process.exitCode = 1;
});

