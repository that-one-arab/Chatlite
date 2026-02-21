use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

// Crypto imports
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use argon2::Argon2;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use rand::{rngs::OsRng, RngCore};

// ─── Domain types ────────────────────────────────────────────────────────────

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

// ─── Crypto types ─────────────────────────────────────────────────────────────

/// On-disk format for an encrypted file.
#[derive(Debug, Serialize, Deserialize)]
struct EncryptedFile {
    encrypted: bool,
    nonce: String,
    ciphertext: String,
}

/// Contents of `{appDataDir}/security.json`.
#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub version: u32,
    /// Base64-encoded 32-byte Argon2id salt.
    pub salt: String,
    /// Base64-encoded 12-byte AES-GCM nonce for the verification block.
    pub verification_nonce: String,
    /// Base64-encoded AES-GCM ciphertext that proves the password is correct.
    pub verification_ciphertext: String,
}

/// Known plaintext that we encrypt at setup time to verify future passwords.
const VERIFICATION_PLAINTEXT: &[u8] = b"chatlite-verify-v1";

// ─── Crypto primitives ────────────────────────────────────────────────────────

fn derive_key(password: &str, salt: &[u8]) -> Result<Vec<u8>, String> {
    let mut output = [0u8; 32];
    Argon2::default()
        .hash_password_into(password.as_bytes(), salt, &mut output)
        .map_err(|e| format!("Key derivation failed: {}", e))?;
    Ok(output.to_vec())
}

fn encrypt_with_key(key: &[u8], plaintext: &[u8]) -> Result<(String, String), String> {
    let aes_key = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(aes_key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|e| format!("Encryption failed: {}", e))?;
    Ok((BASE64.encode(nonce.as_slice()), BASE64.encode(&ciphertext)))
}

fn decrypt_with_key(key: &[u8], nonce_b64: &str, ciphertext_b64: &str) -> Result<Vec<u8>, String> {
    let aes_key = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(aes_key);
    let nonce_bytes = BASE64
        .decode(nonce_b64)
        .map_err(|e| format!("Invalid nonce encoding: {}", e))?;
    let ciphertext = BASE64
        .decode(ciphertext_b64)
        .map_err(|e| format!("Invalid ciphertext encoding: {}", e))?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    cipher
        .decrypt(nonce, ciphertext.as_slice())
        .map_err(|_| "Incorrect password".to_string())
}

// ─── Security config helpers ──────────────────────────────────────────────────

/// Derive key from `password`, write `security.json` to `security_path`, and
/// return the 32-byte key.
pub fn setup_password(password: &str, security_path: &Path) -> Result<Vec<u8>, String> {
    let mut salt = [0u8; 32];
    OsRng.fill_bytes(&mut salt);

    let key = derive_key(password, &salt)?;
    let (v_nonce, v_ciphertext) = encrypt_with_key(&key, VERIFICATION_PLAINTEXT)?;

    let config = SecurityConfig {
        version: 1,
        salt: BASE64.encode(salt),
        verification_nonce: v_nonce,
        verification_ciphertext: v_ciphertext,
    };

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize security config: {}", e))?;

    fs::write(security_path, json)
        .map_err(|e| format!("Failed to write security.json: {}", e))?;

    Ok(key)
}

/// Read `security.json`, verify `password`, and return the derived key on
/// success.  Returns `Err` with a user-visible message on wrong password.
pub fn verify_password_and_derive_key(
    password: &str,
    security_path: &Path,
) -> Result<Vec<u8>, String> {
    let raw = fs::read_to_string(security_path)
        .map_err(|_| "Security config not found".to_string())?;

    let config: SecurityConfig = serde_json::from_str(&raw)
        .map_err(|e| format!("Corrupt security config: {}", e))?;

    let salt = BASE64
        .decode(&config.salt)
        .map_err(|e| format!("Invalid salt in security config: {}", e))?;

    let key = derive_key(password, &salt)?;

    // Verify: attempt to decrypt the stored verification block.
    decrypt_with_key(&key, &config.verification_nonce, &config.verification_ciphertext)
        .map_err(|_| "Incorrect password".to_string())?;

    Ok(key)
}

// ─── File I/O helpers ─────────────────────────────────────────────────────────

/// Read a file, decrypting it if it carries the `"encrypted": true` marker.
fn read_file_decrypted(path: &Path, key: Option<&[u8]>) -> Result<String, String> {
    let raw = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {:?}: {}", path, e))?;

    // Fast check: only try to parse as EncryptedFile if the string contains
    // the marker, to avoid unnecessary JSON parsing on every read.
    if raw.contains("\"encrypted\"") {
        if let Ok(ef) = serde_json::from_str::<EncryptedFile>(&raw) {
            if ef.encrypted {
                let key = key.ok_or_else(|| {
                    "File is encrypted but the app is locked".to_string()
                })?;
                let plaintext = decrypt_with_key(key, &ef.nonce, &ef.ciphertext)?;
                return String::from_utf8(plaintext)
                    .map_err(|e| format!("Decrypted content is not valid UTF-8: {}", e));
            }
        }
    }

    Ok(raw)
}

/// Atomically write `content` to `path`, encrypting it when `key` is `Some`.
fn write_file_atomic(path: &Path, content: &str, key: Option<&[u8]>) -> Result<(), String> {
    let to_write: String = if let Some(key) = key {
        let (nonce, ciphertext) = encrypt_with_key(key, content.as_bytes())?;
        serde_json::to_string(&EncryptedFile {
            encrypted: true,
            nonce,
            ciphertext,
        })
        .map_err(|e| format!("Failed to serialize encrypted wrapper: {}", e))?
    } else {
        content.to_string()
    };

    let temp_path = path.with_extension("tmp");

    let mut file = fs::File::create(&temp_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    file.write_all(to_write.as_bytes())
        .map_err(|e| format!("Failed to write file: {}", e))?;

    file.sync_all()
        .map_err(|e| format!("Failed to sync file: {}", e))?;

    fs::rename(&temp_path, path)
        .map_err(|e| format!("Failed to rename file: {}", e))?;

    Ok(())
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

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

// ─── Bulk encrypt / decrypt ───────────────────────────────────────────────────

/// Re-encrypt every storage file with `key`.  Called when enabling password.
pub fn encrypt_all_files(storage_path: &str, key: &[u8]) -> Result<(), String> {
    let metadata_path = get_metadata_path(storage_path);
    if metadata_path.exists() {
        let content = read_file_decrypted(&metadata_path, None)?;
        write_file_atomic(&metadata_path, &content, Some(key))?;
    }

    let chats_dir = get_chats_dir(storage_path);
    if chats_dir.exists() {
        for entry in fs::read_dir(&chats_dir)
            .map_err(|e| format!("Failed to read chats dir: {}", e))?
        {
            let path = entry
                .map_err(|e| format!("Dir entry error: {}", e))?
                .path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                let content = read_file_decrypted(&path, None)?;
                write_file_atomic(&path, &content, Some(key))?;
            }
        }
    }

    Ok(())
}

/// Decrypt every storage file back to plaintext.  Called when disabling password.
pub fn decrypt_all_files(storage_path: &str, key: &[u8]) -> Result<(), String> {
    let metadata_path = get_metadata_path(storage_path);
    if metadata_path.exists() {
        let content = read_file_decrypted(&metadata_path, Some(key))?;
        write_file_atomic(&metadata_path, &content, None)?;
    }

    let chats_dir = get_chats_dir(storage_path);
    if chats_dir.exists() {
        for entry in fs::read_dir(&chats_dir)
            .map_err(|e| format!("Failed to read chats dir: {}", e))?
        {
            let path = entry
                .map_err(|e| format!("Dir entry error: {}", e))?
                .path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                let content = read_file_decrypted(&path, Some(key))?;
                write_file_atomic(&path, &content, None)?;
            }
        }
    }

    Ok(())
}

// ─── Metadata operations ──────────────────────────────────────────────────────

pub fn load_metadata(storage_path: &str, key: Option<&[u8]>) -> Result<Metadata, String> {
    let metadata_path = get_metadata_path(storage_path);

    if !metadata_path.exists() {
        return Ok(Metadata {
            chats: Vec::new(),
            version: 2,
        });
    }

    let contents = read_file_decrypted(&metadata_path, key)?;
    let metadata: Metadata = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse metadata: {}", e))?;

    Ok(metadata)
}

pub fn save_metadata(
    storage_path: &str,
    metadata: &Metadata,
    key: Option<&[u8]>,
) -> Result<(), String> {
    let metadata_path = get_metadata_path(storage_path);
    let json = serde_json::to_string_pretty(metadata)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
    write_file_atomic(&metadata_path, &json, key)
}

// ─── Chat operations ──────────────────────────────────────────────────────────

pub fn load_chat(storage_path: &str, chat_id: &str, key: Option<&[u8]>) -> Result<Chat, String> {
    let chat_path = get_chat_file_path(storage_path, chat_id);

    if !chat_path.exists() {
        return Err(format!("Chat file not found: {}", chat_id));
    }

    let contents = read_file_decrypted(&chat_path, key)?;
    let chat: Chat = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse chat file: {}", e))?;

    Ok(chat)
}

pub fn save_chat(storage_path: &str, chat: &Chat, key: Option<&[u8]>) -> Result<(), String> {
    let chats_dir = get_chats_dir(storage_path);

    if !chats_dir.exists() {
        fs::create_dir_all(&chats_dir)
            .map_err(|e| format!("Failed to create chats directory: {}", e))?;
    }

    let chat_path = get_chat_file_path(storage_path, &chat.id);
    let json = serde_json::to_string_pretty(chat)
        .map_err(|e| format!("Failed to serialize chat: {}", e))?;

    write_file_atomic(&chat_path, &json, key)?;

    // Update metadata
    let mut metadata = load_metadata(storage_path, key)?;

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

    save_metadata(storage_path, &metadata, key)?;

    Ok(())
}

pub fn delete_chat_file(
    storage_path: &str,
    chat_id: &str,
    key: Option<&[u8]>,
) -> Result<(), String> {
    let chat_path = get_chat_file_path(storage_path, chat_id);

    if chat_path.exists() {
        fs::remove_file(&chat_path)
            .map_err(|e| format!("Failed to delete chat file: {}", e))?;
    }

    let mut metadata = load_metadata(storage_path, key)?;
    metadata.chats.retain(|entry| entry.id != chat_id);
    save_metadata(storage_path, &metadata, key)?;

    Ok(())
}

// ─── Migration from legacy format ────────────────────────────────────────────

fn migrate_from_legacy(storage_path: &str, key: Option<&[u8]>) -> Result<(), String> {
    let legacy_path = get_legacy_chats_path(storage_path);

    if !legacy_path.exists() {
        return Ok(());
    }

    println!("Migrating from legacy chats.json format...");

    let contents = fs::read_to_string(&legacy_path)
        .map_err(|e| format!("Failed to read legacy chats.json: {}", e))?;

    let legacy_chats: Vec<LegacyChat> = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse legacy chats.json: {}", e))?;

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

    for legacy_chat in legacy_chats {
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

        let chat_path = get_chat_file_path(storage_path, &chat.id);
        let json = serde_json::to_string_pretty(&chat)
            .map_err(|e| format!("Failed to serialize chat during migration: {}", e))?;

        write_file_atomic(&chat_path, &json, key)?;

        metadata.chats.push(ChatMetadataEntry {
            id: chat.id,
            title: chat.title,
            model: chat.model,
            last_modified: chat.last_modified,
            message_count: chat.messages.len(),
        });
    }

    save_metadata(storage_path, &metadata, key)?;

    let backup_path = legacy_path.with_extension("json.backup");
    fs::rename(&legacy_path, &backup_path)
        .map_err(|e| format!("Failed to backup legacy chats.json: {}", e))?;

    println!("Migration completed successfully. Backup saved to chats.json.backup");

    Ok(())
}

// ─── Orphan detection and recovery ───────────────────────────────────────────

fn recover_orphaned_chats(storage_path: &str, key: Option<&[u8]>) -> Result<(), String> {
    let chats_dir = get_chats_dir(storage_path);

    if !chats_dir.exists() {
        return Ok(());
    }

    let mut metadata = load_metadata(storage_path, key)?;
    let existing_ids: std::collections::HashSet<String> =
        metadata.chats.iter().map(|e| e.id.clone()).collect();

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
                    match load_chat(storage_path, &chat_id, key) {
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
        save_metadata(storage_path, &metadata, key)?;
    }

    Ok(())
}

// ─── Metadata validation ──────────────────────────────────────────────────────

fn validate_metadata(storage_path: &str, key: Option<&[u8]>) -> Result<(), String> {
    let mut metadata = load_metadata(storage_path, key)?;
    let initial_count = metadata.chats.len();

    metadata.chats.retain(|entry| {
        let chat_path = get_chat_file_path(storage_path, &entry.id);
        let exists = chat_path.exists();
        if !exists {
            eprintln!("Removing missing chat from metadata: {}", entry.id);
        }
        exists
    });

    if metadata.chats.len() < initial_count {
        save_metadata(storage_path, &metadata, key)?;
        println!(
            "Removed {} missing chat(s) from metadata",
            initial_count - metadata.chats.len()
        );
    }

    Ok(())
}

// ─── Storage initialization ───────────────────────────────────────────────────

pub fn initialize_storage(storage_path: &str, key: Option<&[u8]>) -> Result<(), String> {
    let storage_dir = Path::new(storage_path);
    if !storage_dir.exists() {
        fs::create_dir_all(storage_dir)
            .map_err(|e| format!("Failed to create storage directory: {}", e))?;
    }

    let legacy_path = get_legacy_chats_path(storage_path);
    let metadata_path = get_metadata_path(storage_path);

    if legacy_path.exists() && !metadata_path.exists() {
        migrate_from_legacy(storage_path, key)?;
    }

    let chats_dir = get_chats_dir(storage_path);
    if !chats_dir.exists() {
        fs::create_dir_all(&chats_dir)
            .map_err(|e| format!("Failed to create chats directory: {}", e))?;
    }

    validate_metadata(storage_path, key)?;
    recover_orphaned_chats(storage_path, key)?;

    Ok(())
}
