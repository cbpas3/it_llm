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

#[tauri::command]
async fn get_next_step(image_base64: String, api_key: String) -> Result<String, String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key={}",
        api_key
    );

    let body = serde_json::json!({
        "systemInstruction": {
            "parts": [{ "text": "You are an AI desktop assistant guiding the user to open Google Chrome and navigate to www.facebook.com.\n\nFIRST, carefully look at the screenshot and determine the current state:\n- If the browser address bar shows \"facebook.com\" or the page displays Facebook's logo/login screen → the task is DONE.\n- If Chrome is open but Facebook is not loaded yet → instruct the user to type the URL.\n- If Chrome is not open → instruct the user to open Chrome.\n\nIf the task is done, respond ONLY with: \"Task complete! Facebook is now open in Chrome.\"\nOtherwise, respond with ONE short, specific instruction for the very next action. No preamble, no explanation." }]
        },
        "contents": [{
            "role": "user",
            "parts": [
                {
                    "inlineData": {
                        "mimeType": "image/jpeg",
                        "data": image_base64
                    }
                },
                { "text": "What is the next step I should take?" }
            ]
        }],
        "generationConfig": {
            "maxOutputTokens": 2048
        }
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())?;

    println!("[LLM] POST {}", url);
    let response = client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    println!("[LLM] status: {}", response.status());

    let json: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    println!("[LLM] response: {}", json);

    let text = json["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();

    if text.is_empty() {
        Err(format!("Empty response: {}", json))
    } else {
        Ok(text)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![capture_screen, get_next_step])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
