const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../public');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    let claimed = false;
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
        await page.exposeFunction('nativeNoticeClaim', () => { const first = !claimed; claimed = true; return first; });
        await page.addInitScript(() => {
            window.tauriConstants = { invoke: () => window.nativeNoticeClaim() };
        });
        await page.route('https://notice.test/**', route => {
            const name = new URL(route.request().url()).pathname.slice(1) || 'index.html';
            const file = path.resolve(root, name);
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.abort();
            let body = fs.readFileSync(file);
            if (name === 'index.html') body = body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace('</body>', '<script src="libs/tailwindcss.min.js"></script><script src="js/startup_disclaimer.js"></script></body>');
            return route.fulfill({ body, contentType: ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' })[path.extname(file)] || 'application/octet-stream' });
        });
        await page.goto('https://notice.test/');
        const notice = page.locator('#disclaimerModal');
        await notice.waitFor({ state: 'visible' });
        assert((await notice.innerText()).includes('切勿相信视频中的广告'));
        assert((await notice.innerText()).includes('如有侵权，请及时通过“反馈 BUG”反映'));
        await page.evaluate(() => localStorage.setItem('doubanEnabled', 'false'));
        await page.screenshot({ path: path.resolve(__dirname, '../dist-windows/KennysVideo-startup-disclaimer.png') });
        await page.locator('#acceptDisclaimerBtn').click();
        await notice.waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => localStorage.getItem('doubanEnabled')), 'false');
        await page.reload();
        assert.equal(await notice.isVisible(), false);
        // Simulate a fresh native process while retaining the same browser storage.
        claimed = false;
        await page.reload();
        await notice.waitFor({ state: 'visible' });
        await page.setViewportSize({ width: 480, height: 600 });
        const panel = await notice.locator('div').first().boundingBox();
        assert(panel.x >= 0 && panel.width <= 480 && panel.height <= 600);
        console.log('PASS actual startup script: notice on fresh launch, no repeat on reload, both warnings, preferences retained, 480px layout; native claim simulated');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
