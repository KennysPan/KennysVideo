// Visual and layout checks use a local bridge stub; no downloads or installers run.
const {chromium}=require('playwright');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const mobile of [false,true]){
   const page=await browser.newPage({viewport:mobile?{width:390,height:760}:{width:1040,height:900}});
   await page.route('**/image/kennys-logo.png',r=>r.fulfill({path:path.join(__dirname,'../public/image/kennys-logo.png'),contentType:'image/png'}));
   await page.setContent('<base href="http://localhost/"><body style="font-family:Segoe UI,Microsoft YaHei,sans-serif;background:#0f1622;color:#c6dae6;margin:0;padding:36px"><h1 style="color:#31c4d2">KennysVideo</h1><p>设置 / 软件更新</p><p id="appUpdateStatus"></p><button id="checkAppUpdateButton">检查更新</button></body>');
   for(const css of ['styles.css','settings.css'])await page.addStyleTag({path:path.join(__dirname,'../public/css',css)});
   await page.addScriptTag({path:path.join(__dirname,'../public/js/app_updates.js')});
   await page.evaluate(mobile=>{
    window.KENNYS_PLATFORM=mobile?'android':'windows';window.calls=[];
    const notes=[
     '- **重新设计更新弹窗**，顶部显示应用头像、目标版本与当前版本，右上角可关闭。',
     '- **更新日志独立滚动**，查看较长的说明时，版本信息与操作按钮保持可见。',
     '- **转到后台下载**，关闭弹窗后继续下载，可从进度提示或设置页重新打开。',
     '- 下载时显示实际已下载大小、总大小、百分比及当前下载来源。',
     '- 下载失败或过慢时自动切换来源，重新下载并校验安装包。',
     '- 下载完成后显示校验结果，可选择稍后安装或立即安装更新。',
     '- 电脑与手机分别展示对应平台的更新说明，覆盖更新保留设置和历史。',
     '- 手机端使用紧凑布局，长日志可上下滑动，底部按钮不会被挤出屏幕。',
     '- **安装由用户确认**，下载结束后不会自动关闭软件或启动安装器。'
    ].join('\n');
    window.__TAURI_INTERNALS__={invoke:async cmd=>{calls.push(cmd);if(cmd==='download_app_update')return new Promise(r=>window.finish=r);}};
    showAppUpdate({current_version:'1.1.20',latest_version:'1.1.21',source:'github',release_notes:notes},__TAURI_INTERNALS__.invoke);
   },mobile);
   await page.locator('.update-app-logo').evaluate(img=>img.decode());
   const name=mobile?'mobile':'desktop';
   await page.locator('#appUpdateDialog').screenshot({path:path.join(__dirname,`../dist-windows/update-dialog-${name}-available.png`)});
   await page.locator('.update-download').click();
   await page.evaluate(()=>window.dispatchEvent(new CustomEvent('app-update-progress',{detail:{stage:'downloading',source:'github',downloaded:3177185,total:15000000}})));
   const headerBefore=await page.locator('.update-dialog-header').boundingBox();
   const footerBefore=await page.locator('.update-dialog-footer').boundingBox();
   await page.locator('.update-release-notes').evaluate(el=>el.scrollTop=el.scrollHeight);
   const headerAfter=await page.locator('.update-dialog-header').boundingBox();
   const footerAfter=await page.locator('.update-dialog-footer').boundingBox();
   assert.equal(headerBefore.y,headerAfter.y);assert.equal(footerBefore.y,footerAfter.y);
   await page.locator('#appUpdateDialog').screenshot({path:path.join(__dirname,`../dist-windows/update-dialog-${name}-downloading.png`)});
   await page.locator('.update-background').click();
   await page.locator('.update-background-status').waitFor({state:'visible'});
   await page.evaluate(()=>checkAppUpdate(false));
   assert.equal(await page.locator('#appUpdateDialog').isVisible(),true);
   assert.equal(await page.evaluate(()=>calls.filter(c=>c==='download_app_update').length),1);
   await page.evaluate(()=>finish({source:'github',bytes:15000000}));
   await page.locator('.update-ready').waitFor({state:'visible'});
   assert.match(await page.locator('.update-download').evaluate(el=>getComputedStyle(el).backgroundImage),/linear-gradient/,'primary install action must retain its high-contrast fill');
   await page.waitForFunction(()=>calls.includes('install_app_update'));
   await page.locator('#appUpdateDialog').screenshot({path:path.join(__dirname,`../dist-windows/update-dialog-${name}-ready.png`)});
   for(const viewport of [{width:320,height:500},{width:740,height:360}]){
    await page.setViewportSize(viewport);
    const bounds=await page.locator('#appUpdateDialog').boundingBox();
    const footer=await page.locator('.update-dialog-footer').boundingBox();
    assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=viewport.width+.5&&bounds.y+bounds.height<=viewport.height+.5);
    assert(footer.y+footer.height<=viewport.height,JSON.stringify({viewport,footer,bounds}));
   }
   console.log('PASS '+name+': scrollable notes, pinned header/actions, background resume, automatic install, narrow and short layouts');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
