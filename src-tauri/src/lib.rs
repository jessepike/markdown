use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use std::fs;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;
use tauri::{AppHandle, Manager, State};

#[derive(serde::Serialize)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
}

struct LaunchFile(Mutex<Option<String>>);
struct FileWatcher(Mutex<Option<RecommendedWatcher>>);

#[tauri::command]
fn get_launch_file(state: State<LaunchFile>) -> Option<String> {
    let mut file = state.0.lock().unwrap();
    file.take()
}

#[tauri::command]
fn watch_file(app: AppHandle, state: State<'_, FileWatcher>, path: String) -> Result<(), String> {
    let mut watcher_lock = state.0.lock().map_err(|e| e.to_string())?;

    // Stop existing watcher simply by dropping it (setting to None)
    *watcher_lock = None;

    if path.is_empty() {
        return Ok(());
    }

    let path_str = path.clone();
    let app_handle = app.clone();

    let mut watcher =
        notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
            match res {
                Ok(_event) => {
                    // Simple debounce or check kind?
                    // For now, any event on the file triggers reload prompt
                    // Ideally filter for Modify(Data) or Rename(To)
                    // But let's just emit and let frontend debounce/handle
                    let _ = app_handle.emit("file-changed", path_str.clone());
                }
                Err(e) => println!("watch error: {:?}", e),
            }
        })
        .map_err(|e| e.to_string())?;

    let p = std::path::Path::new(&path);
    if p.exists() {
        watcher
            .watch(p, RecursiveMode::NonRecursive)
            .map_err(|e| e.to_string())?;
        *watcher_lock = Some(watcher);
    }

    Ok(())
}

#[tauri::command]
fn read_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();
    let paths = fs::read_dir(path).map_err(|e| e.to_string())?;

    for path in paths {
        let path = path.map_err(|e| e.to_string())?;
        let file_type = path.file_type().map_err(|e| e.to_string())?;
        let entry = FileEntry {
            name: path.file_name().to_string_lossy().to_string(),
            path: path.path().to_string_lossy().to_string(),
            is_dir: file_type.is_dir(),
        };
        // Filter hidden files? For now, include everything except .DS_Store maybe?
        if entry.name != ".DS_Store" {
            entries.push(entry);
        }
    }

    // Sort: Directories first, then files
    entries.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else {
            b.is_dir.cmp(&a.is_dir)
        }
    });

    Ok(entries)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .manage(LaunchFile(Mutex::new(None)))
        .manage(FileWatcher(Mutex::new(None)))
        .setup(|app| {
            let new_i = MenuItem::with_id(app, "new", "&New File", true, Some("CmdOrCtrl+N"))?;
            let open_i = MenuItem::with_id(app, "open", "&Open", true, Some("CmdOrCtrl+O"))?;
            let save_i = MenuItem::with_id(app, "save", "&Save", true, Some("CmdOrCtrl+S"))?;
            let save_as_i = MenuItem::with_id(
                app,
                "save_as",
                "Save &As...",
                true,
                Some("CmdOrCtrl+Shift+S"),
            )?;
            let open_recent_i =
                MenuItem::with_id(app, "open_recent", "Open &Recent...", true, None::<&str>)?;
            let close_recent_i = MenuItem::with_id(
                app,
                "close_recent",
                "Clear Recent History",
                true,
                None::<&str>,
            )?;

            let open_folder_i = MenuItem::with_id(
                app,
                "open_folder",
                "Open &Folder...",
                true,
                Some("CmdOrCtrl+Shift+O"),
            )?;

            let export_html_i =
                MenuItem::with_id(app, "export_html", "Export to &HTML...", true, None::<&str>)?;

            let export_pdf_i =
                MenuItem::with_id(app, "export_pdf", "Export to &PDF...", true, None::<&str>)?;

            let export_docx_i =
                MenuItem::with_id(app, "export_docx", "Export to &DOCX...", true, None::<&str>)?;

            let export_menu = Submenu::with_items(
                app,
                "Export",
                true,
                &[&export_html_i, &export_pdf_i, &export_docx_i],
            )?;

            let sync_scroll_i = tauri::menu::CheckMenuItemBuilder::new("Synchronized Scrolling")
                .id("sync_scroll")
                .checked(true) // Default to true
                .build(app)?;

            let render_fm_i = tauri::menu::CheckMenuItemBuilder::new("Render Frontmatter")
                .id("render_fm")
                .checked(true) // Default to true
                .build(app)?;

            // Theme Items
            let theme_system_i =
                MenuItem::with_id(app, "theme_system", "System", true, None::<&str>)?;
            let theme_light_i = MenuItem::with_id(app, "theme_light", "Light", true, None::<&str>)?;
            let theme_dark_i = MenuItem::with_id(app, "theme_dark", "Dark", true, None::<&str>)?;

            let theme_menu = Submenu::with_items(
                app,
                "Theme",
                true,
                &[&theme_system_i, &theme_light_i, &theme_dark_i],
            )?;

            let prefs_i = MenuItem::with_id(
                app,
                "preferences",
                "Preferences...",
                true,
                Some("CmdOrCtrl+,"),
            )?;

            let app_menu = Submenu::with_items(
                app,
                "AgentPad",
                true,
                &[
                    &PredefinedMenuItem::about(app, None, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &prefs_i,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::show_all(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, None)?,
                ],
            )?;

            let file_menu = Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &new_i,
                    &open_i,
                    &open_folder_i,
                    &open_recent_i,
                    &close_recent_i,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::close_window(app, Some("Close"))?,
                    &save_i,
                    &save_as_i,
                    &PredefinedMenuItem::separator(app)?,
                    &export_menu,
                ],
            )?;

            let menu = Menu::with_items(
                app,
                &[
                    &app_menu,
                    &file_menu,
                    // Add default standard menus for macOS to ensure standard behavior (Copy/Paste etc)
                    &Submenu::with_items(
                        app,
                        "Edit",
                        true,
                        &[
                            &PredefinedMenuItem::undo(app, None)?,
                            &PredefinedMenuItem::redo(app, None)?,
                            &PredefinedMenuItem::separator(app)?,
                            &PredefinedMenuItem::cut(app, None)?,
                            &PredefinedMenuItem::copy(app, None)?,
                            &MenuItem::with_id(
                                app,
                                "copy_llm",
                                "Copy for LLM",
                                true,
                                Some("CmdOrCtrl+Shift+C"),
                            )?,
                            &MenuItem::with_id(
                                app,
                                "copy_rich_text",
                                "Copy as &Rich Text",
                                true,
                                None::<&str>,
                            )?,
                            &PredefinedMenuItem::paste(app, None)?,
                            &PredefinedMenuItem::select_all(app, None)?,
                            &PredefinedMenuItem::separator(app)?,
                            &MenuItem::with_id(
                                app,
                                "normalize",
                                "Normalize",
                                true,
                                Some("CmdOrCtrl+Shift+N"),
                            )?,
                        ],
                    )?,
                    &Submenu::with_items(
                        app,
                        "View",
                        true,
                        &[
                            &PredefinedMenuItem::fullscreen(app, None)?,
                            &sync_scroll_i,
                            &render_fm_i,
                            &PredefinedMenuItem::separator(app)?,
                            &theme_menu,
                        ],
                    )?,
                    &Submenu::with_items(
                        app,
                        "Window",
                        true,
                        &[
                            &PredefinedMenuItem::minimize(app, None)?,
                            &PredefinedMenuItem::close_window(app, None)?,
                        ],
                    )?,
                ],
            )?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                if event.id() == new_i.id() {
                    app_handle.emit("menu-new", ()).unwrap();
                } else if event.id() == open_i.id() {
                    app_handle.emit("menu-open", ()).unwrap();
                } else if event.id() == open_folder_i.id() {
                    app_handle.emit("menu-open-folder", ()).unwrap();
                } else if event.id() == save_i.id() {
                    app_handle.emit("menu-save", ()).unwrap();
                } else if event.id() == save_as_i.id() {
                    app_handle.emit("menu-save-as", ()).unwrap();
                } else if event.id() == open_recent_i.id() {
                    app_handle.emit("menu-open-recent", ()).unwrap();
                } else if event.id() == close_recent_i.id() {
                    app_handle.emit("menu-close-recent", ()).unwrap();
                } else if event.id() == sync_scroll_i.id() {
                    let is_checked = sync_scroll_i.is_checked().unwrap_or(true);
                    app_handle.emit("toggle-sync-scroll", is_checked).unwrap();
                } else if event.id() == render_fm_i.id() {
                    let is_checked = render_fm_i.is_checked().unwrap_or(true);
                    app_handle.emit("toggle-frontmatter", is_checked).unwrap();
                } else if event.id() == "theme_system" {
                    app_handle.emit("menu-theme-system", ()).unwrap();
                } else if event.id() == "theme_light" {
                    app_handle.emit("menu-theme-light", ()).unwrap();
                } else if event.id() == "theme_dark" {
                    app_handle.emit("menu-theme-dark", ()).unwrap();
                } else if event.id() == prefs_i.id() {
                    app_handle.emit("menu-preferences", ()).unwrap();
                } else if event.id() == "normalize" {
                    app_handle.emit("menu-normalize", ()).unwrap();
                } else if event.id() == "copy_llm" {
                    app_handle.emit("menu-copy-llm", ()).unwrap();
                } else if event.id() == "export_html" {
                    app_handle.emit("menu-export-html", ()).unwrap();
                } else if event.id() == "export_pdf" {
                    app_handle.emit("menu-export-pdf", ()).unwrap();
                } else if event.id() == "export_docx" {
                    app_handle.emit("menu-export-docx", ()).unwrap();
                } else if event.id() == "copy_rich_text" {
                    app_handle.emit("menu-copy-rich-text", ()).unwrap();
                }
            });

            // Handle Launch Args (File Association) - Legacy/Backup check
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                if let Some(arg) = args
                    .iter()
                    .find(|a| a.ends_with(".md") || a.ends_with(".markdown"))
                {
                    // Store in state just in case
                    let state = app.state::<LaunchFile>();
                    *state.0.lock().unwrap() = Some(arg.clone());
                }
            }

            Ok(())
        })
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_launch_file,
            watch_file,
            read_dir
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|app_handle, event| match event {
        tauri::RunEvent::Opened { urls } => {
            if let Some(url) = urls.first() {
                if let Ok(file_path) = url.to_file_path() {
                    if let Some(path_str) = file_path.to_str() {
                        // 1. Store in State (for pull on fresh launch)
                        let state = app_handle.state::<LaunchFile>();
                        *state.0.lock().unwrap() = Some(path_str.to_string());

                        // 2. Emit Event (for hot focus if app already running)
                        let _ = app_handle.emit("file-opened-from-launch", path_str);

                        // 3. Focus Window
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.set_focus();
                        }
                    }
                }
            }
        }
        _ => {}
    });
}
