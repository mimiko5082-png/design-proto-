# 同じURLで自動更新するCloudflareプレビュー

## 準備済み／未実施

- 準備済み: 実アプリのソースからプレビュー専用の静的ファイルを作るビルド。
- 準備済み: 名前を `basho-preview` に限定したCloudflare設定。
- 許可済み: 今後このアプリで依頼された変更を `codex-preview` へ送信してプレビューを更新する運用。
- 未確認: CloudflareのGit接続。初回接続が終わるまでは自動公開は有効になりません。

ユーザーはプレビュー専用ブランチへの送信を許可済みです。本番のプッシュ・マージ・公開には別途明示的な許可が必要です。この接続は本番用 `main` とは別の `codex-preview` ブランチを対象にします。ローカルには未公開のアプリ変更があります。公開前にその内容とブランチを確認してください。

## 最初の一度だけ行う設定

1. ユーザーの明示的な許可後、レビュー済みの作業内容を `codex-preview` ブランチへコミット・プッシュ。`main` へはプッシュしません。
2. Cloudflareで既存の **basho-preview** を開く。**Settings（設定）→ Builds（ビルド）→ Connect（接続）** からGitHubを選ぶ。
3. リポジトリ `mimiko5082-png/design-proto-` を選ぶ。
4. Cloudflare上の「Production branch／ビルドするブランチ」は **codex-preview** に設定する。この項目はこのプレビュー専用Workerが追うブランチを意味します。本番サイトのmainではありません。
5. 下記を指定して保存・ビルド。

| 項目 | 値 |
| --- | --- |
| Root directory | `/`（リポジトリのルート） |
| Build command | `node preview/build.mjs` |
| Deploy command | `npx wrangler@4.151.0 deploy --config preview/wrangler.jsonc` |

既存のCloudflare GitHubアプリがある場合は、そのアクセス許可を再利用します。APIキーやトークンをチャットに入力する必要はありません。接続画面の選択肢はCloudflareのUIによって異なるため、表示を確認して案内します。

## 設定後の使い方

許可された更新を `codex-preview` へ送る → Cloudflareが自動ビルド・公開 → 同じURLを再読み込み。

URL: `https://basho-preview.mimiko5082.workers.dev/`

作業フォルダを編集しただけではCloudflareは更新されません。各変更をGitHubへ送る必要があります。最初の接続だけで、変更を送る都度の手動コピー・ダウンロード・Cloudflare操作が不要になります。本番反映は別途許可を必要とします。

## プレビューの範囲

- 30秒観察、お題の書き出し、固定のAIサンプル、写真選択、編集・保存、カレンダー・育成。
- 実アプリの各JS/CSSから毎回作成。手書きの別版を更新する方式ではありません。
- 写真や記録はプレビュー用のブラウザ保存領域へ。本番Firebaseや実AIへ送信しません。
- AIへの提案要求は固定サンプルに置き換え。通知は無効。
- 実Firebase設定・SDK、実サーバーURL、APIキーを配信しません。
- サービスワーカーを登録せず、`Cache-Control: no-store` で古い画面が残るのを抑えます。
- `noindex` は検索除外です。URLを知る人が開けるサイトであり、閲覧認証の代わりではありません。
- 単体貼り付け版で保存した札は別の保存領域に残し、削除しません。この版とは共有しません。

## ローカル検証

依存インストール不要。Node.jsでビルドします。

```
node preview/build.mjs
python3 -m http.server 8000 --directory preview/dist
```

```
node --test tests/preview.test.mjs
python3 tests/preview.browser.py
```

生成物 `preview/dist/` はGit管理対象外。Cloudflareビルド時に生成します。既存の `ai-service/wrangler.jsonc` は本番AI用なので、プレビューのデプロイに使用しません。
