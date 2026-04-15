use base64::{engine::general_purpose, Engine as _};
use image::{imageops::FilterType, ImageFormat};
use std::io::Cursor;
use xcap::Monitor;

#[tauri::command]
fn capture_screen() -> Result<String, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let monitor = monitors.into_iter().next().ok_or("No monitor found")?;
    let image = monitor.capture_image().map_err(|e| e.to_string())?;

    // Resize to max 1280px wide to keep the payload small enough for local LLMs
    let resized = if image.width() > 1280 {
        image::DynamicImage::ImageRgba8(image).resize(1280, 1280, FilterType::Lanczos3)
    } else {
        image::DynamicImage::ImageRgba8(image)
    };

    let mut buf = Cursor::new(Vec::new());
    resized
        .write_to(&mut buf, ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;

    Ok(general_purpose::STANDARD.encode(buf.into_inner()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![capture_screen])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
