const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '../public');
const output = path.join(__dirname, '../dist-windows');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
        await page.route('https://theme.test/**', async route => {
            const name = new URL(route.request().url()).pathname.slice(1) || 'index.html';
            const file = path.resolve(root, name);
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.abort();
            const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
            let body = fs.readFileSync(file);
            if (name === 'index.html') body = body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
            return route.fulfill({ contentType: type, body });
        });
        await page.goto('https://theme.test/');
        await page.addScriptTag({ path: path.join(root, 'libs/tailwindcss.min.js') });
        await page.evaluate(() => {
            document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden'));
            document.querySelector('#page-home').classList.remove('hidden');
        });
        await page.waitForTimeout(300);
        assert.equal(await page.locator('h1.brand-wordmark').textContent(), 'KennysVideo');
        assert.equal(await page.locator('[data-page="sources"]').count(), 0);
        assert.equal(await page.locator('#page-sources').count(), 0);
        const wordmarkStyle = await page.locator('h1.brand-wordmark').evaluate(el => {
            const style = getComputedStyle(el);
            return { display: style.display, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom };
        });
        assert(parseFloat(wordmarkStyle.paddingTop) > 0 && parseFloat(wordmarkStyle.paddingBottom) > 0);
        fs.mkdirSync(output, { recursive: true });
        await page.locator('#page-home header').screenshot({ path: path.join(output, 'KennysVideo-logo-preview.png') });
        await page.evaluate(() => {
            document.querySelector('#page-home').classList.add('hidden');
            document.querySelector('#page-settings').classList.remove('hidden');
        });
        assert.equal(await page.locator('#page-settings .theme-action').count(), 3);
        const normal = await page.locator('#page-settings .theme-action').first().evaluate(el => getComputedStyle(el).backgroundImage);
        assert(normal.includes('7, 89, 133') && normal.includes('17, 94, 89'));
        await page.locator('#page-settings .theme-action').first().hover();
        const hover = await page.locator('#page-settings .theme-action').first().evaluate(el => getComputedStyle(el).backgroundImage);
        assert(hover.includes('3, 105, 161') && hover.includes('15, 118, 110'));
        const actions = page.locator('#page-settings .theme-action').first().locator('..');
        await actions.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await page.mouse.move(0, 0);
        await actions.screenshot({ path: path.join(output, 'KennysVideo-settings-preview.png') });
        // WCAG contrast: button text must pass against both ends of normal and hover gradients.
        const luminance = rgb => rgb.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        for (const background of [[7, 89, 133], [17, 94, 89], [3, 105, 161], [15, 118, 110]]) {
            assert((luminance([240, 249, 255]) + 0.05) / (luminance(background) + 0.05) >= 4.5);
        }
        console.log('PASS branded logo, three settings actions, hover colors, text contrast >=4.5:1');
        await page.addScriptTag({ path: path.join(root, 'js/poster_images.js') });
        await page.addScriptTag({ path: path.join(root, 'js/carousel_controls.js') });
        await page.addScriptTag({ path: path.join(root, 'js/douban_ui.js') });
        await page.route('https://working-cover.test/**', async route => {
            await new Promise(resolve => setTimeout(resolve, 500));
            await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="300" height="450" fill="#165570"/><text x="150" y="225" fill="white" text-anchor="middle" font-size="24">视频自己的海报</text></svg>' });
        });
        await page.route('https://missing-cover.test/**', route => route.abort());
        await page.evaluate(() => {
            document.querySelector('body').innerHTML = '<div id="coverPreview" class="flex gap-4 p-4"></div>';
            renderDoubanCardsAsCarousel({ subjects: [
                { title: '暂无封面', cover: '', rate: '8.0' },
                { title: '封面加载失败', cover: 'https://missing-cover.test/poster.jpg', rate: '8.5' },
                { title: '海报加载成功', cover: 'https://working-cover.test/poster.svg', rate: '8.8' },
                { title: '新接口海报', cover_url: 'https://working-cover.test/new-poster.svg', score: '9.4' }
            ] }, document.querySelector('#coverPreview'), 'tv', '国产剧');
        });
        assert(await page.locator('#coverPreview img').evaluateAll(images => images.every(img => img.src.endsWith('poster-placeholder.svg'))), 'All cards must initially display the local placeholder');
        await page.waitForFunction(() => {
            const images = [...document.querySelectorAll('#coverPreview img')];
            return images.every(img => img.complete && img.naturalWidth === 300)
                && images.slice(0, 2).every(img => img.dataset.posterState === 'fallback' && img.src.endsWith('poster-placeholder.svg'))
                && images.slice(2).every(img => img.dataset.posterState === 'cover' && img.src.startsWith('https://working-cover.test/'));
        });
        await page.locator('#coverPreview').screenshot({ path: path.join(output, 'KennysVideo-cover-preview.png') });
        console.log('PASS placeholder first, real poster on successful load, local fallback on missing/failed cover');
        await page.setViewportSize({ width: 760, height: 600 });
        await page.evaluate(() => {
            document.body.innerHTML = '<section class="p-4"><h2 class="mb-3 text-xl">欧美</h2><div class="carousel-container pb-2"><div id="scrollTest" class="carousel-track flex space-x-3"></div></div></section>';
            renderDoubanCardsAsCarousel({ subjects: Array.from({ length: 10 }, (_, i) => ({ title: `影片 ${i + 1}`, rate: '8.0' })) }, document.querySelector('#scrollTest'), 'movie', '欧美');
        });
        const carousel = page.locator('.carousel-container');
        await page.waitForFunction(() => !document.querySelector('.carousel-controls').hidden);
        const scrollbar = await carousel.evaluate(el => ({ width: el.clientWidth, total: el.scrollWidth, display: getComputedStyle(el, '::-webkit-scrollbar').display, color: getComputedStyle(el).scrollbarColor }));
        assert(scrollbar.total > scrollbar.width);
        assert.notEqual(scrollbar.display, 'none');
        assert(scrollbar.color.includes('56, 189, 248'));
        assert.equal(await page.getByRole('button', { name: '向左浏览影片' }).isDisabled(), true);
        await page.getByRole('button', { name: '向右浏览影片' }).click();
        await page.waitForFunction(() => document.querySelector('.carousel-container').scrollLeft > 100);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(output, 'KennysVideo-carousel-preview.png') });
        await carousel.focus();
        await page.keyboard.press('ArrowLeft');
        await page.waitForFunction(() => document.querySelector('.carousel-container').scrollLeft <= 1);
        await page.evaluate(() => {
            const el = document.querySelector('.carousel-container');
            el.scrollLeft = el.scrollWidth;
        });
        await page.waitForFunction(() => document.querySelector('[aria-label="向右浏览影片"]').disabled);
        await page.evaluate(() => renderDoubanCardsAsCarousel({ subjects: [{ title: '只有一部影片', rate: '8.0' }] }, document.querySelector('#scrollTest'), 'movie', '欧美'));
        await page.waitForFunction(() => document.querySelector('.carousel-controls').hidden);
        assert.equal(await page.locator('.carousel-controls').count(), 1);
        console.log('PASS visible scrollbar, page buttons, keyboard scrolling, boundary states, no duplicate controls');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
