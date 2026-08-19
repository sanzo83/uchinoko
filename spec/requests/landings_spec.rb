require "rails_helper"

RSpec.describe "Landing page", type: :request do
  it "shows an introduction without logging in" do
    get root_path

    expect(response).to have_http_status(:ok)
    expect(response.body).to include("うちのこになるまで")
    expect(response.body).to include("準備をはじめる")
    expect(response.body).to include('data-controller="landing"')
    expect(response.body).to include(local_tasks_path)
  end
end
