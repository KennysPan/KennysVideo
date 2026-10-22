// Checks the compiled preview's embedded UI. Does not send feedback or start video playback.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
    const root = path.resolve(__dirname, '..');
    const socket = net.createServer();
    await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    const instance = spawn(path.join(root, 'src-tauri/target/x86_64-pc-windows-msvc/release/app.exe'), [], {
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env,
            WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
            WEBVIEW2_USER_DATA_FOLDER: path.join(root, 'src-tauri/target/qa-preview-profile')
        }
    });
    let log = '';
    instance.stdout.on('data', chunk => { log += chunk.toString(); });
    instance.stderr.on('data', chunk => { log += chunk.toString(); });
    let browser;
    try {
        let ready = false;
        const endpoint = `http://127.0.0.1:${port}`;
        for (let attempt = 0; attempt < 100; attempt++) {
            if (instance.exitCode !== null) throw Error(`Preview exited ${instance.exitCode}: ${log.slice(-1000)}`);
            try { if ((await fetch(endpoint + '/json/version')).ok) { ready = true; break; } } catch {}
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        assert(ready, 'Preview WebView2 debugging endpoint unavailable');
        browser = await chromium.connectOverCDP(endpoint);
        const page = browser.contexts()[0].pages().find(p => p.url().includes('tauri.localhost'));
        assert(page, 'Expected real Tauri document');
        await page.waitForFunction(() => typeof openBugReport === 'function' && typeof initSourceCatalog === 'function');
        await page.locator('[data-page="settings"]').click();
        await page.locator('#page-settings').waitFor({ state: 'visible' });
        await page.getByRole('button', { name: '反馈 BUG', exact: true }).click();
        assert(await page.getByRole('button', { name: '发送报告', exact: true }).isEnabled());
        await page.screenshot({ path: path.join(root, 'dist-windows/KennysVideo-preview-native-feedback.png') });
        await page.locator('#bugReportDialog [data-dismiss]').click();
        await page.locator('[data-page="sources"]').click();
        await page.locator('#page-sources').waitFor({ state: 'visible' });
        assert(await page.locator('#page-sources select').count() >= 2);
        const origin = new URL(page.url()).origin;
        await page.goto(origin + '/player.html?url=https%3A%2F%2Fexample.invalid%2Fpreview.m3u8&title=Preview');
        await page.locator('#playerAdNotice[open]').waitFor();
        await page.screenshot({ path: path.join(root, 'dist-windows/KennysVideo-preview-native-ad-notice.png') });
        console.log('PASS compiled preview: real Tauri WebView2, settings feedback ready, source catalog entry, watch-before-ad dialog; no feedback sent and no video started');
    } finally {
        if (browser) await browser.close().catch(() => {});
        instance.kill();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
