const { chromium } = require('playwright');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        for (const mode of ['latest', 'new', 'empty', 'offline', 'download_error', 'install_error']) {
            const page = await browser.newPage();
            await page.setContent('<p id="appUpdateStatus"></p><button id="checkAppUpdateButton">检查更新</button>');
            await page.evaluate(mode => {
                window.calls = [];
                window.__TAURI_INTERNALS__ = { invoke: async (command, args) => {
                    window.calls.push({ command, args });
                    if (command === 'open_app_download_page') return;
                    if (command === 'install_app_update') { if (mode === 'install_error') throw Error('Cannot launch'); return; }
                    if (command === 'download_app_update') { if (mode === 'download_error') throw Error('Download failed'); return { source: 'gitee' }; }
                    if (mode === 'offline') throw Error('No network');
                    return { current_version: '1.1.7', latest_version: mode === 'empty' ? null : mode === 'latest' ? '1.1.7' : '1.1.10', available: !['latest', 'empty'].includes(mode), source: 'github' };
                } };
            }, mode);
            await page.addScriptTag({ path: path.join(__dirname, '../public/js/app_updates.js') });
            await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
            await page.waitForFunction(() => !document.querySelector('#checkAppUpdateButton').disabled);
            assert.equal(await page.evaluate(() => window.calls[0].args.startup), true);
            if (['new', 'download_error', 'install_error'].includes(mode)) {
                assert.equal(await page.locator('#appUpdateDialog').isVisible(), true);
                if (mode === 'new') {
                    await page.locator('.update-manual').click();
                    assert.equal(await page.evaluate(() => window.calls.at(-1).command), 'open_app_download_page');
                    await page.evaluate(() => checkAppUpdate(false));
                }
                await page.locator('.update-download').click();
                await page.waitForFunction(() => !document.querySelector('.update-download').disabled);
                assert.equal(await page.evaluate(() => window.calls.some(call => call.command === 'install_app_update')), false);
                if (mode === 'download_error') {
                    assert((await page.locator('.update-error').textContent()).includes('校验失败'));
                    assert.equal(await page.locator('.update-download').textContent(), '下载更新');
                } else {
                    assert((await page.locator('.update-error').textContent()).includes('Gitee'));
                    assert.equal(await page.locator('.update-download').textContent(), '关闭程序并安装');
                    await page.locator('.update-download').click();
                    assert.equal(await page.evaluate(() => window.calls.at(-1).command), 'install_app_update');
                    if (mode === 'install_error') {
                        await page.waitForFunction(() => !document.querySelector('.update-download').disabled);
                        assert((await page.locator('.update-error').textContent()).includes('安装器启动失败'));
                    }
                }
            } else {
                assert.equal(await page.locator('#appUpdateDialog').count(), 0);
                assert((await page.locator('#appUpdateStatus').textContent()).includes({ latest: '已是最新', empty: '尚无可用', offline: '不影响使用' }[mode]));
            }
            await page.close(); console.log('PASS update UI:', mode);
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
