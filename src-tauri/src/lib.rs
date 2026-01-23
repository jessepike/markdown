use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
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

            let file_menu = Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &open_i,
                    &open_recent_i,
                    &close_recent_i,
                    &PredefinedMenuItem::separator(app)?,
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
                        &[&PredefinedMenuItem::fullscreen(app, None)?],
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
                if event.id() == open_i.id() {
                    app_handle.emit("menu-open", ()).unwrap();
                } else if event.id() == save_i.id() {
                    app_handle.emit("menu-save", ()).unwrap();
                } else if event.id() == save_as_i.id() {
                    app_handle.emit("menu-save-as", ()).unwrap();
                } else if event.id() == open_recent_i.id() {
                    app_handle.emit("menu-open-recent", ()).unwrap();
                } else if event.id() == close_recent_i.id() {
                    app_handle.emit("menu-close-recent", ()).unwrap();
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
