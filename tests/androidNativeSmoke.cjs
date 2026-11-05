// Real APK/WebView/Activity smoke test on an explicitly selected emulator.
// Uses a local generated HLS fixture; never submits a BUG report or sends mail.
const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const assert=require('node:assert/strict');
const artifacts=path.resolve(__dirname,'../dist-android');
const sdk=process.env.ANDROID_HOME||path.join(process.env.LOCALAPPDATA,'Android','Sdk');
const adbPath=path.join(sdk,'platform-tools','adb.exe');
const device=process.env.ANDROID_TEST_DEVICE||'emulator-5554';
if(!device.startsWith('emulator-'))throw Error('This smoke test only accepts an emulator serial');
const adb=(args,binary=false)=>execFileSync(adbPath,['-s',device,...args],{encoding:binary?undefined:'utf8',maxBuffer:20*1024*1024,timeout:30000});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function dismissFullscreenGuide() {
 await wait(1500);
 const windows=adb(['shell','dumpsys','window']);
 if(!windows.includes('ImmersiveModeConfirmation'))return;
 adb(['shell','uiautomator','dump','/sdcard/kennysvideo-test-window.xml']);
 const xml=adb(['shell','cat','/sdcard/kennysvideo-test-window.xml']);
 const node=(xml.match(/<node\b[^>]*>/g)||[]).find(n=>/text="(?:Got it|知道了|明白了)"/.test(n));
 assert(node,'Expected the Android fullscreen education confirmation');
 const bounds=node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
 assert(bounds,'Confirmation button must have bounds');
 adb(['shell','input','tap',String(Math.round((Number(bounds[1])+Number(bounds[3]))/2)),String(Math.round((Number(bounds[2])+Number(bounds[4]))/2))]);
}
const server=http.createServer((req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');
 if(req.url==='/native-check'){res.setHeader('Content-Type','application/json');res.end('{"android_native_http":true}');return;}
 const name=(req.url||'').slice(1);
 if(!/^fixture(?:\d+\.ts|\.m3u8)$/.test(name)){res.statusCode=501;res.end('Not a fixture route');return;}
 const file=path.join(artifacts,name);
 if(!fs.existsSync(file)){res.statusCode=404;res.end();return;}
 res.setHeader('Content-Type',name.endsWith('.m3u8')?'application/vnd.apple.mpegurl':'video/mp2t');
 fs.createReadStream(file).pipe(res);
});
(async()=>{
 assert(fs.existsSync(path.join(artifacts,'fixture.m3u8')),'Generate the local HLS fixture first');
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 let browser,forwardPort;
 try {
  adb(['reverse',`tcp:${port}`,`tcp:${port}`]);
  const apk=process.argv[2];if(apk)adb(['install','-r',path.resolve(apk)]);
  adb(['shell','am','start','-n','com.libretv.app/.MainActivity']);
  let socket;
  for(let attempt=0;attempt<30;attempt++){
   let pid='';try{pid=adb(['shell','pidof','com.libretv.app']).trim().split(/\s+/)[0];}catch{}
   const sockets=adb(['shell','cat','/proc/net/unix']);
   if(pid&&sockets.includes('webview_devtools_remote_'+pid)){socket='webview_devtools_remote_'+pid;break;}
   await wait(1000);
  }
  assert(socket,'The debug WebView must expose a devtools socket');
  forwardPort=Number(adb(['forward','tcp:0','localabstract:'+socket]).trim());
  browser=await chromium.connectOverCDP(`http://127.0.0.1:${forwardPort}`);
  const page=browser.contexts()[0].pages().find(p=>p.url().includes('tauri.localhost'));
  assert(page,'Expected the native Tauri WebView');
  await dismissFullscreenGuide();
  if(new URL(page.url()).pathname.endsWith('player.html'))await page.goto(new URL('index.html',page.url()).href);
  await page.waitForFunction(()=>Boolean(window.__TAURI_INTERNALS__?.invoke&&window.handleAndroidBack));
  assert((await page.locator('#homeUsageNotice').textContent()).includes('请勿宣传本软件'));
  if(await page.locator('#acceptDisclaimerBtn').isVisible())await page.locator('#acceptDisclaimerBtn').click();
  const result=await page.evaluate(async url=>window.__TAURI_INTERNALS__.invoke('make_http_request',{options:{url,method:'GET',headers:{},timeout_secs:5}}),`http://127.0.0.1:${port}/native-check`);
  assert.equal(result.status,200);assert.equal(JSON.parse(result.body).android_native_http,true);
  assert.equal(await page.locator('#windowCloseSettings').isVisible(),false);
  await page.evaluate(()=>navigateToTab('settings'));
  assert.equal(await page.locator('#checkAppUpdateButton').isVisible(),true);
  adb(['shell','input','keyevent','4']);
  await page.waitForFunction(()=>getCurrentPageId()==='home');
  const url=`http://127.0.0.1:${port}/fixture.m3u8`;
  await page.evaluate(url=>{localStorage.setItem('currentEpisodes',JSON.stringify([url]));localStorage.setItem('currentVideoTitle','Android 本地播放测试');localStorage.setItem('currentEpisodeIndex','0');},url);
  await page.goto(new URL('player.html?'+new URLSearchParams({url,title:'Android 本地播放测试',index:'0'}),page.url()).href);
  assert((await page.locator('#playerAdNoticeMessage').textContent()).includes('请勿宣传本软件'));
  await page.locator('#playerAdNotice button').click();
  await page.waitForFunction(()=>document.querySelector('video')?.currentTime>0.5,{},{timeout:30000});
  const progress=await page.locator('video').evaluate(v=>({time:v.currentTime,readyState:v.readyState,width:v.videoWidth}));
  assert(progress.width>0&&progress.readyState>=2);
  await page.evaluate(()=>{
   const back=window.handleAndroidBack;window.__testBackCalls=0;window.__testBackEvent=false;
   window.handleAndroidBack=()=>{window.__testBackCalls++;return back();};
   document.addEventListener('kennysvideo-android-back',()=>window.__testBackEvent=true);
  });
  await page.evaluate(()=>dp.fullScreen.request());
  await page.waitForFunction(()=>innerWidth>innerHeight&&document.body.classList.contains('dplayer-custom-fullscreen-mode'));
  await dismissFullscreenGuide();
  const displaySize=adb(['shell','wm','size']).match(/(?:Override|Physical) size: (\d+)x(\d+)/);
  assert(displaySize,'Expected the emulator display dimensions');
  const expectedWidth=Math.max(Number(displaySize[1]),Number(displaySize[2]));
  await page.waitForFunction(width=>Math.abs(innerWidth*devicePixelRatio-width)<3,expectedWidth);
  const safeArea=await page.evaluate(()=>{
   const style=getComputedStyle(document.documentElement);
   const controls=document.querySelector('.dplayer-controller').getBoundingClientRect();
   return {left:parseFloat(style.getPropertyValue('--android-cutout-left'))||0,
    right:parseFloat(style.getPropertyValue('--android-cutout-right'))||0,
    controlsLeft:controls.left,controlsRight:innerWidth-controls.right};
  });
  if(process.env.ANDROID_TEST_REQUIRE_CUTOUT==='1')assert(safeArea.left+safeArea.right>0,'Cutout emulation must be active in landscape');
  assert(safeArea.controlsLeft>=safeArea.left+19,'Left controls must clear the cutout');
  assert(safeArea.controlsRight>=safeArea.right+19,'Right controls must clear the cutout');
  assert(Math.abs(safeArea.controlsLeft-safeArea.controlsRight)<1,'Fullscreen controls must be centered with symmetric safe margins');
  const videoCenter=await page.locator('video').evaluate(video=>{
   const rect=video.getBoundingClientRect();
   return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,width:innerWidth,height:innerHeight};
  });
  assert(Math.abs(videoCenter.x-videoCenter.width/2)<1&&Math.abs(videoCenter.y-videoCenter.height/2)<1,'Video must be centered on the full display');
  console.log('Fullscreen spans the entire physical display; control safe areas:',safeArea);
  fs.writeFileSync(path.join(artifacts,'android-native-fullscreen.png'),adb(['exec-out','screencap','-p'],true));
  const swipe = (x1,y1,x2,y2) => adb(['shell','input','swipe',String(Math.round(x1)),String(Math.round(y1)),String(Math.round(x2)),String(Math.round(y2)),'250']);
  const physical=await page.evaluate(()=>({w:innerWidth*devicePixelRatio,h:innerHeight*devicePixelRatio}));
  await page.evaluate(()=>{dp.pause();dp.seek(5);});
  swipe(physical.w*.4,physical.h*.4,physical.w*.5,physical.h*.4);
  await page.waitForFunction(()=>document.querySelector('video').currentTime>10);
  assert(await page.locator('video').evaluate(video=>video.paused),'seek swipe must not toggle playback');
  await page.evaluate(()=>__TAURI_INTERNALS__.invoke('set_player_control',{control:'brightness',value:.5}));
  swipe(physical.w*.25,physical.h*.55,physical.w*.25,physical.h*.3);
  const brighter=await page.evaluate(()=>__TAURI_INTERNALS__.invoke('get_player_controls'));
  assert(brighter.brightness>.6,'left upward swipe must change native window brightness');
  await page.evaluate(()=>__TAURI_INTERNALS__.invoke('set_player_control',{control:'volume',value:.4}));
  swipe(physical.w*.75,physical.h*.55,physical.w*.75,physical.h*.3);
  const louder=await page.evaluate(()=>__TAURI_INTERNALS__.invoke('get_player_controls'));
  assert(louder.volume>.5,'right upward swipe must change native media stream volume');
  assert.equal(await page.locator('video').evaluate(video=>video.playbackRate),1,'swiping must not leave long-press speed active');
  console.log('PASS real emulator touch swipes: seek committed without play toggle; native brightness:',brighter.brightness,'native media volume:',louder.volume);
  adb(['shell','input','keyevent','4']);
  await wait(1200);
  if(await page.evaluate(()=>document.body.classList.contains('dplayer-custom-fullscreen-mode')))console.log('Back diagnostic:',await page.evaluate(()=>({calls:window.__testBackCalls,event:window.__testBackEvent,dialogs:document.querySelectorAll('dialog[open]').length,fullscreen:dp.fullScreen.isFullScreen()})));
  await page.waitForFunction(()=>!document.body.classList.contains('dplayer-custom-fullscreen-mode'));
  adb(['shell','input','keyevent','4']);
  await page.waitForURL(url=>url.pathname==='/'||url.pathname.endsWith('/index.html'));
  await page.waitForFunction(()=>Boolean(window.handleAndroidBack));
  if(await page.locator('#acceptDisclaimerBtn').isVisible())await page.locator('#acceptDisclaimerBtn').click();
  fs.writeFileSync(path.join(artifacts,'android-native-home.png'),adb(['exec-out','screencap','-p'],true));
  await page.evaluate(()=>{
   window.__nativeExport='pending';
   window.__TAURI_INTERNALS__.invoke('export_config_file',{content:'{"local_test":true}',filename:'KennysVideo-Android-Test.json'})
    .then(value=>window.__nativeExport=value).catch(error=>window.__nativeExport={error:String(error)});
  });
  await wait(1000);
  const exportActivity=adb(['shell','dumpsys','activity','activities']);
  assert(/(?:topResumedActivity=|mResumedActivity:).*documentsui/i.test(exportActivity),'export must open the Android document picker');
  fs.writeFileSync(path.join(artifacts,'android-native-export-picker.png'),adb(['exec-out','screencap','-p'],true));
  for(let attempt=0;attempt<3&&await page.evaluate(()=>window.__nativeExport==='pending');attempt++){
   adb(['shell','input','keyevent','4']);await wait(500);
  }
  await page.waitForFunction(()=>window.__nativeExport!=='pending');
  assert.equal(await page.evaluate(()=>window.__nativeExport),false,'canceling export must resolve without an error');
  adb(['shell','input','keyevent','4']);
  await wait(700);
  const activity=adb(['shell','dumpsys','activity','activities']);
  assert(!/(?:topResumedActivity=|mResumedActivity:).*com\.libretv\.app/.test(activity),'home Back should background the task');
  console.log('PASS real Android APK: native HTTP, home/settings and system back, no desktop updater/tray UI, actual HLS playback ('+progress.width+'px), landscape fullscreen, back exits fullscreen, native export picker/cancel, home backgrounds task. No real mail sent.');
 }finally{
  if(browser)await browser.close();
  if(forwardPort)try{adb(['forward','--remove',`tcp:${forwardPort}`]);}catch{}
  try{adb(['reverse','--remove',`tcp:${port}`]);}catch{}
  server.close();
 }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
