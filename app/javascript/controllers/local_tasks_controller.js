import { Controller } from "@hotwired/stimulus"

const STORAGE_KEY = "tasksan.local-tasks.v1"
const REPORT_STORAGE_KEY = "tasksan.daily-reports.v1"
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
  static targets = ["title", "note", "list", "empty", "count", "backupFile", "backupNotice", "presetNotice", "reportDate", "reportFood", "reportToilet", "reportCondition", "reportNote", "reportQuestion", "reportList", "reportEmpty", "reportCount", "reportNotice"]

  connect() {
    this.filterName = "open"
    this.tasks = this.load()
    this.reports = this.loadReports()
    this.reportDateTarget.value = this.today()
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

  addReport(event) {
    event.preventDefault()
    const report = {
      id: crypto.randomUUID(),
      date: this.reportDateTarget.value,
      food: this.reportFoodTarget.value.trim(),
      toilet: this.reportToiletTarget.value.trim(),
      condition: this.reportConditionTarget.value.trim(),
      note: this.reportNoteTarget.value.trim(),
      question: this.reportQuestionTarget.value.trim(),
      createdAt: new Date().toISOString()
    }

    if (!report.date || !this.reportHasContent(report)) {
      this.setReportNotice("日付と、少なくともひとつの記録を入力してください。")
      return
    }

    this.reports.unshift(report)
    this.saveReports()
    event.target.reset()
    this.reportDateTarget.value = this.today()
    this.renderReports()
    this.setReportNotice("報告を保存しました。送信用の文章を確認してコピーできます。")
  }

  async copyReport(event) {
    const report = this.findReport(event.currentTarget.dataset.reportId)
    if (!report) return

    const text = this.reportText(report)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = text
      textarea.setAttribute("readonly", "")
      textarea.style.position = "fixed"
      textarea.style.opacity = "0"
      document.body.append(textarea)
      textarea.select()
      document.execCommand("copy")
      textarea.remove()
    }
    this.setReportNotice("送信用の文章をコピーしました。LINEなどに貼り付けて送れます。")
  }

  removeReport(event) {
    const report = this.findReport(event.currentTarget.dataset.reportId)
    if (!report || !window.confirm(`${this.formatDate(report.date)}の報告を削除しますか？`)) return

    this.reports = this.reports.filter((item) => item.id !== report.id)
    this.saveReports()
    this.renderReports()
    this.setReportNotice("報告を削除しました。")
  }

  downloadBackup() {
    const backup = {
      format: "tasksan-local-tasks",
      version: 2,
      exportedAt: new Date().toISOString(),
      tasks: this.tasks,
      reports: this.reports
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
      const restored = this.validBackup(backup)
      if (!restored || !window.confirm("今あるタスクと報告をバックアップの内容で置き換えますか？")) return

      this.tasks = restored.tasks
      this.reports = restored.reports
      this.save()
      this.saveReports()
      this.render()
      this.setBackupNotice(`${this.tasks.length}件のタスクと${this.reports.length}件の報告を復元しました。`)
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
    this.renderReports()
  }

  renderReports() {
    const reports = [...this.reports].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    this.reportListTarget.replaceChildren(...reports.map((report) => this.reportElement(report)))
    this.reportEmptyTarget.hidden = reports.length > 0
    this.reportCountTarget.textContent = reports.length === 0 ? "" : `${reports.length}件`
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

  reportElement(report) {
    const item = document.createElement("li")
    item.className = "report-card"

    const header = document.createElement("div")
    header.className = "report-card__header"
    const date = document.createElement("h3")
    date.className = "report-card__date"
    date.textContent = this.formatDate(report.date)
    const remove = document.createElement("button")
    remove.type = "button"
    remove.className = "task-card__remove"
    remove.textContent = "削除"
    remove.dataset.reportId = report.id
    remove.addEventListener("click", (event) => this.removeReport(event))
    header.append(date, remove)

    const details = document.createElement("details")
    details.className = "report-card__preview"
    const summary = document.createElement("summary")
    summary.textContent = "送信用の文章を確認"
    const text = document.createElement("p")
    text.className = "report-card__text"
    text.textContent = this.reportText(report)
    details.append(summary, text)

    const copy = document.createElement("button")
    copy.type = "button"
    copy.className = "button button--secondary report-card__copy"
    copy.textContent = "文章をコピー"
    copy.dataset.reportId = report.id
    copy.addEventListener("click", (event) => this.copyReport(event))

    item.append(header, details, copy)
    return item
  }

  visible(task) {
    if (this.filterName === "all") return true
    return this.filterName === "done" ? task.completed : !task.completed
  }

  findTask(id) {
    return this.tasks.find((task) => task.id === id)
  }

  findReport(id) {
    return this.reports.find((report) => report.id === id)
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

  loadReports() {
    try {
      const stored = JSON.parse(localStorage.getItem(REPORT_STORAGE_KEY) || "[]")
      if (!Array.isArray(stored)) return []

      const ids = new Set()
      return stored.map((report) => this.normalizeReport(report, ids)).filter(Boolean)
    } catch {
      return []
    }
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks))
  }

  saveReports() {
    localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(this.reports))
  }

  validBackup(backup) {
    if (backup?.format !== "tasksan-local-tasks" || ![1, 2].includes(backup.version)) return null

    const tasks = this.validTasks(backup.tasks)
    const reports = backup.version === 1 ? [] : this.validReports(backup.reports)
    return tasks && reports ? { tasks, reports } : null
  }

  validTasks(tasksToValidate) {
    if (!Array.isArray(tasksToValidate)) return null

    const ids = new Set()
    const tasks = tasksToValidate.map((task) => this.normalizeTask(task, ids))
    return tasks.every(Boolean) ? tasks : null
  }

  validReports(reportsToValidate) {
    if (!Array.isArray(reportsToValidate)) return null

    const ids = new Set()
    const reports = reportsToValidate.map((report) => this.normalizeReport(report, ids))
    return reports.every(Boolean) ? reports : null
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

  normalizeReport(report, ids) {
    if (typeof report?.id !== "string" || ids.has(report.id) || !this.validDate(report.date)) return null

    const normalized = {
      id: report.id,
      date: report.date,
      food: this.shortText(report.food),
      toilet: this.shortText(report.toilet),
      condition: this.shortText(report.condition),
      note: this.shortText(report.note),
      question: this.shortText(report.question),
      createdAt: typeof report.createdAt === "string" ? report.createdAt : new Date().toISOString()
    }
    if (!this.reportHasContent(normalized)) return null

    ids.add(report.id)
    return normalized
  }

  reportText(report) {
    const lines = [
      `${this.formatDate(report.date)}のご報告です。`,
      report.food && `・食事・水分：${report.food}`,
      report.toilet && `・排泄：${report.toilet}`,
      report.condition && `・元気・体調：${report.condition}`,
      report.note && `・今日の様子：${report.note}`,
      report.question && `・相談したいこと：${report.question}`,
      "よろしくお願いします。"
    ].filter(Boolean)

    return `${lines.slice(0, 1).join("\n")}\n\n${lines.slice(1, -1).join("\n")}\n\n${lines.at(-1)}`
  }

  reportHasContent(report) {
    return [report.food, report.toilet, report.condition, report.note, report.question].some(Boolean)
  }

  shortText(value) {
    return typeof value === "string" ? value.trim().slice(0, 500) : ""
  }

  validDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  }

  formatDate(value) {
    const [year, month, day] = value.split("-").map(Number)
    return `${year}年${month}月${day}日`
  }

  today() {
    const now = new Date()
    const offset = now.getTimezoneOffset() * 60_000
    return new Date(now.getTime() - offset).toISOString().slice(0, 10)
  }

  setBackupNotice(message) {
    this.backupNoticeTarget.textContent = message
  }

  setReportNotice(message) {
    this.reportNoticeTarget.textContent = message
  }
}
