mod storage;

use std::net::TcpStream;
use std::time::Duration;
use storage::{Chat, ChatMetadataEntry};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn initialize_storage(storage_path: String) -> Result<(), String> {
    storage::initialize_storage(&storage_path)
}

#[tauri::command]
async fn load_chat_metadata(storage_path: String) -> Result<Vec<ChatMetadataEntry>, String> {
    let metadata = storage::load_metadata(&storage_path)?;
    Ok(metadata.chats)
}

#[tauri::command]
async fn load_chat_by_id(storage_path: String, chat_id: String) -> Result<Chat, String> {
    storage::load_chat(&storage_path, &chat_id)
}

#[tauri::command]
async fn save_chat_data(storage_path: String, chat: Chat) -> Result<(), String> {
    storage::save_chat(&storage_path, &chat)
}

#[tauri::command]
async fn delete_chat_data(storage_path: String, chat_id: String) -> Result<(), String> {
    storage::delete_chat_file(&storage_path, &chat_id)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            initialize_storage,
            load_chat_metadata,
            load_chat_by_id,
            save_chat_data,
            delete_chat_data,
            check_ollama,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
