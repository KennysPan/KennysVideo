// Opt-in: sends one clearly marked email using the actual frontend and live provider.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../public');
const server = http.createServer((req, res) => {
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end('<!doctype html><html lang="zh-CN"><body></body></html>'); }
    const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', ({ '.css': 'text/css', '.js': 'application/javascript' })[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
});
(async () => {
    assert(process.argv.includes('--send-test-email'), 'Requires explicit --send-test-email');
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: !process.argv.includes('--headed'), args: ['--no-proxy-server'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
        page.on('requestfailed', request => { if (request.url().startsWith('https://www.kennyspan.xyz/')) console.log('Feedback network failure:', request.failure()?.errorText); });
        page.on('console', message => { if (message.type() === 'error') console.log('Browser error:', message.text()); });
        // Serve only our test document at the Windows Tauri origin. Do not intercept
        // the HTTPS feedback API: its preflight, request, and response are real.
        await page.route('http://tauri.localhost/**', route => route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
        await page.goto('http://tauri.localhost/');
        await page.setContent('<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><body style="background:#101722;color:white;font-family:system-ui"><h1>KennysVideo · 反馈通道测试</h1></body></html>');
        await page.addStyleTag({ path: path.join(root, 'css/bug_report.css') });
        for (const script of ['config.js', 'bug_report_config.js', 'bug_report.js']) await page.addScriptTag({ path: path.join(root, 'js', script) });
        await page.evaluate(() => openBugReport());
        const title = '反馈通道接入测试 ' + new Date().toISOString();
        await page.locator('#bugReportDialog [name=title]').fill(title);
        await page.locator('#bugReportDialog [name=description]').fill('这是一封 KennysVideo 反馈通道接入测试邮件，由维护者授权发送。用于确认当前反馈表单可以向维护者邮箱提交报告，无需处理为真实 BUG。');
        await page.locator('#bugReportDialog [name=steps]').fill('当前待发布前端 → 禁用 HTTP 代理的 Edge → 开发者 HTTPS 反馈服务器 → QQ SMTP → 维护者接收邮箱。');
        const pending = page.waitForResponse(r => r.url() === 'https://www.kennyspan.xyz/api/kennysvideo/feedback' && r.request().method() === 'POST', { timeout: 25000 });
        await page.getByRole('button', { name: '发送报告', exact: true }).click();
        let response;
        try { response = await pending; } catch (error) {
            console.log('Feedback status:', await page.locator('.bug-report-status').innerText());
            await page.screenshot({ path: path.resolve(root, '../dist-windows/KennysVideo-bug-report-live-failure.png') });
            throw error;
        }
        const result = await response.json();
        assert(response.ok() && result.success === true, `Provider rejected: ${response.status()} ${JSON.stringify(result)}`);
        await page.getByText('报告已提交，服务器已保存并加入发送队列。感谢你的反馈！', { exact: true }).waitFor();
        await page.screenshot({ path: path.resolve(root, '../dist-windows/KennysVideo-bug-report-live.png') });
        console.log(JSON.stringify({ environment: 'Edge with current frontend at Windows Tauri origin, HTTP proxy disabled; not native WebView2', status: response.status(), success: result.success, report_id: result.report_id, title, mailboxDelivery: 'requires recipient confirmation' }));
    } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
