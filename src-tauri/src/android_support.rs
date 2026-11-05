use tauri::{plugin::{Builder, PluginHandle, TauriPlugin}, Manager, Wry};

struct AndroidBridge(PluginHandle<Wry>);

#[tauri::command]
pub async fn get_player_controls(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    app.state::<AndroidBridge>().0.run_mobile_plugin("getPlayerControls", serde_json::json!({}))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn set_player_control(app: tauri::AppHandle, control: String, value: f64) -> Result<serde_json::Value, String> {
    if !value.is_finite() || !["brightness", "volume"].contains(&control.as_str()) { return Err("Invalid player control".into()); }
    app.state::<AndroidBridge>().0.run_mobile_plugin("setPlayerControl", serde_json::json!({"control":control,"value":value}))
        .map_err(|error| error.to_string())
}

pub async fn install_update(app: &tauri::AppHandle, path: String) -> Result<(), String> {
    app.state::<AndroidBridge>().0.run_mobile_plugin::<serde_json::Value>("installUpdate", serde_json::json!({"path":path}))
        .map(|_| ()).map_err(|error| error.to_string())
}

pub async fn open_update_page(app: &tauri::AppHandle) -> Result<(), String> {
    app.state::<AndroidBridge>().0.run_mobile_plugin::<serde_json::Value>("openUpdatePage", serde_json::json!({}))
        .map(|_| ()).map_err(|error| error.to_string())
}

pub fn init() -> TauriPlugin<Wry> {
    Builder::new("kennys-mobile")
        .setup(|app, api| {
            let handle = api.register_android_plugin("com.libretv.app", "KennysMobilePlugin")?;
            app.manage(AndroidBridge(handle));
            Ok(())
        })
        .build()
}

#[tauri::command]
pub async fn set_player_fullscreen(app: tauri::AppHandle, fullscreen: bool) -> Result<(), String> {
    let bridge = app.state::<AndroidBridge>();
    bridge.0.run_mobile_plugin::<serde_json::Value>("setFullscreen", serde_json::json!({"fullscreen": fullscreen}))
        .map(|_| ()).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn export_config_file(app: tauri::AppHandle, content: String, filename: String) -> Result<bool, String> {
    let bridge = app.state::<AndroidBridge>();
    let result = bridge.0.run_mobile_plugin::<serde_json::Value>("exportConfig", serde_json::json!({"content":content,"filename":filename}))
        .map_err(|error| error.to_string())?;
    Ok(result.get("saved").and_then(|value| value.as_bool()).unwrap_or(false))
}
