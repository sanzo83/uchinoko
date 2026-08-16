import { Controller } from "@hotwired/stimulus"

const STORAGE_KEY = "tasksan.local-tasks.v1"
const CAT_CHECKLIST = [
  { group: "お迎え前", title: "ケージ・トイレ・ごはん・水を用意する" },
  { group: "お迎え前", title: "キャリーケースを用意する" },
  { group: "お迎え前", title: "窓・網戸・玄関まわりの脱走対策を確認する" },
  { group: "お迎え前", title: "かかりつけ病院と夜間病院を調べる" },
  { group: "お迎え前", title: "先住動物がいる場合の隔離場所を作る" },
  { group: "お迎え当日", title: "静かな部屋にケージを設置する" },
  { group: "お迎え当日", title: "ごはん・水・トイレの場所を確認する" },
  { group: "お迎え当日", title: "隠れられる場所を用意する" },
  { group: "お迎え当日", title: "保護主さんから聞いたごはん量・投薬をメモする" },
  { group: "トライアル中", title: "食事・排泄・体調を毎日記録する" },
  { group: "トライアル中", title: "写真を撮る" },
  { group: "トライアル中", title: "気になったことを保護主さんへ相談する" },
  { group: "トライアル中", title: "1日の報告を送る" }
]
const GROUP_ORDER = ["お迎え前", "お迎え当日", "トライアル中", "ほか"]

export default class extends Controller {
  static targets = ["title", "note", "list", "empty", "count", "backupFile", "backupNotice", "presetNotice"]

  connect() {
    this.filterName = "open"
    this.tasks = this.load()
    this.render()
  }

  add(event) {
    event.preventDefault()
    const title = this.titleTarget.value.trim()
    if (!title) return

    this.tasks.unshift({
      id: crypto.randomUUID(),
      title,
      note: this.noteTarget.value.trim(),
      group: "ほか",
      completed: false,
      createdAt: new Date().toISOString()
    })
    this.save()
    event.target.reset()
    this.titleTarget.focus()
    this.render()
  }

  toggle(event) {
    const task = this.findTask(event.currentTarget.dataset.taskId)
    if (!task) return

    task.completed = event.currentTarget.checked
    this.save()
    this.render()
  }

  remove(event) {
    const task = this.findTask(event.currentTarget.dataset.taskId)
    if (!task || !window.confirm(`「${task.title}」を削除しますか？`)) return

    this.tasks = this.tasks.filter((item) => item.id !== task.id)
    this.save()
    this.render()
  }

  filter(event) {
    this.filterName = event.currentTarget.dataset.filter
    this.render()
  }

  addCatChecklist() {
    const existingTitles = new Set(this.tasks.map((task) => task.title))
    const additions = CAT_CHECKLIST
      .filter((task) => !existingTitles.has(task.title))
      .map((task) => ({ ...task, id: crypto.randomUUID(), note: "", completed: false, createdAt: new Date().toISOString() }))

    if (additions.length === 0) {
      this.presetNoticeTarget.textContent = "チェックリストはすでに追加されています。"
      return
    }

    this.tasks = [...additions, ...this.tasks]
    this.save()
    this.render()
    this.presetNoticeTarget.textContent = `${additions.length}件のチェックリストを追加しました。`
  }

  downloadBackup() {
    const backup = {
      format: "tasksan-local-tasks",
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks: this.tasks
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `tasksan-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    this.setBackupNotice("バックアップファイルを保存しました。")
  }

  async restoreBackup(event) {
    const [file] = event.target.files
    if (!file) return

    try {
      const backup = JSON.parse(await file.text())
      const tasks = this.validTasks(backup)
      if (!tasks || !window.confirm("今あるタスクをバックアップの内容で置き換えますか？")) return

      this.tasks = tasks
      this.save()
      this.render()
      this.setBackupNotice(`${tasks.length}件のタスクを復元しました。`)
    } catch {
      this.setBackupNotice("このファイルは読み込めませんでした。Tasksanのバックアップを選んでください。")
    } finally {
      this.backupFileTarget.value = ""
    }
  }

  render() {
    const visibleTasks = this.tasks.filter((task) => this.visible(task))
    this.listTarget.replaceChildren(...this.groupedTaskElements(visibleTasks))
    this.emptyTarget.hidden = visibleTasks.length > 0

    const remaining = this.tasks.filter((task) => !task.completed).length
    this.countTarget.textContent = remaining === 0 ? "完了！" : `あと ${remaining} 件`

    this.element.querySelectorAll("[data-filter]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.filter === this.filterName)
    })
  }

  groupedTaskElements(tasks) {
    return GROUP_ORDER.flatMap((group) => {
      const groupTasks = tasks.filter((task) => task.group === group)
      if (groupTasks.length === 0) return []

      const heading = document.createElement("li")
      heading.className = "task-group"
      heading.textContent = group
      return [heading, ...groupTasks.map((task) => this.taskElement(task))]
    })
  }

  taskElement(task) {
    const item = document.createElement("li")
    item.className = `task-card${task.completed ? " is-complete" : ""}`

    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    checkbox.className = "task-card__checkbox"
    checkbox.checked = task.completed
    checkbox.dataset.taskId = task.id
    checkbox.setAttribute("aria-label", `${task.title}を完了にする`)
    checkbox.addEventListener("change", (event) => this.toggle(event))

    const content = document.createElement("div")
    content.className = "task-card__content"
    const title = document.createElement("p")
    title.className = "task-card__title"
    title.textContent = task.title
    content.append(title)

    if (task.note) {
      const note = document.createElement("p")
      note.className = "task-card__note"
      note.textContent = task.note
      content.append(note)
    }

    const remove = document.createElement("button")
    remove.type = "button"
    remove.className = "task-card__remove"
    remove.textContent = "削除"
    remove.dataset.taskId = task.id
    remove.addEventListener("click", (event) => this.remove(event))

    item.append(checkbox, content, remove)
    return item
  }

  visible(task) {
    if (this.filterName === "all") return true
    return this.filterName === "done" ? task.completed : !task.completed
  }

  findTask(id) {
    return this.tasks.find((task) => task.id === id)
  }

  load() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
      if (!Array.isArray(stored)) return []

      const ids = new Set()
      return stored.map((task) => this.normalizeTask(task, ids)).filter(Boolean)
    } catch {
      return []
    }
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks))
  }

  validTasks(backup) {
    if (backup?.format !== "tasksan-local-tasks" || backup.version !== 1 || !Array.isArray(backup.tasks)) return null

    const ids = new Set()
    const tasks = backup.tasks.map((task) => this.normalizeTask(task, ids))
    return tasks.every(Boolean) ? tasks : null
  }

  normalizeTask(task, ids) {
    if (typeof task?.id !== "string" || ids.has(task.id) || typeof task.title !== "string" || !task.title.trim()) return null

    ids.add(task.id)
    return {
      id: task.id,
      title: task.title.trim().slice(0, 100),
      note: typeof task.note === "string" ? task.note.trim().slice(0, 500) : "",
      group: typeof task.group === "string" && GROUP_ORDER.includes(task.group) ? task.group : "ほか",
      completed: task.completed === true,
      createdAt: typeof task.createdAt === "string" ? task.createdAt : new Date().toISOString()
    }
  }

  setBackupNotice(message) {
    this.backupNoticeTarget.textContent = message
  }
}
