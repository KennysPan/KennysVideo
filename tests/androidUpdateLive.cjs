// Read-only live check of the updater running inside the installed emulator APK.
const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const adbPath=path.join(process.env.LOCALAPPDATA,'Android/Sdk/platform-tools/adb.exe');
const adb=args=>execFileSync(adbPath,['-s','emulator-5554',...args],{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
(async()=>{
 let browser,port;
 try {
  adb(['shell','am','start','-n','com.libretv.app/.MainActivity']);
  const pid=adb(['shell','pidof','com.libretv.app']).trim().split(/\s+/)[0];
  port=Number(adb(['forward','tcp:0','localabstract:webview_devtools_remote_'+pid]).trim());
  browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);
  const page=browser.contexts()[0].pages().find(p=>p.url().includes('tauri.localhost'));
  assert(page,'Expected the native WebView');
  if(new URL(page.url()).pathname.endsWith('player.html'))await page.goto(new URL('index.html',page.url()).href);
  await page.waitForFunction(()=>Boolean(window.__TAURI_INTERNALS__?.invoke));
  const status=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('check_app_update',{startup:false}));
  console.log(JSON.stringify(status));
  const expected=process.env.ANDROID_EXPECTED_VERSION||'1.1.20';
  assert.equal(status.current_version,expected);
  assert.equal(status.latest_version,expected);
  assert.equal(status.available,false);
  assert.match(status.sha256,/^[a-f0-9]{64}$/);
  fs.writeFileSync(path.join(__dirname,'../dist-android/android-live-update-check.json'),JSON.stringify(status,null,2)+'\n');
  console.log('PASS live Android update check: native command registered, installed version is correct, published metadata and SHA-256 accepted, no false update for same version.');
 }finally{
  if(browser)await browser.close();
  if(port)try{adb(['forward','--remove','tcp:'+port]);}catch{}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
