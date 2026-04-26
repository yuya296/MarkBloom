#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
  collections::HashSet,
  fs,
  path::{Path, PathBuf},
  sync::Mutex,
};

use tauri::{Manager, RunEvent, State, WindowEvent};
use url::Url;

const MAX_MARKDOWN_FILE_SIZE: u64 = 10 * 1024 * 1024;

#[derive(Default)]
struct AllowedMarkdownPaths {
  paths: Mutex<HashSet<PathBuf>>,
}

fn is_allowed_markdown_extension(path: &Path) -> bool {
  matches!(
    path
      .extension()
      .and_then(|ext| ext.to_str())
      .map(|ext| ext.to_ascii_lowercase()),
    Some(ext) if ext == "md" || ext == "markdown" || ext == "txt"
  )
}

fn canonicalize_existing_path(path: &str) -> Result<PathBuf, String> {
  let candidate = PathBuf::from(path);
  let canonical = candidate
    .canonicalize()
    .map_err(|error| format!("Failed to canonicalize path: {error}"))?;
  if !canonical.is_file() {
    return Err("The selected path is not a file.".to_string());
  }
  if !is_allowed_markdown_extension(&canonical) {
    return Err("Only markdown files (.md, .markdown, .txt) are allowed.".to_string());
  }
  Ok(canonical)
}

fn canonicalize_write_path(path: &str) -> Result<PathBuf, String> {
  let candidate = PathBuf::from(path);
  let normalized = if candidate.exists() {
    candidate
      .canonicalize()
      .map_err(|error| format!("Failed to canonicalize path: {error}"))?
  } else {
    let parent = candidate
      .parent()
      .ok_or_else(|| "The selected path has no parent directory.".to_string())?;
    let parent_canonical = parent
      .canonicalize()
      .map_err(|error| format!("Failed to canonicalize parent path: {error}"))?;
    let file_name = candidate
      .file_name()
      .ok_or_else(|| "The selected path has no file name.".to_string())?;
    parent_canonical.join(file_name)
  };
  if !is_allowed_markdown_extension(&normalized) {
    return Err("Only markdown files (.md, .markdown, .txt) are allowed.".to_string());
  }
  Ok(normalized)
}

fn ensure_allowed_path(path: &Path, state: &State<AllowedMarkdownPaths>) -> Result<(), String> {
  let paths = state
    .paths
    .lock()
    .map_err(|_| "Failed to access allowed file paths.".to_string())?;
  if !paths.contains(path) {
    return Err("Access to the selected path is not allowed.".to_string());
  }
  Ok(())
}

#[tauri::command]
fn allow_markdown_path(path: String, state: State<AllowedMarkdownPaths>) -> Result<(), String> {
  let normalized = canonicalize_write_path(&path)?;
  let mut paths = state
    .paths
    .lock()
    .map_err(|_| "Failed to access allowed file paths.".to_string())?;
  paths.insert(normalized);
  Ok(())
}

#[tauri::command]
async fn read_markdown_file(
  path: String,
  state: State<'_, AllowedMarkdownPaths>,
) -> Result<String, String> {
  let normalized = canonicalize_existing_path(&path)?;
  ensure_allowed_path(&normalized, &state)?;
  tauri::async_runtime::spawn_blocking(move || {
    let metadata = fs::metadata(&normalized).map_err(|error| format!("Failed to read metadata: {error}"))?;
    if metadata.len() > MAX_MARKDOWN_FILE_SIZE {
      return Err("File is too large (max 10 MB).".to_string());
    }
    fs::read_to_string(&normalized).map_err(|error| format!("Failed to read file: {error}"))
  })
  .await
  .map_err(|error| format!("Failed to join read task: {error}"))?
}

#[tauri::command]
async fn write_markdown_file(
  path: String,
  content: String,
  state: State<'_, AllowedMarkdownPaths>,
) -> Result<(), String> {
  if content.len() as u64 > MAX_MARKDOWN_FILE_SIZE {
    return Err("Content is too large (max 10 MB).".to_string());
  }
  let normalized = canonicalize_write_path(&path)?;
  ensure_allowed_path(&normalized, &state)?;
  tauri::async_runtime::spawn_blocking(move || {
    fs::write(&normalized, content).map_err(|error| format!("Failed to write file: {error}"))
  })
  .await
  .map_err(|error| format!("Failed to join write task: {error}"))?
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
  let parsed = Url::parse(&url).map_err(|error| format!("Invalid URL: {error}"))?;
  let scheme = parsed.scheme();
  if scheme != "http" && scheme != "https" {
    return Err("Only http/https URLs are allowed.".to_string());
  }
  webbrowser::open(parsed.as_str()).map_err(|error| format!("Failed to open URL: {error}"))?;
  Ok(())
}

fn main() {
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .manage(AllowedMarkdownPaths::default())
    .invoke_handler(tauri::generate_handler![
      allow_markdown_path,
      read_markdown_file,
      write_markdown_file,
      open_external_url
    ])
    .on_window_event(|window, event| {
      // macOS: hide the window instead of quitting when the user closes it
      // (Cmd+W or red traffic light). The app stays alive in the menu bar
      // and can be reopened via Dock click (RunEvent::Reopen).
      if cfg!(target_os = "macos") {
        if let WindowEvent::CloseRequested { api, .. } = event {
          api.prevent_close();
          let _ = window.hide();
        }
      }
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|app_handle, event| {
    if cfg!(target_os = "macos") {
      if let RunEvent::Reopen { .. } = event {
        if let Some(window) = app_handle.get_webview_window("main") {
          let _ = window.show();
          let _ = window.set_focus();
        }
      }
    }
  });
}
