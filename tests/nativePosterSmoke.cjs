// Launch an isolated test instance and exercise the real Rust IPC + real image servers.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
    const root = path.join(__dirname, '..');
    const executable = path.join(root, 'src-tauri/target/x86_64-pc-windows-msvc/release/app.exe');
    const server = net.createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    const instance = spawn(executable, [], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env,
            WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
            WEBVIEW2_USER_DATA_FOLDER: path.join(root, 'src-tauri/target/qa-poster-profile')
        }
    });
    let startupLog = '';
    instance.stdout.on('data', chunk => { startupLog += chunk.toString(); });
    instance.stderr.on('data', chunk => { startupLog += chunk.toString(); });
    let browser;
    try {
        const endpoint = `http://127.0.0.1:${port}`;
        let ready = false;
        for (let attempt = 0; attempt < 100; attempt++) {
            if (instance.exitCode !== null) throw Error(`Native app exited: ${instance.exitCode}. ${startupLog.slice(-3000)}`);
            try {
                const response = await fetch(`${endpoint}/json/version`);
                if (response.ok) { ready = true; break; }
            } catch { /* WebView2 is starting. */ }
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        assert(ready, `Native WebView2 debugging endpoint did not start. ${startupLog.slice(-3000)}`);
        browser = await chromium.connectOverCDP(endpoint);
        const context = browser.contexts()[0];
        const page = context.pages().find(p => p.url().includes('tauri.localhost')) || context.pages()[0];
        await page.waitForFunction(() => typeof window.__TAURI_INTERNALS__?.invoke === 'function' && typeof renderDoubanCardsAsCarousel === 'function');
        const metadata = JSON.parse(fs.readFileSync(path.join(root, 'cover-diagnostic.json'), 'utf8'));
        await page.evaluate(records => {
            document.body.innerHTML = '<main class="p-4"><h1 class="text-2xl font-bold gradient-text mb-4">KennysVideo · 真实海报检查</h1><div class="carousel-container pb-2"><div id="livePosters" class="carousel-track flex space-x-3"></div></div></main>';
            renderDoubanCardsAsCarousel({ subjects: records.slice(0, 3).map(item => ({ ...item, rate: item.score })) }, document.getElementById('livePosters'), 'movie', '科幻');
        }, metadata);
        await page.waitForFunction(() => [...document.querySelectorAll('#livePosters img')].length === 3
            && [...document.querySelectorAll('#livePosters img')].every(img => img.dataset.posterState === 'cover' && img.complete && img.naturalWidth > 0 && img.src.startsWith('data:image/')), null, { timeout: 45000 });
        const loaded = await page.locator('#livePosters img').evaluateAll(images => images.map(img => ({ title: img.alt, width: img.naturalWidth, height: img.naturalHeight })));
        console.log('PASS real native image downloads and decoded posters:', JSON.stringify(loaded));
        await page.screenshot({ path: path.join(root, 'dist-windows/KennysVideo-real-posters.png') });
    } finally {
        if (browser) await browser.close().catch(() => {});
        instance.kill();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
