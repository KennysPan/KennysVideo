const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:900,height:640}});
  await page.setContent('<body style="font-family:Segoe UI,sans-serif;background:#0f1622;color:white"><h1>KennysVideo</h1></body>');
  await page.addScriptTag({path:path.join(__dirname,'../public/js/app_updates.js')});
  await page.evaluate(()=>{
   window.calls=[];
   window.openUpdate=()=>showAppUpdate({current_version:'1.1.11',latest_version:'1.1.12',source:'github'},async command=>{
    calls.push(command);
    if(command==='download_app_update')return new Promise((resolve,reject)=>{window.finish=resolve;window.fail=reject;});
   });openUpdate();
  });
  const send=progress=>page.evaluate(detail=>window.dispatchEvent(new CustomEvent('app-update-progress',{detail})),progress);
  const bar=page.locator('.update-progress');
  await page.locator('.update-download').click();
  assert.equal(await bar.getAttribute('value'),null);
  await send({stage:'downloading',source:'github',downloaded:3145728,total:5242880});
  assert.equal(await bar.getAttribute('value'),'60');
  assert.match(await page.locator('.update-bytes').innerText(),/3.00 MB \/ 5.00 MB/);
  await page.screenshot({path:path.join(__dirname,'../dist-windows/KennysVideo-update-progress.png')});
  assert.equal(await page.locator('#appUpdateTitle').isVisible(),false);
  assert.equal(await page.getByText(/优先使用 GitHub/).isVisible(),false);
  assert.equal(await page.locator('.update-error').isVisible(),false);
  assert.equal(await page.locator('.update-download').isVisible(),false);
  await send({stage:'verifying',source:'github',downloaded:5242880,total:5242880});
  assert.equal(await bar.getAttribute('value'),'99');
  await send({stage:'fallback',source:'gitee',downloaded:0,total:null});
  assert.equal(await bar.getAttribute('value'),null);
  assert.match(await page.locator('.update-source').innerText(),/已切换至 Gitee/);
  await send({stage:'downloading',source:'gitee',downloaded:2048,total:null});
  assert.equal(await bar.getAttribute('value'),null);
  assert.match(await page.locator('.update-bytes').innerText(),/2.0 KB.*总大小未知/);
  await page.evaluate(()=>fail(Error('checksum failed')));
  await page.locator('.update-download').filter({hasText:'重试下载'}).waitFor();
  assert.notEqual(await bar.getAttribute('value'),'100');
  assert.equal(await page.locator('.update-dismiss').isEnabled(),true);
  await page.locator('.update-download').click();
  await send({stage:'downloading',source:'gitee',downloaded:1024,total:4096});
  assert.equal(await bar.getAttribute('value'),'25');
  await page.evaluate(()=>finish({source:'gitee',bytes:4096}));
  await page.locator('.update-download').filter({hasText:'关闭程序并安装'}).waitFor();
  assert.equal(await bar.getAttribute('value'),'100');
  assert.match(await page.locator('.update-bytes').innerText(),/4.0 KB \/ 4.0 KB/);
  assert.equal(await page.evaluate(()=>calls.includes('install_app_update')),false);
  await page.locator('.update-download').click();
  assert.equal(await page.evaluate(()=>calls.includes('install_app_update')),true);
  await page.keyboard.press('Escape');
  await page.locator('#appUpdateDialog').waitFor({state:'detached'});
  assert.equal(await page.locator('#appUpdateDialog').count(),0);
  console.log('PASS real-byte percentages, unknown length, fallback reset, checksum failure/retry, 99% before verification, 100% only on success, explicit install');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

