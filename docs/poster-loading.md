# Desktop poster loading

The home carousel accepts both `cover` (search subjects) and `cover_url` (chart/newer results). It must not discard `cover_url` when `cover` is absent.

The image initially uses the bundled KennysVideo SVG. A successfully decoded real cover replaces it; missing, rejected, or undecodable covers keep the fallback.

## Native IPC contract

`fetch_poster_image({ url: string }) -> Promise<string>` returns a validated `data:image/...;base64,...` URI. Errors reject the promise. This is not a public HTTP service and requires no deployed server or user credentials.

- Only HTTPS Douban image hosts and `/view/photo/` paths, with the standard HTTPS port, are accepted. Redirects are disabled.
- Requests include `Referer: https://movie.douban.com/`, a desktop User-Agent and an image Accept header.
- Only JPEG, PNG, WebP and GIF responses with matching file signatures are accepted; the body is limited to 5 MiB and requests time out after 15 seconds.
- The frontend shares matching downloads, limits concurrent native image requests to four, and keeps at most 128 cached promises per page session. Failed downloads may fall back to a direct image request, then to the bundled SVG.

## Evidence and checks

Live diagnosis on 2026-10-20: the chart endpoint returned `cover_url` without `cover`. A real poster request without the expected source header returned HTTP 418; two requests with the matching source header returned HTTP 200 JPEG (23721 and 33076 bytes).

`tests/appTheme.cjs` checks placeholder-first behavior, successful and failed remote images, and results containing only `cover_url`. Rust tests in `src-tauri/src/poster_images.rs` validate allowed addresses and include an explicitly ignored live download test. Live network tests must be run separately from offline checks.

The Postman CLI is not installed in this environment. Live downloads use the actual Rust client. `tests/renderLivePosters.cjs` renders captured live responses with an IPC adapter in Edge, checks decoded dimensions, and saves a screenshot. The native WebView2 smoke attempt could not establish its debugging connection, so native-window end-to-end verification is incomplete. No Postman simulation run is claimed.
