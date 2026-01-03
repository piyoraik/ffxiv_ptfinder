import { readEnvOptions, resolveOptions } from "./envOptions";
import { runApp } from "./runApp";
import { createLogger } from "./logger";

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
export async function handler(
  _event?: unknown,
  context?: { awsRequestId?: string }
): Promise<ApiGatewayResultV2> {
  const logger = createLogger("lambda");
  const startedAt = Date.now();
  logger.info("invoke", { awsRequestId: context?.awsRequestId });

  try {
    const env = readEnvOptions();
    const options = resolveOptions({}, env);
    const result = await runApp(options);

    logger.info("success", { awsRequestId: context?.awsRequestId, sent: result.sent, ms: Date.now() - startedAt });
    return {
      statusCode: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true, sent: result.sent })
    };
  } catch (err: unknown) {
    logger.error("error", { awsRequestId: context?.awsRequestId, err, ms: Date.now() - startedAt });
    throw err;
  }
}
