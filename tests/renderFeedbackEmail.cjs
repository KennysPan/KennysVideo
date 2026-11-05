const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
    const root = path.resolve(__dirname, '..');
    const browser = await chromium.launch({channel:'msedge',headless:true});
    try {
        const page = await browser.newPage({viewport:{width:800,height:1120}});
        await page.setContent(fs.readFileSync(path.join(root,'dist-windows/feedback-email-preview.html'),'utf8'));
        await page.screenshot({path:path.join(root,'dist-windows/feedback-email-preview.png'),fullPage:true});
        await page.setViewportSize({width:360,height:800});
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.screenshot({path:path.join(root,'dist-windows/feedback-email-preview-mobile.png'),fullPage:true});
        console.log('PASS HTML email 800px preview and 360px layout; actual mailbox rendering requires confirmation');
    } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
