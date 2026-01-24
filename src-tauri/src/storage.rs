use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::io::Write;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMetadataEntry {
    pub id: String,
    pub title: String,
    pub model: String,
    #[serde(rename = "lastModified")]
    pub last_modified: i64,
    #[serde(rename = "messageCount")]
    pub message_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Metadata {
    pub chats: Vec<ChatMetadataEntry>,
    pub version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thinking: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chat {
    pub id: String,
    pub title: String,
    pub messages: Vec<Message>,
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "systemPrompt")]
    pub system_prompt: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "lastModified")]
    pub last_modified: i64,
}

#[derive(Debug, Serialize, Deserialize)]
struct LegacyChat {
    id: String,
    title: String,
    messages: Vec<Message>,
    model: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "systemPrompt")]
    system_prompt: Option<String>,
}

// Path helpers
fn get_metadata_path(storage_path: &str) -> PathBuf {
    Path::new(storage_path).join("metadata.json")
}

fn get_chats_dir(storage_path: &str) -> PathBuf {
    Path::new(storage_path).join("chats")
}

fn get_chat_file_path(storage_path: &str, chat_id: &str) -> PathBuf {
    get_chats_dir(storage_path).join(format!("{}.json", chat_id))
}

fn get_legacy_chats_path(storage_path: &str) -> PathBuf {
    Path::new(storage_path).join("chats.json")
}

// Metadata operations
pub fn load_metadata(storage_path: &str) -> Result<Metadata, String> {
    let metadata_path = get_metadata_path(storage_path);

    if !metadata_path.exists() {
        return Ok(Metadata {
            chats: Vec::new(),
            version: 2,
        });
    }

    let contents = fs::read_to_string(&metadata_path)
        .map_err(|e| format!("Failed to read metadata: {}", e))?;

    let metadata: Metadata = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse metadata: {}", e))?;

    Ok(metadata)
}

pub fn save_metadata(storage_path: &str, metadata: &Metadata) -> Result<(), String> {
    let metadata_path = get_metadata_path(storage_path);
    let temp_path = metadata_path.with_extension("tmp");

    // Write to temporary file
    let json = serde_json::to_string_pretty(metadata)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;

    let mut file = fs::File::create(&temp_path)
        .map_err(|e| format!("Failed to create temp metadata file: {}", e))?;

    file.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write metadata: {}", e))?;

    file.sync_all()
        .map_err(|e| format!("Failed to sync metadata: {}", e))?;

    // Atomic rename
    fs::rename(&temp_path, &metadata_path)
        .map_err(|e| format!("Failed to rename metadata file: {}", e))?;

    Ok(())
}

// Chat operations
pub fn load_chat(storage_path: &str, chat_id: &str) -> Result<Chat, String> {
    let chat_path = get_chat_file_path(storage_path, chat_id);

    if !chat_path.exists() {
        return Err(format!("Chat file not found: {}", chat_id));
    }

    let contents = fs::read_to_string(&chat_path)
        .map_err(|e| format!("Failed to read chat file: {}", e))?;

    let chat: Chat = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse chat file: {}", e))?;

    Ok(chat)
}

pub fn save_chat(storage_path: &str, chat: &Chat) -> Result<(), String> {
    let chats_dir = get_chats_dir(storage_path);

    // Ensure chats directory exists
    if !chats_dir.exists() {
        fs::create_dir_all(&chats_dir)
            .map_err(|e| format!("Failed to create chats directory: {}", e))?;
    }

    let chat_path = get_chat_file_path(storage_path, &chat.id);
    let temp_path = chat_path.with_extension("tmp");

    // Write to temporary file
    let json = serde_json::to_string_pretty(chat)
        .map_err(|e| format!("Failed to serialize chat: {}", e))?;

    let mut file = fs::File::create(&temp_path)
        .map_err(|e| format!("Failed to create temp chat file: {}", e))?;

    file.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write chat: {}", e))?;

    file.sync_all()
        .map_err(|e| format!("Failed to sync chat: {}", e))?;

    // Atomic rename
    fs::rename(&temp_path, &chat_path)
        .map_err(|e| format!("Failed to rename chat file: {}", e))?;

    // Update metadata
    let mut metadata = load_metadata(storage_path)?;

    // Find and update existing entry, or add new one
    if let Some(entry) = metadata.chats.iter_mut().find(|e| e.id == chat.id) {
        entry.title = chat.title.clone();
        entry.model = chat.model.clone();
        entry.last_modified = chat.last_modified;
        entry.message_count = chat.messages.len();
    } else {
        metadata.chats.push(ChatMetadataEntry {
            id: chat.id.clone(),
            title: chat.title.clone(),
            model: chat.model.clone(),
            last_modified: chat.last_modified,
            message_count: chat.messages.len(),
        });
    }

    save_metadata(storage_path, &metadata)?;

    Ok(())
}

pub fn delete_chat_file(storage_path: &str, chat_id: &str) -> Result<(), String> {
    let chat_path = get_chat_file_path(storage_path, chat_id);

    if chat_path.exists() {
        fs::remove_file(&chat_path)
            .map_err(|e| format!("Failed to delete chat file: {}", e))?;
    }

    // Update metadata
    let mut metadata = load_metadata(storage_path)?;
    metadata.chats.retain(|entry| entry.id != chat_id);
    save_metadata(storage_path, &metadata)?;

    Ok(())
}

// Migration from legacy format
fn migrate_from_legacy(storage_path: &str) -> Result<(), String> {
    let legacy_path = get_legacy_chats_path(storage_path);

    if !legacy_path.exists() {
        return Ok(());
    }

    println!("Migrating from legacy chats.json format...");

    // Read legacy file
    let contents = fs::read_to_string(&legacy_path)
        .map_err(|e| format!("Failed to read legacy chats.json: {}", e))?;

    let legacy_chats: Vec<LegacyChat> = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse legacy chats.json: {}", e))?;

    // Create chats directory
    let chats_dir = get_chats_dir(storage_path);
    if !chats_dir.exists() {
        fs::create_dir_all(&chats_dir)
            .map_err(|e| format!("Failed to create chats directory: {}", e))?;
    }

    let current_time = chrono::Utc::now().timestamp_millis();
    let mut metadata = Metadata {
        chats: Vec::new(),
        version: 2,
    };

    // Migrate each chat
    for legacy_chat in legacy_chats {
        // Parse chat ID to get creation timestamp
        let created_at = legacy_chat.id.parse::<i64>().unwrap_or(current_time);

        let chat = Chat {
            id: legacy_chat.id.clone(),
            title: legacy_chat.title.clone(),
            messages: legacy_chat.messages.clone(),
            model: legacy_chat.model.clone(),
            system_prompt: legacy_chat.system_prompt.clone(),
            created_at,
            last_modified: current_time,
        };

        // Save individual chat file
        let chat_path = get_chat_file_path(storage_path, &chat.id);
        let json = serde_json::to_string_pretty(&chat)
            .map_err(|e| format!("Failed to serialize chat during migration: {}", e))?;

        fs::write(&chat_path, json)
            .map_err(|e| format!("Failed to write chat file during migration: {}", e))?;

        // Add to metadata
        metadata.chats.push(ChatMetadataEntry {
            id: chat.id,
            title: chat.title,
            model: chat.model,
            last_modified: chat.last_modified,
            message_count: chat.messages.len(),
        });
    }

    // Save metadata
    save_metadata(storage_path, &metadata)?;

    // Backup and remove legacy file
    let backup_path = legacy_path.with_extension("json.backup");
    fs::rename(&legacy_path, &backup_path)
        .map_err(|e| format!("Failed to backup legacy chats.json: {}", e))?;

    println!("Migration completed successfully. Backup saved to chats.json.backup");

    Ok(())
}

// Orphan detection and recovery
fn recover_orphaned_chats(storage_path: &str) -> Result<(), String> {
    let chats_dir = get_chats_dir(storage_path);

    if !chats_dir.exists() {
        return Ok(());
    }

    let mut metadata = load_metadata(storage_path)?;
    let existing_ids: std::collections::HashSet<String> =
        metadata.chats.iter().map(|e| e.id.clone()).collect();

    // Scan for orphaned chat files
    let entries = fs::read_dir(&chats_dir)
        .map_err(|e| format!("Failed to read chats directory: {}", e))?;

    let mut recovered = false;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                let chat_id = file_stem.to_string();

                if !existing_ids.contains(&chat_id) {
                    // Found orphaned chat, try to load and add to metadata
                    match load_chat(storage_path, &chat_id) {
                        Ok(chat) => {
                            metadata.chats.push(ChatMetadataEntry {
                                id: chat.id,
                                title: chat.title,
                                model: chat.model,
                                last_modified: chat.last_modified,
                                message_count: chat.messages.len(),
                            });
                            recovered = true;
                            println!("Recovered orphaned chat: {}", chat_id);
                        }
                        Err(e) => {
                            eprintln!("Failed to recover orphaned chat {}: {}", chat_id, e);
                        }
                    }
                }
            }
        }
    }

    if recovered {
        save_metadata(storage_path, &metadata)?;
    }

    Ok(())
}

// Validate metadata against actual files
fn validate_metadata(storage_path: &str) -> Result<(), String> {
    let mut metadata = load_metadata(storage_path)?;
    let initial_count = metadata.chats.len();

    // Remove entries for missing files
    metadata.chats.retain(|entry| {
        let chat_path = get_chat_file_path(storage_path, &entry.id);
        let exists = chat_path.exists();
        if !exists {
            eprintln!("Removing missing chat from metadata: {}", entry.id);
        }
        exists
    });

    if metadata.chats.len() < initial_count {
        save_metadata(storage_path, &metadata)?;
        println!("Removed {} missing chat(s) from metadata", initial_count - metadata.chats.len());
    }

    Ok(())
}

// Initialize storage
pub fn initialize_storage(storage_path: &str) -> Result<(), String> {
    // Create storage directory if it doesn't exist
    let storage_dir = Path::new(storage_path);
    if !storage_dir.exists() {
        fs::create_dir_all(storage_dir)
            .map_err(|e| format!("Failed to create storage directory: {}", e))?;
    }

    // Check if migration is needed
    let legacy_path = get_legacy_chats_path(storage_path);
    let metadata_path = get_metadata_path(storage_path);

    if legacy_path.exists() && !metadata_path.exists() {
        migrate_from_legacy(storage_path)?;
    }

    // Ensure chats directory exists
    let chats_dir = get_chats_dir(storage_path);
    if !chats_dir.exists() {
        fs::create_dir_all(&chats_dir)
            .map_err(|e| format!("Failed to create chats directory: {}", e))?;
    }

    // Validate metadata and recover orphaned chats
    validate_metadata(storage_path)?;
    recover_orphaned_chats(storage_path)?;

    Ok(())
}
