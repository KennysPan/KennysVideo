const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../public');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/135.0 Mobile Safari/537.36',hasTouch:true});
  await page.route('https://tauri.localhost/**',route=>route.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));
  await page.goto('https://tauri.localhost/index.html');
  await page.setContent(fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''));
  await page.addStyleTag({path:path.join(root,'css/styles.css')});
  await page.addStyleTag({path:path.join(root,'css/mobile.css')});
  await page.addScriptTag({path:path.join(root,'libs/tailwindcss.min.js')});
  await page.evaluate(()=>{
   window.calls=[];window.__TAURI_INTERNALS__={invoke:async(command,args)=>{calls.push({command,args});
    if(command==='check_app_update')return {current_version:'1.1.18',latest_version:'1.1.18',available:false,source:'github'};
    return true;}};
   window.currentPage='home';window.getCurrentPageId=()=>currentPage;
   window.navigateToTab=id=>{currentPage=id;document.querySelectorAll('.page-content').forEach(p=>p.classList.toggle('hidden',p.id!=='page-'+id));};navigateToTab('home');
  });
  await page.addScriptTag({path:path.join(root,'js/mobile.js')});
  await page.addScriptTag({path:path.join(root,'js/app_updates.js')});
  await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
  assert.equal(await page.locator('html').getAttribute('class'),'android-app');
  assert.equal(await page.evaluate(()=>document.querySelector('#checkAppUpdateButton').hidden),false);
  assert.equal(await page.evaluate(()=>calls.some(c=>c.command==='check_app_update'&&c.args.startup)),true);
  assert.equal(await page.evaluate(()=>handleAndroidBack()),false);
  await page.evaluate(()=>navigateToTab('settings'));
  assert.equal(await page.evaluate(()=>handleAndroidBack()),true);
  assert.equal(await page.evaluate(()=>currentPage),'home');
  await page.evaluate(()=>showAppUpdate({current_version:'1.1.18',latest_version:'1.1.19',source:'github'},async command=>{
   calls.push({command});
   if(command==='download_app_update'){
    window.dispatchEvent(new CustomEvent('app-update-progress',{detail:{stage:'downloading',source:'github',downloaded:5,total:10}}));
    return {source:'github',bytes:10};
   }
   if(command==='install_app_update')throw Error('请允许安装更新');
  }));
  await page.locator('.update-download').click();
  assert.equal(await page.locator('.update-download').textContent(),'安装更新');
  assert.equal(await page.locator('.update-percent').textContent(),'100%');
  await page.locator('.update-download').click();
  assert((await page.locator('.update-error').textContent()).includes('请允许安装更新'));
  await page.locator('.update-dismiss').click();
  await page.evaluate(()=>{const d=document.createElement('dialog');d.id='testDialog';d.addEventListener('cancel',e=>e.preventDefault());document.body.append(d);d.showModal();});
  assert.equal(await page.evaluate(()=>handleAndroidBack()),true);
  assert.equal(await page.locator('#testDialog').evaluate(d=>d.open),true);
  await page.locator('#testDialog').evaluate(d=>d.remove());
  await page.evaluate(()=>{document.getElementById('modal').classList.remove('hidden');});
  assert.equal(await page.evaluate(()=>handleAndroidBack()),true);
  assert.equal(await page.locator('#modal').isVisible(),false);
  await page.addScriptTag({path:path.join(root,'js/config_io.js')});
  await page.evaluate(()=>saveStringAsFile('{"test":true}','KennysVideo-Settings.json'));
  assert.equal(await page.evaluate(()=>calls.at(-1).command),'export_config_file');
  assert.equal(await page.evaluate(()=>calls.at(-1).args.content),'{"test":true}');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'home must fit a phone viewport');
  await page.screenshot({path:path.join(__dirname,'../dist-android/android-home-layout.png'),fullPage:true});
  await page.goto('https://tauri.localhost/player.html');
  await page.setContent('<body><button id="goBack">返回</button></body>');
  await page.addScriptTag({path:path.join(root,'js/mobile.js')});
  await page.addScriptTag({path:path.join(root,'js/player_fullscreen.js')});
  await page.evaluate(()=>{
   window.calls=[];window.__TAURI_INTERNALS__={invoke:async(command,args)=>calls.push({command,args})};
   window.events={};window.player={container:document.createElement('div'),resize(){},controller:{show(){}},fullScreen:{},events:{trigger(){}},on(name,fn){events[name]=fn;}};
   setupPlayerFullscreen(player);document.getElementById('goBack').onclick=()=>window.wentBack=true;
  });
  await page.evaluate(()=>player.fullScreen.request());
  assert.equal(await page.evaluate(()=>handleAndroidBack()),true);
  await page.waitForFunction(()=>!document.body.classList.contains('dplayer-custom-fullscreen-mode'));
  assert.equal(await page.evaluate(()=>calls.at(-1).args.fullscreen),false);
  assert.equal(await page.evaluate(()=>handleAndroidBack()),true);
  assert.equal(await page.evaluate(()=>wentBack),true);
  console.log('PASS Android frontend: phone layout, startup update check, download progress/installation and permission retry, back hierarchy/modal protection, native config export, fullscreen back and player return');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
