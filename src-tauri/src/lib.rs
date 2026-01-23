use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

use std::sync::Mutex;
use tauri::{Manager, State};

struct LaunchFile(Mutex<Option<String>>);

#[tauri::command]
fn get_launch_file(state: State<LaunchFile>) -> Option<String> {
    let mut file = state.0.lock().unwrap();
    file.take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .manage(LaunchFile(Mutex::new(None)))
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

            let sync_scroll_i = tauri::menu::CheckMenuItemBuilder::new("Synchronized Scrolling")
                .id("sync_scroll")
                .checked(true) // Default to true
                .build(app)?;

            let render_fm_i = tauri::menu::CheckMenuItemBuilder::new("Render Frontmatter")
                .id("render_fm")
                .checked(true) // Default to true
                .build(app)?;

            let file_menu = Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &new_i,
                    &open_i,
                    &open_recent_i,
                    &close_recent_i,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::close_window(app, Some("Close"))?,
                    &save_i,
                    &save_as_i,
                ],
            )?;

            let menu = Menu::with_items(
                app,
                &[
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
                            &PredefinedMenuItem::paste(app, None)?,
                            &PredefinedMenuItem::select_all(app, None)?,
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
        .invoke_handler(tauri::generate_handler![get_launch_file])
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
