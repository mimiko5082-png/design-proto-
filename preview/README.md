# 同じURLで自動更新するCloudflareプレビュー

## 準備済み／未実施

- 準備済み: 実アプリのソースからプレビュー専用の静的ファイルを作るビルド。
- 準備済み: 名前を `basho-preview` に限定したCloudflare設定。
- 許可済み: 今後このアプリで依頼された変更を `codex-preview` へ送信してプレビューを更新する運用。
- 設定待ち: GitHub Actionsにプレビュー用のトークンとAccount IDを登録するまで自動公開は有効になりません。

ユーザーはプレビュー専用ブランチへの送信を許可済みです。本番のプッシュ・マージ・公開には別途明示的な許可が必要です。この接続は本番用 `main` とは別の `codex-preview` ブランチを対象にします。ローカルには未公開のアプリ変更があります。公開前にその内容とブランチを確認してください。

## 最初の一度だけ行う設定：GitHub Actions

現在のCloudflare画面は「Git repository」のGitHub/GitLab/Originボタンと「API token for external CI/CD」を表示します。「Connect」が表示されずGitHubボタンがリポジトリを開くため、外部CI/CD方式に切り替えます。

1. **basho-preview** の Settings → Builds → **API token for external CI/CD → Create token** を選ぶ。この画面の説明どおり、このWorkerだけに公開できるトークンを使用します。
2. トークンはチャットやスクリーンショットに出さず、GitHubの対象リポジトリで **Settings → Secrets and variables → Actions → New repository secret** に保存します。
3. トークンのSecret名は `CLOUDFLARE_PREVIEW_API_TOKEN`。この名前に実際のトークンを記入せず、値欄へ入力します。
4. 同じ場所に `CLOUDFLARE_PREVIEW_ACCOUNT_ID` を追加し、CloudflareのAccount IDを値として保存します。Account IDはWorker名やURLとは別です。
5. 登録完了後、`codex-preview` にコミットを送って初回実行を確認します。画面に現れる秘密情報を見せる必要はありません。「登録した」という返答で次へ進めます。

ワークフローは `.github/workflows/deploy-preview.yml`。対象ブランチ・リポジトリ・Worker名を固定しています。GitHubとCloudflareの直接のGit接続は不要です。

Secretsが未設定の実行では、ビルドとテストだけを行い、デプロイせずに設定待ちと表示します。Secret追加だけでは再実行されないため、登録後に次のプレビュー用コミットを送ります。手動実行ボタンはワークフローがmainに存在しないと表示されない場合があるため、この設定ではmainを変更せずpushで起動します。

APIトークンをチャット、ソースコード、設定ファイル、Actionsのログへ書きません。既存の本番用トークンは利用しません。Cloudflareでスコープがbasho-previewだけであることを確認してから使用します。

## 設定後の使い方

許可された更新を `codex-preview` へ送る → GitHub ActionsがビルドしてCloudflareのbasho-previewだけを公開 → 同じURLを再読み込み。

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

生成物 `preview/dist/` はGit管理対象外。GitHub Actionsのビルド時に生成します。既存の `ai-service/wrangler.jsonc` は本番AI用なので、プレビューのデプロイに使用しません。

## 認証情報の形式チェック

公開時は `preview/deploy.mjs` を実行します。GitHub Secretsから渡されたトークンとAccount IDの前後の空白・改行を除いて、子プロセスの環境変数でWranglerへ渡します。値はファイルやコマンド引数に書かず、ログにも出力しません。

内部に改行・空白があるトークン、引用符付きの値、「使用例」のコマンド全体、形式の違うAccount IDはWranglerを起動する前に停止し、修正するSecret名だけを案内します。内部の文字を推測してつなぎ直すことはしません。前後の空白だけならユーザーによる再登録は不要です。

スクリプト内でも対象リポジトリ・ブランチ・Worker名を検証します。本番mainからは実行できません。
