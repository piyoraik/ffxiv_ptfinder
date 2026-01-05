# ffxiv_ptfinder

FFXIV のパーティ募集（`https://xivpf.com/listings`）を定期取得し、条件に一致した募集を Discord Webhook に送信するツールです。  
AWS SAM + EventBridge（30分間隔）での実行を前提にしています。

## ざっくり仕様

- 取得元: `https://xivpf.com/listings`（Cookie `lang=ja` を付与）
- 対象DC: `Elemental` / `Mana` / `Meteor` / `Gaia`
- 送信: 1募集 = 1メッセージ（Discord のコードブロック）
- 送信件数上限: `FFXIV_PTFINDER_LIMIT`（デフォルト 5）
- 募集者から Lodestone を検索し、先頭ヒットのURLを本文に含めます
- Lodestone のアチーブページ（カテゴリ4）から「絶/零式」達成状況を判定して本文に含めます
  - 判定: 対象アチーブの項目に日付（`time.entry__activity__time`）が存在するか

## フィルタ（filter.json）

検索条件は `data/filter.json` で管理します（複数行で編集しやすい形式）。  
SAMデプロイ時もこのファイルが同梱され、Lambda 実行時に読み込まれます。

例: `data/filter.json`

```json
{
  "dutyTitle": { "terms": ["絶もうひとつの未来"], "mode": "and" },
  "requirements": { "terms": ["練習"], "mode": "and" },
  "party": {
    "recruiting": {
      "healer": ["白", "占"],
      "withinRoleMode": "or",
      "acrossRolesMode": "and"
    }
  },
  "description": { "terms": ["最初から", "P1"], "mode": "or" }
}
```

主なキー（抜粋）:

- `dutyTitle`: コンテンツ名（部分一致, and/or）
- `requirements`: 要件（`description` から `[Practice]` 等を抽出した日本語ラベル、部分一致, and/or）
- `description`: 募集文（タグ除去後の本文、部分一致, and/or）
- `party.recruiting`: 募集中ジョブ（表示に使う略称で指定。例: `白`/`占`/`侍`）
  - `withinRoleMode`: 同一ロール内の OR/AND
  - `acrossRolesMode`: 複数ロール指定時の OR/AND

## 環境変数（Lambda）

- `DISCORD_WEBHOOK_URL`（必須）: Discord Webhook URL
- `FFXIV_PTFINDER_LIMIT`（任意）: 送信上限（デフォルト 5）
- `FFXIV_PTFINDER_FILTER_FILE`（任意）: フィルタファイルパス（デフォルト `data/filter.json`）

## ローカル実行

### デバッグ（Webhook送信なし、JSON出力）

`yarn start` で `https://xivpf.com/listings` を取得し、フィルタ（`data/filter.json`）を反映した募集一覧を JSON で標準出力に出します。

### 通知（Webhook送信）

```sh
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..." yarn notify
```

## SAM デプロイ

### ビルド

```sh
SAM_CLI_HOME=.samcli sam build
```

### 初回デプロイ

```sh
SAM_CLI_HOME=.samcli sam deploy --guided
```

`samconfig.toml` に設定が保存されるので、2回目以降は次で更新できます。

```sh
SAM_CLI_HOME=.samcli sam deploy
```
