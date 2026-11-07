const {chromium} = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  const page = await browser.newPage({acceptDownloads:true});
  await page.route('https://export.test/**', r => r.fulfill({contentType:'text/html',body:'<!doctype html><title>Configuration export test</title><input id="ChooseFile">'}));
  await page.goto('https://export.test/');
  await page.addScriptTag({path:path.join(__dirname,'../public/js/config_io.js')});
  const expected = {selectedAPIs:'["dyttzy","ruyi"]',doubanEnabled:'true',doubanApiMode:'true',kennysTheme:'violet',customAPIs:'[{"name":"中文测试","url":"https://private.example/api"}]'};
  await page.evaluate(data => {for(const [k,v] of Object.entries(data))localStorage.setItem(k,v);localStorage.setItem('authToken','not-exported')}, expected);
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => exportConfig());
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^KennysVideo-Settings_\d+\.KennysVideo$/);
  const exported = await fs.readFile(await download.path(),'utf8');
  assert(exported.startsWith('KennysVideo-Config/1\n'));
  assert(!exported.includes('private.example') && !exported.includes('中文测试'));
  assert.deepEqual(await page.evaluate(text=>KennysConfig.decode(text),exported), expected);
  await page.evaluate(() => {
   localStorage.clear();window.messages=[];
   window.showToast = text => messages.push(text);
   window.showImportBox = callback => {window.importFile=callback};
   // Avoid the success-path reload while inspecting restored values.
   window.setTimeout = () => 0;
  });
  await page.evaluate(() => importConfig());
  // Content identification must work even if the file was renamed or has no MIME.
  await page.evaluate(text=>importFile(new File([text],'renamed.bin',{type:''})),exported);
  const restored = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  assert.deepEqual(restored, expected);
  assert(await page.evaluate(() => messages.some(m=>m.includes('导入成功'))));
  await page.evaluate(() => importConfig());
  await page.evaluate(text => importFile(new File([text.slice(0,-8)],'bad.KennysVideo')),exported);
  assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))),expected);
  assert(await page.evaluate(() => messages.at(-1).includes('导入失败')));
  console.log('PASS: real desktop download filename/content, encrypted roundtrip, renamed-file import restores settings, damaged-file import leaves storage unchanged');
 } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
