# 芭蕉レンズのAIサーバー

GitHub Pagesとは別にCloudflare Workersで実行します。公開フロントエンドへAPIキーを入れず、記録文とお題だけをOpenAI Responses APIへ送ります。

## 初回公開

必要なものはCloudflareアカウントと、APIの利用設定・残高があるOpenAI APIキーです。ChatGPTの有料プランとは別のAPI利用料金が発生します。キーはチャットやGitHubに貼らず、WorkersのSecretとして登録してください。

このフォルダで以下を実行します。Node.js 22以上を推奨します。

```sh
cd /workspace/design-proto-/ai-service
npx --yes wrangler@4.151.0 login
npx --yes wrangler@4.151.0 deploy
npx --yes wrangler@4.151.0 secret put OPENAI_API_KEY
```

`login` のブラウザでCloudflareを認証します。`secret put` の入力プロンプトへAPIキーを入力します。値をコマンドの引数に書かないでください。ヘッドレス環境の場合は、認証済みの手元のPCから同じリポジトリを使って実行できます。

設定ファイルはWorker名 `basho-perspective`、モデル `gpt-4.1-mini`、許可元 `https://mimiko5082-png.github.io` を指定しています。使用するOpenAIプロジェクトでモデルが利用できることを確認してください。公開URLはdeployの結果に表示される実際の `https://basho-perspective.<アカウントのサブドメイン>.workers.dev` です。サブドメインを推測してアプリに登録しないでください。

Origin制限は利用者認証ではありません。公開前にCloudflare側の利用制限とOpenAI側の予算・利用状況を確認し、必要に応じてレート制限を設定してください。

## アプリと接続

公開URLをアプリのホーム「AIの接続設定」に入れて保存すると、そのブラウザから利用できます。全員の初期接続先にするには、リポジトリの `perspective-config.js` の `endpoint` を実際のURLに設定し、GitHub Pagesへ反映します。ここに書くのはURLだけです。

動作確認は以下のPOSTで行えます。URLにはdeploy結果の実際の値を使ってください。これはAPI利用料の発生する確認です。

```sh
curl --fail-with-body 'https://実際のWorkerのURL/' \
  -H 'Origin: https://mimiko5082-png.github.io' \
  -H 'Content-Type: application/json' \
  --data '{"note":"ベンチの端だけが濡れていない。","prompt":"誰かがここにいた痕跡を探す"}'
```

`hypotheses` と `question` を含むJSONが返ること、公開アプリで「AIからの問い返し」と表示されることを確認します。未設定は503、上流の失敗は502です。アプリは失敗時に「用意された問い」へ切り替えるため、問いが出ることだけでは接続成功と判断できません。

## 認証なしで行う確認

```sh
cd /workspace/design-proto-
node --test tests/observation.test.mjs
cd ai-service
npx --yes wrangler@4.151.0 deploy --dry-run --outdir /tmp/basho-worker-build
```

dry-runはバンドルの確認であり、サーバー公開や実APIへの接続は行いません。
