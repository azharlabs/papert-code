import "./webview-zoom"
import "./styles.css"

import { invoke } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"

import { createMenu } from "./menu"
import { runUpdater, UPDATER_ENABLED } from "./updater"

type ServerReadyData = { url: string }

type AuthMode = "admin" | "openai"

type AuthSettings = {
  mode: AuthMode
  adminUrl: string
  adminEmail: string
  adminPassword: string
  adminToken: string
  openAiApiKey: string
  openAiBaseUrl: string
  openAiModel: string
}

type Project = {
  id: string
  name: string
  path: string
  lastOpenedAt: number
}

type ThemeMode = "light" | "dark"

const PROJECTS_STORAGE_KEY = "papert.desktop.projects.v1"
const AUTH_STORAGE_KEY = "papert.desktop.auth.v1"
const THEME_STORAGE_KEY = "papert.desktop.theme.v1"

const projectsListEl = document.getElementById("projects-list")
const appShell = document.querySelector(".app-shell")
const toggleSidebarBtn = document.getElementById("toggle-sidebar-btn")
const newProjectBtn = document.getElementById("new-project-btn")
const updateAppBtn = document.getElementById("update-app-btn")
const authSettingsBtn = document.getElementById("auth-settings-btn")
const emptyState = document.getElementById("empty-state")
const emptyStateOpenBtn = document.getElementById("empty-state-open-btn")
const loadingCard = document.getElementById("loading-card")
const errorCard = document.getElementById("error-card")
const statusEl = document.getElementById("status")
const hintEl = document.getElementById("hint")
const errorTitle = document.getElementById("error-title")
const errorMessage = document.getElementById("error-message")
const errorDetails = document.getElementById("error-details")
const restartBtn = document.getElementById("restart-btn")
const webviewWrap = document.getElementById("webview-wrap")
const webview = document.getElementById("webview") as HTMLIFrameElement | null
const authModal = document.getElementById("auth-modal")
const authModalCloseBtn = document.getElementById("auth-modal-close-btn")
const authModalSaveBtn = document.getElementById("auth-modal-save-btn")
const authModalRefreshBtn = document.getElementById("auth-modal-refresh-btn")
const authModeSelect = document.getElementById("auth-mode-select") as HTMLSelectElement | null
const authAdminFields = document.getElementById("auth-admin-fields")
const authOpenAiFields = document.getElementById("auth-openai-fields")
const authAdminUrlInput = document.getElementById("auth-admin-url") as HTMLInputElement | null
const authAdminEmailInput = document.getElementById("auth-admin-email") as HTMLInputElement | null
const authAdminPasswordInput = document.getElementById("auth-admin-password") as HTMLInputElement | null
const authAdminTokenInput = document.getElementById("auth-admin-token") as HTMLInputElement | null
const authOpenAiApiKeyInput = document.getElementById("auth-openai-api-key") as HTMLInputElement | null
const authOpenAiBaseUrlInput = document.getElementById("auth-openai-base-url") as HTMLInputElement | null
const authOpenAiModelInput = document.getElementById("auth-openai-model") as HTMLInputElement | null
const themeToggleInput = document.getElementById("theme-toggle") as HTMLInputElement | null
const themeLabelEl = document.getElementById("theme-label")
const themeColorMetaEl = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null

let projects: Project[] = loadProjects()
let activeProjectId = ""
let isSidebarCollapsed = false
let authSettings = loadAuthSettings()
let themeMode: ThemeMode = loadThemeMode()

function defaultAuthSettings(): AuthSettings {
  return {
    mode: "admin",
    adminUrl: "",
    adminEmail: "",
    adminPassword: "",
    adminToken: "",
    openAiApiKey: "",
    openAiBaseUrl: "",
    openAiModel: "",
  }
}

function loadAuthSettings(): AuthSettings {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return defaultAuthSettings()
    const parsed = JSON.parse(raw) as Partial<AuthSettings>
    return {
      ...defaultAuthSettings(),
      ...parsed,
      mode: parsed.mode === "openai" ? "openai" : "admin",
    }
  } catch {
    return defaultAuthSettings()
  }
}

function saveAuthSettings() {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authSettings))
}

function loadThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    return raw === "dark" ? "dark" : "light"
  } catch {
    return "light"
  }
}

function saveThemeMode() {
  localStorage.setItem(THEME_STORAGE_KEY, themeMode)
}

function applyThemeMode() {
  document.documentElement.dataset.theme = themeMode
  if (themeToggleInput) themeToggleInput.checked = themeMode === "dark"
  if (themeLabelEl) themeLabelEl.textContent = themeMode === "dark" ? "Dark" : "Light"
  if (themeColorMetaEl) themeColorMetaEl.content = themeMode === "dark" ? "#101726" : "#f6f8fc"
  if (webview?.contentWindow) {
    webview.contentWindow.postMessage(
      {
        type: "papert.desktop.theme",
        theme: themeMode,
      },
      "*",
    )
  }
}

function hasAuthValues(settings: AuthSettings) {
  return Boolean(
    settings.adminUrl ||
      settings.adminEmail ||
      settings.adminPassword ||
      settings.adminToken ||
      settings.openAiApiKey ||
      settings.openAiBaseUrl ||
      settings.openAiModel,
  )
}

function mergeAuthSettings(current: AuthSettings, defaults: Partial<AuthSettings>): AuthSettings {
  const merged: AuthSettings = {
    mode: current.mode,
    adminUrl: current.adminUrl || defaults.adminUrl || "",
    adminEmail: current.adminEmail || defaults.adminEmail || "",
    adminPassword: current.adminPassword || defaults.adminPassword || "",
    adminToken: current.adminToken || defaults.adminToken || "",
    openAiApiKey: current.openAiApiKey || defaults.openAiApiKey || "",
    openAiBaseUrl: current.openAiBaseUrl || defaults.openAiBaseUrl || "",
    openAiModel: current.openAiModel || defaults.openAiModel || "",
  }
  if (!hasAuthValues(current) && (defaults.mode === "admin" || defaults.mode === "openai")) {
    merged.mode = defaults.mode
  }
  return merged
}

async function autoFillAuthFromProject(projectPath?: string) {
  try {
    const defaults = await invoke<Partial<AuthSettings>>("detect_auth_defaults", {
      projectPath: projectPath ?? null,
    })
    authSettings = mergeAuthSettings(authSettings, defaults || {})
    saveAuthSettings()
  } catch {
    // no-op
  }
}

function getAutofillProjectPath() {
  const active = projects.find((p) => p.id === activeProjectId)?.path
  if (active) return active
  const latest = [...projects].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)[0]
  return latest?.path
}

function applyAuthModeVisibility() {
  const mode = authModeSelect?.value === "openai" ? "openai" : "admin"
  authAdminFields?.classList.toggle("hidden", mode !== "admin")
  authOpenAiFields?.classList.toggle("hidden", mode !== "openai")
}

function hydrateAuthForm() {
  if (authModeSelect) authModeSelect.value = authSettings.mode
  if (authAdminUrlInput) authAdminUrlInput.value = authSettings.adminUrl
  if (authAdminEmailInput) authAdminEmailInput.value = authSettings.adminEmail
  if (authAdminPasswordInput) authAdminPasswordInput.value = authSettings.adminPassword
  if (authAdminTokenInput) authAdminTokenInput.value = authSettings.adminToken
  if (authOpenAiApiKeyInput) authOpenAiApiKeyInput.value = authSettings.openAiApiKey
  if (authOpenAiBaseUrlInput) authOpenAiBaseUrlInput.value = authSettings.openAiBaseUrl
  if (authOpenAiModelInput) authOpenAiModelInput.value = authSettings.openAiModel
  applyAuthModeVisibility()
}

function collectAuthForm(): AuthSettings {
  return {
    mode: authModeSelect?.value === "openai" ? "openai" : "admin",
    adminUrl: authAdminUrlInput?.value.trim() || "",
    adminEmail: authAdminEmailInput?.value.trim() || "",
    adminPassword: authAdminPasswordInput?.value || "",
    adminToken: authAdminTokenInput?.value.trim() || "",
    openAiApiKey: authOpenAiApiKeyInput?.value.trim() || "",
    openAiBaseUrl: authOpenAiBaseUrlInput?.value.trim() || "",
    openAiModel: authOpenAiModelInput?.value.trim() || "",
  }
}

async function openAuthModal() {
  await autoFillAuthFromProject(getAutofillProjectPath())
  hydrateAuthForm()
  authModal?.classList.remove("hidden")
}

function closeAuthModal() {
  authModal?.classList.add("hidden")
}

function updateSidebarToggleButton() {
  if (!toggleSidebarBtn) return
  toggleSidebarBtn.textContent = isSidebarCollapsed ? "▶" : "◀"
  toggleSidebarBtn.setAttribute("title", isSidebarCollapsed ? "Show projects" : "Hide projects")
  toggleSidebarBtn.setAttribute("aria-label", isSidebarCollapsed ? "Show projects" : "Hide projects")
}

function setStatus(text: string, hint?: string) {
  if (statusEl) statusEl.textContent = text
  if (hintEl && hint) hintEl.textContent = hint
}

function hideAllPanels() {
  emptyState?.classList.add("hidden")
  loadingCard?.classList.add("hidden")
  errorCard?.classList.add("hidden")
  webviewWrap?.classList.add("hidden")
}

function showEmptyState() {
  hideAllPanels()
  emptyState?.classList.remove("hidden")
}

function showLoading() {
  hideAllPanels()
  loadingCard?.classList.remove("hidden")
}

function showWebview(url: string) {
  hideAllPanels()
  if (webview) {
    const cacheBust = `${url.includes("?") ? "&" : "?"}desktop=1&theme=${themeMode}&t=${Date.now()}`
    webview.src = `${url}${cacheBust}`
  }
  webviewWrap?.classList.remove("hidden")
}

function showError(title: string, message: string, details?: string) {
  hideAllPanels()
  errorCard?.classList.remove("hidden")
  if (errorTitle) errorTitle.textContent = title
  if (errorMessage) errorMessage.textContent = message
  if (errorDetails) errorDetails.textContent = details ?? ""
}

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Project[]
    return parsed.filter((project) => project?.path && project?.name)
  } catch {
    return []
  }
}

function saveProjects() {
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects))
}

function projectNameFromPath(folderPath: string) {
  const normalized = folderPath.replace(/[\\/]+$/, "")
  const match = normalized.match(/[^\\/]+$/)
  return match?.[0] || folderPath
}

function renderProjects() {
  if (!projectsListEl) return
  projectsListEl.innerHTML = ""

  if (projects.length === 0) {
    const empty = document.createElement("div")
    empty.className = "project-path"
    empty.textContent = "No projects yet"
    projectsListEl.appendChild(empty)
    return
  }

  const sorted = [...projects].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
  sorted.forEach((project) => {
    const button = document.createElement("button")
    button.className = `project-item${project.id === activeProjectId ? " active" : ""}`
    button.type = "button"
    button.innerHTML = `<div class="project-name"></div><div class="project-path"></div>`

    const nameEl = button.querySelector(".project-name")
    const pathEl = button.querySelector(".project-path")
    if (nameEl) nameEl.textContent = project.name
    if (pathEl) pathEl.textContent = project.path

    button.addEventListener("click", () => {
      void openExistingProject(project.id)
    })
    projectsListEl.appendChild(button)
  })
}

function upsertProject(folderPath: string): Project {
  const existing = projects.find((project) => project.path === folderPath)
  if (existing) {
    existing.lastOpenedAt = Date.now()
    return existing
  }

  const project: Project = {
    id: crypto.randomUUID(),
    name: projectNameFromPath(folderPath),
    path: folderPath,
    lastOpenedAt: Date.now(),
  }
  projects.unshift(project)
  return project
}

async function openFolderPicker() {
  const selection = await open({ directory: true, multiple: false })
  if (!selection || Array.isArray(selection)) return

  const project = upsertProject(selection)
  activeProjectId = project.id
  saveProjects()
  renderProjects()
  await startProject(project)
}

async function openExistingProject(projectId: string) {
  const project = projects.find((candidate) => candidate.id === projectId)
  if (!project) return

  project.lastOpenedAt = Date.now()
  activeProjectId = project.id
  saveProjects()
  renderProjects()
  await startProject(project)
}

async function startProject(project: Project) {
  await autoFillAuthFromProject(project.path)
  setStatus(`Opening ${project.name}...`, "Starting local workspace services.")
  showLoading()

  try {
    const data = await invoke<ServerReadyData>("start_project_server", {
      projectPath: project.path,
      authSettings,
    })
    showWebview(data.url)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    showError(
      "Papert Code failed to open project",
      "The local server could not start for this folder. Verify access permissions and retry.",
      message,
    )
  }
}

restartBtn?.addEventListener("click", () => {
  if (!activeProjectId) return
  void openExistingProject(activeProjectId)
})

newProjectBtn?.addEventListener("click", () => {
  void openFolderPicker()
})

authSettingsBtn?.addEventListener("click", () => {
  void openAuthModal()
})

updateAppBtn?.addEventListener("click", () => {
  void runUpdater({ alertOnFail: true })
})

authModalCloseBtn?.addEventListener("click", () => {
  closeAuthModal()
})

authModalSaveBtn?.addEventListener("click", () => {
  authSettings = collectAuthForm()
  saveAuthSettings()
  closeAuthModal()
})

authModalRefreshBtn?.addEventListener("click", () => {
  void (async () => {
    await autoFillAuthFromProject(getAutofillProjectPath())
    hydrateAuthForm()
  })()
})

authModeSelect?.addEventListener("change", () => {
  applyAuthModeVisibility()
})

authModal?.addEventListener("click", (event) => {
  if (event.target === authModal) {
    closeAuthModal()
  }
})

toggleSidebarBtn?.addEventListener("click", () => {
  isSidebarCollapsed = !isSidebarCollapsed
  appShell?.classList.toggle("sidebar-collapsed", isSidebarCollapsed)
  updateSidebarToggleButton()
})

emptyStateOpenBtn?.addEventListener("click", () => {
  void openFolderPicker()
})

themeToggleInput?.addEventListener("change", () => {
  themeMode = themeToggleInput.checked ? "dark" : "light"
  saveThemeMode()
  applyThemeMode()
})

window.addEventListener("beforeunload", () => {
  void invoke("stop_project_server")
})

void createMenu().catch(() => undefined)
if (!UPDATER_ENABLED) {
  updateAppBtn?.classList.add("hidden")
}
renderProjects()
updateSidebarToggleButton()
applyThemeMode()
showEmptyState()
