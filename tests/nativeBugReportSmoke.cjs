// Opt-in: sends ONE real, clearly marked test email through the configured form.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
    assert(process.argv.includes('--send-test-email'), 'Requires explicit --send-test-email');
    const root = path.resolve(__dirname, '..');
    const server = net.createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    const instance = spawn(path.join(root, 'src-tauri/target/x86_64-pc-windows-msvc/release/app.exe'), [], {
        windowsHide: true, stdio: 'ignore', env: { ...process.env,
            WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
            WEBVIEW2_USER_DATA_FOLDER: path.join(root, 'src-tauri/target/qa-bug-report-profile')
        }
    });
    let browser;
    try {
        const endpoint = `http://127.0.0.1:${port}`;
        let ready = false;
        for (let attempt = 0; attempt < 100; attempt++) {
            if (instance.exitCode !== null) throw Error(`Native app exited: ${instance.exitCode}`);
            try { if ((await fetch(endpoint + '/json/version')).ok) { ready = true; break; } } catch {}
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        assert(ready, 'WebView2 debugging endpoint unavailable');
        browser = await chromium.connectOverCDP(endpoint);
        const page = browser.contexts()[0].pages().find(p => p.url().includes('tauri.localhost'));
        assert(page, 'Expected real Tauri origin');
        await page.waitForLoadState('domcontentloaded');
        await page.addStyleTag({ path: path.join(root, 'public/css/bug_report.css') });
        await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'public/js/bug_report_config.js'), 'utf8') });
        await page.addScriptTag({ path: path.join(root, 'public/js/bug_report.js') });
        await page.evaluate(() => openBugReport());
        const title = '反馈通道接入测试 ' + new Date().toISOString();
        await page.locator('#bugReportDialog [name=title]').fill(title);
        await page.locator('#bugReportDialog [name=description]').fill('这是一封 KennysVideo 反馈通道接入测试邮件，由维护者授权发送，用于确认 Windows 桌面端可以提交反馈，无需处理为真实 BUG。');
        await page.locator('#bugReportDialog [name=steps]').fill('真实 Tauri WebView2 → 当前待发布反馈弹窗 → Web3Forms → 已验证的维护者接收邮箱。');
        const responsePromise = page.waitForResponse(r => r.url() === 'https://api.web3forms.com/submit' && r.request().method() === 'POST', { timeout: 20000 });
        await page.getByRole('button', { name: '发送报告', exact: true }).click();
        const response = await responsePromise;
        const result = await response.json();
        assert(response.ok() && result.success === true, `Provider rejected: ${response.status()} ${JSON.stringify(result)}`);
        await page.getByText('报告已提交，邮件服务已接收。感谢你的反馈！', { exact: true }).waitFor();
        await page.screenshot({ path: path.join(root, 'dist-windows/KennysVideo-bug-report-live.png') });
        console.log(JSON.stringify({ origin: new URL(page.url()).origin, status: response.status(), success: result.success, title, mailboxDelivery: 'requires recipient confirmation' }));
    } finally {
        if (browser) await browser.close().catch(() => {});
        instance.kill();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
