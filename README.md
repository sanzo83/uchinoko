# Tasksan

スマホで使う、保護猫のお迎え準備向けタスク管理ツールです。

## 開発環境

- Ruby 3.2.11
- Rails 8.1
- SQLite

```sh
bundle install
bin/rails db:prepare
bin/rails server
```

## 本番環境

Cloud Run では `SECRET_KEY_BASE` をシークレットとして設定してください。
コンテナ内の SQLite ファイルは永続化されないため、タスクはブラウザのローカルストレージに保存します。別の端末・ブラウザには同期されません。
機種変更の前には、画面の「バックアップを保存」からJSONファイルを作成してください。復元すると、現在のタスクはバックアップの内容で置き換わります。
