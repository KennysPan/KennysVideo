use base64::Engine;
use once_cell::sync::Lazy;
use reqwest::{header, redirect::Policy, Client, Url};
use std::time::Duration;

const MAX_IMAGE_BYTES: usize = 5 * 1024 * 1024;
const IMAGE_REFERER: &str = "https://movie.douban.com/";
const IMAGE_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

static IMAGE_CLIENT: Lazy<Result<Client, reqwest::Error>> = Lazy::new(|| {
    Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(15))
        .redirect(Policy::none())
        .pool_max_idle_per_host(4)
        .build()
});

fn validate_poster_url(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|_| "Invalid poster URL".to_string())?;
    let host = url.host_str().unwrap_or("");
    if url.scheme() != "https"
        || !(host == "doubanio.com" || host.ends_with(".doubanio.com"))
        || !url.path().starts_with("/view/photo/")
        || url.port_or_known_default() != Some(443)
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Only Douban HTTPS poster addresses are supported".to_string());
    }
    Ok(url)
}

/// Native IPC contract: Douban poster URL -> validated image data URI, or an error.
/// This is deliberately an image-only channel, not an unrestricted HTTP proxy.
#[tauri::command]
pub async fn fetch_poster_image(url: String) -> Result<String, String> {
    let url = validate_poster_url(&url)?;
    let client = IMAGE_CLIENT.as_ref().map_err(|error| error.to_string())?;
    let mut response = client.get(url)
        .header(header::REFERER, IMAGE_REFERER)
        .header(header::USER_AGENT, IMAGE_USER_AGENT)
        .header(header::ACCEPT, "image/avif,image/webp,image/apng,image/*,*/*;q=0.8")
        .send().await.map_err(|error| error.to_string())?
        .error_for_status().map_err(|error| error.to_string())?;
    let mime = response.headers().get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("").split(';').next().unwrap_or("").trim().to_string();
    if !matches!(mime.as_str(), "image/jpeg" | "image/png" | "image/webp" | "image/gif") {
        return Err("Poster response is not a supported image".to_string());
    }
    if response.content_length().unwrap_or(0) > MAX_IMAGE_BYTES as u64 {
        return Err("Poster exceeds size limit".to_string());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        if bytes.len() + chunk.len() > MAX_IMAGE_BYTES {
            return Err("Poster exceeds size limit".to_string());
        }
        bytes.extend_from_slice(&chunk);
    }
    let valid_image = match mime.as_str() {
        "image/jpeg" => bytes.starts_with(&[0xff, 0xd8, 0xff]),
        "image/png" => bytes.starts_with(b"\x89PNG\r\n\x1a\n"),
        "image/webp" => bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP"),
        "image/gif" => bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a"),
        _ => false,
    };
    if !valid_image { return Err("Invalid poster image bytes".to_string()); }
    Ok(format!("data:{};base64,{}", mime, base64::engine::general_purpose::STANDARD.encode(bytes)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn poster_addresses_are_restricted() {
        assert!(validate_poster_url("https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2614988097.jpg").is_ok());
        for address in ["http://img3.doubanio.com/view/photo/a.jpg", "https://127.0.0.1/view/photo/a.jpg", "https://img3.doubanio.com.evil.test/view/photo/a.jpg", "https://img3.doubanio.com:444/view/photo/a.jpg"] {
            assert!(validate_poster_url(address).is_err());
        }
    }

    #[tokio::test]
    #[ignore = "Requires live access to Douban image servers"]
    async fn live_poster_download() {
        let mut evidence = Vec::new();
        for address in [
            "https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2614988097.jpg",
            "https://img9.doubanio.com/view/photo/s_ratio_poster/public/p513344864.jpg",
        ] {
            let result = fetch_poster_image(address.to_string()).await.expect("live poster download");
            assert!(result.starts_with("data:image/jpeg;base64,"));
            assert!(result.len() > 1000);
            println!("Live native poster download verified: {} bytes", result.len());
            evidence.push((address, result));
        }
        if let Some(output) = std::env::var_os("KENNYSVIDEO_POSTER_TEST_OUTPUT") {
            std::fs::write(output, serde_json::to_vec(&evidence).unwrap()).unwrap();
        }
    }
}
