import axios from "axios";

/**
 * 指定ミリ秒だけ待機します。
 */
export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Discord のコードブロック形式に変換し、2000文字制限に引っかからないように切り詰めます。
 */
export function toDiscordCodeBlock(text: string, maxChars = 1900): string {
  const sanitized = text.replace(/```/g, "'''").trim();
  const truncated =
    sanitized.length > maxChars ? sanitized.slice(0, maxChars - 1).trimEnd() + "…" : sanitized;
  return "```\n" + truncated + "\n```";
}

async function sendWebhook(webhookUrl: string, content: string): Promise<void> {
  await axios.post(
    webhookUrl,
    { content },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 30_000
    }
  );
}

/**
 * Discord Webhook に送信します（レート制限: HTTP 429 の場合は 1 回だけリトライします）。
 */
export async function postDiscordWebhook(webhookUrl: string, content: string): Promise<void> {
  try {
    await sendWebhook(webhookUrl, content);
    return;
  } catch (err: unknown) {
    if (!axios.isAxiosError(err)) throw err;
    if (err.response?.status !== 429) throw err;

    const retryAfterMs =
      typeof err.response.data?.retry_after === "number"
        ? Math.ceil(err.response.data.retry_after * 1000)
        : 1500;
    await sleep(retryAfterMs);
    await sendWebhook(webhookUrl, content);
  }
}
