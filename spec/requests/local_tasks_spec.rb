require "rails_helper"

RSpec.describe "Local tasks", type: :request do
  it "shows the browser-local task list without logging in" do
    get local_tasks_path

    expect(response).to have_http_status(:ok)
    expect(response.body).to include("ねこを迎える準備")
    expect(response.body).to include("お迎えチェックリストを追加")
    expect(response.body).to include('data-controller="local-tasks"')
    expect(response.body).to include("バックアップを保存")
    expect(response.body).to include("バックアップを復元")
    expect(response.body).to include("すべて削除")
  end
end
