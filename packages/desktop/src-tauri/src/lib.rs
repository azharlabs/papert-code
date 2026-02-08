mod cli;
#[cfg(windows)]
mod job_object;
mod markdown;
mod window_customizer;

#[cfg(windows)]
use job_object::*;
use std::{
    collections::VecDeque,
    fs,
    net::TcpListener,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::{AppHandle, LogicalSize, Manager, RunEvent, State, WebviewWindowBuilder};
#[cfg(windows)]
use tauri_plugin_decorum::WebviewWindowExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

use crate::window_customizer::PinchZoomDisablePlugin;

#[derive(Clone, serde::Serialize)]
struct ServerReadyData {
    url: String,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AuthSettings {
    mode: Option<String>,
    admin_url: Option<String>,
    admin_email: Option<String>,
    admin_password: Option<String>,
    admin_token: Option<String>,
    open_ai_api_key: Option<String>,
    open_ai_base_url: Option<String>,
    open_ai_model: Option<String>,
}

#[derive(Clone)]
struct ServerState {
    child: Arc<Mutex<Option<CommandChild>>>,
}

impl ServerState {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
        }
    }

    pub fn set_child(&self, child: Option<CommandChild>) {
        *self.child.lock().unwrap() = child;
    }
}

#[derive(Clone)]
struct LogState(Arc<Mutex<VecDeque<String>>>);

const MAX_LOG_ENTRIES: usize = 200;

#[tauri::command]
fn kill_sidecar(app: AppHandle) {
    let Some(server_state) = app.try_state::<ServerState>() else {
        println!("Server not running");
        return;
    };

    let Some(server_state) = server_state
        .child
        .lock()
        .expect("Failed to acquire mutex lock")
        .take()
    else {
        println!("Server state missing");
        return;
    };

    let _ = server_state.kill();

    println!("Killed server");
}

fn kill_active_sidecar(app: &AppHandle) {
    let Some(server_state) = app.try_state::<ServerState>() else {
        return;
    };

    if let Some(child) = server_state
        .child
        .lock()
        .expect("Failed to acquire mutex lock")
        .take()
    {
        let _ = child.kill();
    }
}

async fn get_logs(app: AppHandle) -> Result<String, String> {
    let log_state = app.try_state::<LogState>().ok_or("Log state not found")?;

    let logs = log_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire log lock")?;

    Ok(logs.iter().cloned().collect::<Vec<_>>().join(""))
}

fn normalize_workspace_path(project_path: &str) -> Result<String, String> {
    let path = project_path.trim();
    if path.is_empty() {
        return Err("Project folder is required".to_string());
    }

    let canonical = std::fs::canonicalize(path)
        .map_err(|e| format!("Unable to access folder: {e}"))?;
    if !canonical.is_dir() {
        return Err("Selected path is not a folder".to_string());
    }
    canonical
        .to_str()
        .map(|v| v.to_string())
        .ok_or("Folder path is not valid UTF-8".to_string())
}

fn parse_env_content(content: &str) -> std::collections::HashMap<String, String> {
    let mut values = std::collections::HashMap::new();
    for raw_line in content.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let mut parts = line.splitn(2, '=');
        let Some(key) = parts.next().map(|v| v.trim()) else {
            continue;
        };
        let Some(value_raw) = parts.next().map(|v| v.trim()) else {
            continue;
        };
        if key.is_empty() {
            continue;
        }
        let value = value_raw
            .trim_matches('"')
            .trim_matches('\'')
            .to_string();
        values.insert(key.to_string(), value);
    }
    values
}

fn load_env_chain(start_dir: &Path) -> std::collections::HashMap<String, String> {
    let mut merged = std::collections::HashMap::new();
    let mut current = Some(start_dir.to_path_buf());
    while let Some(dir) = current {
        let papert_env = dir.join(".papert").join(".env");
        let root_env = dir.join(".env");
        for path in [papert_env, root_env] {
            if let Ok(content) = fs::read_to_string(&path) {
                for (k, v) in parse_env_content(&content) {
                    merged.entry(k).or_insert(v);
                }
            }
        }
        current = dir.parent().map(|p| p.to_path_buf());
    }
    merged
}

fn load_settings_auth(
    start_dir: &Path,
) -> (Option<String>, Option<String>, Option<String>, Option<String>) {
    let settings_path = start_dir.join(".papert").join("settings.json");
    let Ok(raw) = fs::read_to_string(settings_path) else {
        return (None, None, None, None);
    };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return (None, None, None, None);
    };
    let auth = value
        .get("security")
        .and_then(|v| v.get("auth"))
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    let selected_type = auth
        .get("selectedType")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
    let enforced_type = auth
        .get("enforcedType")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
    let api_key = auth
        .get("apiKey")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
    let base_url = auth
        .get("baseUrl")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
    (selected_type, enforced_type, api_key, base_url)
}

#[tauri::command]
fn detect_auth_defaults(project_path: Option<String>) -> Result<AuthSettings, String> {
    let start_dir = if let Some(path) = project_path {
        PathBuf::from(path)
    } else {
        std::env::current_dir().map_err(|e| format!("Unable to detect current dir: {e}"))?
    };
    let env_values = load_env_chain(&start_dir);
    let (selected_type, enforced_type, settings_api_key, settings_base_url) =
        load_settings_auth(&start_dir);
    let env_get = |key: &str| -> Option<String> {
        env_values
            .get(key)
            .cloned()
            .or_else(|| std::env::var(key).ok())
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty())
    };

    let open_ai_api_key = settings_api_key
        .or_else(|| env_get("OPENAI_API_KEY"))
        .unwrap_or_default();
    let open_ai_base_url = settings_base_url
        .or_else(|| env_get("OPENAI_BASE_URL"))
        .unwrap_or_default();
    let open_ai_model = env_get("OPENAI_MODEL")
        .or_else(|| env_get("PAPERT_MODEL"))
        .unwrap_or_default();

    let admin_url = env_get("PAPERT_ADMIN_URL").unwrap_or_default();
    let admin_email = env_get("PAPERT_ADMIN_EMAIL").unwrap_or_default();
    let admin_password = env_get("PAPERT_ADMIN_PASSWORD").unwrap_or_default();
    let admin_token = env_get("PAPERT_ADMIN_TOKEN").unwrap_or_default();

    let auth_type = enforced_type.or(selected_type).unwrap_or_default();
    let mode = if auth_type == "openai" || !open_ai_api_key.is_empty() {
        Some("openai".to_string())
    } else if !admin_url.is_empty()
        || !admin_email.is_empty()
        || !admin_password.is_empty()
        || !admin_token.is_empty()
        || env_get("PAPERT_OAUTH").is_some()
    {
        Some("admin".to_string())
    } else {
        None
    };

    Ok(AuthSettings {
        mode,
        admin_url: if admin_url.is_empty() {
            None
        } else {
            Some(admin_url)
        },
        admin_email: if admin_email.is_empty() {
            None
        } else {
            Some(admin_email)
        },
        admin_password: if admin_password.is_empty() {
            None
        } else {
            Some(admin_password)
        },
        admin_token: if admin_token.is_empty() {
            None
        } else {
            Some(admin_token)
        },
        open_ai_api_key: if open_ai_api_key.is_empty() {
            None
        } else {
            Some(open_ai_api_key)
        },
        open_ai_base_url: if open_ai_base_url.is_empty() {
            None
        } else {
            Some(open_ai_base_url)
        },
        open_ai_model: if open_ai_model.is_empty() {
            None
        } else {
            Some(open_ai_model)
        },
    })
}

#[tauri::command]
async fn start_project_server(
    app: AppHandle,
    state: State<'_, ServerState>,
    project_path: String,
    auth_settings: Option<AuthSettings>,
) -> Result<ServerReadyData, String> {
    if let Some(log_state) = app.try_state::<LogState>() {
        if let Ok(mut logs) = log_state.0.lock() {
            logs.clear();
        }
    }

    let workspace_root = normalize_workspace_path(&project_path)?;
    kill_active_sidecar(&app);

    let local_port = get_sidecar_port();
    let hostname = "127.0.0.1";
    let local_url = format!("http://{hostname}:{local_port}");

    match spawn_local_server(&app, hostname, local_port, &workspace_root, auth_settings).await {
        Ok(child) => {
            #[cfg(windows)]
            {
                let job_state = app.state::<JobObjectState>();
                job_state.assign_pid(child.pid());
            }
            state.set_child(Some(child));
            Ok(ServerReadyData { url: local_url })
        }
        Err(err) => Err(err),
    }
}

#[tauri::command]
fn stop_project_server(app: AppHandle) {
    kill_active_sidecar(&app)
}

fn get_sidecar_port() -> u32 {
    if let Some(port) = option_env!("PAPERT_PORT")
        .map(|s| s.to_string())
        .or_else(|| std::env::var("PAPERT_PORT").ok())
        .and_then(|port_str| port_str.parse().ok())
    {
        return port;
    }

    TcpListener::bind("127.0.0.1:0")
        .ok()
        .and_then(|listener| listener.local_addr().ok().map(|addr| u32::from(addr.port())))
        .unwrap_or(41242)
}

fn spawn_sidecar(
    app: &AppHandle,
    hostname: &str,
    port: u32,
    workspace_root: &str,
    auth_settings: Option<AuthSettings>,
) -> CommandChild {
    let log_state = app.state::<LogState>();
    let log_state_clone = log_state.inner().clone();

    println!("spawning sidecar on port {port}");

    let (mut rx, child) = cli::create_server_command(
        app,
        hostname,
        port,
        workspace_root,
        auth_settings.as_ref(),
    )
        .spawn()
        .expect("Failed to spawn papert");

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    print!("{line}");

                    // Store log in shared state
                    if let Ok(mut logs) = log_state_clone.0.lock() {
                        logs.push_back(format!("[STDOUT] {}", line));
                        while logs.len() > MAX_LOG_ENTRIES {
                            logs.pop_front();
                        }
                    }
                }
                CommandEvent::Stderr(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    eprint!("{line}");

                    // Store log in shared state
                    if let Ok(mut logs) = log_state_clone.0.lock() {
                        logs.push_back(format!("[STDERR] {}", line));
                        while logs.len() > MAX_LOG_ENTRIES {
                            logs.pop_front();
                        }
                    }
                }
                _ => {}
            }
        }
    });

    child
}

fn url_is_localhost(url: &reqwest::Url) -> bool {
    url.host_str().is_some_and(|host| {
        host.eq_ignore_ascii_case("localhost")
            || host
                .parse::<std::net::IpAddr>()
                .is_ok_and(|ip| ip.is_loopback())
    })
}

async fn check_server_health(url: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(url) else {
        return false;
    };

    let mut builder = reqwest::Client::builder().timeout(Duration::from_secs(3));

    if url_is_localhost(&url) {
        builder = builder.no_proxy();
    };

    let Ok(client) = builder.build() else {
        return false;
    };
    let endpoints = ["/api/v1/health", "/.well-known/agent-card.json", "/"];
    for endpoint in endpoints {
        let Ok(probe_url) = url.join(endpoint) else {
            continue;
        };
        let ok = client
            .get(probe_url)
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false);
        if ok {
            return true;
        }
    }

    false
}

fn extract_started_port(logs: &str) -> Option<u32> {
    for line in logs.lines().rev() {
        let marker = "Agent Server started on http://localhost:";
        if let Some(index) = line.find(marker) {
            let value = &line[index + marker.len()..];
            let port_text = value
                .chars()
                .take_while(|char| char.is_ascii_digit())
                .collect::<String>();
            if let Ok(port) = port_text.parse::<u32>() {
                return Some(port);
            }
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let updater_enabled = option_env!("TAURI_SIGNING_PRIVATE_KEY").is_some();

    #[cfg(all(target_os = "macos", not(debug_assertions)))]
    let _ = std::process::Command::new("killall")
        .arg("papert-cli")
        .output();

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        .plugin(tauri_plugin_os::init())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        - tauri_plugin_window_state::StateFlags::DECORATIONS,
                )
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(PinchZoomDisablePlugin)
        .plugin(tauri_plugin_decorum::init())
        .invoke_handler(tauri::generate_handler![
            kill_sidecar,
            start_project_server,
            stop_project_server,
            detect_auth_defaults,
            markdown::parse_markdown_command
        ])
        .setup(move |app| {
            let app = app.handle().clone();

            app.manage(LogState(Arc::new(Mutex::new(VecDeque::new()))));

            #[cfg(windows)]
            app.manage(JobObjectState::new());

            let primary_monitor = app.primary_monitor().ok().flatten();
            let size = primary_monitor
                .map(|m| m.size().to_logical(m.scale_factor()))
                .unwrap_or(LogicalSize::new(1920, 1080));

            let config = app
                .config()
                .app
                .windows
                .iter()
                .find(|w| w.label == "main")
                .expect("main window config missing");

            let window_builder = WebviewWindowBuilder::from_config(&app, config)
                .expect("Failed to create window builder from config")
                .inner_size(size.width as f64, size.height as f64)
                .initialization_script(format!(
                    r#"
                      window.__PAPERT__ ??= {{}};
                      window.__PAPERT__.updaterEnabled = {updater_enabled};
                    "#
                ));

            #[cfg(target_os = "macos")]
            let window_builder = window_builder
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .hidden_title(true);

            #[cfg(windows)]
            let window_builder = window_builder.decorations(false);

            let _window = window_builder.build().expect("Failed to create window");

            #[cfg(windows)]
            let _ = _window.create_overlay_titlebar();

            app.manage(ServerState::new());

            Ok(())
        });

    if updater_enabled {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                println!("Received Exit");
                kill_active_sidecar(&app.clone());
            }
        });
}

async fn spawn_local_server(
    app: &AppHandle,
    hostname: &str,
    port: u32,
    workspace_root: &str,
    auth_settings: Option<AuthSettings>,
) -> Result<CommandChild, String> {
    let child = spawn_sidecar(app, hostname, port, workspace_root, auth_settings);
    let requested_url = format!("http://{hostname}:{port}");
    let localhost_url = format!("http://localhost:{port}");

    let timestamp = Instant::now();
    loop {
        if timestamp.elapsed() > Duration::from_secs(30) {
            break Err(format!(
                "Failed to spawn Papert Code server. Logs:\n{}",
                get_logs(app.clone()).await.unwrap_or_default()
            ));
        }

        tokio::time::sleep(Duration::from_millis(10)).await;

        if check_server_health(&requested_url).await || check_server_health(&localhost_url).await {
            println!("Server ready after {:?}", timestamp.elapsed());
            break Ok(child);
        }

        if let Ok(logs) = get_logs(app.clone()).await {
            if let Some(started_port) = extract_started_port(&logs) {
                let started_url = format!("http://127.0.0.1:{started_port}");
                if check_server_health(&started_url).await {
                    println!(
                        "Server ready on discovered port {} after {:?}",
                        started_port,
                        timestamp.elapsed()
                    );
                    break Ok(child);
                }
            }
        }
    }
}
