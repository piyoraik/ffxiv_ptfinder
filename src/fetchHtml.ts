import axios from "axios";
import { readFile } from "node:fs/promises";
import { DEFAULT_COOKIE, DEFAULT_LISTINGS_URL } from "./config";

/**
 * 入力が HTTP(S) URL っぽい場合に true を返します。
 */
export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * HTML をローカルファイル、または URL から読み込みます。
 *
 * URL の場合は `Cookie: lang=ja` を付与します。
 * ※ Lambda(Node.js) の CommonJS から ESM 専用ライブラリを require できない問題を避けるため、
 *   CookieJar は使わずヘッダで渡します（xivpf は通常リダイレクトしない想定）。
 */
export async function loadHtml(input: string): Promise<string> {
  if (!isHttpUrl(input)) {
    return await readFile(input, "utf8");
  }

  const response = await axios.get<string>(input, {
    responseType: "text",
    maxRedirects: 5,
    beforeRedirect: (options) => {
      options.headers = options.headers ?? {};
      options.headers["Cookie"] = DEFAULT_COOKIE;
      options.headers["Accept-Language"] = "ja,en;q=0.8";
    },
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ja,en;q=0.8",
      Cookie: DEFAULT_COOKIE,
      "User-Agent": "ffxiv_ptfinder/1.0 (+https://xivpf.com)"
    }
  });

  return response.data;
}
