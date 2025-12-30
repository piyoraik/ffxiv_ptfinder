import { readEnvOptions, resolveOptions } from "./envOptions";
import { runApp } from "./runApp";

type ApiGatewayResultV2 = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
};

/**
 * AWS Lambda handler。
 *
 * EventBridge のスケジュール実行を想定し、設定は環境変数のみで行います。
 */
export async function handler(): Promise<ApiGatewayResultV2> {
  const env = readEnvOptions();
  const options = resolveOptions({}, env);
  const result = await runApp(options);

  return {
    statusCode: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ ok: true, sent: result.sent })
  };
}
