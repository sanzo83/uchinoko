import { Controller } from "@hotwired/stimulus"

const STORAGE_KEYS = ["tasksan.local-tasks.v1", "tasksan.daily-reports.v1"]

export default class extends Controller {
  static values = { todoUrl: String }

  connect() {
    if (STORAGE_KEYS.some((key) => this.hasStoredItems(key))) {
      window.location.replace(this.todoUrlValue)
    }
  }

  hasStoredItems(key) {
    try {
      const items = JSON.parse(localStorage.getItem(key) || "[]")
      return Array.isArray(items) && items.length > 0
    } catch {
      return false
    }
  }
}
