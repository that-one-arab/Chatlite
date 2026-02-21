mod storage;

use std::net::TcpStream;
use std::sync::Mutex;
use std::time::Duration;
use storage::{Chat, ChatMetadataEntry};
use tauri::Manager;

// ─── App state ────────────────────────────────────────────────────────────────

/// Holds the AES-256 encryption key in memory.
/// `None` = no password set (or not yet unlocked).
/// The key is never sent to the JS side; JS only learns "locked" / "unlocked".
pub struct AppState {
    pub key: Mutex<Option<Vec<u8>>>,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Clone the current key out of AppState (drops the lock immediately).
fn get_key(state: &tauri::State<'_, AppState>) -> Option<Vec<u8>> {
    state.key.lock().unwrap().clone()
}

/// Resolve `{appDataDir}/security.json`.
fn security_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join("security.json"))
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))
}

// ─── Existing commands (updated to thread key) ───────────────────────────────

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn initialize_storage(
    storage_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let key = get_key(&state);
    storage::initialize_storage(&storage_path, key.as_deref())
}

#[tauri::command]
async fn load_chat_metadata(
    storage_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ChatMetadataEntry>, String> {
    let key = get_key(&state);
    let metadata = storage::load_metadata(&storage_path, key.as_deref())?;
    Ok(metadata.chats)
}

#[tauri::command]
async fn load_chat_by_id(
    storage_path: String,
    chat_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Chat, String> {
    let key = get_key(&state);
    storage::load_chat(&storage_path, &chat_id, key.as_deref())
}

#[tauri::command]
async fn save_chat_data(
    storage_path: String,
    chat: Chat,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let key = get_key(&state);
    storage::save_chat(&storage_path, &chat, key.as_deref())
}

#[tauri::command]
async fn delete_chat_data(
    storage_path: String,
    chat_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let key = get_key(&state);
    storage::delete_chat_file(&storage_path, &chat_id, key.as_deref())
}

/// Returns true if something is listening on 127.0.0.1:11434 within 500ms.
#[tauri::command]
fn check_ollama() -> bool {
    TcpStream::connect_timeout(
        &"127.0.0.1:11434".parse().unwrap(),
        Duration::from_millis(500),
    )
    .is_ok()
}

// ─── Password / security commands ────────────────────────────────────────────

/// True when `security.json` exists in the app data directory.
#[tauri::command]
fn is_password_enabled(app_handle: tauri::AppHandle) -> bool {
    security_path(&app_handle)
        .map(|p| p.exists())
        .unwrap_or(false)
}

/// Verify the password against `security.json` and store the derived key in
/// AppState.  Returns an error string on wrong password.
#[tauri::command]
async fn unlock_app(
    password: String,
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let sec = security_path(&app_handle)?;
    let key = storage::verify_password_and_derive_key(&password, &sec)?;
    *state.key.lock().unwrap() = Some(key);
    Ok(())
}

/// Set a new password: derive key, write security.json, re-encrypt all chats.
#[tauri::command]
async fn enable_password(
    password: String,
    storage_path: String,
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let sec = security_path(&app_handle)?;
    let key = storage::setup_password(&password, &sec)?;
    storage::encrypt_all_files(&storage_path, &key)?;
    *state.key.lock().unwrap() = Some(key);
    Ok(())
}

/// Verify the current password, decrypt all files, remove security.json.
#[tauri::command]
async fn disable_password(
    password: String,
    storage_path: String,
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let sec = security_path(&app_handle)?;
    let key = storage::verify_password_and_derive_key(&password, &sec)?;
    storage::decrypt_all_files(&storage_path, &key)?;
    std::fs::remove_file(&sec)
        .map_err(|e| format!("Failed to remove security.json: {}", e))?;
    *state.key.lock().unwrap() = None;
    Ok(())
}

/// Change password: verify old, decrypt all, setup new password, re-encrypt.
#[tauri::command]
async fn change_password(
    old_password: String,
    new_password: String,
    storage_path: String,
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let sec = security_path(&app_handle)?;
    let old_key = storage::verify_password_and_derive_key(&old_password, &sec)?;
    storage::decrypt_all_files(&storage_path, &old_key)?;
    let new_key = storage::setup_password(&new_password, &sec)?;
    storage::encrypt_all_files(&storage_path, &new_key)?;
    *state.key.lock().unwrap() = Some(new_key);
    Ok(())
}

// ─── App entry point ──────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            key: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            initialize_storage,
            load_chat_metadata,
            load_chat_by_id,
            save_chat_data,
            delete_chat_data,
            check_ollama,
            is_password_enabled,
            unlock_app,
            enable_password,
            disable_password,
            change_password,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
