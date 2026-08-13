芭蕉のまなざし Firebase自動同期版

GitHubの design-proto- リポジトリで、次の4ファイルをこのフォルダのものに置き換えてください。

1. index.html
2. basho-app.js
3. sw.js
4. firebase-config.js（新規追加）

supabase-config.js は不要です。残っていても index.html からは読み込まれません。

更新後の動作:
- iPhone/Safariで句を保存するとFirebase Realtime Databaseへ自動保存
- PCで同じURLを開くと同じ句帳を自動取得
- PCで保存した句もiPhone側へ自動反映
- ログイン、同期コード、同期ボタンは不要
- 今スマホに既にあるローカル句は、更新後にそのスマホでサイトを一度開くとFirebaseへ移行

注意:
Realtime Databaseのルールを .read=true / .write=true にしているため、サイトを知っている人も同じ共有句帳を読み書きできます。
