# このリポジトリでの公開ルール

- ユーザーは、今後このアプリで依頼した変更を `codex-preview` ブランチへコミット・プッシュし、プレビューを更新する運用を許可済みです。
- 本番の `main` へのプッシュ・マージ、本番サイトの公開、本番AI Worker `basho-ai` の更新は、別途ユーザーから明示的な許可を得てください。
- プレビューには `preview/wrangler.jsonc` を使用します。対象は `basho-preview` だけです。`ai-service/wrangler.jsonc` は本番AI用なのでプレビュー公開には使用しません。
- 自動更新は `.github/workflows/deploy-preview.yml` のGitHub Actionsを使用します。`CLOUDFLARE_PREVIEW_API_TOKEN` と `CLOUDFLARE_PREVIEW_ACCOUNT_ID` のGitHub Secrets登録が必要です。トークンはbasho-previewだけを公開できるものを使用します。Secrets未設定ではビルドだけを実行し公開しません。初回デプロイ成功を確認するまで、自動更新が有効だと報告しないでください。
- このプロジェクトは静的HTML・CSS・JavaScriptです。`node preview/build.mjs` で追加依存なしにプレビューを作れます。生成物 `preview/dist/` はコミットしません。
- 変更に応じたテストを実行してください。プレビューの確認には `node --test tests/preview.test.mjs` と `python3 tests/preview.browser.py` を使用できます。Python PlaywrightとChromiumが必要です。
- プレビューは本番Firebaseや実AIへ接続しない構成を維持してください。APIキーや秘密情報をソースやチャットに出力しないでください。
- ユーザーの未公開変更を保持してください。本番とプレビューブランチに差分がある場合は、強制プッシュや本番への上書きをせず、目的に必要な変更だけを扱ってください。
