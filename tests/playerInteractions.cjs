const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1000,height:600},hasTouch:true});
  await page.setContent('<div id="playerContainer"><div id="player" style="position:relative;width:1000px;height:500px"><div class="dplayer-video-wrap" style="width:100%;height:100%"><video></video></div><div class="dplayer-controller"><button>播放</button></div></div></div><input id="search"><textarea></textarea>');
  await page.addScriptTag({path:path.join(__dirname,'../public/js/player_interactions.js')});
  await page.evaluate(()=>{
   window.KENNYS_PLATFORM='desktop'; window.calls=[];
   const video=document.querySelector('video');Object.defineProperty(video,'duration',{value:120,configurable:true});video.currentTime=20;video.volume=.5;
   window.player={container:document.querySelector('#player'),video,on(name,fn){this[name]=fn;},seek(value){calls.push(['seek',value]);video.currentTime=value;},volume(value){calls.push(['volume',value]);video.volume=value;video.muted=false;},toggle(){calls.push(['toggle']);}};
   setupPlayerInteractions(player);
  });
  await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>player.video.currentTime),25);
  await page.keyboard.press('ArrowLeft');assert.equal(await page.evaluate(()=>player.video.currentTime),20);
  await page.keyboard.press('ArrowUp');assert(Math.abs(await page.evaluate(()=>player.video.volume)-.55)<.001);
  await page.keyboard.press('ArrowDown');assert(Math.abs(await page.evaluate(()=>player.video.volume)-.5)<.001);
  await page.locator('input').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>player.video.currentTime),20);
  await page.locator('input').evaluate(e=>e.blur());
  await page.evaluate(()=>document.querySelector('#playerContainer').classList.add('controls-locked'));
  await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>player.video.currentTime),20);
  await page.evaluate(()=>{document.querySelector('#playerContainer').classList.remove('controls-locked');player.destroy();window.KENNYS_PLATFORM='android';window.settings={brightness:.5,volume:.5,volume_fixed:false};window.__TAURI_INTERNALS__={invoke:async(command,args)=>{calls.push([command,args]);if(command==='get_player_controls')return {...settings};settings[args.control]=args.value;return {value:args.value};}};window.calls=[];setupPlayerInteractions(player);});
  await page.evaluate(()=>{
   window.touch=(type,x,y,count=1,target=document.querySelector('.dplayer-video-wrap'))=>{
    const point=new Touch({identifier:1,target,clientX:x,clientY:y});
    const touches=type==='touchend'||type==='touchcancel'?[]:count===2?[point,new Touch({identifier:2,target,clientX:x+10,clientY:y})]:[point];
    target.dispatchEvent(new TouchEvent(type,{touches,changedTouches:[point],bubbles:true,cancelable:true}));
   };
   touch('touchstart',400,200);
  });
  await page.evaluate(()=>{touch('touchmove',500,200);touch('touchend',500,200);});
  assert(Math.abs(await page.evaluate(()=>player.video.currentTime)-32)<.1,'horizontal swipe commits a seek');
  await page.evaluate(()=>touch('touchstart',200,250));await page.waitForTimeout(20);
  await page.evaluate(()=>{touch('touchmove',200,150);touch('touchend',200,150);});
  await page.waitForFunction(()=>settings.brightness>.5);assert(await page.evaluate(()=>settings.volume===.5));
  await page.evaluate(()=>touch('touchstart',800,250));await page.waitForTimeout(20);
  await page.evaluate(()=>{touch('touchmove',800,350);touch('touchend',800,350);});
  await page.waitForFunction(()=>settings.volume<.5);
  const before=await page.evaluate(()=>player.video.currentTime);
  await page.evaluate(()=>{touch('touchstart',400,200);touch('touchmove',500,200);touch('touchcancel',500,200);});
  assert.equal(await page.evaluate(()=>player.video.currentTime),before,'cancel must not seek');
  await page.evaluate(()=>{touch('touchstart',400,200);touch('touchmove',500,200,2);touch('touchend',500,200);});
  assert.equal(await page.evaluate(()=>player.video.currentTime),before,'multitouch must not seek');
  await page.evaluate(()=>{const b=document.querySelector('button');touch('touchstart',400,200,1,b);touch('touchmove',500,200,1,b);touch('touchend',500,200,1,b);});
  assert.equal(await page.evaluate(()=>player.video.currentTime),before,'buttons must retain their own touch handling');
  console.log('PASS player inputs: desktop arrows/volume, editable and lock protection; Android seek preview/commit, brightness/volume separation, cancel, multitouch and buttons.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
