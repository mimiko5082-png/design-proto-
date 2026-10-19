# 芭蕉レンズのAIサーバー（無料枠版）

1日1回ランダムな通知を使う場合は、[NOTIFICATIONS.md](NOTIFICATIONS.md)のD1・鍵・定期実行の設定も必要です。通知を使わない場合は、以下のAI設定だけで構いません。

画像認識・画像生成・文章の問い返しをCloudflare Workers AIで実行します。**OpenAI APIキーは不要**で、有料APIへの自動切り替えはありません。フロントエンドは今まで通りGitHub Pagesで配信します。

## 無料で使うための条件

Cloudflareの **Workers Free** プランを使ってください。Workers AIの無料枠はアカウント全体で1日10,000 Neuronsです。画像認識・生成・文章の問い返しと、同じアカウントの他のWorkers AI利用で枠を共有します。画像1枚・問い1件ごとに消費量が違うため、利用可能回数は固定ではありません。

Workers Freeでは枠を超えると処理がエラーで止まります。毎日00:00 UTC（日本時間09:00）にリセットされます。Workers自体の無料リクエスト枠など、別のプラットフォーム制限もあります。

**Workers Paidへ変更したり、AI Gatewayの有料課金を有効にしないでください。** Paidでは無料枠超過分の請求があり得ます。Workerのコードからアカウントの料金プランを判定・変更することはできません。無料であることの条件は、Cloudflare側でFreeを維持することです。

公式料金案内：https://developers.cloudflare.com/workers-ai/platform/pricing/

## 初回公開

Cloudflareの無料アカウントを用意してから、次を実行します。APIキーやSecretの登録は不要です。

```sh
cd /workspace/design-proto-/ai-service
npx --yes wrangler@4.151.0 login
npx --yes wrangler@4.151.0 deploy
```

`login` のブラウザで自分のCloudflareアカウントを認証します。ブラウザ認証できない環境では、手元のPCで同じリポジトリを使って実行してください。`wrangler.jsonc` は `AI` と `IMAGE_RATE_LIMITER` バインディングを設定済みです。

Llamaモデルの利用規約への同意を求められた場合は、CloudflareのWorkers AI画面で確認してください。未同意エラーは503となり、有料モデルには切り替えません。

## アプリと接続

GitHub連携なしでCloudflareのコード編集画面を使う場合は、`dashboard-worker.js`全体を`worker.js`へ貼り付けてDeployします。`AI`と`IMAGE_RATE_LIMITER`のバインディングは管理画面で別途登録します。現行の接続先は、管理画面で確認した`https://basho-ai.mimiko5082.workers.dev`です。

`dashboard-worker.js`はサーバーのソースから生成しています。サーバーを変更したら、リポジトリルートで`node ai-service/build-dashboard.mjs`を実行し、再生成した内容を貼り付けてください。生成処理はdry-runのみで、公開やAI推論は行いません。公開URLへの通常のアクセスはバインディング設定だけを確認し、AI推論は行いません。

deploy結果に表示された実際のHTTPS URLを使います。URLを推測して設定しないでください。

- 画像認識・生成：ホームの「画像AIを開く」→「画像AIの接続設定」へURLを保存。
- 文章の問い返し：ホームの「AIの接続設定」へ同じURLを保存。
- 全員の初期接続先にする場合は、`image-config.js` と `perspective-config.js` の `endpoint` にURLだけを設定してGitHub Pagesへ反映。

画像の無料枠を使い切ると、画面に上限を表示して停止します。文章の問い返しでは、AI生成ではないと明示して既存の用意された問いを表示します。自動再試行や他の有料APIへの切り替えは行いません。

## モデル

| 機能 | Workers AIモデル |
| --- | --- |
| 画像認識 | `@cf/meta/llama-3.2-11b-vision-instruct` |
| 画像生成 | `@cf/black-forest-labs/flux-1-schnell`（4 steps） |
| 文章の問い返し | `@cf/meta/llama-3.2-3b-instruct` |

モデルはサーバー側で固定し、クライアントから別のモデル・有料Gatewayを選ばせません。詳細は[IMAGES.md](IMAGES.md)を参照してください。

## 認証なしで行う検証

```sh
cd /workspace/design-proto-
node --test tests/*.test.mjs
python3 tests/images.browser.py
cd ai-service
npx --yes wrangler@4.151.0 deploy --dry-run --outdir /tmp/basho-worker-build
```

テストはAIとFirebaseをモックし、無料枠も消費しません。dry-runはバンドル確認のみで、サーバー公開やAIの推論を行いません。実アカウントでの公開・モデルの動作は別途確認が必要です。
