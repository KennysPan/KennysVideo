// Resolve static provider share pages without executing third-party scripts.
function extractPlaybackUrl(html, base) {
    const text = String(html).replace(/\\\//g, '/').replace(/&amp;/g, '&');
    const match = text.match(/["']((?:https?:\/\/|\/|\.\/)[^"'<>\s]+?\.(?:m3u8|mp4)(?:\?[^"'<>\s]*)?)["']/i);
    if (!match) return null;
    const url = new URL(match[1], base);
    return /^https?:$/.test(url.protocol) ? url.href : null;
}

async function resolvePlaybackSource(value) {
    const url = new URL(value, location.href);
    if (!/^https?:$/.test(url.protocol)) throw new Error('不支持的视频地址');
    if (!url.pathname.includes('/share/')) return url.href;
    const invoke = window.__TAURI__?.core?.invoke || window.__TAURI_INTERNALS__?.invoke;
    let body;
    if (invoke) {
        const response = await invoke('make_http_request', {options: {
            url: url.href, method: 'GET', timeout_secs: 10,
            headers: {Accept: 'text/html,application/vnd.apple.mpegurl,*/*'}
        }});
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`分享页访问失败（HTTP ${response.status}），请切换数据源或在浏览器打开`);
        }
        body = response.body;
    } else {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch(url.href, {signal: controller.signal});
            if (!response.ok) throw new Error(`分享页访问失败（HTTP ${response.status}）`);
            body = await response.text();
        } finally { clearTimeout(timer); }
    }
    if (String(body).trimStart().startsWith('#EXTM3U')) return url.href;
    const direct = extractPlaybackUrl(body, url.href);
    if (!direct) throw new Error('此分享页未提供可识别的视频直链，请切换数据源或复制链接到浏览器播放');
    return direct;
}
