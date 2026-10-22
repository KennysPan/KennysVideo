![KennysVideo banner](KennysVideo-banner.png)

# KennysVideo

[简体中文](README.md) | **English**

KennysVideo is an open-source Windows video client for discovering titles, searching configured sources, streaming video, selecting episodes, and keeping viewing history. Install the packaged application to get started; end users do not need to deploy a local server, database, or development environment.

This project is maintained by **KennysPan** and is based on [KeyRotate/LibreTV-App](https://github.com/KeyRotate/LibreTV-App), whose upstream is [LibreSpark/LibreTV](https://github.com/LibreSpark/LibreTV). It focuses on Windows window management, fullscreen playback, poster loading, consistent branding, and updates through GitHub and Gitee.

[Download from GitHub](https://github.com/KennysPan/KennysVideo/releases/latest) · [Download from Gitee](https://gitee.com/kennysPan/kennys-video/releases/latest) · [Changelog](CHANGELOG.md) · [License and attribution](#license-and-attribution)

This is English project documentation. The current application interface is primarily in Simplified Chinese.

## Overview

| Item | Details |
| --- | --- |
| Supported release platform | Windows x64 |
| Application | Tauri desktop client, available as an installer or a portable executable |
| Main technologies | Rust, Tauri, HTML, CSS, JavaScript, Tailwind CSS, DPlayer, hls.js |
| Runtime | Microsoft Edge WebView2 |
| Distribution | GitHub and Gitee, with in-app version checks and update downloads |
| Repository | Client source, optional maintainer-operated feedback service, build instructions, tests, and releases |

The upstream project has cross-platform foundations, but this fork currently maintains and distributes Windows x64 builds. Other platform configuration files do not imply that corresponding releases have been tested or provided.

## Features

### Discovery and search

- Browse recommendations, categories, ratings, titles, and posters supplied by third-party Douban-related interfaces.
- Explore movies, TV series, variety shows, animation, documentaries, and short films.
- Browse recommendation rows with horizontal scrollbars and previous/next buttons, and use the floating back-to-top button on long pages.
- Search selected built-in or custom sources by title or keyword and open results to view details and episodes.
- Add, edit, enable, or remove custom APIs, including an optional separate detail endpoint.
- Filter titles by content type, genre, region, and available sorting options; the exact filters depend on the selected interface mode.

Custom APIs must return a supported video-source data structure. An arbitrary website URL is not necessarily a compatible API. The former standalone source-library page has been removed; custom APIs remain available for search, details, and playback.

### Playback and episodes

- DPlayer controls for play/pause, volume, mute, seeking, playback speed, time display, and screenshots where supported.
- HLS/M3U8 playback through hls.js, with buffering, segment retry, and some media-error recovery.
- Previous/next episode controls, episode selection, order switching, and optional automatic playback of the next episode.
- Save playback position and attempt to resume it when the stored record and current media allow it.
- Adjust video fit and vertical positioning for different aspect ratios.
- Use native desktop fullscreen with the player and control bar adjusted to the screen; normal windows use a more compact playback area.
- Keyboard controls, including Alt + Left for the previous episode and Alt + Right for the next episode.

Playback, screenshots, speed changes, and error recovery depend on the format, source, and runtime. No client-side handling can guarantee that every third-party stream will work.

### Posters and local data

- Display a local branded placeholder first, replacing it when the real poster loads successfully.
- Keep the fallback image when the source has no poster or an image request fails.
- Use a shared poster-loading path across discovery, search, and filtering views.
- Load supported Douban HTTPS images through Rust, checking the response type, file signature, and size. Images are limited to 5 MiB each; the frontend uses a bounded cache and up to four concurrent requests.
- Keep up to 50 viewing-history records, including source, episode, and playback position, along with search history.
- Export settings, selected sources, custom sources, and related history as JSON, and import them with format and data-digest checks.
- Export configurations as `KennysVideo-Settings_<timestamp>.json`; older `LibreTV-Settings_*.json` exports remain importable.

History and most preferences are stored in the local WebView's `localStorage`, without account-based cloud synchronization. The native application saves close-button preferences separately in its configuration directory.

### Windows desktop experience

- Start in a centered, resizable 1000 × 680 window with the native Windows title bar.
- Run as a single instance: launching the application again restores and focuses the existing window.
- On close, choose between exiting and minimizing to the system tray, with Confirm, Cancel, and a remember-choice checkbox.
- Each new close confirmation defaults to minimizing to the tray. Remembered behavior can be changed in Settings.
- Restore the window from the tray or use the tray menu to exit. The title-bar minimize button retains its normal taskbar behavior.
- Use consistent application, taskbar, tray, shortcut, and installer icons.
- Prevent ordinary interface text, including close-dialog labels, from being selected while retaining normal editing and copying in input fields.

### Notices and content controls

- Show the resource and advertising notice on every full application startup, without repeating it when returning from playback during the same run.
- Explain that resources originate from third-party online sources and that infringement reports can be submitted through **反馈 BUG** (Report a bug).
- Remind viewers not to trust advertisements embedded in videos, both in the startup notice and before playback.
- Provide content filtering, HLS segment-ad filtering, recommendation visibility, and Douban interface-mode settings.

Segment filtering only handles recognizable cases and does not remove every advertisement. The project does not store, upload, or distribute video files; availability and content depend on external sources.

### In-app bug reports

- Open the feedback form from Settings or the player and provide a title, description, optional reproduction steps, and an optional reply email address.
- Submit through the maintainer's HTTPS service without opening an email application. A non-empty description is sufficient; maximum lengths and basic validation still apply.
- Preserve entered text after failure and reuse request identifiers for retries to avoid duplicate queue entries.
- Store accepted reports in a durable server queue, then forward them through QQ SMTP as HTML email with a plain-text alternative.
- Keep SMTP credentials exclusively on the server. The client does not automatically attach screenshots, logs, viewing history, video URLs, or custom API configurations.
- Retain reports on the feedback server for up to 30 days. Mailbox copies are separate from server retention.

The optional service uses Python, Gunicorn, SQLite, and Nginx. Ordinary users do not need to host it. A successful submission means the report was saved for delivery; it does not by itself confirm mailbox receipt. See [service source and deployment instructions](server/feedback/) and [verification notes](docs/bug-feedback.md).

## Updates and installation

1. The app checks for a new version at startup; Settings also provides a manual check.
2. Version checks try GitHub first with a three-second budget and fall back to Gitee when GitHub times out, fails, or returns unusable release information.
3. Downloads also try GitHub first. Connection timeouts, stalled reads, or an average speed below 64 KiB/s after at least five seconds can trigger a retry from Gitee for the same version.
4. Switching sources starts the download again; it is not resumable downloading.
5. The progress display shows the source, actual downloaded bytes, total size when known, and percentage. Unknown sizes use an indeterminate state. The bar reaches 100% only after verification and saving succeed.
6. The installer is checked against the published SHA256 before installation. The user explicitly chooses when to close the app and launch the installer.

The installer supports first-time installation and upgrading an existing installer-managed copy in place, retaining settings and history. The legacy application identifier is preserved to support upgrades from LibreTV. Downgrades are blocked. Arbitrary portable copies in other folders are not treated as installed applications.

### Downloads

| File | Purpose |
| --- | --- |
| `KennysVideo-<version>-x64-setup.exe` | Recommended installer for first-time installation and upgrades. |
| `KennysVideo-<version>-x64.exe` | Portable Windows executable. |
| `KennysVideo-<version>-source.zip` | Full source package with license, attribution, build instructions, and test scripts. |

Both [GitHub releases](https://github.com/KennysPan/KennysVideo/releases/latest) and [Gitee releases](https://gitee.com/kennysPan/kennys-video/releases/latest) provide download files. WebView2 is required; third-party recommendations, posters, and streams also require their network services to be available.

The default branches contain the complete maintained client and feedback-service source. Tags for 1.1.14 and earlier were created before the full source was added, so their automatically generated source archives may contain only release-repository documents. Use the explicitly versioned `source.zip` attachment to reproduce those releases.

### Publisher information and Windows signing

Application and installer file properties identify the maintainer as **KennysPan**. This metadata is not a verified digital signature. Current releases are not signed with a publicly trusted Windows Authenticode certificate, and Windows Smart App Control may block execution. SHA256 verification checks file integrity against the release digest; it does not certify the publisher. See [Windows signing notes](docs/windows-signing.md).

## Technology stack

| Technology | Responsibility |
| --- | --- |
| Tauri 2 and Rust 2021 | Desktop runtime, native commands, window control, tray behavior, and integration with the frontend. |
| HTML, CSS, JavaScript, Tailwind CSS | Discovery, search, filters, history, settings, player pages, and theme styling. |
| DPlayer and hls.js | Player controls, HLS loading, buffering, and media-error handling. |
| reqwest and Tokio | Native HTTP requests, asynchronous work, timeouts, and streamed update downloads. |
| Serde and serde_json | Configuration, source responses, and release metadata. |
| scraper | HTML parsing for supported detail sources. |
| sha2 and Base64 | Installer SHA256 verification and image encoding. |
| tauri-plugin-single-instance | Duplicate-launch detection and restoration of the existing window. |
| WebView2 | Windows web frontend runtime. |
| NSIS and Tauri CLI | Windows packaging, upgrades, shortcuts, and uninstallation. |
| Python, Gunicorn, SQLite, Nginx, SMTP | Optional maintainer-operated feedback API, persistent delivery queue, and email forwarding. |
| Node.js/npm and Cargo | Build dependencies, development commands, and native compilation. |
| Playwright, Node.js, Python, PowerShell | Regression checks and release preparation. |

Packaged application users do not need Rust, Node.js, or Python. Although the upstream dependency list includes Express and other Node.js libraries, this desktop client loads static frontend assets and uses native Rust commands for its relevant networking; users do not need a separate Express server.

## Source layout and build

| Path | Contents |
| --- | --- |
| `public/index.html` | Main discovery, search, filter, history, and settings interface. |
| `public/player.html` | Player and episode controls. |
| `public/js/`, `public/css/` | Frontend behavior, styling, updates, feedback, and window interactions. |
| `public/libs/`, `public/image/` | Frontend libraries, icons, branding, and fallback images. |
| `src-tauri/src/lib.rs` | Native command registration and application initialization. |
| `src-tauri/src/app_updates.rs` | Release checks, download fallback, progress, and installer verification. |
| `src-tauri/src/poster_images.rs` | Restricted poster fetching and validation. |
| `src-tauri/src/window_close.rs`, `system_tray.rs` | Close preferences and tray behavior. |
| `src-tauri/tauri.windows.conf.json`, `installer-template.nsi` | Windows window and installer configuration. |
| `server/feedback/` | Feedback API, email template, deployment examples, and API contract; no production credentials. |
| `tests/`, `docs/`, `BUILDING.md` | Regression scripts, feature notes, and build/release instructions. |

For Windows development, install Node.js/npm, Rust, the MSVC C++ build tools, the Windows SDK, and WebView2. From the repository root:

```powershell
npm ci
npm run dev
```

Build the Windows x64 NSIS installer:

```powershell
rustup target add x86_64-pc-windows-msvc
npm run tauri -- build --bundles nsis --target x86_64-pc-windows-msvc -- --locked
```

The installer is normally written to `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`. See [BUILDING.md](BUILDING.md) for the maintained build instructions. Release helpers include `tests/prepareRelease.py` and `tests/packageSource.py`.

## Verification and reporting issues

The repository contains browser checks for posters, title clicks, scrolling, fullscreen geometry, startup notices, close dialogs, feedback, and update progress; Rust tests cover update metadata, fallback, progress, and verification. Windows-specific checks use PowerShell. Browser checks use Playwright with Edge; see the scripts and documentation for their dependencies.

Local tests, simulated services, live API checks, and native desktop checks provide different evidence. Browser validation is not a substitute for a complete native WebView2 desktop test. Known verification limits are recorded in the corresponding feature documentation.

Report issues through the in-app feedback form or repository Issues. Include the app version, Windows version, reproduction steps, expected behavior, and actual result. For playback problems, include the source name and whether the problem occurs consistently.

## License and attribution

- Fork base: [KeyRotate/LibreTV-App](https://github.com/KeyRotate/LibreTV-App).
- Upstream: [LibreSpark/LibreTV](https://github.com/LibreSpark/LibreTV).
- Maintainer of this fork: [KennysPan](https://github.com/KennysPan).

Thanks to the original authors and contributors. This fork retains the upstream Apache License 2.0, copyright notices, [LICENSE](LICENSE), [NOTICE](NOTICE), and third-party licenses. Individual components remain subject to their respective licenses.

[GitHub repository](https://github.com/KennysPan/KennysVideo) · [Gitee repository](https://gitee.com/kennysPan/kennys-video)
