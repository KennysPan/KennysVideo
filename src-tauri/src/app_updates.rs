use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{path::PathBuf, sync::{Mutex, atomic::{AtomicBool, Ordering}}, time::{Duration, Instant}};
use tauri::Manager;
#[cfg(test)]
#[path = "app_updates_tests.rs"]
mod tests;

const GITHUB_FEED: &str = "https://github.com/KennysPan/KennysVideo/releases/latest/download/update.json";
const GITEE_FEED: &str = "https://gitee.com/api/v5/repos/kennysPan/kennys-video/releases/latest";
const GITHUB_REPO: &str = "https://github.com/KennysPan/KennysVideo";
const GITEE_REPO: &str = "https://gitee.com/kennysPan/kennys-video";
const GITHUB_WAIT: Duration = Duration::from_secs(3);
const GITEE_WAIT: Duration = Duration::from_secs(12);
const MAX_INSTALLER_BYTES: usize = 100 * 1024 * 1024;
static STARTUP_CHECKED: AtomicBool = AtomicBool::new(false);
static DOWNLOADING: AtomicBool = AtomicBool::new(false);
static SELECTED: Lazy<Mutex<Option<UpdateStatus>>> = Lazy::new(|| Mutex::new(None));
static INSTALLER: Lazy<Mutex<Option<(PathBuf, String)>>> = Lazy::new(|| Mutex::new(None));

#[derive(Clone, Copy, Debug, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
enum Source { Github, Gitee }
impl Source {
    fn repo(self) -> &'static str { match self { Self::Github => GITHUB_REPO, Self::Gitee => GITEE_REPO } }
    fn wait(self) -> Duration { match self { Self::Github => GITHUB_WAIT, Self::Gitee => GITEE_WAIT } }
}
#[derive(Deserialize)]
struct Asset { name: String, browser_download_url: String, state: Option<String> }
#[derive(Deserialize)]
struct Release {
    tag_name: String, #[serde(default)] draft: bool, prerelease: bool, assets: Vec<Asset>,
    installer_sha256: Option<String>, body: Option<String>,
}
#[derive(Clone, Serialize)]
pub struct UpdateStatus {
    current_version: String, latest_version: Option<String>, available: bool,
    source: Source, tag: Option<String>, sha256: Option<String>,
}
#[derive(Serialize)]
pub struct DownloadedUpdate { source: Source, bytes: u64 }

#[derive(Clone, Copy, Debug, Serialize)]
struct DownloadProgress {
    stage: &'static str,
    source: Source,
    downloaded: u64,
    total: Option<u64>,
}
type ProgressReporter<'a> = dyn Fn(DownloadProgress) + Send + Sync + 'a;

fn version_numbers(value: &str) -> Result<(u64, u64, u64), String> {
    let parts: Vec<_> = value.strip_prefix('v').unwrap_or(value).split('.').collect();
    if parts.len() != 3 || parts.iter().any(|p| p.is_empty() || !p.bytes().all(|b| b.is_ascii_digit()) || (p.len() > 1 && p.starts_with('0'))) { return Err("Invalid stable release version".into()); }
    Ok((parts[0].parse().map_err(|_| "Invalid version")?, parts[1].parse().map_err(|_| "Invalid version")?, parts[2].parse().map_err(|_| "Invalid version")?))
}
fn installer_url(source: Source, tag: &str, version: &str) -> String {
    format!("{}/releases/download/{}/KennysVideo-{}-x64-setup.exe", source.repo(), tag, version)
}
fn valid_hash(hash: &str) -> bool { hash.len() == 64 && hash.bytes().all(|b| b.is_ascii_hexdigit()) }
fn evaluate_release(current: &str, release: Release, source: Source) -> Result<UpdateStatus, String> {
    if release.draft || release.prerelease { return Err("Not a stable release".into()); }
    let latest = version_numbers(&release.tag_name)?;
    let version = release.tag_name.strip_prefix('v').unwrap_or(&release.tag_name);
    let name = format!("KennysVideo-{}-x64-setup.exe", version);
    let expected = installer_url(source, &release.tag_name, version);
    if !release.assets.iter().any(|a| a.name == name && a.state.as_deref().map_or(source == Source::Gitee, |s| s == "uploaded") && a.browser_download_url == expected) { return Err("Release installer is not ready".into()); }
    let hash = release.installer_sha256.or_else(|| release.body.as_deref().and_then(|body| body.lines().find_map(|line| line.trim().strip_prefix("KennysVideo-SHA256:").map(|value| value.trim().to_owned()))));
    if hash.as_deref().map_or(false, |h| !valid_hash(h)) { return Err("Invalid installer checksum".into()); }
    Ok(UpdateStatus { current_version: current.into(), latest_version: Some(version.into()), available: latest > version_numbers(current)?, source, tag: Some(release.tag_name), sha256: hash.map(|h| h.to_ascii_lowercase()) })
}
async fn request_update(endpoint: &str, current: &str, source: Source, wait: Duration) -> Result<UpdateStatus, String> {
    let response = reqwest::Client::builder().no_proxy().timeout(wait).build().map_err(|e| e.to_string())?.get(endpoint)
        .header("User-Agent", "KennysVideo-Update-Check").header("Accept", "application/json").send().await.map_err(|e| e.to_string())?;
    if response.status() == reqwest::StatusCode::NOT_FOUND { return Ok(UpdateStatus { current_version: current.into(), latest_version: None, available: false, source, tag: None, sha256: None }); }
    let release = response.error_for_status().map_err(|e| e.to_string())?.json::<Release>().await.map_err(|e| e.to_string())?;
    evaluate_release(current, release, source)
}
async fn check_sources(current: &str, github: &str, gitee: &str, github_wait: Duration, gitee_wait: Duration) -> Result<UpdateStatus, String> {
    match request_update(github, current, Source::Github, github_wait).await {
        Ok(result) if result.latest_version.is_some() => Ok(result),
        _ => request_update(gitee, current, Source::Gitee, gitee_wait).await,
    }
}
#[tauri::command]
pub async fn check_app_update(app: tauri::AppHandle, startup: bool) -> Result<Option<UpdateStatus>, String> {
    if startup && STARTUP_CHECKED.swap(true, Ordering::Relaxed) { return Ok(None); }
    let status = check_sources(&app.package_info().version.to_string(), GITHUB_FEED, GITEE_FEED, GITHUB_WAIT, GITEE_WAIT).await?;
    *SELECTED.lock().map_err(|_| "Update state unavailable")? = Some(status.clone());
    Ok(Some(status))
}

#[derive(Clone, Copy)]
struct TransferBudget { headers: Duration, idle: Duration, window: Duration, min_bps: u64 }
impl TransferBudget {
    fn for_source(source: Source) -> Self { Self { headers: source.wait(), idle: source.wait(), window: Duration::from_secs(5), min_bps: if source == Source::Github { 64 * 1024 } else { 0 } } }
}
async fn download_one(url: &str, expected_hash: &str, budget: TransferBudget, source: Source, progress: &ProgressReporter<'_>) -> Result<Vec<u8>, String> {
    progress(DownloadProgress { stage: "connecting", source, downloaded: 0, total: None });
    let client = reqwest::Client::builder().no_proxy().timeout(Duration::from_secs(180)).build().map_err(|e| e.to_string())?;
    let mut response = tokio::time::timeout(budget.headers, client.get(url).header("User-Agent", "KennysVideo-Updater").send()).await.map_err(|_| "Installer connection too slow")?.map_err(|e| e.to_string())?.error_for_status().map_err(|e| e.to_string())?;
    let expected_length = response.content_length().filter(|length| *length > 0);
    if expected_length.unwrap_or(0) > MAX_INSTALLER_BYTES as u64 { return Err("Installer exceeds size limit".into()); }
    let started = Instant::now(); let mut bytes = Vec::new();
    let mut last_report = Instant::now();
    progress(DownloadProgress { stage: "downloading", source, downloaded: 0, total: expected_length });
    loop {
        let chunk = tokio::time::timeout(budget.idle, response.chunk()).await.map_err(|_| "Installer download stalled")?.map_err(|e| e.to_string())?;
        match chunk {
            Some(chunk) => {
                if bytes.len() + chunk.len() > MAX_INSTALLER_BYTES { return Err("Installer exceeds size limit".into()); }
                bytes.extend_from_slice(&chunk);
                if last_report.elapsed() >= Duration::from_millis(100) {
                    progress(DownloadProgress { stage: "downloading", source, downloaded: bytes.len() as u64, total: expected_length });
                    last_report = Instant::now();
                }
                if budget.min_bps > 0 && started.elapsed() >= budget.window && bytes.len() as f64 / started.elapsed().as_secs_f64() < budget.min_bps as f64 { return Err("Installer download speed too low".into()); }
            }, None => break,
        }
    }
    if expected_length.map_or(false, |n| n != bytes.len() as u64) || !bytes.starts_with(b"MZ") { return Err("Incomplete or invalid Windows installer".into()); }
    progress(DownloadProgress { stage: "verifying", source, downloaded: bytes.len() as u64, total: Some(bytes.len() as u64) });
    if !format!("{:x}", Sha256::digest(&bytes)).eq_ignore_ascii_case(expected_hash) { return Err("Installer checksum mismatch".into()); }
    Ok(bytes)
}
async fn download_sources_with_progress(primary: &str, fallback: &str, expected_hash: &str, source: Source, primary_budget: TransferBudget, fallback_budget: TransferBudget, progress: &ProgressReporter<'_>) -> Result<(Vec<u8>, Source), String> {
    match download_one(primary, expected_hash, primary_budget, source, progress).await {
        Ok(bytes) => Ok((bytes, source)),
        Err(primary_error) if source == Source::Github => {
            progress(DownloadProgress { stage: "fallback", source: Source::Gitee, downloaded: 0, total: None });
            download_one(fallback, expected_hash, fallback_budget, Source::Gitee, progress).await.map(|bytes| (bytes, Source::Gitee)).map_err(|e| format!("GitHub: {}; Gitee: {}", primary_error, e))
        },
        Err(error) => Err(error),
    }
}
#[cfg(test)]
async fn download_sources(primary: &str, fallback: &str, expected_hash: &str, source: Source, primary_budget: TransferBudget, fallback_budget: TransferBudget) -> Result<(Vec<u8>, Source), String> {
    download_sources_with_progress(primary, fallback, expected_hash, source, primary_budget, fallback_budget, &|_| {}).await
}
struct DownloadGuard;
impl Drop for DownloadGuard { fn drop(&mut self) { DOWNLOADING.store(false, Ordering::Relaxed); } }
#[tauri::command]
pub async fn download_app_update(app: tauri::AppHandle) -> Result<DownloadedUpdate, String> {
    if DOWNLOADING.swap(true, Ordering::Relaxed) { return Err("An update download is already running".into()); }
    let _guard = DownloadGuard;
    *INSTALLER.lock().map_err(|_| "Update state unavailable")? = None;
    let status = SELECTED.lock().map_err(|_| "Update state unavailable")?.clone().ok_or("Check for updates first")?;
    if !status.available { return Err("No new version available".into()); }
    let hash = status.sha256.as_deref().ok_or("The release has no installer checksum; use manual download")?;
    let version = status.latest_version.as_deref().ok_or("Missing version")?;
    let tag = status.tag.as_deref().ok_or("Missing release tag")?;
    let report = |progress: DownloadProgress| {
        if let (Some(window), Ok(payload)) = (app.get_webview_window("main"), serde_json::to_string(&progress)) {
            // Reuse the desktop event bridge; payload contains only enums and byte counts.
            let _ = window.eval(format!("window.dispatchEvent(new CustomEvent('app-update-progress',{{detail:{payload}}}))"));
        }
    };
    let (bytes, source) = download_sources_with_progress(&installer_url(status.source, tag, version), &installer_url(Source::Gitee, tag, version), hash, status.source, TransferBudget::for_source(status.source), TransferBudget::for_source(Source::Gitee), &report).await?;
    let downloaded = bytes.len() as u64;
    let directory = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("updates");
    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let nonce = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
    let path = directory.join(format!("KennysVideo-{}-{}.exe", version, nonce)); let partial = path.with_extension("part");
    std::fs::write(&partial, bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&partial, &path).map_err(|e| e.to_string())?;
    *INSTALLER.lock().map_err(|_| "Update state unavailable")? = Some((path, hash.to_owned()));
    if let Some(selected) = SELECTED.lock().map_err(|_| "Update state unavailable")?.as_mut() { selected.source = source; }
    report(DownloadProgress { stage: "ready", source, downloaded, total: Some(downloaded) });
    Ok(DownloadedUpdate { source, bytes: downloaded })
}
#[tauri::command]
pub fn install_app_update(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    { let (path, hash) = INSTALLER.lock().map_err(|_| "Update state unavailable")?.clone().ok_or("Download a verified installer first")?;
      let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
      if !format!("{:x}", Sha256::digest(&bytes)).eq_ignore_ascii_case(&hash) { return Err("Cached installer checksum mismatch".into()); }
      std::process::Command::new(path).spawn().map_err(|e| e.to_string())?; app.exit(0); Ok(()) }
    #[cfg(not(target_os = "windows"))]
    { let _ = app; Err("Only Windows installers are supported".into()) }
}
#[tauri::command]
pub fn open_app_download_page() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    { let source = SELECTED.lock().map_err(|_| "Update state unavailable")?.as_ref().map_or(Source::Gitee, |status| status.source);
      std::process::Command::new("explorer.exe").arg(format!("{}/releases/latest", source.repo())).spawn().map_err(|e| e.to_string())?; Ok(()) }
    #[cfg(not(target_os = "windows"))]
    { Err("Update download is available in the Windows edition".into()) }
}
