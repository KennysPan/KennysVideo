use serde::{Deserialize, Serialize};
use std::{path::PathBuf, sync::Mutex};
use tauri::Manager;

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CloseAction {
    #[default]
    Minimize,
    Exit,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq)]
pub struct ClosePreference {
    pub action: CloseAction,
    pub remember: bool,
}

pub struct CloseState {
    preference: Mutex<ClosePreference>,
    path: PathBuf,
}

impl CloseState {
    pub fn load(path: PathBuf) -> Self {
        let preference = std::fs::read(&path).ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok()).unwrap_or_default();
        Self { preference: Mutex::new(preference), path }
    }

    fn save(&self, preference: ClosePreference) -> Result<(), String> {
        let mut current = self.preference.lock().map_err(|e| e.to_string())?;
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let bytes = serde_json::to_vec(&preference).map_err(|e| e.to_string())?;
        std::fs::write(&self.path, bytes).map_err(|e| e.to_string())?;
        *current = preference;
        Ok(())
    }
}

#[tauri::command]
pub fn get_close_preference(state: tauri::State<'_, CloseState>) -> Result<ClosePreference, String> {
    Ok(*state.preference.lock().map_err(|e| e.to_string())?)
}

#[tauri::command]
pub fn set_close_preference(state: tauri::State<'_, CloseState>, preference: ClosePreference) -> Result<(), String> {
    state.save(preference)
}

fn perform(window: &tauri::Window, action: CloseAction) -> Result<(), String> {
    match action {
        CloseAction::Minimize => {
            #[cfg(target_os = "windows")]
            {
                // Never hide the only window unless a working tray entry can restore it.
                if window.app_handle().tray_by_id(crate::system_tray::TRAY_ID).is_none() {
                    return Err("系统托盘尚未就绪，请重试".into());
                }
                window.hide().map_err(|e| e.to_string())
            }
            #[cfg(not(target_os = "windows"))]
            window.minimize().map_err(|e| e.to_string())
        },
        CloseAction::Exit => { window.app_handle().exit(0); Ok(()) }
    }
}

#[tauri::command]
pub async fn apply_close_action(window: tauri::Window, state: tauri::State<'_, CloseState>, preference: ClosePreference) -> Result<(), String> {
    state.save(preference)?;
    perform(&window, preference.action)
}

pub fn requested(window: &tauri::Window) {
    let preference = window.state::<CloseState>().preference.lock().map(|value| *value).unwrap_or_default();
    if preference.remember {
        if perform(window, preference.action).is_ok() { return; }
    }
    if let Some(webview) = window.app_handle().get_webview_window(window.label()) {
        let _ = webview.eval("window.dispatchEvent(new Event('kennys-close-requested'))");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preference_persists_and_corruption_prompts_again() {
        let path = std::env::temp_dir().join(format!("kennys-close-test-{}.json", std::process::id()));
        let state = CloseState::load(path.clone());
        for action in [CloseAction::Minimize, CloseAction::Exit] {
            let preference = ClosePreference { action, remember: true };
            state.save(preference).unwrap();
            assert_eq!(*CloseState::load(path.clone()).preference.lock().unwrap(), preference);
        }
        std::fs::write(&path, b"invalid").unwrap();
        assert_eq!(*CloseState::load(path.clone()).preference.lock().unwrap(), ClosePreference::default());
        let _ = std::fs::remove_file(path);
    }
}
