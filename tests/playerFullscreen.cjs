const { chromium } = require('playwright');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        for (const viewport of [{ width: 800, height: 600 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
            const page = await browser.newPage({ viewport });
            await page.route('https://player.test/', route => route.fulfill({ contentType: 'text/html', body: '<body><header class="player-header">KennysVideo</header><main><div id="playerContainer"><div class="relative"><div id="player"></div></div></div></main></body>' }));
            await page.goto('https://player.test/');
            for (const file of ['css/styles.css', 'css/player.css']) {
                await page.addStyleTag({ path: path.join(__dirname, '../public', file) });
            }
            await page.addScriptTag({ path: path.join(__dirname, '../public/libs/DPlayer.min.js') });
            await page.addScriptTag({ path: path.join(__dirname, '../public/js/player_fullscreen.js') });
            await page.evaluate(() => {
                window.nativeCalls = [];
                window.__TAURI_INTERNALS__ = { invoke: async (command, args) => { nativeCalls.push({ command, args }); } };
                window.player = new DPlayer({ container: document.getElementById('player'), video: { url: '', type: 'normal' } });
                setupPlayerFullscreen(player);
            });
            const normalHeight = await page.locator('#player').evaluate(el => el.getBoundingClientRect().height);
            assert(normalHeight <= Math.min(460, viewport.height * 0.52) + 1);
            await page.evaluate(() => player.fullScreen.request());
            await page.waitForTimeout(100);
            const geometry = await page.evaluate(() => {
                player.controller.hide(); // Controls must survive DPlayer's idle-hide behavior.
                const controller = document.querySelector('.dplayer-controller');
                const rect = controller.getBoundingClientRect();
                const style = getComputedStyle(controller);
                const hit = document.elementFromPoint(rect.left + 30, rect.top + 20);
                const playerRect = player.container.getBoundingClientRect();
                return { bottom: rect.bottom, opacity: style.opacity, height: playerRect.height,
                    hitControls: !!hit?.closest('.dplayer-controller'), calls: nativeCalls };
            });
            assert.equal(geometry.height, viewport.height);
            assert(geometry.bottom <= viewport.height + 1);
            assert.equal(geometry.opacity, '1');
            assert(geometry.hitControls, 'Controls are covered by the video layer');
            assert.deepEqual(geometry.calls[0], { command: 'set_player_fullscreen', args: { fullscreen: true } });
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => !player.fullScreen.isFullScreen());
            assert.equal(await page.locator('body').evaluate(el => el.classList.contains('dplayer-custom-fullscreen-mode')), false);
            // An unsuccessful native operation must not leave a fake fullscreen layout behind.
            await page.evaluate(async () => {
                __TAURI_INTERNALS__.invoke = async () => { throw Error('test rejection'); };
                // Existing helper captures the original invoke; use a separate replacement instance.
                player.destroy();
                window.player = new DPlayer({ container: document.getElementById('player'), video: { url: '', type: 'normal' } });
                setupPlayerFullscreen(player);
                await player.fullScreen.request();
            });
            assert.equal(await page.locator('body').evaluate(el => el.classList.contains('dplayer-custom-fullscreen-mode')), false);
            console.log(`PASS ${viewport.width}x${viewport.height}: height, fullscreen bridge, visible controls, Escape, rejection recovery`);
            await page.close();
        }
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
