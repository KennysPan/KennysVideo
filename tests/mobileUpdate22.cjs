const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
const assert=require('assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const width of [320,390,1000]){
   const page=await browser.newPage({viewport:{width,height:760}});
   await page.route('http://release.test/**',route=>{
    if(route.request().url().endsWith('image/kennys-logo.png')) return route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(__dirname,'../public/image/kennys-logo.png'))});
    return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')});
   });
   await page.goto('http://release.test/');
   await page.evaluate(()=>localStorage.setItem('doubanApiMode','false'));
   await page.addScriptTag({path:path.join(__dirname,'../public/js/app_init.js')});
   assert.equal(await page.evaluate(()=>localStorage.getItem('doubanApiMode')),'true');
   await page.evaluate(()=>localStorage.setItem('doubanApiMode','false'));
   await page.addScriptTag({path:path.join(__dirname,'../public/js/app_init.js')});
   assert.equal(await page.evaluate(()=>localStorage.getItem('doubanApiMode')),'false');
   for(const css of ['styles.css','settings.css']) await page.addStyleTag({path:path.join(__dirname,'../public/css',css)});
   await page.addScriptTag({path:path.join(__dirname,'../public/js/app_updates.js')});
   await page.addScriptTag({path:path.join(__dirname,'../public/js/startup_disclaimer.js')});
   await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
   await page.locator('#acceptDisclaimerBtn').waitFor({state:'visible'});
   const notice=await page.locator('.startup-notice-card').boundingBox();
   const accept=await page.locator('#acceptDisclaimerBtn').boundingBox();
   assert(notice.x>=0&&notice.y>=0&&accept.y+accept.height<=760,JSON.stringify({width,notice,accept}));
   if(width===390) await page.screenshot({path:path.join(__dirname,'../dist-windows/startup-notice-22-mobile.png')});
   await page.locator('#acceptDisclaimerBtn').click();
   await page.evaluate(()=>{
    window.KENNYS_PLATFORM='android'; window.calls=[];
    showAppUpdate({current_version:'1.1.21',latest_version:'1.1.22',source:'gitee',release_notes:'- 手机弹窗与自动安装优化\n'.repeat(15)},async cmd=>{
     calls.push(cmd);
     if(cmd==='download_app_update') return new Promise(r=>window.completeDownload=r);
     if(cmd==='install_app_update') throw Error('test installer unavailable');
    });
   });
   assert.equal(await page.evaluate(()=>document.body.style.position),'fixed');
   await page.locator('.update-download').click();
   await page.locator('.update-background').click();
   await page.waitForFunction(()=>document.body.style.position!=='fixed');
   await page.locator('.update-background-status').click();
   await page.waitForFunction(()=>document.body.style.position==='fixed');
   await page.evaluate(()=>completeDownload({source:'gitee',bytes:4096}));
   await page.waitForFunction(()=>calls.includes('install_app_update'));
   await page.waitForFunction(()=>!document.querySelector('.update-download').disabled);
   const buttons=await page.locator('.update-dialog-footer button:visible').all();
   assert.equal(buttons.length,3);
   const bounds=await Promise.all(buttons.map(b=>b.boundingBox()));
   assert(Math.max(...bounds.map(b=>b.y))-Math.min(...bounds.map(b=>b.y))<1,'three actions in one row');
   assert(bounds.every(b=>b.x>=0&&b.x+b.width<=width));
   assert.match(await page.locator('.update-error').innerText(),/未启动安装/);
   if(width===390) await page.screenshot({path:path.join(__dirname,'../dist-windows/update-ready-22-mobile.png')});
   await page.locator('.update-dismiss').click();
   await page.waitForFunction(()=>document.body.style.position!=='fixed');
   await page.close();
  }
  console.log('PASS mobile startup layout, background scroll locking/unlocking, three inline actions, verified-download auto-install and retry');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
