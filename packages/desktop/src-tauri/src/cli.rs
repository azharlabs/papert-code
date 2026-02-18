use tauri::{path::BaseDirectory, Manager};
use tauri_plugin_shell::{process::Command, ShellExt};
use std::path::PathBuf;
use crate::AuthSettings;

const CLI_BINARY_NAME: &str = "papert";
const CLI_SIDECAR_NAME: &str = "papert-cli";

fn get_sidecar_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    // Get binary with symlinks support
    tauri::process::current_binary(&app.env())
        .expect("Failed to get current binary")
        .parent()
        .expect("Failed to get parent dir")
        .join(CLI_SIDECAR_NAME)
}

fn get_user_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
}

fn sidecar_available(app: &tauri::AppHandle) -> bool {
    get_sidecar_path(app).exists()
}

fn server_candidate_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Ok(cwd) = std::env::current_dir() {
        roots.push(cwd);
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    roots.push(manifest_dir.clone());
    if let Some(parent) = manifest_dir.parent() {
        roots.push(parent.to_path_buf());
        if let Some(grand_parent) = parent.parent() {
            roots.push(grand_parent.to_path_buf());
            if let Some(great_grand_parent) = grand_parent.parent() {
                roots.push(great_grand_parent.to_path_buf());
            }
        }
    }

    roots
}

pub fn create_command(app: &tauri::AppHandle, args: &str) -> Command {
    let state_dir = app
        .path()
        .resolve("", BaseDirectory::AppLocalData)
        .expect("Failed to resolve app local data dir");

    #[cfg(target_os = "windows")]
    {
        if app.shell().sidecar(CLI_SIDECAR_NAME).is_ok() {
            return app
                .shell()
                .sidecar(CLI_SIDECAR_NAME)
                .unwrap()
                .args(args.split_whitespace())
                .env("PAPERT_CLIENT", "desktop")
                .env("XDG_STATE_HOME", &state_dir);
        }

        return app
            .shell()
            .command(CLI_BINARY_NAME)
            .args(args.split_whitespace())
            .env("PAPERT_CLIENT", "desktop")
            .env("XDG_STATE_HOME", &state_dir);
    }

    #[cfg(not(target_os = "windows"))]
    {
        if sidecar_available(app) {
            let sidecar = get_sidecar_path(app);
            let shell = get_user_shell();

            let cmd = if shell.ends_with("/nu") {
                format!("^\"{}\" {}", sidecar.display(), args)
            } else {
                format!("\"{}\" {}", sidecar.display(), args)
            };

            return app
                .shell()
                .command(&shell)
                .env("PAPERT_CLIENT", "desktop")
                .env("XDG_STATE_HOME", &state_dir)
                .args(["-il", "-c", &cmd]);
        }

        let shell = get_user_shell();
        let cmd = if shell.ends_with("/nu") {
            format!("^\"{}\" {}", CLI_BINARY_NAME, args)
        } else {
            format!("\"{}\" {}", CLI_BINARY_NAME, args)
        };

        app.shell()
            .command(&shell)
            .env("PAPERT_CLIENT", "desktop")
            .env("XDG_STATE_HOME", &state_dir)
            .args(["-il", "-c", &cmd])
    }
}

fn find_local_server_entrypoint() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    for root in server_candidate_roots() {
        candidates.push(root.join("packages/a2a-server/dist/src/http/server.js"));
        candidates.push(root.join("a2a-server/dist/src/http/server.js"));
    }

    candidates.into_iter().find(|path| path.exists())
}

fn find_local_server_source() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    for root in server_candidate_roots() {
        candidates.push(root.join("packages/a2a-server/src/http/server.ts"));
        candidates.push(root.join("a2a-server/src/http/server.ts"));
    }

    candidates.into_iter().find(|path| path.exists())
}

pub fn create_server_command(
    app: &tauri::AppHandle,
    hostname: &str,
    port: u32,
    workspace_root: &str,
    auth_settings: Option<&AuthSettings>,
) -> Command {
    let state_dir = app
        .path()
        .resolve("", BaseDirectory::AppLocalData)
        .expect("Failed to resolve app local data dir");

    let mut envs = vec![
        ("PAPERT_REMOTE_ENABLED", "1".to_string()),
        ("PAPERT_WEB_UI_ENABLED", "1".to_string()),
        ("PAPERT_WEB_UI_ALLOW_EMPTY_TOKEN", "1".to_string()),
        ("PAPERT_WEB_UI_DESKTOP_MODE", "1".to_string()),
        ("PAPERT_YOLO_MODE", "true".to_string()),
        ("PAPERT_REMOTE_SERVER_TOKEN", "".to_string()),
        ("PAPERT_REMOTE_SESSION_TTL_MS", "43200000".to_string()),
        ("PAPERT_REMOTE_DOCS_ENABLED", "0".to_string()),
        ("PAPERT_SHARE_PUBLIC_URL_BASE", "".to_string()),
        ("CODER_AGENT_PORT", port.to_string()),
        ("CODER_AGENT_HOST", hostname.to_string()),
        ("CODER_AGENT_WORKSPACE_PATH", workspace_root.to_string()),
        ("PAPERT_CLIENT", "desktop".to_string()),
        ("XDG_STATE_HOME", state_dir.to_string_lossy().to_string()),
    ];

    if let Some(auth) = auth_settings {
        let mode = auth.mode.as_deref().unwrap_or("admin");
        if mode.eq_ignore_ascii_case("openai") {
            if let Some(api_key) = auth.open_ai_api_key.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()) {
                envs.push(("OPENAI_API_KEY", api_key.to_string()));
            }
            if let Some(base_url) = auth.open_ai_base_url.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()) {
                envs.push(("OPENAI_BASE_URL", base_url.to_string()));
            }
            if let Some(model) = auth.open_ai_model.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()) {
                envs.push(("OPENAI_MODEL", model.to_string()));
                envs.push(("PAPERT_MODEL", model.to_string()));
            }
        } else {
            if let Some(admin_url) = auth.admin_url.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()) {
                envs.push(("PAPERT_ADMIN_URL", admin_url.to_string()));
            }
            if let Some(admin_email) = auth.admin_email.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()) {
                envs.push(("PAPERT_ADMIN_EMAIL", admin_email.to_string()));
            }
            if let Some(admin_password) = auth.admin_password.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()) {
                envs.push(("PAPERT_ADMIN_PASSWORD", admin_password.to_string()));
            }
            if let Some(admin_token) = auth.admin_token.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()) {
                envs.push(("PAPERT_ADMIN_TOKEN", admin_token.to_string()));
            }
            envs.push(("PAPERT_OAUTH", "1".to_string()));
        }
    }

    if let Some(entrypoint) = find_local_server_entrypoint() {
        eprintln!(
            "[desktop] Using local a2a-server dist entrypoint: {}",
            entrypoint.display()
        );
        let node = std::env::var("PAPERT_NODE_BINARY").unwrap_or_else(|_| "node".to_string());
        let mut cmd = app.shell().command(node);
        cmd = cmd.arg(entrypoint.to_string_lossy().to_string());
        cmd = cmd.current_dir(workspace_root);
        for (key, value) in envs.drain(..) {
            cmd = cmd.env(key, value);
        }
        return cmd;
    }

    if let Some(entrypoint) = find_local_server_source() {
        eprintln!(
            "[desktop] Using local a2a-server source entrypoint: {}",
            entrypoint.display()
        );
        let node = std::env::var("PAPERT_NODE_BINARY").unwrap_or_else(|_| "node".to_string());
        let mut cmd = app.shell().command(node);
        cmd = cmd.args([
            "--import".to_string(),
            "tsx".to_string(),
            entrypoint.to_string_lossy().to_string(),
        ]);
        cmd = cmd.current_dir(workspace_root);
        for (key, value) in envs.drain(..) {
            cmd = cmd.env(key, value);
        }
        return cmd;
    }

    let args = format!("web --host {hostname} --port {port}");
    eprintln!("[desktop] Falling back to external 'papert web' command");
    let mut cmd = create_command(app, &args);
    cmd = cmd.current_dir(workspace_root);
    for (key, value) in envs.drain(..) {
        cmd = cmd.env(key, value);
    }
    cmd
}
