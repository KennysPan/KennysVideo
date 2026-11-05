// Render actual results captured from the real Rust HTTP client.
// The IPC adapter is supplied by the harness; this does not claim a native-window smoke pass.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
    const root = path.join(__dirname, '..');
    const evidence = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri/target/live-posters.json'), 'utf8'));
    const metadata = JSON.parse(fs.readFileSync(path.join(root, 'cover-diagnostic.json'), 'utf8'));
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
        await page.route('https://poster.test/**', route => {
            if (new URL(route.request().url()).pathname === '/image/poster-placeholder.svg') {
                return route.fulfill({ contentType: 'image/svg+xml', body: fs.readFileSync(path.join(root, 'public/image/poster-placeholder.svg')) });
            }
            return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<meta charset="utf-8"><body><main style="padding:24px"><h1 class="gradient-text" style="font-size:28px;font-weight:700;margin-bottom:24px">KennysVideo · 真实海报</h1><div class="carousel-container"><div id="posters" class="carousel-track flex space-x-3"></div></div></main></body>' });
        });
        await page.goto('https://poster.test/');
        await page.addScriptTag({ path: path.join(root, 'public/libs/tailwindcss.min.js') });
        await page.addStyleTag({ path: path.join(root, 'public/css/styles.css') });
        for (const file of ['poster_images.js', 'carousel_controls.js', 'douban_ui.js']) {
            await page.addScriptTag({ path: path.join(root, 'public/js', file) });
        }
        await page.evaluate(({ evidence, metadata }) => {
            window.__TAURI_INTERNALS__ = { invoke: async (command, { url }) => {
                if (command !== 'fetch_poster_image') throw Error('Unexpected command');
                const result = evidence.find(([address]) => address === url);
                if (!result) throw Error('No captured live response');
                return result[1];
            } };
            const subjects = metadata.filter(item => evidence.some(([url]) => url === item.cover_url)).map(item => ({ ...item, rate: item.score }));
            renderDoubanCardsAsCarousel({ subjects }, document.querySelector('#posters'), 'movie', '科幻');
        }, { evidence, metadata });
        await page.waitForFunction(() => [...document.querySelectorAll('#posters img')].length === 2 && [...document.querySelectorAll('#posters img')].every(img => img.dataset.posterState === 'cover' && img.complete && img.naturalWidth > 100 && img.src.startsWith('data:image/')));
        const dimensions = await page.locator('#posters img').evaluateAll(images => images.map(image => ({ title: image.alt, width: image.naturalWidth, height: image.naturalHeight })));
        assert(dimensions.every(image => image.width > 100 && image.height > image.width));
        await page.screenshot({ path: path.join(root, 'dist-windows/KennysVideo-real-posters.png') });
        console.log('PASS real Rust-downloaded posters decoded and displayed:', JSON.stringify(dimensions));
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
