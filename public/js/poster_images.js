// Always paint our local placeholder first; swap only after a real cover has loaded.
const nativePosterCache = new Map();
const nativePosterQueue = [];
let activePosterDownloads = 0;

function pumpPosterDownloads() {
    while (activePosterDownloads < 4 && nativePosterQueue.length) nativePosterQueue.shift()();
}

function downloadNativePoster(url, invoke) {
    if (nativePosterCache.has(url)) return nativePosterCache.get(url);
    const request = new Promise((resolve, reject) => {
        nativePosterQueue.push(() => {
            activePosterDownloads++;
            Promise.resolve().then(() => invoke('fetch_poster_image', { url }))
                .then(resolve, reject).finally(() => {
                    activePosterDownloads--;
                    pumpPosterDownloads();
                });
        });
        pumpPosterDownloads();
    }).catch(error => {
        nativePosterCache.delete(url);
        throw error;
    });
    if (nativePosterCache.size >= 128) nativePosterCache.delete(nativePosterCache.keys().next().value);
    nativePosterCache.set(url, request);
    return request;
}

function resolvePosterSource(source) {
    const invoke = window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke;
    try {
        const address = new URL(source, window.location.href);
        if (typeof invoke === 'function' && address.hostname.endsWith('.doubanio.com')) {
            address.protocol = 'https:';
            return downloadNativePoster(address.href, invoke).catch(() => source);
        }
    } catch { /* Invalid source will be handled by the image error callback. */ }
    return Promise.resolve(source);
}

function createPosterImage(source, title, className, proxySource = '') {
    const image = document.createElement('img');
    image.src = 'image/poster-placeholder.svg';
    image.alt = title;
    image.className = className.replace(/\bobject-cover\b/g, 'object-contain');
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.dataset.cover = source || '';
    image.dataset.coverProxy = proxySource || '';
    image.dataset.posterState = 'placeholder';
    image.setAttribute('onload', 'loadPosterCover(this)');
    return image.outerHTML;
}

function loadPosterCover(image) {
    if (image.dataset.posterStarted) return;
    image.dataset.posterStarted = 'true';
    const placeholder = 'image/poster-placeholder.svg';
    const candidates = [...new Set([image.dataset.cover, image.dataset.coverProxy])]
        .filter(url => url && !url.includes('poster-placeholder.svg'));
    function tryNext() {
        const source = candidates.shift();
        if (!source) {
            image.dataset.posterState = 'fallback';
            return;
        }
        const cover = new Image();
        cover.referrerPolicy = 'no-referrer';
        cover.onload = () => {
            if (!image.isConnected || !cover.naturalWidth) return;
            image.onload = null;
            image.onerror = () => {
                image.onerror = null;
                image.src = placeholder;
                image.classList.replace('object-cover', 'object-contain');
                image.dataset.posterState = 'fallback';
            };
            image.src = cover.src;
            image.classList.replace('object-contain', 'object-cover');
            image.dataset.posterState = 'cover';
        };
        cover.onerror = tryNext;
        resolvePosterSource(source).then(resolved => {
            if (image.isConnected) cover.src = resolved;
        }).catch(tryNext);
    }
    tryNext();
}
