# 画像認識・画像生成の設定

フロントエンドは既存の静的HTML/JavaScript、バックエンドは既存のCloudflare Workerを維持しています。ホームの「画像AIを開く」から独立した認識・生成フォームを使います。観察タイマー、既存の文章の問い返し、共有句帳の写真添付は変更しません。

## APIと環境変数

| API | 入力 | 応答 |
| --- | --- | --- |
| `POST /api/images/analyze` | JSON `{ "image": "data:image/png;base64,..." }` | `{ "text": "認識結果" }` |
| `POST /api/images/generate` | JSON `{ "prompt": "作りたい画像の説明" }` | `{ "image": "data:image/png;base64,...", "kind": "generated" }` |

サーバー側はCloudflareの`AI`バインディングで外部のWorkers AIを呼び出します。APIキーは不要です。料金・初回公開・モデル一覧は[README.md](README.md)を参照してください。

| 設定 | 用途 |
| --- | --- |
| `AI` | Workers AIバインディング。`wrangler.jsonc`で設定 |
| `IMAGE_RATE_LIMITER` | Cloudflare Rate Limitingバインディング |
| `ALLOWED_ORIGIN` | 公開時は`https://mimiko5082-png.github.io`、ローカル時は画面のOrigin |

Workers Freeプランの1日10,000 Neuronsの無料枠を使います。超過時は429で停止し、有料APIへ切り替えません。Paidアカウントの超過課金をコードでは止められないため、Freeプランを維持してください。OpenAIの接続情報が以前から存在していても、現行サーバーでは読み込みません。

## ローカル開発

このリポジトリをそのまま静的配信するため、秘密ファイルをチェックアウト内に作らないでください。Git除外だけではローカルHTTPサーバーの配信を防げません。

1. `ai-service/.env.example`を公開フォルダの外（例：`/tmp/basho-ai-config/.env`）へコピーします。
2. APIキーの入力は不要です。将来ほかのSecretを追加する場合も、この公開フォルダ外のコピーで管理します。
3. コピー内の`ALLOWED_ORIGIN`をフロントエンドのOriginに合わせます。`localhost`と`127.0.0.1`、ポート違いは別Originです。
4. フロントエンドとWorkerを別ターミナルで起動します。

```sh
# フロントエンド：リポジトリルート
python3 -m http.server 8000 --bind 127.0.0.1

# バックエンド：ai-serviceフォルダ
npx --yes wrangler@4.151.0 login
npx --yes wrangler@4.151.0 dev --env-file /tmp/basho-ai-config/.env --ip 127.0.0.1 --port 8787
```

ホームの画像AI画面で接続設定を開き、`http://127.0.0.1:8787`を保存します。HTTP接続はローカル画面からループバック接続先を使う場合だけ許可します。本番はHTTPSが必要です。接続先URLだけがlocalStorageに残り、画像・認識結果・生成結果は保存しません。

ローカル開発でもWorkers AIの推論はCloudflare側で実行され、無料枠を消費します。消費なしで確認する場合は下記のモックテストとdry-runを使ってください。

## 本番公開

1. `ai-service`で`npx --yes wrangler@4.151.0 deploy`を実行します。
2. Cloudflare側がWorkers Freeプランであること、必要なモデルの利用規約への同意を確認します。
3. `AI`と`IMAGE_RATE_LIMITER`バインディングが反映されていることを確認します。
4. 画像AI画面の接続設定へ実際のWorkerのURLを登録します。全員の既定値にする場合はルートの`image-config.js`の`endpoint`へURLだけを設定し、フロントエンドを公開します。

文章の問い返しの接続先`perspective-config.js`とは別設定です。画像APIはAI・回数制限のバインディングが未設定なら503を返します。接続先を保存しただけでは疎通確認済みとは扱いません。

## 入力・利用制限とデータの扱い

- アップロードはJPEG/PNG/WebP、4MiB以下、2000万画素以下・各辺10000px以下。ブラウザとサーバーで形式ヘッダー・サイズ・寸法を検証します。ブラウザでは実デコード後に長辺768px以下・256KiB以下のJPEGへ変換して送信します。サーバーも送信画像を256KiBまでに制限します。無料WorkerのCPU負荷と通信量を抑えるためです。
- 説明文は1〜1000文字（JavaScriptの文字列長基準）。生成はFLUX.1 schnellで1回1枚、4 stepsです。解像度とPNG/JPEG/WebPの形式はモデル出力に従います。
- サーバーはContent-Lengthの有無にかかわらずストリームを計測します。認識リクエストは384KiB、生成リクエストは8KiBまでです。
- 送信元IP別と全体キーの両方に、Cloudflareの5回/60秒制限を適用します。両機能で枠を共有します。これはCloudflare拠点ごとの近似制限で、厳密な全世界の日次上限・課金上限ではありません。必要に応じて追加の認証や一元的な利用量管理を導入してください。
- 既存アプリには利用者認証がないため、新規ログイン機構は追加しません。CORSは認証ではなく、許可Originの偽装も可能です。公開時は利用状況を確認し、必要ならTurnstileなどを追加してください。
- サーバーから任意の外部画像URLを取得しません。認識入力は検証したData URL、生成結果も形式を判別・検証したPNG/JPEG/WebPだけを返します。
- APIキー、上流レスポンスの生データ、例外の詳細はエラー応答へ含めません。認識テキストはHTMLとして扱わず表示します。
- ブラウザは認識55秒・生成130秒、サーバーは認識45秒・生成120秒でタイムアウトします。失敗時は利用者が明示的に再試行します。自動再送は行いません。画面を離れるとブラウザの待機を中止しますが、Cloudflare側で既に始まった推論の無料枠消費取消は保証されません。
- 入力画像・生成画像は既存のFirebase共有領域やlocalStorageへ自動保存しません。画面を離れると結果は消えます。必要なら生成画像の保存リンクからダウンロードしてください。

## 検証

```sh
# リポジトリルート
node --test tests/*.test.mjs
python3 tests/images.browser.py

# ai-serviceフォルダ
npx --yes wrangler@4.151.0 deploy --dry-run --outdir /tmp/basho-worker-build
```

ブラウザテストはPython PlaywrightとChromiumが必要です。必要なら手元で別途導入してください。ブラウザテストは外部AIとFirebaseをモックし、入力検証・縮小、無料枠超過時の停止、独立した待機状態、失敗と再試行、テキストの安全な表示、ダウンロード、画面遷移を検証します。実APIや本番データベースへの送信は行いません。実サーバー公開・AIバインディングでの認識と生成は別途確認が必要です。

## 無料枠のエラー

Cloudflareのエラーコード3036は`FREE_QUOTA_EXCEEDED`へ変換し、アカウント情報や上流メッセージを返しません。画像画面は「本日の無料枠」を表示し、文章の問い返しは`prepared`として保存します。モデルが有料プランを要求する場合（5035）も停止します。モデル自体の提供状況はCloudflareの公式情報を確認してください。

- 料金：https://developers.cloudflare.com/workers-ai/platform/pricing/
- 画像認識：https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/
- 画像生成：https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
- エラー：https://developers.cloudflare.com/workers-ai/platform/errors/
