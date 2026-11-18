# FCMプッシュ通知の設定と公開

## 実装内容

- フロントは引き続き `https://mimiko5082-png.github.io/design-proto-/`（GitHub Pages）。Firebase Hostingは使用しません。
- 「カレンダー → 通知の設定」でGoogleログイン後、端末ごとに通知の許可・登録・停止・テスト送信を行います。許可ダイアログは利用者がボタンを押した場合だけ開きます。
- 毎日 **8:00・23:50、日本時間**。Cloud Schedulerのタイムゾーンは `Asia/Tokyo` です。朝は今日のお題、夜は今日の写真・友達の写真を振り返る案内を送ります。
- `fcmMorning` / `fcmNight`（Cloud Functions第2世代、Node.js 22、東京リージョン）がAdmin SDKからFCMへ送信します。
- フォアグラウンドでは `fcm-bootstrap.js`、バックグラウンドでは既存の `sw.js` 上のFirebase Messaging SDKが表示します。通知ペイロードとデータを送信し、バックグラウンドのコールバックではSDKが表示済みの通知を重ねて表示しません。旧サーバーのデータのみの通知にも対応します。
- GitHub Pagesの `/design-proto-/` スコープを使用します。ルートにService Workerを置く必要はありません。通知を押すと同じアプリを開きます。
- 同じ端末・日付・時間帯の送信をトランザクションで管理。失敗は再試行し、失効したFCMトークンと90日間更新されていない端末を削除します。送信状態は時間帯ごとの最新分だけ保持します。
- 通信断などにより、端末へ届いた後に送信完了記録が失敗した場合は再送の可能性があります。同じ通知タグと `renotify: false` で重複表示・再通知を抑えます。OS側の遅延まで含めて厳密な時刻配信を保証するものではありません。
- 端末IDとFCMトークンはCallable Functions経由で登録。`fcmDevices` はクライアントから読み書きできません。停止・テストは登録者本人だけが操作できます。テストは端末ごとに1分に1回まで、通常の端末登録は1ユーザー10台までです。
- 写真・コメント・メールアドレスを通知本文に含めません。FCMトークンや資格情報をログへ出しません。

## 設定する値

| 項目 | 設定場所・値 |
| --- | --- |
| Firebaseプロジェクト | `basho-friends`（既存のGoogleログインと同じプロジェクト） |
| Firebase Web設定 | `firebase-friends-config.js` の既存設定を利用 |
| Web Push公開鍵 | `fcm-config.js` の `vapidKey` に依頼時の公開鍵を設定済み |
| Functionsリージョン | `fcm-config.js` とFunctions設定で `asia-northeast1` |
| 通知時刻 | `firebase/functions/delivery.mjs` の `SCHEDULES`。8:00と23:50を設定済み |
| 通知クリック先 | `firebase/functions/delivery.mjs` の `APP_URL`（上記GitHub Pages URL） |
| サーバー資格情報 | Cloud Functionsの実行サービスアカウント（Application Default Credentials） |

Firebaseコンソール → プロジェクト設定 → Cloud Messaging → Web Push証明書の公開鍵が、`fcm-config.js` と一致することを確認してください。この公開鍵に対応する鍵ペアが **basho-friends** に登録されている必要があります。公開鍵だけから秘密鍵は復元できません。異なるプロジェクトの鍵の場合は、対象プロジェクトの公開鍵を設定してください。秘密鍵やサービスアカウントJSONをブラウザ・GitHubリポジトリへ置く必要はありません。

## Firebase側の準備

1. `basho-friends` にBlaze（従量課金）を設定します。Cloud Functions・Cloud Schedulerの利用に必要です。フロントの公開先は変わりません。
2. AuthenticationのGoogleログインを有効にし、承認済みドメインに `mimiko5082-png.github.io` があることを確認します。
3. Cloud MessagingのFCM HTTP v1 APIを有効にします。Functionsの初回公開時にはCloud Functions、Cloud Run、Cloud Build、Artifact Registry、Cloud Schedulerの各APIも必要です（Firebase CLIの案内でも有効化できます）。
4. Functions実行サービスアカウントに `roles/firebasecloudmessaging.admin` と `roles/firebasedatabase.admin` があることを確認します。第2世代の標準は `<PROJECT_NUMBER>-compute@developer.gserviceaccount.com` です。カスタムの実行アカウントを使う場合はそちらへ付与します。登録者本人のチェックと非公開データの読み書きは、このサーバーアカウントで行います。
5. Cloud SchedulerがFunctionsを呼び出せることを公開後に確認します。CLIが作成するSchedulerジョブと呼び出し用サービスアカウントを削除しないでください。

## デプロイ手順

リポジトリのルートから、FirebaseとGitHubへの権限を持つアカウントで行います。本番公開は別途許可を得てから実行してください。

```sh
npm ci --prefix firebase/functions --ignore-scripts --no-audit --no-fund
node --test tests/fcm*.test.mjs
npx firebase-tools@15.36.0 login
npx firebase-tools@15.36.0 deploy --project basho-friends --only database,functions:fcm
```

`firebase.json` のFunctionsコードベース名は `fcm` です。既存のCloudflare AI Workerは更新しません。Databaseルールは既存の友達共有ルールに `fcmDevices` のクライアント拒否・uidインデックスを追加したものです。Firebaseコンソール側のルールに未反映の変更がある場合は、公開前に差分を確認してください。

作成されるFunctions:

- `fcmRegisterDevice`: Google認証済み端末を登録・更新
- `fcmDeviceStatus`: 本人の端末の通知状態を返す（トークンは返さない）
- `fcmDisableDevice`: 本人の端末登録を削除
- `fcmTestNotification`: 本人の端末へテスト送信
- `fcmMorning`: `0 8 * * *` / `Asia/Tokyo`
- `fcmNight`: `50 23 * * *` / `Asia/Tokyo`

Functionsとルールを公開した後、テスト済みのフロント変更を `main` へ反映してGitHub Pagesの公開完了を待ちます。既存の `Verify production assets` が、FCM関連ファイルを含めた公開ファイルとコミットの一致を検証します。Firebase Hostingへのデプロイは行いません。

## 利用者の設定・実機確認

1. 本番サイトへGoogleログイン → カレンダー → 通知の設定。
2. 「通知を受け取る」を押してブラウザの通知を許可します。
3. 「テスト通知を送る」を押し、前面表示・別タブ表示・アプリを閉じた状態での受信を確認します。テストは1分間隔で行ってください。
4. 通知タップでGitHub Pagesのアプリが開くことを確認します。
5. 翌8:00・23:50の実配信と、Cloud Scheduler/Functionsの実行ログ（件数のみ）を確認します。
6. 「この端末の通知を停止」後に配信されないことを確認します。

iPhone/iPadはSafariからホーム画面へ追加したWebアプリ（16.4以降）が必要です。ブラウザ・OSが対応していても、端末設定・集中モード・省電力・ネットワークで通知が遅延・抑制される場合があります。対応可否はFirebase SDKでも確認します。

旧Cloudflare Web Pushからの自動移行はしません。利用者がFCMを有効にした際、公開鍵が異なる旧購読を停止して新しいFCM登録に切り替えます。旧Workerの空のPush配信を使うコードは新しいService Workerから読み込みません。旧サーバーの登録は失効応答で削除されます。新FCMへの切り替えと実機確認が終わったら、旧通知Cronを運用側で停止してください（AI用Workerそのものは削除しません）。

## 検証コマンド

```sh
node --test tests/*.test.mjs
CHROMIUM_PATH=/usr/bin/chromium python3 tests/fcm.browser.py
npm ci --prefix preview --ignore-scripts --no-audit --no-fund
npm --prefix preview run share
python3 tests/share.browser.py
```

送信テストはモックを使用し、実際のFCMや利用者の端末へ送信しません。FCMブラウザテストは、許可の操作起点、公開鍵・スコープ、旧購読の切替、前面表示、テスト送信、停止、拒否、通信エラー、認証切替、モバイル幅を検証します。Service Workerテストは旧データ通知の表示、SDK通知の二重表示防止、SDK CDN停止時の通知ペイロードとデータ通知の代替処理、クリック先の制限を検証します。実機での配信・iOSホーム画面からの受信は、上記の実機確認が必要です。

## まだ必要な作業

Firebaseプロジェクトの課金/API/IAM/公開鍵の確認、Functionsとルールの実デプロイ、本番GitHub Pagesへの反映、利用者による通知許可と実機受信確認です。このリポジトリへの実装やプレビュー公開だけでは定時通知は動き始めません。プレビューは実通知・Service Workerを無効に保ちます。

## テスト通知が反応しない場合の修正

送信ボタンを押した直後に「送信中…」を表示し、Callableの待ち時間を15秒に制限しています。「FCMに送信を依頼」はサーバー受付を表し、端末で受信済みとは区別します。前面のアプリで受信した場合は「この端末で通知を受信しました」、表示に失敗した場合はその旨を通知設定内に表示します。

Realtime Databaseのトランザクションは、最初にサーバーではなくプロセス内キャッシュで更新関数を実行します。起動直後の空キャッシュで送信前チェックを中断しないよう、端末情報の取得から送信完了記録まで値の購読を保持するように修正しました。定時送信にも同じ対策を適用しています。終了時・失敗時・タイムアウト時は購読を解除します。

この修正にはFunctionsの再デプロイが必要です。Cloud Shellの `~/basho-fcm-deploy` 内で実行します。

```sh
git pull --ff-only
npx --yes firebase-tools@15.36.0 deploy --project basho-friends --only functions:fcm
```

送信権限・Web Push鍵・失効トークンのエラーは、秘密情報を含めない種別で画面に表示します。Functionsログには失敗コードだけを記録し、FCMトークンやAPI応答本文は記録しません。送信権限エラーなら実行サービスアカウントのFCM権限、鍵エラーならFirebaseコンソールのWeb Push証明書を確認します。

## テスト送信を止めた理由の確認

テストの前提条件エラーは、端末登録なし `FCM_DEVICE_MISSING`、アカウント不一致 `FCM_DEVICE_ACCOUNT`、停止中 `FCM_DEVICE_DISABLED`、1分以内の再送 `FCM_TEST_COOLDOWN`、同時変更 `FCM_TEST_CONFLICT` を区別します。再送制限では残り秒数も表示します。ログは理由と残り秒数だけで、ユーザーID・端末ID・トークンは含めません。`FCM_TEST_LEGACY` は詳細理由を返さない旧サーバーからの応答です。

Cloud Shellで別ブランチを使っていると `git pull` だけでは修正版が取得されません。既存作業を上書きせず、検証済みコミットを新しい作業ディレクトリへ取り出してデプロイできます（`COMMIT_SHA` は検証済みの完全なSHAへ置換）。

```sh
cd ~/basho-fcm-deploy
git fetch origin codex-preview
git worktree add --detach ../basho-fcm-diagnostics COMMIT_SHA
cd ../basho-fcm-diagnostics
npm ci --prefix firebase/functions
npx --yes firebase-tools@15.36.0 deploy --project basho-friends --only functions:fcm
```

本番側の受信成功は、公開チェックやエミュレーター検証では確認できません。理由の表示と実機での受信を別途確認してください。

## アプリを閉じた状態での定時通知

毎日 `0 8 * * *` と `50 23 * * *`、タイムゾーン `Asia/Tokyo` のCloud Schedulerから送信します。ページのタイマーやページが開いていることに依存しません。通知にはタイトル・本文の `notification`、表示タグ・アイコン・固定のクリック先を含む `webpush`、前面表示と旧サーバー互換のための `data` を含めます。待機中の端末へ速やかに配信されるよう `Urgency: high` を指定し、定時通知のTTLは1時間です。OS設定やオフラインの端末へ指定時刻どおりの表示を保証するものではありません。

「10秒後」のテストボタンとサーバーの待機処理は削除しました。通常の即時テストと通知の登録・停止を利用できます。通知ペイロードへの変更はFunctionsの再デプロイ、表示と二重表示防止の変更はGitHub Pagesへの反映が必要です。既存の端末登録を引き続き使用し、アプリ側で最新Service Workerを読み込ませます。

## 通知の音・振動

FCMの自動表示、前面表示、SDK停止時の代替表示のすべてで `silent: false` を明示します。対応ブラウザ向けには `vibrate: [200, 100, 200]` を指定します。iOSでは独自の振動パターンは利用できず、実際の音・触覚はOS、端末の通知設定、集中モード等に従います。コード上の指定を実機で音や振動が鳴った証拠とは扱いません。

Appleの説明ではiOS/iPadOSは標準で音が有効ですが、音を要求する場合は `silent: false` を明示できます。以前の「アプリから音を指定できない」という案内は不正確でした。参考: https://developer.apple.com/videos/play/wwdc2023/10120/ （通知の音に関する説明）。

## 定時通知が1台にしか届かない不具合の修正（2026-11-18）

`sendScheduled` は `snapshot.forEach(child=>rows.push(child))` で端末を列挙していました。Realtime Databaseの `forEach` はコールバックが真値を返すと列挙を打ち切るため、`push` の戻り値（配列の長さ）で1台目の後に止まり、毎回キー順で先頭の1台だけが送信対象になっていました。本番ログでも11/17 23:50と11/18 8:00の処理台数は合計1台でした。コールバックが値を返さない形に直し、テストのモックもRTDBと同じ打ち切り動作にしています（修正前のコードでは205台中1台しか送られずテストが失敗します）。

この修正にはFunctionsの再デプロイが必要です。反映後、次の8:00・23:50の実行ログで `sent` が登録端末数になることを確認してください。

```sh
npx --yes firebase-tools@15.36.0 deploy --project basho-friends --only functions:fcm
```

## アプリ表示中の受信でも必ず通知を出す（2026-11-18）

Firebase MessagingのService Worker SDKは、アプリの画面が見えている間は通知を表示せず、ページへメッセージを転送するだけです。iOS/iPadOSは、通知を表示せずに終わったpushが続くと購読を失効させます。テスト通知はアプリを開いたまま押すため、また23:50にアプリを開いている利用者も、この条件に当たります。`firebase-messaging-sw.js` のpushハンドラーで、SDKの有無に関係なく必ず `showNotification` を実行するようにしました。SDKやページ側の表示は同じタグ（`renotify:false`）なので置き換えになり、二重には鳴りません。

この変更はGitHub Pagesへの反映が必要です。iPhoneのホーム画面版で、アプリを開いたままテスト通知を4回以上（1分間隔）送り、その後アプリを閉じた状態でも届くことを実機で確認してください。失効の再現と解消は実機でしか確認できません。

### 模擬pushでの確認（2026-11-18）

実物の `sw.js`（Firebase Messaging SDKを読み込んだ状態）をローカルで配信し、Chromeの開発者向け機能（`ServiceWorker.deliverPushMessage`）で、FCMと同じ形のpushを届けて表示件数を数えました。アカウントのログインやサーバーからの送信は使っていません。

| 状態 | 公開中のService Worker | 修正後 |
| --- | --- | --- |
| アプリの画面を表示中 | 通知0件（Service Workerは何も表示しない） | 1件 |
| アプリの画面を1つも開いていない | 1件 | 1件（二重にならない） |
| 開いていない状態で朝・夜の2通 | 2件 | 2件 |

公開中の版でも、ログイン済みで受信処理が動いているページがあれば、ページ側が通知を出します。ただしpushイベント自体は通知なしで終わるため、iOSではこれが失効の条件に当たります。実際のFCM配信と実機での表示は、この確認には含まれていません。
