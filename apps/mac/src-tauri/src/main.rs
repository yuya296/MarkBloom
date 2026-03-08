#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
fn read_markdown_file(path: String) -> Result<String, String> {
  std::fs::read_to_string(&path).map_err(|error| format!("Failed to read file: {error}"))
}

#[tauri::command]
fn write_markdown_file(path: String, content: String) -> Result<(), String> {
  std::fs::write(&path, content).map_err(|error| format!("Failed to write file: {error}"))
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![read_markdown_file, write_markdown_file])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
